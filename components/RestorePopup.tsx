import React from 'react';

interface RestorePopupProps {
  onRestore: () => void;
  onDiscard: () => void;
}

const RestorePopup: React.FC<RestorePopupProps> = ({ onRestore, onDiscard }) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl animate-fade-in z-50 p-3 flex items-center space-x-4">
      <p className="text-sm text-zinc-300">It looks like you have an unsaved session. Would you like to restore it?</p>
      <div className="flex items-center space-x-2">
        <button
          onClick={onRestore}
          className="px-3 py-1 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Restore
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1 text-sm font-medium text-zinc-300 rounded-md hover:bg-zinc-700 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
};

export default RestorePopup;
