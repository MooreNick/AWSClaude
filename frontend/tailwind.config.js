/** @type {import('tailwindcss').Config} */
// tailwind.config.js - Tailwind CSS configuration
// Defines which files to scan for class names and any theme customizations
export default {
  // Files to scan for Tailwind class usage (purges unused styles in production)
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // Theme customizations
  theme: {
    // Extend the default theme
    extend: {},
  },
  // Tailwind plugins (none needed for this project)
  plugins: [],
};
