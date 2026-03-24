# files.py - Lambda handler for GET /api/files and DELETE /api/files
# Lists files in S3 by category and supports file deletion

# Import json for response serialization
import json
# Import traceback for detailed error logging
import traceback
# Import S3 utility functions for listing and deleting files
from shared.s3_utils import list_files, delete_file


def handler(event, context):
    """Handle GET /api/files and DELETE /api/files requests.

    GET: Returns a list of files in S3, optionally filtered by category.
         Query parameter 'category' filters results to a specific category.

    DELETE: Removes a file from S3.
            Query parameter 'key' specifies the S3 object key to delete.

    Args:
        event: API Gateway HTTP API event containing request method and parameters
        context: Lambda execution context

    Returns:
        API Gateway response with file list (GET) or deletion confirmation (DELETE)
    """
    # Define standard CORS headers used in all responses
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    }

    try:
        # Extract the HTTP method from the request context
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
        # Extract query string parameters (may be None if no params provided)
        query_params = event.get('queryStringParameters') or {}

        if http_method == 'GET':
            # Extract the optional category filter from query parameters
            category_id = query_params.get('category', None)
            # Call S3 utility to list files, optionally filtered by category
            files = list_files(category_id)
            # Return the file list as a successful response
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    # List of file metadata objects
                    'files': files,
                    # Total count of files returned
                    'count': len(files),
                    # The category filter that was applied (None if all categories)
                    'category': category_id,
                }),
            }

        elif http_method == 'DELETE':
            # Extract the S3 key of the file to delete from query parameters
            s3_key = query_params.get('key', '')
            # Validate that an S3 key was provided
            if not s3_key:
                # Return a 400 error if no key was specified
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({
                        'error': 'Missing required query parameter: key',
                    }),
                }
            # Call S3 utility to delete the specified file
            result = delete_file(s3_key)
            # Return the deletion confirmation
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result),
            }

        else:
            # Return 405 Method Not Allowed for unsupported HTTP methods
            return {
                'statusCode': 405,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'Method {http_method} not allowed',
                }),
            }

    except Exception as e:
        # Log the full error traceback for debugging in CloudWatch
        print(f'Error in files handler: {traceback.format_exc()}')
        # Return a 500 Internal Server Error response
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }
