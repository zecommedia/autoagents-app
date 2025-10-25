import React, { useState } from 'react';
import { CloseIcon } from '../constants';

export interface ExportOptions {
    format: 'png' | 'jpeg';
    scale: number;
    quality: number; // 0-1 for jpeg
}

interface ExportPopupProps {
  show: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  isExporting: boolean;
}

const ExportPopup: React.FC<ExportPopupProps> = ({ show, onClose, onExport, isExporting }) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'png',
    scale: 1,
    quality: 0.9,
  });

  if (!show) return null;

  const handleExportClick = () => {
    onExport(options);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-700">
          <h3 className="text-base font-medium text-white">Export Canvas</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close export options">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Format</label>
            <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg p-1">
              <button
                onClick={() => setOptions(o => ({ ...o, format: 'png' }))}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${options.format === 'png' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
              >
                PNG
              </button>
              <button
                onClick={() => setOptions(o => ({ ...o, format: 'jpeg' }))}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${options.format === 'jpeg' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
              >
                JPEG
              </button>
            </div>
          </div>
          
          {/* Scale */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Scale</label>
            <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg p-1">
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setOptions(o => ({ ...o, scale: s }))}
                  className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${options.scale === s ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          
          {/* Quality (for JPEG) */}
          {options.format === 'jpeg' && (
            <div>
                <label htmlFor="quality" className="block text-sm font-medium text-zinc-300 mb-2">Quality</label>
                <div className="flex items-center space-x-3">
                    <input
                        id="quality"
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={options.quality}
                        onChange={(e) => setOptions(o => ({ ...o, quality: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-zinc-400 w-10 text-right">{(options.quality * 100).toFixed(0)}%</span>
                </div>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPopup;
