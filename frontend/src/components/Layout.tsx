// components/Layout.tsx - Main layout component with navigation bar
// Wraps all pages with consistent header, navigation, and footer

// Import React for JSX
import React from 'react';
// Import NavLink for navigation with active state styling
import { NavLink } from 'react-router-dom';

// Define props interface - children is the page content to render
interface LayoutProps {
  children: React.ReactNode;
}

// Layout component providing consistent page structure
const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Helper function to generate CSS classes for nav links
  // Active links get a different style to indicate the current page
  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    isActive
      ? 'px-4 py-2 rounded-md bg-blue-700 text-white font-medium'
      : 'px-4 py-2 rounded-md text-blue-100 hover:bg-blue-600 hover:text-white transition-colors';

  return (
    // Full-height flex container for sticky footer layout
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navigation header bar */}
      <header className="bg-blue-800 shadow-lg">
        {/* Constrain content width and add padding */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Flex container for logo and nav links */}
          <div className="flex items-center justify-between h-16">
            {/* Application title/logo */}
            <h1 className="text-xl font-bold text-white">RAG Document Tool</h1>
            {/* Navigation links */}
            <nav className="flex space-x-2">
              {/* Link to the Search page (main RAG workflow) */}
              <NavLink to="/" className={navLinkClass}>
                Search & Generate
              </NavLink>
              {/* Link to the Files management page */}
              <NavLink to="/files" className={navLinkClass}>
                File Manager
              </NavLink>
              {/* Link to the Document Audit page */}
              <NavLink to="/audit" className={navLinkClass}>
                Audit
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content area - grows to fill available space */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Render the current page content */}
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 text-center py-4 text-sm">
        RAG Document Tool - Powered by AWS Bedrock
      </footer>
    </div>
  );
};

// Export the Layout component as the default export
export default Layout;
