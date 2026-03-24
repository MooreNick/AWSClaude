# s3_utils.py - Helper functions for S3 operations
# Provides upload, download, list, and delete operations for the documents bucket

# Import boto3 AWS SDK
import boto3
# Import base64 for encoding/decoding file content
import base64
# Import binascii for handling base64 decode errors
import binascii
# Import logging for error reporting
import logging
# Import our configuration for bucket name and categories
from shared.config import DOCUMENTS_BUCKET, CATEGORIES, get_s3_prefix_for_category

# Create a logger for this module
logger = logging.getLogger(__name__)

# Create a reusable S3 client (reused across Lambda invocations)
s3_client = boto3.client('s3')


def upload_file(file_bytes: bytes, category_id: str, filename: str) -> dict:
    """Upload a file to S3 under the appropriate category prefix.

    Args:
        file_bytes: Raw bytes of the file to upload
        category_id: Category ID determining the S3 prefix folder
        filename: Original filename to use as the S3 object key

    Returns:
        Dictionary with upload details: s3_key, bucket, category
    """
    # Sanitize filename to prevent path traversal
    safe_filename = filename.replace('..', '').replace('/', '').replace('\\', '')
    # Get the S3 prefix for the specified category
    prefix = get_s3_prefix_for_category(category_id)
    # Construct the full S3 object key
    s3_key = f'{prefix}{safe_filename}'
    # Upload the file bytes to S3
    s3_client.put_object(
        Bucket=DOCUMENTS_BUCKET,
        Key=s3_key,
        Body=file_bytes,
    )
    return {
        's3_key': s3_key,
        'bucket': DOCUMENTS_BUCKET,
        'category': category_id,
        'filename': safe_filename,
    }


def upload_base64_file(base64_content: str, category_id: str, filename: str) -> dict:
    """Upload a base64-encoded file to S3.

    Args:
        base64_content: Base64-encoded file content from the frontend
        category_id: Category ID determining the S3 prefix folder
        filename: Original filename

    Returns:
        Dictionary with upload details

    Raises:
        ValueError: If base64 content is malformed
    """
    try:
        # Decode the base64 string into raw file bytes
        file_bytes = base64.b64decode(base64_content)
    except (binascii.Error, ValueError) as e:
        raise ValueError(f'Invalid base64 file content: {e}')
    # Upload the decoded bytes
    return upload_file(file_bytes, category_id, filename)


def download_file(s3_key: str) -> bytes:
    """Download a file from S3 and return its contents as bytes."""
    response = s3_client.get_object(
        Bucket=DOCUMENTS_BUCKET,
        Key=s3_key,
    )
    return response['Body'].read()


def list_files(category_id: str = None) -> list:
    """List files in S3, optionally filtered by category.

    Uses pagination to handle buckets with >1000 files.

    Args:
        category_id: If provided, only list files under this category's prefix.

    Returns:
        List of dictionaries with file metadata: key, filename, size, last_modified, category
    """
    files = []

    if category_id:
        # List files under a specific category prefix
        prefix = get_s3_prefix_for_category(category_id)
        files.extend(_list_files_with_prefix(prefix, category_id))
    else:
        # List files across all categories
        for category in CATEGORIES:
            prefix = category['s3Prefix']
            files.extend(_list_files_with_prefix(prefix, category['id']))

    return files


def _list_files_with_prefix(prefix: str, category_id: str) -> list:
    """List files under a specific S3 prefix with pagination support.

    Handles buckets with >1000 files by using the paginator.
    """
    files = []
    # Use the S3 paginator to handle >1000 results automatically
    paginator = s3_client.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(
        Bucket=DOCUMENTS_BUCKET,
        Prefix=prefix,
    )

    for page in page_iterator:
        for obj in page.get('Contents', []):
            # Skip folder marker entries
            if obj['Key'] == prefix:
                continue
            # Extract filename by removing the prefix
            filename = obj['Key'].replace(prefix, '')
            if not filename:
                continue
            files.append({
                'key': obj['Key'],
                'filename': filename,
                'size': obj['Size'],
                'lastModified': obj['LastModified'].isoformat(),
                'category': category_id,
            })

    return files


def delete_file(s3_key: str) -> dict:
    """Delete a file from S3."""
    s3_client.delete_object(
        Bucket=DOCUMENTS_BUCKET,
        Key=s3_key,
    )
    return {
        'deleted': True,
        'key': s3_key,
    }


def generate_presigned_upload_url(category_id: str, filename: str, expiration: int = 3600) -> dict:
    """Generate a pre-signed URL for direct S3 upload from the frontend."""
    # Sanitize filename
    safe_filename = filename.replace('..', '').replace('/', '').replace('\\', '')
    prefix = get_s3_prefix_for_category(category_id)
    s3_key = f'{prefix}{safe_filename}'
    url = s3_client.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': DOCUMENTS_BUCKET,
            'Key': s3_key,
        },
        ExpiresIn=expiration,
    )
    return {
        'uploadUrl': url,
        's3Key': s3_key,
    }
