// components/FileUploader.tsx - Drag-and-drop file upload component
// Supports PDF, DOCX, TXT, and other configured file types

// Import React and hooks
import React, { useRef, useState } from 'react';

// Define props interface for the FileUploader component
interface FileUploaderProps {
  // Callback fired when a file is selected or dropped
  onFileSelect: (file: File) => void;
  // Optional label displayed above the upload area
  label?: string;
  // Optional list of accepted file extensions (e.g., ['.pdf', '.docx'])
  acceptedTypes?: string[];
  // Optional currently selected file (for controlled component behavior)
  selectedFile?: File | null;
}

// FileUploader component with drag-and-drop support
const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  label = 'Upload a document',
  acceptedTypes = ['.pdf', '.docx', '.txt', '.md', '.html', '.csv'],
  selectedFile = null,
}) => {
  // State to track whether a file is being dragged over the drop zone
  const [isDragging, setIsDragging] = useState(false);
  // Ref to the hidden file input element (used to trigger click-to-select)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler for when a file is dragged over the drop zone
  const handleDragOver = (e: React.DragEvent) => {
    // Prevent the browser's default drag behavior (which would open the file)
    e.preventDefault();
    // Set dragging state to true for visual feedback
    setIsDragging(true);
  };

  // Handler for when a dragged file leaves the drop zone
  const handleDragLeave = (e: React.DragEvent) => {
    // Prevent default browser behavior
    e.preventDefault();
    // Remove the dragging visual feedback
    setIsDragging(false);
  };

  // Handler for when a file is dropped on the drop zone
  const handleDrop = (e: React.DragEvent) => {
    // Prevent the browser from opening the dropped file
    e.preventDefault();
    // Remove the dragging visual feedback
    setIsDragging(false);
    // Get the list of dropped files
    const files = e.dataTransfer.files;
    // Process the first file if any were dropped
    if (files.length > 0) {
      // Call the parent's callback with the dropped file
      onFileSelect(files[0]);
    }
  };

  // Handler for when a file is selected via the click-to-browse dialog
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get the selected files from the input element
    const files = e.target.files;
    // Process the first file if any were selected
    if (files && files.length > 0) {
      // Call the parent's callback with the selected file
      onFileSelect(files[0]);
    }
  };

  // Handler for clicking the drop zone to open the file browser
  const handleClick = () => {
    // Programmatically trigger the hidden file input's click event
    fileInputRef.current?.click();
  };

  return (
    // Wrapper div
    <div className="w-full">
      {/* Label displayed above the upload area */}
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {/* Drop zone area with click and drag-and-drop support */}
      <div
        // Apply different styles when dragging vs. idle
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
        // Attach drag-and-drop event handlers
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        // Open file browser on click
        onClick={handleClick}
      >
        {/* Hidden file input element */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          // Accept the configured file types
          accept={acceptedTypes.join(',')}
          // Hide the native file input (we use the styled drop zone instead)
          className="hidden"
        />
        {/* Show selected file info or upload instructions */}
        {selectedFile ? (
          // Display selected file name and size
          <div>
            <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {/* Format file size: show KB for small files, MB for larger */}
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <p className="text-xs text-gray-400 mt-1">Click or drag to replace</p>
          </div>
        ) : (
          // Display upload instructions when no file is selected
          <div>
            <p className="text-gray-500">Drag and drop a file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">
              {/* Show accepted file types */}
              Supported: {acceptedTypes.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Export the FileUploader component
export default FileUploader;
