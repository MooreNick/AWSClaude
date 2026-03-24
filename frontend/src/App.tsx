// App.tsx - Root application component
// Sets up React Router routes and wraps pages with the shared Layout

// Import React
import React from 'react';
// Import Routes and Route components for defining URL-to-page mappings
import { Routes, Route } from 'react-router-dom';
// Import the shared layout component (header, footer, navigation)
import Layout from './components/Layout';
// Import page components for each route
import SearchPage from './pages/SearchPage';
import FilesPage from './pages/FilesPage';
import AuditPage from './pages/AuditPage';

// App component - the root component that renders the appropriate page
const App: React.FC = () => {
  return (
    // Wrap all pages with the shared Layout (nav bar, footer)
    <Layout>
      {/* Define URL routes and their corresponding page components */}
      <Routes>
        {/* Home route - Search & Generate page (main workflow) */}
        <Route path="/" element={<SearchPage />} />
        {/* File Manager route - Browse and upload S3 documents */}
        <Route path="/files" element={<FilesPage />} />
        {/* Audit route - Document audit tool */}
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </Layout>
  );
};

// Export the App component as the default export
export default App;
