// config.ts - Central configuration for the entire RAG tool infrastructure
// This is the SINGLE source of truth for categories, IPs, models, and naming
// To add a new category: add one entry to the CATEGORIES array below

// Interface defining the shape of a document category
export interface Category {
  // Unique identifier used in API calls and metadata filtering
  id: string;
  // Human-readable label displayed in the frontend UI
  label: string;
  // S3 prefix (folder path) where documents of this category are stored
  s3Prefix: string;
  // Brief description shown as helper text in the UI
  description: string;
}

// ============================================================================
// CATEGORIES - Add new document categories here
// Each category maps to an S3 folder and a filterable metadata tag in Bedrock KB
// ============================================================================
export const CATEGORIES: Category[] = [
  {
    // Technical approach documents - proposals, architectures, methodologies
    id: 'tech-approach',
    label: 'Tech Approach',
    s3Prefix: 'tech-approach/',
    description: 'Technical approach documents, architectures, and methodologies',
  },
  {
    // Organizational approach documents - management plans, org charts, staffing
    id: 'organizational-approach',
    label: 'Organizational Approach',
    s3Prefix: 'organizational-approach/',
    description: 'Organizational structure, management plans, and staffing approaches',
  },
  {
    // Past performance documents - case studies, project summaries, references
    id: 'past-performance',
    label: 'Past Performance',
    s3Prefix: 'past-performance/',
    description: 'Past performance records, case studies, and project references',
  },
  {
    // Resumes - employee CVs and professional summaries
    id: 'resumes',
    label: 'Resumes',
    s3Prefix: 'resumes/',
    description: 'Employee resumes and professional summaries',
  },
];

// ============================================================================
// AWS REGION - Deployment target region
// ============================================================================
export const AWS_REGION = 'us-east-1';

// ============================================================================
// IP ALLOWLIST - CIDR ranges permitted to access the application
// Update these with your actual IP addresses before deploying to production
// Format: ['x.x.x.x/32'] for single IPs, ['x.x.x.x/24'] for ranges
// ============================================================================
export const ALLOWED_IPS: string[] = [
  '44.206.235.60/32',
  '24.154.162.38/32',
  '71.115.205.39/32',
  '69.253.241.226/32',
];

export const ALLOWED_IPS_V6: string[] = [
  '2600:4040:60a0:e900:c19a:e16e:d518:7d6e/128',
  '2601:47:4a03:59d0:a953:f491:1095:b958/128',
];

// ============================================================================
// BEDROCK MODEL IDs - LLM and embedding models used by the application
// ============================================================================
export const BEDROCK_MODELS = {
  // Embedding model used to vectorize documents and queries
  embedding: 'amazon.titan-embed-text-v2:0',
  // Primary LLM for RAG search and draft generation (cost-effective)
  generation: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  // Higher-capability LLM used for document auditing (more thorough analysis)
  audit: 'anthropic.claude-sonnet-4-20250514-v1:0',
};

// ============================================================================
// RESOURCE NAMING - Prefixes and names for AWS resources
// ============================================================================
export const RESOURCE_NAMES = {
  // S3 bucket suffix for document storage (will be prefixed with account ID)
  documentsBucketSuffix: 'rag-documents',
  // S3 bucket suffix for frontend static assets
  frontendBucketSuffix: 'rag-frontend',
  // Name prefix for all Lambda functions
  lambdaPrefix: 'rag-tool',
  // Name for the Bedrock Knowledge Base
  knowledgeBaseName: 'rag-tool-kb',
  // Name for the WAF Web ACL
  wafAclName: 'rag-tool-waf-acl',
  // CloudFront origin verification header name
  originVerifyHeader: 'x-origin-verify',
  // Secret value for origin verification (change this to a unique value)
  originVerifySecret: 'rag-tool-origin-secret-change-me',
};

// ============================================================================
// DOCUMENT PROCESSING - Configuration for how documents are chunked
// ============================================================================
export const DOCUMENT_PROCESSING = {
  // Maximum chunk size in tokens for document splitting
  chunkSizeTokens: 512,
  // Overlap percentage between consecutive chunks (0.0 to 1.0)
  chunkOverlapPercent: 0.2,
  // Supported file extensions for upload
  supportedExtensions: ['.pdf', '.docx', '.txt', '.md', '.html', '.csv'],
};

// ============================================================================
// TONE OPTIONS - Available writing tones for generation
// ============================================================================
export const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'technical', label: 'Technical' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'formal', label: 'Formal' },
  { id: 'concise', label: 'Concise' },
];
