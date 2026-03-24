// pages/FilesPage.tsx - S3 file management page
// Allows users to browse, upload, and delete documents in S3

// Import React and hooks
import React, { useState, useEffect } from 'react';
// Import API client functions
import { fetchCategories, fetchFiles, uploadFile, deleteFile } from '../api/client';
// Import UI components
import FileUploader from '../components/FileUploader';
import CategorySelector from '../components/CategorySelector';
import FileBrowser from '../components/FileBrowser';
// Import default config
import { DEFAULT_CATEGORIES } from '../config/categories';
// Import types
import type { Category, S3File } from '../types';

// FilesPage component for S3 file management
const FilesPage: React.FC = () => {
  // ========================================================================
  // STATE
  // ========================================================================

  // Available categories loaded from the API
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  // Currently selected category filter for the file browser
  const [filterCategory, setFilterCategory] = useState('');
  // Currently selected category for uploading new files
  const [uploadCategory, setUploadCategory] = useState('');
  // File selected for upload
  const [uploadFile_, setUploadFile] = useState<File | null>(null);
  // List of files in S3
  const [files, setFiles] = useState<S3File[]>([]);
  // Loading state for file operations
  const [loading, setLoading] = useState(false);
  // Uploading state for the upload operation
  const [uploading, setUploading] = useState(false);
  // Success message to display
  const [successMsg, setSuccessMsg] = useState('');
  // Error message to display
  const [error, setError] = useState('');

  // ========================================================================
  // EFFECTS - Load categories and files on mount
  // ========================================================================

  // Load categories from the API on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Fetch categories from the API
        const data = await fetchCategories();
        // Update state if data was returned
        if (data.categories.length > 0) setCategories(data.categories);
      } catch (err) {
        // Use defaults on failure
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Load files whenever the filter category changes
  useEffect(() => {
    loadFiles();
  }, [filterCategory]); // Re-run when the filter changes

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  // Function to load files from S3, optionally filtered by category
  const loadFiles = async () => {
    // Set loading state
    setLoading(true);
    try {
      // Fetch files from the API with the optional category filter
      const data = await fetchFiles(filterCategory || undefined);
      // Update the files state with the response
      setFiles(data.files);
    } catch (err) {
      // Display the error
      console.error('Failed to load files:', err);
      setError('Failed to load files. Please try again.');
    } finally {
      // Clear loading state
      setLoading(false);
    }
  };

  // ========================================================================
  // HANDLERS
  // ========================================================================

  // Handler for uploading a file to S3
  const handleUpload = async () => {
    // Validate inputs
    if (!uploadFile_) {
      setError('Please select a file to upload.');
      return;
    }
    if (!uploadCategory) {
      setError('Please select a category for the file.');
      return;
    }

    // Clear previous messages
    setError('');
    setSuccessMsg('');
    setUploading(true);

    try {
      // Call the upload API
      const response = await uploadFile(uploadFile_, uploadCategory);
      // Show success message
      setSuccessMsg(response.message);
      // Clear the upload form
      setUploadFile(null);
      // Reload the file list to show the new file
      await loadFiles();
    } catch (err: unknown) {
      // Display the error
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
    } finally {
      // Clear uploading state
      setUploading(false);
    }
  };

  // Handler for deleting a file from S3
  const handleDelete = async (s3Key: string, filename: string) => {
    // Confirm deletion with the user
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      // Call the delete API
      await deleteFile(s3Key);
      // Show success message
      setSuccessMsg(`"${filename}" deleted successfully.`);
      // Reload the file list
      await loadFiles();
    } catch (err) {
      // Display the error
      setError('Failed to delete file. Please try again.');
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    // Page container
    <div className="space-y-6">
      {/* Page title */}
      <h2 className="text-2xl font-bold text-gray-900">File Manager</h2>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMsg}</span>
          {/* Dismiss button */}
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">
            &times;
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          {/* Dismiss button */}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document</h3>
        {/* Upload form: file selector and category in a grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File uploader */}
          <FileUploader
            onFileSelect={setUploadFile}
            selectedFile={uploadFile_}
            label="Select File"
          />
          {/* Category selector for the upload target */}
          <div className="flex flex-col justify-between">
            <CategorySelector
              categories={categories}
              selectedCategory={uploadCategory}
              onCategoryChange={setUploadCategory}
              label="Upload to Category"
            />
            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile_ || !uploadCategory}
              className={`mt-4 w-full py-2 rounded-md font-medium text-white transition-colors
                ${uploading || !uploadFile_ || !uploadCategory
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {/* Show uploading state or default text */}
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </div>
      </div>

      {/* File browser section */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header with title and category filter */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Documents in S3</h3>
          {/* Category filter dropdown */}
          <div className="w-64">
            <CategorySelector
              categories={categories}
              selectedCategory={filterCategory}
              onCategoryChange={setFilterCategory}
              label=""
            />
          </div>
        </div>
        {/* File listing table */}
        <FileBrowser
          files={files}
          loading={loading}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};

// Export the page component
export default FilesPage;
