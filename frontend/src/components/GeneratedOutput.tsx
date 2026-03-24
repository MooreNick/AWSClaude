// components/GeneratedOutput.tsx - Displays the generated draft document
// Shows the AI-generated text with source attribution and copy functionality

// Import React and useState hook
import React, { useState } from 'react';

// Define props interface
interface GeneratedOutputProps {
  // The generated draft document text
  generatedText: string;
  // List of source files used as references
  sourceFiles: string[];
  // The tone that was applied
  tone: string;
  // Callback to go back and revise the search/selection
  onRevise: () => void;
}

// GeneratedOutput component displays the AI-generated draft
const GeneratedOutput: React.FC<GeneratedOutputProps> = ({
  generatedText,
  sourceFiles,
  tone,
  onRevise,
}) => {
  // State to track whether the text has been copied to clipboard
  const [copied, setCopied] = useState(false);

  // Handler to copy the generated text to the clipboard
  const handleCopy = async () => {
    try {
      // Use the browser's clipboard API to copy the text
      await navigator.clipboard.writeText(generatedText);
      // Set the copied state to show feedback
      setCopied(true);
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Log clipboard errors (may fail in some browsers/contexts)
      console.error('Failed to copy text:', err);
    }
  };

  return (
    // Output container
    <div className="space-y-4">
      {/* Header with title and action buttons */}
      <div className="flex items-center justify-between">
        {/* Section title */}
        <h3 className="text-lg font-medium text-gray-900">Generated Draft</h3>
        {/* Action buttons */}
        <div className="flex gap-2">
          {/* Revise button to go back and modify the search/selection */}
          <button
            onClick={onRevise}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700
                       hover:bg-gray-50 transition-colors font-medium"
          >
            Revise
          </button>
          {/* Copy to clipboard button */}
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded-md
                       hover:bg-blue-700 transition-colors font-medium"
          >
            {/* Show "Copied!" feedback or default "Copy" text */}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>

      {/* Metadata: tone and source files */}
      <div className="flex flex-wrap gap-2 text-sm">
        {/* Tone badge */}
        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
          Tone: {tone}
        </span>
        {/* Source file badges */}
        {sourceFiles.map((file, index) => (
          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
            {file}
          </span>
        ))}
      </div>

      {/* Generated text display area */}
      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        {/* Render the generated text preserving whitespace and line breaks */}
        <div className="prose max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
          {generatedText}
        </div>
      </div>
    </div>
  );
};

// Export the component
export default GeneratedOutput;
