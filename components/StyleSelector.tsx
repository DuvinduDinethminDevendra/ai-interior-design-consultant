
import React from 'react';

interface StyleSelectorProps {
  styles: string[];
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  generatedStatus: string[];
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ styles, selectedStyle, onStyleChange, generatedStatus }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-3 text-indigo-400">Choose a Style</h3>
      <div className="grid grid-cols-2 gap-2">
        {styles.map((style) => (
          <button
            key={style}
            onClick={() => onStyleChange(style)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
              ${selectedStyle === style ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {style}
            {!generatedStatus.includes(style) && (
              <span className="ml-2 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Generating..."></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
