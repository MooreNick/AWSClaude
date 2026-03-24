# knowledge_base.py - Wrapper for Amazon Bedrock Knowledge Base operations
# Provides RAG retrieval and ingestion sync functions

# Import boto3 AWS SDK
import boto3
# Import json for payload serialization
import json
# Import our configuration for KB ID and region
from shared.config import KNOWLEDGE_BASE_ID, AWS_BEDROCK_REGION

# Create a Bedrock Agent Runtime client for Knowledge Base operations
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime', region_name=AWS_BEDROCK_REGION)

# Create a Bedrock Agent client for managing ingestion jobs
bedrock_agent = boto3.client('bedrock-agent', region_name=AWS_BEDROCK_REGION)

# ============================================================================
# RETRIEVAL - Search the Knowledge Base for relevant document chunks
# ============================================================================


def retrieve_documents(query_text: str, category_id: str = None,
                       num_results: int = 10) -> list:
    """Search the Bedrock Knowledge Base for documents relevant to the query.

    Uses the Retrieve API to find matching document chunks with their
    source file information and relevance scores.

    Args:
        query_text: The search query text (extracted from uploaded doc or typed input)
        category_id: Optional category ID to filter results by S3 prefix
        num_results: Maximum number of results to return (default 10)

    Returns:
        List of result dictionaries containing:
        - fileName: Source document filename
        - s3Key: Full S3 object key
        - passage: The relevant text chunk
        - score: Relevance score (0.0 to 1.0)
        - category: Category ID of the source document
    """
    # Build the retrieval configuration with the number of desired results
    retrieval_config = {
        'vectorSearchConfiguration': {
            # Maximum number of results to return
            'numberOfResults': num_results,
        }
    }

    # Add a metadata filter for category if specified
    if category_id:
        # Filter results to only documents matching the category S3 prefix
        retrieval_config['vectorSearchConfiguration']['filter'] = {
            'startsWith': {
                # Filter on the S3 URI metadata field
                'key': 'x-amz-bedrock-kb-source-uri',
                # Match documents whose source URI contains the category prefix
                'value': f's3://{category_id}',
            }
        }

    # Call the Bedrock Agent Runtime Retrieve API
    response = bedrock_agent_runtime.retrieve(
        # The Knowledge Base to search
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        # The search query
        retrievalQuery={
            'text': query_text,
        },
        # Search configuration with filters and result count
        retrievalConfiguration=retrieval_config,
    )

    # Process and format the retrieval results
    results = []
    # Iterate through each retrieval result
    for result in response.get('retrievalResults', []):
        # Extract the S3 URI from the result location
        s3_uri = result.get('location', {}).get('s3Location', {}).get('uri', '')
        # Extract the filename from the S3 URI (everything after the last '/')
        filename = s3_uri.split('/')[-1] if s3_uri else 'Unknown'
        # Extract the S3 key from the URI (everything after the bucket name)
        s3_key = '/'.join(s3_uri.split('/')[3:]) if s3_uri else ''
        # Determine the category from the S3 key prefix
        detected_category = _detect_category_from_key(s3_key)

        # Add the formatted result to our list
        results.append({
            # The source document filename
            'fileName': filename,
            # The full S3 object key
            's3Key': s3_key,
            # The relevant text passage from the document
            'passage': result.get('content', {}).get('text', ''),
            # The relevance score from the vector search
            'score': result.get('score', 0.0),
            # The detected category of the source document
            'category': detected_category,
        })

    # Return the formatted results sorted by relevance score (highest first)
    return sorted(results, key=lambda x: x['score'], reverse=True)


# ============================================================================
# INGESTION - Sync new documents into the Knowledge Base
# ============================================================================


def start_ingestion_sync(data_source_id: str = None) -> dict:
    """Trigger a Knowledge Base ingestion job to process new/updated documents.

    Should be called after uploading new files to S3 to make them searchable.

    Args:
        data_source_id: The data source ID to sync. If not provided,
                        uses the DATA_SOURCE_ID environment variable.

    Returns:
        Dictionary with the ingestion job ID and status
    """
    # Import os here to read the data source ID from environment
    import os
    # Use the provided data source ID or fall back to the environment variable
    ds_id = data_source_id or os.environ.get('DATA_SOURCE_ID', '')

    # Call the Bedrock Agent StartIngestionJob API
    response = bedrock_agent.start_ingestion_job(
        # The Knowledge Base to sync
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        # The data source (S3 bucket) to process
        dataSourceId=ds_id,
    )

    # Extract the ingestion job details from the response
    job = response.get('ingestionJob', {})
    # Return the job ID and current status
    return {
        'jobId': job.get('ingestionJobId', ''),
        'status': job.get('status', 'UNKNOWN'),
    }


def get_ingestion_status(ingestion_job_id: str) -> dict:
    """Check the status of a running ingestion job.

    Args:
        ingestion_job_id: The ID of the ingestion job to check

    Returns:
        Dictionary with job status and statistics
    """
    # Import os here to read the data source ID from environment
    import os
    # Read the data source ID from environment
    ds_id = os.environ.get('DATA_SOURCE_ID', '')

    # Call the Bedrock Agent GetIngestionJob API
    response = bedrock_agent.get_ingestion_job(
        # The Knowledge Base containing the job
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        # The data source associated with the job
        dataSourceId=ds_id,
        # The specific ingestion job to check
        ingestionJobId=ingestion_job_id,
    )

    # Extract the job details from the response
    job = response.get('ingestionJob', {})
    # Extract ingestion statistics
    stats = job.get('statistics', {})
    # Return formatted status information
    return {
        'jobId': job.get('ingestionJobId', ''),
        'status': job.get('status', 'UNKNOWN'),
        'documentsScanned': stats.get('numberOfDocumentsScanned', 0),
        'documentsIndexed': stats.get('numberOfNewDocumentsIndexed', 0),
        'documentsFailed': stats.get('numberOfDocumentsFailed', 0),
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def _detect_category_from_key(s3_key: str) -> str:
    """Detect the category ID from an S3 key by matching the prefix.

    Args:
        s3_key: The S3 object key (e.g., 'tech-approach/report.pdf')

    Returns:
        The category ID if a prefix match is found, otherwise 'unknown'
    """
    # Import categories for prefix matching
    from shared.config import CATEGORIES
    # Check each category's prefix against the S3 key
    for category in CATEGORIES:
        # If the S3 key starts with this category's prefix, it's a match
        if s3_key.startswith(category['s3Prefix']):
            # Return the matching category ID
            return category['id']
    # Return 'unknown' if no category prefix matches
    return 'unknown'
