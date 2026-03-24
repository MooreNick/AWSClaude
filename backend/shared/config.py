# config.py - Central configuration for the backend Lambda functions
# Reads configuration from environment variables set by CDK during deployment
# Falls back to hardcoded defaults if environment variables are missing

# Import os module to read environment variables
import os
# Import json module to parse JSON-encoded environment variables
import json
# Import logging for warning messages
import logging

# Create a logger for this module
logger = logging.getLogger(__name__)

# ============================================================================
# ENVIRONMENT VARIABLES - Set by CDK Lambda environment configuration
# ============================================================================

# S3 bucket name where all RAG reference documents are stored
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET', '')

# AWS region for Bedrock API calls
AWS_BEDROCK_REGION = os.environ.get('AWS_BEDROCK_REGION', 'us-east-1')

# Bedrock Knowledge Base ID for RAG retrieval operations
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', '')

# Data Source ID for triggering KB ingestion sync
DATA_SOURCE_ID = os.environ.get('DATA_SOURCE_ID', '')

# Log warnings if critical environment variables are missing
if not DOCUMENTS_BUCKET:
    logger.warning('DOCUMENTS_BUCKET environment variable is not set')
if not KNOWLEDGE_BASE_ID:
    logger.warning('KNOWLEDGE_BASE_ID environment variable is not set - search will fail')

# ============================================================================
# BEDROCK MODEL IDs
# ============================================================================

# Parse Bedrock models from env var, fall back to defaults
try:
    _bedrock_models_raw = os.environ.get('BEDROCK_MODELS', '{}')
    _bedrock_models = json.loads(_bedrock_models_raw)
except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f'Failed to parse BEDROCK_MODELS env var: {e}, using defaults')
    _bedrock_models = {}

# Embedding model ID (Titan Embed V2)
EMBEDDING_MODEL_ID = _bedrock_models.get('embedding', 'amazon.titan-embed-text-v2:0')
# Generation model ID (Claude Haiku) for RAG draft generation
GENERATION_MODEL_ID = _bedrock_models.get('generation', 'anthropic.claude-3-5-haiku-20241022-v1:0')
# Audit model ID (Claude Sonnet) for document comparison
AUDIT_MODEL_ID = _bedrock_models.get('audit', 'anthropic.claude-sonnet-4-20250514-v1:0')

# ============================================================================
# CATEGORIES - Document categories
# ============================================================================

# Parse categories from env var, fall back to defaults
try:
    _categories_raw = os.environ.get('CATEGORIES', '[]')
    _parsed_categories = json.loads(_categories_raw)
except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f'Failed to parse CATEGORIES env var: {e}, using defaults')
    _parsed_categories = []

# Use parsed categories if available, otherwise use hardcoded defaults
CATEGORIES = _parsed_categories if _parsed_categories else [
    {
        'id': 'tech-approach',
        'label': 'Tech Approach',
        's3Prefix': 'tech-approach/',
        'description': 'Technical approach documents, architectures, and methodologies',
    },
    {
        'id': 'organizational-approach',
        'label': 'Organizational Approach',
        's3Prefix': 'organizational-approach/',
        'description': 'Organizational structure, management plans, and staffing approaches',
    },
    {
        'id': 'past-performance',
        'label': 'Past Performance',
        's3Prefix': 'past-performance/',
        'description': 'Past performance records, case studies, and project references',
    },
    {
        'id': 'resumes',
        'label': 'Resumes',
        's3Prefix': 'resumes/',
        'description': 'Employee resumes and professional summaries',
    },
]

# ============================================================================
# TONE OPTIONS - Available writing tones for document generation
# ============================================================================

# Parse tone options from env var, fall back to defaults
try:
    _tone_raw = os.environ.get('TONE_OPTIONS', '[]')
    _parsed_tones = json.loads(_tone_raw)
except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f'Failed to parse TONE_OPTIONS env var: {e}, using defaults')
    _parsed_tones = []

TONE_OPTIONS = _parsed_tones if _parsed_tones else [
    {'id': 'professional', 'label': 'Professional'},
    {'id': 'technical', 'label': 'Technical'},
    {'id': 'conversational', 'label': 'Conversational'},
    {'id': 'formal', 'label': 'Formal'},
    {'id': 'concise', 'label': 'Concise'},
]

# ============================================================================
# DOCUMENT PROCESSING - Settings for file handling
# ============================================================================

# List of supported file extensions for upload
SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.html', '.csv']

# Maximum file size for upload in bytes (50 MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_category_by_id(category_id: str) -> dict:
    """Look up a category by its ID and return its configuration dictionary."""
    for category in CATEGORIES:
        if category['id'] == category_id:
            return category
    return None


def get_s3_prefix_for_category(category_id: str) -> str:
    """Get the S3 prefix (folder path) for a given category ID."""
    category = get_category_by_id(category_id)
    return category['s3Prefix'] if category else ''
