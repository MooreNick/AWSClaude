// config/categories.ts - Default categories and tones for the frontend
// These defaults are used before the API response loads, and as fallbacks
// The authoritative source is the backend /api/categories endpoint

// Import types for categories and tones
import type { Category, ToneOption } from '../types';

// Default document categories matching the backend configuration
// These are used as initial values before the API call completes
export const DEFAULT_CATEGORIES: Category[] = [
  {
    // Technical approach documents
    id: 'tech-approach',
    label: 'Tech Approach',
    s3Prefix: 'tech-approach/',
    description: 'Technical approach documents, architectures, and methodologies',
  },
  {
    // Organizational approach documents
    id: 'organizational-approach',
    label: 'Organizational Approach',
    s3Prefix: 'organizational-approach/',
    description: 'Organizational structure, management plans, and staffing approaches',
  },
  {
    // Past performance documents
    id: 'past-performance',
    label: 'Past Performance',
    s3Prefix: 'past-performance/',
    description: 'Past performance records, case studies, and project references',
  },
  {
    // Employee resumes
    id: 'resumes',
    label: 'Resumes',
    s3Prefix: 'resumes/',
    description: 'Employee resumes and professional summaries',
  },
];

// Default writing tone options matching the backend configuration
export const DEFAULT_TONES: ToneOption[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'technical', label: 'Technical' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'formal', label: 'Formal' },
  { id: 'concise', label: 'Concise' },
];
