// api/client.ts - API client for communicating with the backend Lambda functions
// All API calls are routed through CloudFront to the API Gateway

// Import axios for making HTTP requests
import axios from 'axios';
// Import TypeScript types for request/response shapes
import type {
  CategoriesResponse,
  FilesResponse,
  SearchResponse,
  GenerateResponse,
  AuditResponse,
  UploadResponse,
} from '../types';

// Create an axios instance with default configuration
const api = axios.create({
  // Base URL for all API requests (relative - goes through CloudFront)
  baseURL: '/api',
  // Default headers for all requests
  headers: {
    'Content-Type': 'application/json',
  },
  // Request timeout in milliseconds (3 minutes for long operations like audit)
  timeout: 180000,
});

// ============================================================================
// CATEGORIES API - Fetch available categories and tone options
// ============================================================================

/**
 * Fetch the list of available document categories and writing tone options.
 * Called on page load to populate dropdown menus.
 *
 * @returns Promise resolving to categories and tones
 */
export const fetchCategories = async (): Promise<CategoriesResponse> => {
  // Send GET request to the categories endpoint
  const response = await api.get<CategoriesResponse>('/categories');
  // Return the response data (categories and tones)
  return response.data;
};

// ============================================================================
// FILES API - List, upload, and delete files in S3
// ============================================================================

/**
 * List files in S3, optionally filtered by category.
 *
 * @param category - Optional category ID to filter results
 * @returns Promise resolving to the file list
 */
export const fetchFiles = async (category?: string): Promise<FilesResponse> => {
  // Build query parameters object
  const params: Record<string, string> = {};
  // Add category filter if provided
  if (category) {
    params.category = category;
  }
  // Send GET request with query parameters
  const response = await api.get<FilesResponse>('/files', { params });
  // Return the file list response
  return response.data;
};

/**
 * Upload a file to S3 under a specific category.
 *
 * @param file - The File object to upload
 * @param category - The category ID to upload under
 * @returns Promise resolving to upload confirmation
 */
export const uploadFile = async (file: File, category: string): Promise<UploadResponse> => {
  // Read the file content as a base64 string
  const base64Content = await fileToBase64(file);
  // Send POST request with file data
  const response = await api.post<UploadResponse>('/upload', {
    // Original filename
    fileName: file.name,
    // Base64-encoded file content
    fileContent: base64Content,
    // Target category
    category: category,
  });
  // Return the upload response
  return response.data;
};

/**
 * Delete a file from S3.
 *
 * @param s3Key - The full S3 object key to delete
 * @returns Promise resolving to deletion confirmation
 */
export const deleteFile = async (s3Key: string): Promise<void> => {
  // Send DELETE request with the S3 key as a query parameter
  await api.delete('/files', { params: { key: s3Key } });
};

// ============================================================================
// SEARCH API - RAG document retrieval
// ============================================================================

/**
 * Search for relevant documents using the RAG Knowledge Base.
 *
 * @param queryText - Text query from the user
 * @param category - Category to filter search results
 * @param file - Optional file to include in the search query
 * @param numResults - Maximum number of results (default 10)
 * @returns Promise resolving to search results with passages
 */
export const searchDocuments = async (
  queryText: string,
  category: string,
  file?: File | null,
  numResults: number = 10
): Promise<SearchResponse> => {
  // Initialize the request payload with the text query
  const payload: Record<string, unknown> = {
    queryText,
    category,
    numResults,
  };

  // If a file was provided, convert it to base64 and add to the payload
  if (file) {
    // Convert the file to base64 encoding
    const base64Content = await fileToBase64(file);
    // Add file details to the payload
    payload.fileName = file.name;
    payload.fileContent = base64Content;
  }

  // Send POST request to the search endpoint
  const response = await api.post<SearchResponse>('/search', payload);
  // Return the search results
  return response.data;
};

// ============================================================================
// GENERATE API - Draft document generation
// ============================================================================

/**
 * Generate a draft document from approved search results.
 *
 * @param originalQuery - The original search query text
 * @param approvedPassages - List of approved search results to use as references
 * @param tone - The desired writing tone
 * @param additionalInstructions - Optional extra guidance for generation
 * @returns Promise resolving to the generated draft text
 */
export const generateDocument = async (
  originalQuery: string,
  approvedPassages: Array<{ fileName: string; passage: string; category: string }>,
  tone: string,
  additionalInstructions?: string
): Promise<GenerateResponse> => {
  // Send POST request to the generate endpoint
  const response = await api.post<GenerateResponse>('/generate', {
    // The original search query/uploaded text
    originalQuery,
    // The passages the user approved for reference
    approvedPassages,
    // The desired writing tone
    tone,
    // Optional additional instructions
    additionalInstructions: additionalInstructions || '',
  });
  // Return the generation response
  return response.data;
};

// ============================================================================
// AUDIT API - Document audit comparison
// ============================================================================

/**
 * Audit a document against criteria from a reference file.
 *
 * @param auditFile - The file to audit
 * @param criteriaFile - The reference file containing criteria
 * @returns Promise resolving to the structured audit report
 */
export const auditDocument = async (
  auditFile: File,
  criteriaFile: File
): Promise<AuditResponse> => {
  // Convert both files to base64 encoding
  const auditBase64 = await fileToBase64(auditFile);
  const criteriaBase64 = await fileToBase64(criteriaFile);

  // Send POST request to the audit endpoint
  const response = await api.post<AuditResponse>('/audit', {
    // Document to audit
    auditFileName: auditFile.name,
    auditFileContent: auditBase64,
    // Criteria reference document
    criteriaFileName: criteriaFile.name,
    criteriaFileContent: criteriaBase64,
  });
  // Return the audit response
  return response.data;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert a File object to a base64-encoded string.
 * Used to send file contents in JSON payloads to the API.
 *
 * @param file - The File object to convert
 * @returns Promise resolving to the base64 string (without data URI prefix)
 */
const fileToBase64 = (file: File): Promise<string> => {
  // Return a promise that resolves with the base64 content
  return new Promise((resolve, reject) => {
    // Create a FileReader to read the file contents
    const reader = new FileReader();
    // Set up the onload handler to process the result
    reader.onload = () => {
      // Get the data URL result (e.g., 'data:application/pdf;base64,AAAA...')
      const result = reader.result as string;
      // Extract just the base64 content (remove the data URI prefix)
      const base64 = result.split(',')[1];
      // Resolve the promise with the base64 string
      resolve(base64);
    };
    // Set up the onerror handler for read failures
    reader.onerror = (error) => reject(error);
    // Start reading the file as a data URL (triggers onload when complete)
    reader.readAsDataURL(file);
  });
};
