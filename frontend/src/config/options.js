// ============================================================
// Centralized configuration for search types and document types.
// To add a new search-type or doc-type, simply add an entry here.
// The S3 bucket folder structure mirrors these values (hyphenated).
// ============================================================

export const SEARCH_TYPES = [
  { value: 'tech-approach', label: 'Tech Approach' },
  { value: 'organizational-approach', label: 'Organizational Approach' },
  { value: 'past-performance', label: 'Past Performance' },
];

// DOC_TYPES are a frontend-only concept for labeling the desired output format.
// The backend search/generate endpoints do not use doc_type.
export const DOC_TYPES = [
  { value: 'white_paper', label: 'White Paper' },
  { value: 'rfi', label: 'RFI' },
  { value: 'rfq', label: 'RFQ' },
  { value: 'rfp', label: 'RFP' },
];

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal' },
  { value: 'technical', label: 'Technical' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'concise', label: 'Concise' },
];
