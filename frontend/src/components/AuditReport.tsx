// components/AuditReport.tsx - Displays the structured document audit report
// Shows each criterion with its verdict, evidence, and recommendations

// Import React
import React from 'react';
// Import the AuditReport type
import type { AuditReport as AuditReportType } from '../types';

// Define props interface
interface AuditReportProps {
  // The structured audit report from the API
  report: AuditReportType;
  // Name of the file that was audited
  auditedFile: string;
  // Name of the criteria reference file
  criteriaFile: string;
}

// AuditReport component renders the structured audit results
const AuditReportDisplay: React.FC<AuditReportProps> = ({
  report,
  auditedFile,
  criteriaFile,
}) => {
  // Helper function to get the CSS color class for a verdict
  const getVerdictColor = (verdict: string): string => {
    // Map each verdict to a color scheme
    if (verdict === 'MEETS') return 'bg-green-100 text-green-800';
    if (verdict === 'PARTIALLY MEETS') return 'bg-yellow-100 text-yellow-800';
    if (verdict === 'DOES NOT MEET') return 'bg-red-100 text-red-800';
    // Default color for unknown verdicts
    return 'bg-gray-100 text-gray-800';
  };

  // Helper function to get the color for the overall score
  const getOverallColor = (score: string): string => {
    if (score === 'PASS') return 'text-green-700 bg-green-50 border-green-200';
    if (score === 'PARTIAL') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    if (score === 'FAIL') return 'text-red-700 bg-red-50 border-red-200';
    return 'text-gray-700 bg-gray-50 border-gray-200';
  };

  // If the report only has a raw text response (JSON parsing failed)
  if (report.rawResponse) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <h3 className="text-lg font-medium text-gray-900">Audit Report</h3>
        {/* File info */}
        <div className="text-sm text-gray-500">
          <p>Audited: {auditedFile}</p>
          <p>Against: {criteriaFile}</p>
        </div>
        {/* Raw response display */}
        <div className="border rounded-lg p-4 bg-white whitespace-pre-wrap text-sm text-gray-800">
          {report.rawResponse}
        </div>
      </div>
    );
  }

  return (
    // Report container
    <div className="space-y-6">
      {/* Report header with overall score */}
      <div className={`border rounded-lg p-4 ${getOverallColor(report.overallScore)}`}>
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Audit Report</h3>
          {/* Overall score badge */}
          <span className="text-xl font-bold">{report.overallScore}</span>
        </div>
        {/* File info */}
        <div className="text-sm mt-1 opacity-80">
          <p>Audited: {auditedFile} | Criteria: {criteriaFile}</p>
        </div>
        {/* Summary */}
        <p className="mt-2 text-sm">{report.summary}</p>
        {/* Criteria count */}
        <p className="mt-1 text-xs opacity-70">
          {report.totalCriteria} criteria evaluated
        </p>
      </div>

      {/* Individual criterion results */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Detailed Results</h4>
        {/* Render each criterion result */}
        {report.criteriaResults?.map((result, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
            {/* Criterion header with number, text, and verdict */}
            <div className="flex items-start justify-between gap-4">
              {/* Criterion number and text */}
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {result.criterionNumber}. {result.criterion}
                </p>
              </div>
              {/* Verdict badge */}
              <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                ${getVerdictColor(result.verdict)}`}>
                {result.verdict}
              </span>
            </div>
            {/* Evidence quote */}
            {result.evidence && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Evidence</p>
                <p className="text-sm text-gray-600 italic mt-1">"{result.evidence}"</p>
              </div>
            )}
            {/* Notes/explanation */}
            {result.notes && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Notes</p>
                <p className="text-sm text-gray-600 mt-1">{result.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recommendations section */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <h4 className="font-medium text-blue-900">Recommendations</h4>
          {/* List of recommendations */}
          <ul className="mt-2 space-y-1">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                {/* Bullet point */}
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {/* Recommendation text */}
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Export the component
export default AuditReportDisplay;
