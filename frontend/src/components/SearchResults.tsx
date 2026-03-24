// components/SearchResults.tsx - Displays RAG search results with selection checkboxes
// Shows matching files, relevant passages, and relevance scores

// Import React
import React from 'react';
// Import the SearchResult type
import type { SearchResult } from '../types';

// Define props interface
interface SearchResultsProps {
  // List of search results to display
  results: SearchResult[];
  // Callback fired when a result's selection state changes
  onToggleResult: (index: number) => void;
  // Callback fired when the user clicks "Proceed with Selected"
  onProceed: () => void;
}

// SearchResults component displays results with checkboxes for approval
const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onToggleResult,
  onProceed,
}) => {
  // Count how many results are currently selected
  const selectedCount = results.filter((r) => r.selected).length;

  // Show a message if no results were found
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No results found. Try adjusting your search query or category.
      </div>
    );
  }

  return (
    // Results container
    <div className="space-y-4">
      {/* Header with result count and proceed button */}
      <div className="flex items-center justify-between">
        {/* Result count */}
        <h3 className="text-lg font-medium text-gray-900">
          Search Results ({results.length} found)
        </h3>
        {/* Proceed button - only enabled when at least one result is selected */}
        <button
          onClick={onProceed}
          disabled={selectedCount === 0}
          className={`px-4 py-2 rounded-md font-medium transition-colors
            ${selectedCount > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          {/* Show count of selected results on the button */}
          Proceed with Selected ({selectedCount})
        </button>
      </div>

      {/* List of individual result cards */}
      {results.map((result, index) => (
        // Result card with selection highlighting
        <div
          key={index}
          className={`border rounded-lg p-4 transition-colors cursor-pointer
            ${result.selected
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          // Toggle selection when the card is clicked
          onClick={() => onToggleResult(index)}
        >
          {/* Result header: checkbox, filename, and score */}
          <div className="flex items-start gap-3">
            {/* Selection checkbox */}
            <input
              type="checkbox"
              checked={result.selected || false}
              onChange={() => onToggleResult(index)}
              // Stop click from bubbling to the card's onClick
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 text-blue-600 rounded"
            />
            {/* File info section */}
            <div className="flex-1">
              {/* Filename and score on the same line */}
              <div className="flex items-center justify-between">
                {/* Source filename */}
                <h4 className="font-medium text-gray-900">{result.fileName}</h4>
                {/* Relevance score badge */}
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  Score: {(result.score * 100).toFixed(1)}%
                </span>
              </div>
              {/* Category badge */}
              <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 mt-1">
                {result.category}
              </span>
              {/* Relevant passage from the document */}
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {/* Show first 500 characters of the passage with ellipsis if longer */}
                {result.passage.length > 500
                  ? `${result.passage.substring(0, 500)}...`
                  : result.passage}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Export the component
export default SearchResults;
