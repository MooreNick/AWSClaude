// main.tsx - Application entry point
// Mounts the React app to the DOM and wraps it with the router provider

// Import React for JSX support
import React from 'react';
// Import ReactDOM for rendering React components into the browser DOM
import ReactDOM from 'react-dom/client';
// Import BrowserRouter for client-side routing (URL-based navigation)
import { BrowserRouter } from 'react-router-dom';
// Import the root App component
import App from './App';
// Import global CSS styles (includes Tailwind directives)
import './index.css';

// Find the root DOM element where React will mount
const rootElement = document.getElementById('root')!;

// Create a React root and render the application
ReactDOM.createRoot(rootElement).render(
  // StrictMode enables additional development checks and warnings
  <React.StrictMode>
    {/* BrowserRouter enables client-side URL routing for SPA navigation */}
    <BrowserRouter>
      {/* App is the top-level component containing all pages and layout */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
