# s3_utils.py - Helper functions for S3 operations
# Provides upload, download, list, and delete operations for the documents bucket

# Import boto3 AWS SDK for Python
import boto3
# Import base64 for encoding/decoding file content
import base64
# Import our configuration for bucket name and categories
from shared.config import DOCUMENTS_BUCKET, CATEGORIES, get_s3_prefix_for_category

# Create a reusable S3 client (created once, reused across Lambda invocations)
s3_client = boto3.client('s3')

# ============================================================================
# FILE OPERATIONS
# ============================================================================


def upload_file(file_bytes: bytes, category_id: str, filename: str) -> dict:
    """Upload a file to S3 under the appropriate category prefix.

    Args:
        file_bytes: Raw bytes of the file to upload
        category_id: Category ID determining the S3 prefix folder
        filename: Original filename to use as the S3 object key

    Returns:
        Dictionary with upload details: s3_key, bucket, category
    """
    # Get the S3 prefix (folder path) for the specified category
    prefix = get_s3_prefix_for_category(category_id)
    # Construct the full S3 object key: category-prefix/filename
    s3_key = f'{prefix}{filename}'
    # Upload the file bytes to S3 with the constructed key
    s3_client.put_object(
        # Target bucket name
        Bucket=DOCUMENTS_BUCKET,
        # Full path within the bucket
        Key=s3_key,
        # Raw file content
        Body=file_bytes,
    )
    # Return metadata about the uploaded file
    return {
        's3_key': s3_key,
        'bucket': DOCUMENTS_BUCKET,
        'category': category_id,
        'filename': filename,
    }


def upload_base64_file(base64_content: str, category_id: str, filename: str) -> dict:
    """Upload a base64-encoded file to S3.

    Convenience wrapper that decodes base64 before uploading.

    Args:
        base64_content: Base64-encoded file content from the frontend
        category_id: Category ID determining the S3 prefix folder
        filename: Original filename

    Returns:
        Dictionary with upload details
    """
    # Decode the base64 string into raw file bytes
    file_bytes = base64.b64decode(base64_content)
    # Upload the decoded bytes using the standard upload function
    return upload_file(file_bytes, category_id, filename)


def download_file(s3_key: str) -> bytes:
    """Download a file from S3 and return its contents as bytes.

    Args:
        s3_key: The full S3 object key (e.g., 'tech-approach/report.pdf')

    Returns:
        Raw file bytes
    """
    # Fetch the object from S3
    response = s3_client.get_object(
        # Source bucket
        Bucket=DOCUMENTS_BUCKET,
        # Object key to download
        Key=s3_key,
    )
    # Read and return the file body as bytes
    return response['Body'].read()


def list_files(category_id: str = None) -> list:
    """List files in S3, optionally filtered by category.

    Args:
        category_id: If provided, only list files under this category's prefix.
                     If None, list all files across all categories.

    Returns:
        List of dictionaries with file metadata: key, filename, size, last_modified, category
    """
    # Initialize an empty list to collect file entries
    files = []

    if category_id:
        # List files under a specific category prefix
        prefix = get_s3_prefix_for_category(category_id)
        # Call S3 list_objects_v2 with the category prefix filter
        response = s3_client.list_objects_v2(
            Bucket=DOCUMENTS_BUCKET,
            Prefix=prefix,
        )
        # Process each object in the response (if any exist)
        for obj in response.get('Contents', []):
            # Skip the prefix-only entries (folder markers)
            if obj['Key'] == prefix:
                continue
            # Extract the filename from the full S3 key (remove prefix)
            filename = obj['Key'].replace(prefix, '')
            # Skip empty filenames (shouldn't happen but safety check)
            if not filename:
                continue
            # Add the file entry to our results list
            files.append({
                'key': obj['Key'],
                'filename': filename,
                'size': obj['Size'],
                'lastModified': obj['LastModified'].isoformat(),
                'category': category_id,
            })
    else:
        # List files across all categories by iterating each category
        for category in CATEGORIES:
            # Get the S3 prefix for this category
            prefix = category['s3Prefix']
            # Call S3 list_objects_v2 for this category prefix
            response = s3_client.list_objects_v2(
                Bucket=DOCUMENTS_BUCKET,
                Prefix=prefix,
            )
            # Process each object returned for this category
            for obj in response.get('Contents', []):
                # Skip folder marker entries
                if obj['Key'] == prefix:
                    continue
                # Extract filename by removing the category prefix
                filename = obj['Key'].replace(prefix, '')
                # Skip empty filenames
                if not filename:
                    continue
                # Add the file entry with its category ID
                files.append({
                    'key': obj['Key'],
                    'filename': filename,
                    'size': obj['Size'],
                    'lastModified': obj['LastModified'].isoformat(),
                    'category': category['id'],
                })

    # Return the complete list of file entries
    return files


def delete_file(s3_key: str) -> dict:
    """Delete a file from S3.

    Args:
        s3_key: The full S3 object key to delete

    Returns:
        Dictionary confirming the deletion
    """
    # Call S3 delete_object to remove the file
    s3_client.delete_object(
        Bucket=DOCUMENTS_BUCKET,
        Key=s3_key,
    )
    # Return confirmation of the deletion
    return {
        'deleted': True,
        'key': s3_key,
    }


def generate_presigned_upload_url(category_id: str, filename: str, expiration: int = 3600) -> dict:
    """Generate a pre-signed URL for direct S3 upload from the frontend.

    This allows the frontend to upload files directly to S3 without going
    through the Lambda function, which is useful for large files.

    Args:
        category_id: Category ID determining the S3 prefix
        filename: Filename to use as the object key
        expiration: URL expiration time in seconds (default 1 hour)

    Returns:
        Dictionary with the pre-signed URL and S3 key
    """
    # Get the S3 prefix for the specified category
    prefix = get_s3_prefix_for_category(category_id)
    # Construct the full S3 key
    s3_key = f'{prefix}{filename}'
    # Generate the pre-signed URL for PUT operations
    url = s3_client.generate_presigned_url(
        # The S3 operation to authorize
        ClientMethod='put_object',
        # Parameters for the operation
        Params={
            'Bucket': DOCUMENTS_BUCKET,
            'Key': s3_key,
        },
        # How long the URL remains valid
        ExpiresIn=expiration,
    )
    # Return the URL and key
    return {
        'uploadUrl': url,
        's3Key': s3_key,
    }
