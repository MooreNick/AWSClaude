# knowledge_base.py - Wrapper for Amazon Bedrock Knowledge Base operations
# Provides RAG retrieval and ingestion sync functions

# Import boto3 AWS SDK
import boto3
# Import logging for error reporting
import logging
# Import our configuration for KB ID, region, and bucket name
from shared.config import KNOWLEDGE_BASE_ID, DATA_SOURCE_ID, AWS_BEDROCK_REGION, DOCUMENTS_BUCKET, CATEGORIES

# Create a logger for this module
logger = logging.getLogger(__name__)

# Create Bedrock Agent Runtime client for Knowledge Base retrieval
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime', region_name=AWS_BEDROCK_REGION)

# Create Bedrock Agent client for managing ingestion jobs
bedrock_agent = boto3.client('bedrock-agent', region_name=AWS_BEDROCK_REGION)


def retrieve_documents(query_text: str, category_id: str = None,
                       num_results: int = 10) -> list:
    """Search the Bedrock Knowledge Base for documents relevant to the query.

    Args:
        query_text: The search query text
        category_id: Optional category ID to filter results by S3 prefix
        num_results: Maximum number of results to return (default 10)

    Returns:
        List of result dictionaries with: fileName, s3Key, passage, score, category
    """
    # Validate that Knowledge Base ID is configured
    if not KNOWLEDGE_BASE_ID:
        raise RuntimeError('KNOWLEDGE_BASE_ID is not configured. Create a Knowledge Base in the Bedrock console and set the environment variable.')

    # Build the retrieval configuration
    retrieval_config = {
        'vectorSearchConfiguration': {
            'numberOfResults': num_results,
        }
    }

    # Add metadata filter for category if specified
    if category_id:
        # Get the S3 prefix for this category
        prefix = _get_prefix_for_category(category_id)
        if prefix and DOCUMENTS_BUCKET:
            # Filter on the full S3 URI that Bedrock stores as metadata
            retrieval_config['vectorSearchConfiguration']['filter'] = {
                'startsWith': {
                    'key': 'x-amz-bedrock-kb-source-uri',
                    'value': f's3://{DOCUMENTS_BUCKET}/{prefix}',
                }
            }

    # Call the Bedrock Agent Runtime Retrieve API
    response = bedrock_agent_runtime.retrieve(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalQuery={
            'text': query_text,
        },
        retrievalConfiguration=retrieval_config,
    )

    # Process and format the retrieval results
    results = []
    for result in response.get('retrievalResults', []):
        # Extract the S3 URI from the result location
        s3_uri = result.get('location', {}).get('s3Location', {}).get('uri', '')
        # Extract the filename from the S3 URI (everything after the last '/')
        filename = s3_uri.split('/')[-1] if s3_uri else 'Unknown'
        # Extract the S3 key from the URI (everything after bucket name)
        s3_key = '/'.join(s3_uri.split('/')[3:]) if s3_uri else ''
        # Determine the category from the S3 key prefix
        detected_category = _detect_category_from_key(s3_key)

        results.append({
            'fileName': filename,
            's3Key': s3_key,
            'passage': result.get('content', {}).get('text', ''),
            'score': result.get('score', 0.0),
            'category': detected_category,
        })

    # Return results sorted by relevance score (highest first)
    return sorted(results, key=lambda x: x['score'], reverse=True)


def start_ingestion_sync(data_source_id: str = None) -> dict:
    """Trigger a Knowledge Base ingestion job to process new/updated documents.

    Args:
        data_source_id: The data source ID to sync. Falls back to DATA_SOURCE_ID env var.

    Returns:
        Dictionary with the ingestion job ID and status
    """
    # Use provided ID or fall back to environment variable
    ds_id = data_source_id or DATA_SOURCE_ID

    if not KNOWLEDGE_BASE_ID or not ds_id:
        logger.warning('Cannot start ingestion: KNOWLEDGE_BASE_ID or DATA_SOURCE_ID not set')
        return {'status': 'not_configured', 'message': 'KB or DS ID not set'}

    # Start the ingestion job
    response = bedrock_agent.start_ingestion_job(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        dataSourceId=ds_id,
    )

    job = response.get('ingestionJob', {})
    return {
        'jobId': job.get('ingestionJobId', ''),
        'status': job.get('status', 'UNKNOWN'),
    }


def get_ingestion_status(ingestion_job_id: str) -> dict:
    """Check the status of a running ingestion job."""
    ds_id = DATA_SOURCE_ID

    if not KNOWLEDGE_BASE_ID or not ds_id:
        return {'status': 'not_configured'}

    response = bedrock_agent.get_ingestion_job(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        dataSourceId=ds_id,
        ingestionJobId=ingestion_job_id,
    )

    job = response.get('ingestionJob', {})
    stats = job.get('statistics', {})
    return {
        'jobId': job.get('ingestionJobId', ''),
        'status': job.get('status', 'UNKNOWN'),
        'documentsScanned': stats.get('numberOfDocumentsScanned', 0),
        'documentsIndexed': stats.get('numberOfNewDocumentsIndexed', 0),
        'documentsFailed': stats.get('numberOfDocumentsFailed', 0),
    }


def _get_prefix_for_category(category_id: str) -> str:
    """Get the S3 prefix for a category ID."""
    for category in CATEGORIES:
        if category['id'] == category_id:
            return category['s3Prefix']
    return ''


def _detect_category_from_key(s3_key: str) -> str:
    """Detect the category ID from an S3 key by matching the prefix."""
    for category in CATEGORIES:
        if s3_key.startswith(category['s3Prefix']):
            return category['id']
    return 'unknown'
