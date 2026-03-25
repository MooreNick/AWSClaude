import api from './api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * List files in a given category (S3 prefix).
 * @param {string} [category] - e.g. "tech-approach", "resumes"
 * @returns {Promise<Array<{name, folder, size, last_modified}>>}
 */
export async function listFiles(category) {
  const params = category ? { category } : {};
  const res = await api.get('/api/files', { params });
  const files = res.data.files || res.data.documents || [];
  return files.map((f) => ({
    name: f.name || f.key || f.filename,
    folder: f.category || f.folder || '',
    size: f.size || '',
    last_modified: f.last_modified || f.lastModified || '',
  }));
}

/**
 * Upload a single file to S3 under the given category.
 * Backend expects JSON with base64-encoded content (one file per request).
 * @param {File} file
 * @param {string} category - e.g. "tech-approach"
 */
export async function uploadFile(file, category) {
  const content = await fileToBase64(file);
  return api.post('/api/upload', {
    filename: file.name,
    content,
    category,
  });
}

// ---------------------------------------------------------------------------
// Generate (Search + Produce)
// ---------------------------------------------------------------------------

/**
 * RAG retrieval — search the Bedrock Knowledge Base.
 * @param {{ query: string, category?: string, file?: File|null }} params
 * @returns {Promise<Array<{name, passage, score}>>}
 */
export async function searchDocuments({ query, category, file }) {
  const body = { query };
  if (category) body.category = category;
  if (file) {
    body.file_content = await fileToBase64(file);
    body.filename = file.name;
  }
  const res = await api.post('/api/search', body);
  const results = res.data.results || res.data.documents || [];
  return results.map((r) => ({
    name: r.name || r.source || r.document_name || 'Document',
    passage: r.passage || r.text || r.content || '',
    score: r.score ?? r.relevance_score ?? undefined,
  }));
}

/**
 * Generate a document using retrieved passages.
 * @param {{ query: string, passages: string[], tone: string }} params
 * @returns {Promise<{content: string}>}
 */
export async function generateDocument({ query, passages, tone }) {
  const res = await api.post('/api/generate', { query, passages, tone });
  return {
    content: res.data.content || res.data.text || '',
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Audit a document against criteria/rules.
 * @param {{ documentFile: File, criteriaFile: File }} params
 * @returns {Promise<{issues: Array<{severity, location, description, rule, suggestion}>}>}
 */
export async function auditDocument({ documentFile, criteriaFile }) {
  const [docContent, criteriaContent] = await Promise.all([
    fileToBase64(documentFile),
    fileToBase64(criteriaFile),
  ]);
  const res = await api.post('/api/audit', {
    document_content: docContent,
    document_filename: documentFile.name,
    criteria_content: criteriaContent,
    criteria_filename: criteriaFile.name,
  });
  return {
    issues: res.data.issues || [],
  };
}
