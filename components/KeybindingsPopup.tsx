import React from 'react';
import { CloseIcon } from '../constants';

interface KeybindingsPopupProps {
  show: boolean;
  onClose: () => void;
}

const KeybindingItem: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-zinc-300">{description}</span>
        <div className="flex items-center space-x-1">
            {keys.map((key, index) => (
                <React.Fragment key={key}>
                    <kbd className="px-2 py-1.5 text-xs font-sans font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-zinc-600 dark:text-gray-100 dark:border-zinc-500">
                        {key}
                    </kbd>
                    {index < keys.length -1 && <span className="text-zinc-400">+</span>}
                </React.Fragment>
            ))}
        </div>
    </div>
);


const KeybindingsPopup: React.FC<KeybindingsPopupProps> = ({ show, onClose }) => {
  if (!show) return null;
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlCmdKey = isMac ? 'Cmd' : 'Ctrl';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-700">
          <h3 className="text-base font-medium text-white">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close shortcuts">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
            <KeybindingItem keys={[ctrlCmdKey, 'Z']} description="Undo" />
            <KeybindingItem keys={[ctrlCmdKey, 'Shift', 'Z']} description="Redo" />
            <KeybindingItem keys={['Shift', 'Enter']} description="Generate Image" />
            <KeybindingItem keys={['Mouse Wheel']} description="Zoom In/Out" />
            <KeybindingItem keys={['Spacebar', 'Drag']} description="Pan Canvas" />
            <div className="border-t border-zinc-700 my-2"></div>
            <KeybindingItem keys={[ctrlCmdKey, 'C']} description="Copy Selection" />
            <KeybindingItem keys={[ctrlCmdKey, 'V']} description="Paste Selection" />
            <KeybindingItem keys={['Backspace']} description="Delete Selection" />
            <div className="border-t border-zinc-700 my-2"></div>
            <KeybindingItem keys={['V']} description="Select Tool" />
            <KeybindingItem keys={['B']} description="Brush Tool" />
            <KeybindingItem keys={['E']} description="Eraser Tool" />
            <KeybindingItem keys={['L']} description="Arrow Tool" />
            <KeybindingItem keys={['M']} description="Rectangle Tool" />
            <KeybindingItem keys={['T']} description="Text Tool" />
            <KeybindingItem keys={['C']} description="Crop Tool" />
        </div>
      </div>
    </div>
  );
};

export default KeybindingsPopup;