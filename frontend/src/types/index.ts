// types/index.ts - TypeScript interfaces for the RAG tool application
// Defines the shape of data flowing between frontend and backend

// Represents a document category (e.g., Tech Approach, Past Performance)
export interface Category {
  // Unique identifier used in API calls (e.g., 'tech-approach')
  id: string;
  // Human-readable label for display (e.g., 'Tech Approach')
  label: string;
  // S3 prefix where documents of this category are stored
  s3Prefix: string;
  // Brief description shown in the UI
  description: string;
}

// Represents a writing tone option for document generation
export interface ToneOption {
  // Unique identifier (e.g., 'professional')
  id: string;
  // Display label (e.g., 'Professional')
  label: string;
}

// Represents a single search result from the RAG Knowledge Base
export interface SearchResult {
  // Source document filename
  fileName: string;
  // Full S3 object key
  s3Key: string;
  // Relevant text passage from the document
  passage: string;
  // Relevance score from vector search (0.0 to 1.0)
  score: number;
  // Category of the source document
  category: string;
  // Whether the user has selected this result for generation
  selected?: boolean;
}

// Represents the response from the search API
export interface SearchResponse {
  // List of matching document chunks
  results: SearchResult[];
  // Total number of results
  count: number;
  // The query that was sent (possibly truncated)
  query: string;
  // The category filter that was applied
  category: string;
}

// Represents a file listed in the S3 bucket
export interface S3File {
  // Full S3 object key
  key: string;
  // Filename without the category prefix
  filename: string;
  // File size in bytes
  size: number;
  // ISO timestamp of last modification
  lastModified: string;
  // Category ID this file belongs to
  category: string;
}

// Represents the response from the files listing API
export interface FilesResponse {
  // List of file metadata objects
  files: S3File[];
  // Total count of files
  count: number;
  // Category filter applied (null for all)
  category: string | null;
}

// Represents the response from the generate API
export interface GenerateResponse {
  // The generated draft document text
  generatedText: string;
  // The tone that was applied
  tone: string;
  // Number of reference passages used
  referencesUsed: number;
  // Source filenames used as references
  sourceFiles: string[];
}

// Represents a single criterion result in an audit report
export interface CriterionResult {
  // Sequential number for ordering
  criterionNumber: number;
  // The requirement or criterion text
  criterion: string;
  // Assessment verdict
  verdict: 'MEETS' | 'PARTIALLY MEETS' | 'DOES NOT MEET';
  // Evidence quote from the audited document
  evidence: string;
  // Additional notes about the assessment
  notes: string;
}

// Represents the complete audit report
export interface AuditReport {
  // Brief overall assessment
  summary: string;
  // Overall pass/fail score
  overallScore: 'PASS' | 'PARTIAL' | 'FAIL';
  // Total number of criteria identified
  totalCriteria: number;
  // Individual criterion results
  criteriaResults: CriterionResult[];
  // Recommendations for improvement
  recommendations: string[];
  // Raw response text if JSON parsing failed
  rawResponse?: string;
}

// Represents the response from the audit API
export interface AuditResponse {
  // The structured audit report
  auditReport: AuditReport;
  // Name of the file that was audited
  auditedFile: string;
  // Name of the criteria reference file
  criteriaFile: string;
}

// Represents the response from the categories API
export interface CategoriesResponse {
  // List of available categories
  categories: Category[];
  // List of available tone options
  tones: ToneOption[];
}

// Represents the response from the upload API
export interface UploadResponse {
  // Success message
  message: string;
  // Upload details
  upload: {
    s3_key: string;
    bucket: string;
    category: string;
    filename: string;
  };
  // Knowledge Base sync status
  sync: {
    status: string;
    jobId?: string;
    message?: string;
  };
}
