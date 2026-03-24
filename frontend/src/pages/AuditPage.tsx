// pages/AuditPage.tsx - Document audit page
// Allows users to audit a document against criteria from a reference file

// Import React and hooks
import React, { useState } from 'react';
// Import API client for the audit endpoint
import { auditDocument } from '../api/client';
// Import UI components
import FileUploader from '../components/FileUploader';
import AuditReportDisplay from '../components/AuditReport';
// Import types
import type { AuditReport } from '../types';

// AuditPage component for document audit workflow
const AuditPage: React.FC = () => {
  // ========================================================================
  // STATE
  // ========================================================================

  // File to be audited
  const [auditFile, setAuditFile] = useState<File | null>(null);
  // Criteria reference file
  const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
  // The audit report returned from the API
  const [report, setReport] = useState<AuditReport | null>(null);
  // Name of the audited file (for display in the report)
  const [auditedFileName, setAuditedFileName] = useState('');
  // Name of the criteria file (for display in the report)
  const [criteriaFileName, setCriteriaFileName] = useState('');
  // Loading state during the audit API call
  const [loading, setLoading] = useState(false);
  // Error message to display
  const [error, setError] = useState('');

  // ========================================================================
  // HANDLERS
  // ========================================================================

  // Handler for the "Run Audit" button
  const handleAudit = async () => {
    // Validate that both files are provided
    if (!auditFile) {
      setError('Please upload the document you want to audit.');
      return;
    }
    if (!criteriaFile) {
      setError('Please upload the criteria/reference file to audit against.');
      return;
    }

    // Clear previous state
    setError('');
    setReport(null);
    setLoading(true);

    try {
      // Call the audit API with both files
      const response = await auditDocument(auditFile, criteriaFile);
      // Store the report and file names for display
      setReport(response.auditReport);
      setAuditedFileName(response.auditedFile);
      setCriteriaFileName(response.criteriaFile);
    } catch (err: unknown) {
      // Display the error
      const errorMessage = err instanceof Error ? err.message : 'Audit failed. Please try again.';
      setError(errorMessage);
    } finally {
      // Clear loading state
      setLoading(false);
    }
  };

  // Handler for starting a new audit
  const handleNewAudit = () => {
    // Reset all state
    setAuditFile(null);
    setCriteriaFile(null);
    setReport(null);
    setError('');
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    // Page container
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Document Audit</h2>
        {/* New Audit button (shown when a report is displayed) */}
        {report && (
          <button
            onClick={handleNewAudit}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700
                       hover:bg-gray-50 transition-colors text-sm"
          >
            New Audit
          </button>
        )}
      </div>

      {/* Description of the audit feature */}
      <p className="text-gray-600">
        Upload a document to audit and a reference file containing criteria. The tool will
        extract requirements from the reference file (any format) and evaluate your document
        against each criterion.
      </p>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Audit input form (hidden once a report is shown) */}
      {!report && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Two file uploaders side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Document to audit */}
            <FileUploader
              onFileSelect={setAuditFile}
              selectedFile={auditFile}
              label="Document to Audit"
            />
            {/* Criteria reference file */}
            <FileUploader
              onFileSelect={setCriteriaFile}
              selectedFile={criteriaFile}
              label="Criteria / Reference File"
            />
          </div>

          {/* Run Audit button */}
          <button
            onClick={handleAudit}
            disabled={loading || !auditFile || !criteriaFile}
            className={`w-full py-3 rounded-md font-medium text-white transition-colors
              ${loading || !auditFile || !criteriaFile
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {/* Show loading text or default */}
            {loading ? 'Auditing... (this may take a minute)' : 'Run Audit'}
          </button>
        </div>
      )}

      {/* Loading indicator during audit */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-gray-600">Analyzing documents and generating audit report...</p>
          <p className="text-sm text-gray-400 mt-1">This may take 1-2 minutes depending on document length.</p>
        </div>
      )}

      {/* Audit report display */}
      {report && (
        <AuditReportDisplay
          report={report}
          auditedFile={auditedFileName}
          criteriaFile={criteriaFileName}
        />
      )}
    </div>
  );
};

// Export the page component
export default AuditPage;
