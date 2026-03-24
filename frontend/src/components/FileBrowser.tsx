// components/FileBrowser.tsx - S3 file browser with category filtering
// Displays files in the S3 bucket and supports deletion

// Import React
import React from 'react';
// Import the S3File type
import type { S3File } from '../types';

// Define props interface
interface FileBrowserProps {
  // List of files to display
  files: S3File[];
  // Whether the file list is currently loading
  loading: boolean;
  // Callback fired when the user clicks delete on a file
  onDelete: (s3Key: string, filename: string) => void;
}

// FileBrowser component displays a table of S3 files
const FileBrowser: React.FC<FileBrowserProps> = ({ files, loading, onDelete }) => {
  // Show loading state
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading files...
      </div>
    );
  }

  // Show empty state if no files exist
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No files found. Upload documents to get started.
      </div>
    );
  }

  // Helper function to format file size in human-readable form
  const formatSize = (bytes: number): string => {
    // If less than 1 KB, show bytes
    if (bytes < 1024) return `${bytes} B`;
    // If less than 1 MB, show KB
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    // Otherwise show MB
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper function to format dates in a readable format
  const formatDate = (isoDate: string): string => {
    // Parse the ISO date string and format it
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    // Table container with horizontal scroll for small screens
    <div className="overflow-x-auto">
      {/* File listing table */}
      <table className="min-w-full divide-y divide-gray-200">
        {/* Table header */}
        <thead className="bg-gray-50">
          <tr>
            {/* Filename column */}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Filename
            </th>
            {/* Category column */}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            {/* Size column */}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Size
            </th>
            {/* Last modified column */}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Modified
            </th>
            {/* Actions column */}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        {/* Table body with file rows */}
        <tbody className="bg-white divide-y divide-gray-200">
          {files.map((file) => (
            <tr key={file.key} className="hover:bg-gray-50">
              {/* Filename cell */}
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {file.filename}
              </td>
              {/* Category badge cell */}
              <td className="px-4 py-3 text-sm">
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                  {file.category}
                </span>
              </td>
              {/* File size cell */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {formatSize(file.size)}
              </td>
              {/* Last modified date cell */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {formatDate(file.lastModified)}
              </td>
              {/* Delete action cell */}
              <td className="px-4 py-3 text-right">
                <button
                  // Fire the delete callback with the file's S3 key and name
                  onClick={() => onDelete(file.key, file.filename)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Export the component
export default FileBrowser;
