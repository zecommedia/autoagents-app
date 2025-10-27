
import React from 'react';
import { CloseIcon } from '../constants';

interface ExamplePopupProps {
  show: boolean;
  onClose: () => void;
}

const ExamplePopup: React.FC<ExamplePopupProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="absolute bottom-4 right-4 w-72 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center p-3 border-b border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-300">Example usage</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close example">
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="p-2">
        <div className="relative rounded-md overflow-hidden">
          <img src="https://picsum.photos/seed/racecar/400/225" alt="Example of a racecar driver" className="w-full h-auto object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="absolute bottom-2 left-2 text-white text-xs font-mono drop-shadow-md">
            TOMATO SPLASH
          </div>
          <div className="absolute bottom-2 right-2">
             <button className="bg-lime-400/80 text-black text-xs px-2 py-1 rounded font-semibold">Generate</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamplePopup;
