// components/ToneSelector.tsx - Writing tone selection dropdown
// Allows users to pick a tone for document generation

// Import React
import React from 'react';
// Import the ToneOption type
import type { ToneOption } from '../types';

// Define props interface
interface ToneSelectorProps {
  // List of available tone options
  tones: ToneOption[];
  // Currently selected tone ID
  selectedTone: string;
  // Callback fired when the user selects a different tone
  onToneChange: (toneId: string) => void;
}

// ToneSelector component renders a styled dropdown for tone selection
const ToneSelector: React.FC<ToneSelectorProps> = ({
  tones,
  selectedTone,
  onToneChange,
}) => {
  return (
    // Wrapper div
    <div className="w-full">
      {/* Label for the dropdown */}
      <label className="block text-sm font-medium text-gray-700 mb-2">Writing Tone</label>
      {/* Select dropdown element */}
      <select
        // Bind selected value to parent state
        value={selectedTone}
        // Fire callback on change
        onChange={(e) => onToneChange(e.target.value)}
        // Styled dropdown
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   bg-white text-gray-900"
      >
        {/* Render an option for each tone */}
        {tones.map((tone) => (
          <option key={tone.id} value={tone.id}>
            {/* Display the tone label */}
            {tone.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// Export the component
export default ToneSelector;
