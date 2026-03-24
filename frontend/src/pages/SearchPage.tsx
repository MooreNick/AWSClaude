// pages/SearchPage.tsx - Main RAG search and document generation page
// Implements the full workflow: Input -> Search -> Review -> Approve -> Generate

// Import React and hooks for state management and side effects
import React, { useState, useEffect } from 'react';
// Import API client functions for search, generation, and categories
import { fetchCategories, searchDocuments, generateDocument } from '../api/client';
// Import UI components used on this page
import FileUploader from '../components/FileUploader';
import CategorySelector from '../components/CategorySelector';
import ToneSelector from '../components/ToneSelector';
import SearchResults from '../components/SearchResults';
import GeneratedOutput from '../components/GeneratedOutput';
// Import default config values as fallbacks
import { DEFAULT_CATEGORIES, DEFAULT_TONES } from '../config/categories';
// Import types
import type { Category, ToneOption, SearchResult } from '../types';

// Enum for tracking which step of the workflow the user is on
type WorkflowStep = 'input' | 'results' | 'generated';

// SearchPage component - the main RAG search and generation workflow
const SearchPage: React.FC = () => {
  // ========================================================================
  // STATE - Track form inputs, search results, and generation output
  // ========================================================================

  // Available categories loaded from the API
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  // Available tone options loaded from the API
  const [tones, setTones] = useState<ToneOption[]>(DEFAULT_TONES);
  // The text query entered by the user
  const [queryText, setQueryText] = useState('');
  // The file uploaded by the user (optional)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // The selected category for filtering search results
  const [selectedCategory, setSelectedCategory] = useState('');
  // The selected writing tone for generation
  const [selectedTone, setSelectedTone] = useState('professional');
  // Additional instructions for the generation step
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  // Search results from the Knowledge Base
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  // Generated draft text from Claude
  const [generatedText, setGeneratedText] = useState('');
  // Source files used in generation
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  // Current workflow step
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('input');
  // Loading state for async operations
  const [loading, setLoading] = useState(false);
  // Error message to display
  const [error, setError] = useState('');

  // ========================================================================
  // EFFECTS - Load categories and tones on mount
  // ========================================================================

  useEffect(() => {
    // Async function to fetch categories from the API
    const loadCategories = async () => {
      try {
        // Call the categories API endpoint
        const data = await fetchCategories();
        // Update categories state if the API returned data
        if (data.categories.length > 0) setCategories(data.categories);
        // Update tones state if the API returned data
        if (data.tones.length > 0) setTones(data.tones);
      } catch (err) {
        // Log the error but use default values as fallback
        console.error('Failed to load categories, using defaults:', err);
      }
    };
    // Execute the fetch
    loadCategories();
  }, []); // Empty dependency array = run once on mount

  // ========================================================================
  // HANDLERS - User interactions for search, selection, and generation
  // ========================================================================

  // Handler for the Search button - sends query to Knowledge Base
  const handleSearch = async () => {
    // Validate that the user provided some search input
    if (!queryText.trim() && !uploadedFile) {
      setError('Please enter a search query or upload a document.');
      return;
    }
    // Clear any previous errors
    setError('');
    // Set loading state
    setLoading(true);

    try {
      // Call the search API with the query, category, and optional file
      const response = await searchDocuments(
        queryText,
        selectedCategory,
        uploadedFile,
      );
      // Mark all results as selected by default
      const resultsWithSelection = response.results.map((r) => ({
        ...r,
        selected: true,
      }));
      // Update the search results state
      setSearchResults(resultsWithSelection);
      // Move to the results review step
      setCurrentStep('results');
    } catch (err: unknown) {
      // Display the error message to the user
      const errorMessage = err instanceof Error ? err.message : 'Search failed. Please try again.';
      setError(errorMessage);
    } finally {
      // Clear loading state regardless of success or failure
      setLoading(false);
    }
  };

  // Handler for toggling a search result's selection state
  const handleToggleResult = (index: number) => {
    // Create a copy of the results array
    const updated = [...searchResults];
    // Toggle the selected state of the clicked result
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    // Update the state with the modified results
    setSearchResults(updated);
  };

  // Handler for the "Proceed with Selected" button - triggers generation
  const handleProceed = async () => {
    // Filter to only selected results
    const selected = searchResults.filter((r) => r.selected);
    // Validate that at least one result is selected
    if (selected.length === 0) {
      setError('Please select at least one result to proceed.');
      return;
    }
    // Clear errors and set loading
    setError('');
    setLoading(true);

    try {
      // Call the generate API with selected passages, query, and tone
      const response = await generateDocument(
        queryText || 'Generate based on the uploaded document and selected references.',
        selected.map((r) => ({
          fileName: r.fileName,
          passage: r.passage,
          category: r.category,
        })),
        selectedTone,
        additionalInstructions,
      );
      // Update the generated text state
      setGeneratedText(response.generatedText);
      // Store the source files for attribution
      setSourceFiles(response.sourceFiles);
      // Move to the generated output step
      setCurrentStep('generated');
    } catch (err: unknown) {
      // Display the error
      const errorMessage = err instanceof Error ? err.message : 'Generation failed. Please try again.';
      setError(errorMessage);
    } finally {
      // Clear loading state
      setLoading(false);
    }
  };

  // Handler for the "Revise" button - go back to results or input
  const handleRevise = () => {
    // If we were on the generated step, go back to results
    if (currentStep === 'generated') {
      setCurrentStep('results');
    } else {
      // Otherwise go back to the input step
      setCurrentStep('input');
    }
  };

  // Handler for starting a new search from scratch
  const handleNewSearch = () => {
    // Reset all state to initial values
    setQueryText('');
    setUploadedFile(null);
    setSearchResults([]);
    setGeneratedText('');
    setSourceFiles([]);
    setAdditionalInstructions('');
    setError('');
    setCurrentStep('input');
  };

  // ========================================================================
  // RENDER - Display the appropriate step of the workflow
  // ========================================================================

  return (
    // Page container
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Search & Generate</h2>
        {/* Show "New Search" button when not on the input step */}
        {currentStep !== 'input' && (
          <button
            onClick={handleNewSearch}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700
                       hover:bg-gray-50 transition-colors text-sm"
          >
            New Search
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {/* Input step indicator */}
        <span className={`px-3 py-1 rounded-full ${currentStep === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          1. Input
        </span>
        <span className="text-gray-400">&rarr;</span>
        {/* Results step indicator */}
        <span className={`px-3 py-1 rounded-full ${currentStep === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          2. Review Results
        </span>
        <span className="text-gray-400">&rarr;</span>
        {/* Generated step indicator */}
        <span className={`px-3 py-1 rounded-full ${currentStep === 'generated' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          3. Generated Draft
        </span>
      </div>

      {/* Error message display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* STEP 1: Input form */}
      {currentStep === 'input' && (
        <div className="space-y-6 bg-white rounded-lg shadow p-6">
          {/* Text query input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Query (optional if uploading a file)
            </label>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Enter text to search for relevant documents..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* File upload */}
          <FileUploader
            onFileSelect={setUploadedFile}
            selectedFile={uploadedFile}
            label="Upload a Document (optional if entering text above)"
          />

          {/* Category and Tone selectors side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategorySelector
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
            <ToneSelector
              tones={tones}
              selectedTone={selectedTone}
              onToneChange={setSelectedTone}
            />
          </div>

          {/* Additional instructions for generation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Instructions for Generation (optional)
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Any specific guidance for the generated draft..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className={`w-full py-3 rounded-md font-medium text-white transition-colors
              ${loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {/* Show loading text or default text */}
            {loading ? 'Searching...' : 'Search for Relevant Documents'}
          </button>
        </div>
      )}

      {/* STEP 2: Search results review */}
      {currentStep === 'results' && (
        <div className="bg-white rounded-lg shadow p-6">
          {/* Loading overlay for generation */}
          {loading && (
            <div className="text-center py-4 text-blue-600 font-medium">
              Generating draft document...
            </div>
          )}
          {/* Search results with selection checkboxes */}
          {!loading && (
            <SearchResults
              results={searchResults}
              onToggleResult={handleToggleResult}
              onProceed={handleProceed}
            />
          )}
          {/* Back to input button */}
          {!loading && (
            <button
              onClick={handleRevise}
              className="mt-4 px-4 py-2 border border-gray-300 rounded-md text-gray-700
                         hover:bg-gray-50 transition-colors text-sm"
            >
              Back to Search Input
            </button>
          )}
        </div>
      )}

      {/* STEP 3: Generated output */}
      {currentStep === 'generated' && (
        <div className="bg-white rounded-lg shadow p-6">
          <GeneratedOutput
            generatedText={generatedText}
            sourceFiles={sourceFiles}
            tone={selectedTone}
            onRevise={handleRevise}
          />
        </div>
      )}
    </div>
  );
};

// Export the page component
export default SearchPage;
