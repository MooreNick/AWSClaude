# config.py - Central configuration for the backend Lambda functions
# Reads configuration from environment variables set by CDK during deployment
# This mirrors the CDK config.ts to keep categories and settings in sync

# Import os module to read environment variables
import os
# Import json module to parse JSON-encoded environment variables
import json

# ============================================================================
# ENVIRONMENT VARIABLES - Set by CDK Lambda environment configuration
# ============================================================================

# S3 bucket name where all RAG reference documents are stored
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET', 'rag-documents')

# AWS region for Bedrock API calls
AWS_BEDROCK_REGION = os.environ.get('AWS_BEDROCK_REGION', 'us-east-1')

# Bedrock Knowledge Base ID for RAG retrieval operations
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', '')

# ============================================================================
# BEDROCK MODEL IDs - Parsed from the JSON environment variable
# ============================================================================

# Parse the Bedrock model configuration from the environment variable
_bedrock_models_raw = os.environ.get('BEDROCK_MODELS', '{}')
# Decode the JSON string into a Python dictionary
_bedrock_models = json.loads(_bedrock_models_raw)

# Embedding model ID for converting text to vectors (Titan Embed V2)
EMBEDDING_MODEL_ID = _bedrock_models.get('embedding', 'amazon.titan-embed-text-v2:0')
# Generation model ID for RAG search and draft generation (Claude Haiku)
GENERATION_MODEL_ID = _bedrock_models.get('generation', 'anthropic.claude-3-5-haiku-20241022-v1:0')
# Audit model ID for detailed document comparison (Claude Sonnet)
AUDIT_MODEL_ID = _bedrock_models.get('audit', 'anthropic.claude-sonnet-4-20250514-v1:0')

# ============================================================================
# CATEGORIES - Document categories matching the CDK and frontend config
# Parsed from environment variable or uses defaults
# ============================================================================

# Parse the categories from the JSON environment variable
_categories_raw = os.environ.get('CATEGORIES', '[]')
# Decode the JSON string into a list of category dictionaries
CATEGORIES = json.loads(_categories_raw)

# If no categories from environment, use hardcoded defaults matching CDK config
if not CATEGORIES:
    CATEGORIES = [
        {
            # Technical approach documents
            'id': 'tech-approach',
            'label': 'Tech Approach',
            's3Prefix': 'tech-approach/',
            'description': 'Technical approach documents, architectures, and methodologies',
        },
        {
            # Organizational approach documents
            'id': 'organizational-approach',
            'label': 'Organizational Approach',
            's3Prefix': 'organizational-approach/',
            'description': 'Organizational structure, management plans, and staffing approaches',
        },
        {
            # Past performance documents
            'id': 'past-performance',
            'label': 'Past Performance',
            's3Prefix': 'past-performance/',
            'description': 'Past performance records, case studies, and project references',
        },
        {
            # Employee resumes
            'id': 'resumes',
            'label': 'Resumes',
            's3Prefix': 'resumes/',
            'description': 'Employee resumes and professional summaries',
        },
    ]

# ============================================================================
# TONE OPTIONS - Available writing tones for document generation
# ============================================================================

# Parse tone options from the JSON environment variable
_tone_raw = os.environ.get('TONE_OPTIONS', '[]')
# Decode the JSON string into a list of tone dictionaries
TONE_OPTIONS = json.loads(_tone_raw)

# If no tones from environment, use hardcoded defaults
if not TONE_OPTIONS:
    TONE_OPTIONS = [
        {'id': 'professional', 'label': 'Professional'},
        {'id': 'technical', 'label': 'Technical'},
        {'id': 'conversational', 'label': 'Conversational'},
        {'id': 'formal', 'label': 'Formal'},
        {'id': 'concise', 'label': 'Concise'},
    ]

# ============================================================================
# DOCUMENT PROCESSING - Settings for file handling
# ============================================================================

# Parse document processing config from the environment variable
_doc_processing_raw = os.environ.get('DOCUMENT_PROCESSING', '{}')
# Decode the JSON string into a dictionary
_doc_processing = json.loads(_doc_processing_raw)

# List of supported file extensions for upload
SUPPORTED_EXTENSIONS = _doc_processing.get(
    'supportedExtensions',
    ['.pdf', '.docx', '.txt', '.md', '.html', '.csv']
)

# Maximum file size for upload in bytes (50 MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_category_by_id(category_id: str) -> dict:
    """Look up a category by its ID and return its configuration dictionary.

    Args:
        category_id: The unique identifier of the category (e.g., 'tech-approach')

    Returns:
        The category dictionary if found, or None if no match
    """
    # Iterate through all categories to find a matching ID
    for category in CATEGORIES:
        # Compare the category ID with the requested ID
        if category['id'] == category_id:
            # Return the matching category dictionary
            return category
    # Return None if no category matches the provided ID
    return None


def get_s3_prefix_for_category(category_id: str) -> str:
    """Get the S3 prefix (folder path) for a given category ID.

    Args:
        category_id: The unique identifier of the category

    Returns:
        The S3 prefix string, or empty string if category not found
    """
    # Look up the category configuration
    category = get_category_by_id(category_id)
    # Return the S3 prefix if found, otherwise return empty string
    return category['s3Prefix'] if category else ''
