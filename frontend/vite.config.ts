// vite.config.ts - Vite build tool configuration
// Configures React plugin and proxy for local development

// Import the defineConfig helper for type-safe configuration
import { defineConfig } from 'vite';
// Import the React plugin for JSX/TSX support
import react from '@vitejs/plugin-react';

// Export the Vite configuration
export default defineConfig({
  // Enable the React plugin for JSX transformation
  plugins: [react()],
  // Development server configuration
  server: {
    // Port for the local dev server
    port: 3000,
    // Proxy API requests to a local backend during development
    proxy: {
      '/api': {
        // Target for API requests (change to your API Gateway URL for remote testing)
        target: 'http://localhost:8000',
        // Enable request origin rewriting
        changeOrigin: true,
      },
    },
  },
  // Build output configuration
  build: {
    // Output directory for production build
    outDir: 'dist',
    // Generate source maps for debugging
    sourcemap: false,
  },
});
