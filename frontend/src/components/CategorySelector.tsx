// components/CategorySelector.tsx - Category selection dropdown
// Allows users to pick a document category for search filtering

// Import React
import React from 'react';
// Import the Category type
import type { Category } from '../types';

// Define props interface
interface CategorySelectorProps {
  // List of available categories to display
  categories: Category[];
  // Currently selected category ID
  selectedCategory: string;
  // Callback fired when the user selects a different category
  onCategoryChange: (categoryId: string) => void;
  // Optional label text
  label?: string;
}

// CategorySelector component renders a styled dropdown
const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  label = 'Search Category',
}) => {
  return (
    // Wrapper div
    <div className="w-full">
      {/* Label for the dropdown */}
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {/* Select dropdown element */}
      <select
        // Bind the selected value to the parent's state
        value={selectedCategory}
        // Fire the callback when the user makes a selection
        onChange={(e) => onCategoryChange(e.target.value)}
        // Styled with Tailwind classes
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   bg-white text-gray-900"
      >
        {/* Default option prompting the user to select */}
        <option value="">All Categories</option>
        {/* Render an option for each available category */}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {/* Display the category label */}
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// Export the component
export default CategorySelector;
