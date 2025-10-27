import React from 'react';
import { CheckIcon, CloseIcon, ExportIcon } from '../constants';

interface Variation {
    src: string;
    width: number;
    height: number;
}
interface VariationViewerProps {
  images: Variation[];
  currentIndex: number;
  onSelectVariation: (index: number) => void;
  onAccept: () => void;
  onCancel: () => void;
}

const VariationViewer: React.FC<VariationViewerProps> = ({ images, currentIndex, onSelectVariation, onAccept, onCancel }) => {
  const handleDownload = (e: React.MouseEvent, src: string, index: number) => {
    e.stopPropagation(); // Prevent selecting the variation when downloading
    const link = document.createElement('a');
    link.href = src;
    link.download = `variation-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    images.forEach((image, index) => {
        const link = document.createElement('a');
        link.href = image.src;
        link.download = `variation_all-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
  };

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-auto max-w-lg bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-xl shadow-2xl animate-fade-in z-20 flex items-center p-2 space-x-4">
      <button
        onClick={onCancel}
        className="p-2 rounded-full text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        aria-label="Cancel variations"
      >
        <CloseIcon className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-2">
        {images.map((img, index) => (
          <div key={index} className="relative group">
            <button
              onClick={() => onSelectVariation(index)}
              className={`w-14 h-14 rounded-md overflow-hidden transition-all duration-200 ${
                currentIndex === index ? 'ring-2 ring-blue-500 scale-105' : 'ring-1 ring-zinc-600 hover:ring-blue-500'
              }`}
            >
              <img src={img.src} alt={`Variation ${index + 1}`} className="w-full h-full object-cover" />
            </button>
            <button
              onClick={(e) => handleDownload(e, img.src, index)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-blue-600 transition-opacity"
              aria-label={`Download variation ${index + 1}`}
            >
              <ExportIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      <div className="text-sm font-mono text-zinc-400 w-16 text-center">
        {currentIndex + 1} / {images.length}
      </div>

      <button
        onClick={handleExportAll}
        className="p-2 rounded-full text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        aria-label="Export all variations"
      >
        <ExportIcon className="w-5 h-5" />
      </button>

      <button
        onClick={onAccept}
        className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        aria-label="Accept current variation"
      >
        <CheckIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default VariationViewer;