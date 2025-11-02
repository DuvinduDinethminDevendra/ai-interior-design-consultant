
import React, { useState, useRef, useCallback } from 'react';

interface ImageComparatorProps {
  original: string;
  redesigned: string;
}

export const ImageComparator: React.FC<ImageComparatorProps> = ({ original, redesigned }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  return (
    <div
      ref={imageContainerRef}
      className="relative w-full h-full select-none overflow-hidden rounded-lg group"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <img
        src={original}
        alt="Original Room"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable="false"
      />
      <div
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={redesigned}
          alt="Redesigned Room"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable="false"
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-1 bg-white/50 cursor-ew-resize pointer-events-none group-hover:bg-white transition-colors"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full h-10 w-10 flex items-center justify-center shadow-2xl">
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>
       <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded-md text-sm pointer-events-none">Original</div>
      <div 
        className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-sm pointer-events-none"
        style={{ opacity: sliderPosition > 55 ? 1 : 0, transition: 'opacity 0.2s' }}
      >
        Redesigned
      </div>
    </div>
  );
};
