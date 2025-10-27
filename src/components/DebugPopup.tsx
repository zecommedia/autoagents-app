import React from 'react';
import { CloseIcon } from '../constants';
import type { Part } from '@google/genai';

interface DebugPopupProps {
  debugInfo: {
    parts: Part[];
    fullPrompt: string;
    sourceImages: { title: string; base64: string }[];
  };
  onClose: () => void;
  onContinue: () => void;
}

const DebugPopup: React.FC<DebugPopupProps> = ({ debugInfo, onClose, onContinue }) => {
  const { fullPrompt, sourceImages } = debugInfo;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-700 flex-shrink-0">
          <h3 className="text-base font-medium text-white">Debug: API Request Payload</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close debug view">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto">
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-2">Source Images (Input)</h4>
            <div className="space-y-4">
              {sourceImages.map((image, index) => (
                <div key={index}>
                  <h5 className="text-xs font-medium text-zinc-400 mb-1">{image.title}</h5>
                  <div className="bg-zinc-900 p-2 rounded-md border border-zinc-700">
                    <img
                      src={`data:image/png;base64,${image.base64}`}
                      alt={image.title}
                      className="w-full h-auto object-contain rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-2">Full Prompt (Text Part)</h4>
            <div className="bg-zinc-900 p-3 rounded-md border border-zinc-700 h-full max-h-[70vh] overflow-y-auto">
              <pre className="text-xs text-zinc-200 whitespace-pre-wrap font-mono break-words">
                {fullPrompt}
              </pre>
            </div>
          </div>
        </div>
        <div className="flex justify-end items-center p-4 border-t border-zinc-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 rounded-md hover:bg-zinc-700 transition-colors mr-2"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Continue with Generation
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPopup;
