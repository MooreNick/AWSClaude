# upload.py - Lambda handler for POST /api/upload
# Handles file uploads to S3 and triggers Knowledge Base ingestion sync

# Import json for request/response serialization
import json
# Import base64 for decoding file content from the frontend
import base64
# Import traceback for error logging
import traceback
# Import os for reading environment variables
import os
# Import S3 utility for file upload
from shared.s3_utils import upload_file
# Import KB utility for triggering ingestion sync
from shared.knowledge_base import start_ingestion_sync
# Import config for validation
from shared.config import SUPPORTED_EXTENSIONS, MAX_FILE_SIZE_BYTES, get_category_by_id


def handler(event, context):
    """Handle POST /api/upload requests.

    Accepts a file (base64-encoded) and a category, uploads the file
    to S3 under the appropriate category prefix, then triggers a
    Knowledge Base ingestion sync to index the new document.

    Expected request body (JSON):
    {
        "fileName": "report.pdf",
        "fileContent": "<base64-encoded file bytes>",
        "category": "tech-approach"
    }

    Args:
        event: API Gateway HTTP API event with the upload payload
        context: Lambda execution context

    Returns:
        API Gateway response with upload confirmation or error
    """
    # Define standard CORS headers for all responses
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }

    try:
        # Parse the request body from JSON string to dictionary
        body = json.loads(event.get('body', '{}'))

        # Extract the filename from the request
        filename = body.get('fileName', '')
        # Extract the base64-encoded file content
        file_content_b64 = body.get('fileContent', '')
        # Extract the target category ID
        category_id = body.get('category', '')

        # ====================================================================
        # VALIDATION - Check all required fields are present and valid
        # ====================================================================

        # Validate that all required fields are provided
        if not filename or not file_content_b64 or not category_id:
            # Return a 400 error listing which fields are missing
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Missing required fields: fileName, fileContent, category',
                }),
            }

        # Validate that the category exists in our configuration
        category = get_category_by_id(category_id)
        if not category:
            # Return a 400 error if the category is not recognized
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'Invalid category: {category_id}',
                }),
            }

        # Validate the file extension is supported
        file_ext = os.path.splitext(filename.lower())[1]
        if file_ext not in SUPPORTED_EXTENSIONS:
            # Return a 400 error listing the supported extensions
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'Unsupported file type: {file_ext}',
                    'supported': SUPPORTED_EXTENSIONS,
                }),
            }

        # ====================================================================
        # UPLOAD - Decode file and upload to S3
        # ====================================================================

        # Decode the base64 file content to raw bytes
        file_bytes = base64.b64decode(file_content_b64)

        # Check file size against the maximum allowed
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            # Return a 400 error if the file exceeds the size limit
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'File too large. Maximum size: {MAX_FILE_SIZE_BYTES // (1024*1024)} MB',
                }),
            }

        # Upload the file to S3 under the category prefix
        upload_result = upload_file(file_bytes, category_id, filename)

        # ====================================================================
        # KNOWLEDGE BASE SYNC - Trigger ingestion to index the new document
        # ====================================================================

        # Initialize sync status as not triggered
        sync_status = {'status': 'not_triggered'}
        # Read the data source ID from environment (set by CDK)
        data_source_id = os.environ.get('DATA_SOURCE_ID', '')
        # Only attempt sync if we have a data source ID configured
        if data_source_id:
            try:
                # Trigger the Knowledge Base ingestion sync
                sync_status = start_ingestion_sync(data_source_id)
            except Exception as sync_error:
                # Log sync errors but don't fail the upload
                print(f'Warning: KB sync failed: {sync_error}')
                # Set sync status to indicate the error
                sync_status = {'status': 'sync_error', 'message': str(sync_error)}

        # ====================================================================
        # RESPONSE - Return upload confirmation with sync status
        # ====================================================================

        # Return success response with upload details and sync status
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                # Confirmation message
                'message': f'File "{filename}" uploaded successfully to {category_id}',
                # Upload details (S3 key, bucket, category)
                'upload': upload_result,
                # Knowledge Base sync status
                'sync': sync_status,
            }),
        }

    except json.JSONDecodeError:
        # Handle malformed JSON in the request body
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Invalid JSON in request body',
            }),
        }

    except Exception as e:
        # Log the full error traceback for debugging
        print(f'Error in upload handler: {traceback.format_exc()}')
        # Return a 500 Internal Server Error
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }
