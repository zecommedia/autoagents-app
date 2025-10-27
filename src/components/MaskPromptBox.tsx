import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, SpinnerIcon, ImageIcon, ScissorsIcon, StraightenTextIcon } from '../constants';
import type { MaskPromptState } from '../App';

interface MaskPromptBoxProps {
    state: MaskPromptState;
    onStateChange: React.Dispatch<React.SetStateAction<MaskPromptState>>;
    onClose: () => void;
    onGenerate: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onRemoveBackground: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onFixGenerate: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isGenerating: boolean;
    appMode: 'canvas' | 'edit';
}

const MaskPromptBox: React.FC<MaskPromptBoxProps> = ({ state, onStateChange, onClose, onGenerate, onRemoveBackground, onFixGenerate, isGenerating, appMode }) => {
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onStateChange({ ...state, promptText: e.target.value });
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };

    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    const resultString = reader.result;
                    onStateChange(s => ({ ...s, droppedImage: resultString }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const stagedAssetSrc = e.dataTransfer.getData('application/x-staged-asset-src');
        if (stagedAssetSrc) {
            onStateChange(s => ({ ...s, droppedImage: stagedAssetSrc }));
            return;
        }

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    processFile(file);
                    break;
                }
            }
        }
    };
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        container.addEventListener('paste', handlePaste);
        return () => {
            container.removeEventListener('paste', handlePaste);
        };
    }, [containerRef, onStateChange]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // This cast is safe because the event will be a button click event in the onGenerate call.
        // We pass a synthetic event to satisfy the type.
        onGenerate({} as React.MouseEvent<HTMLButtonElement>);
      }
    };

    return (
        <div 
            ref={containerRef}
            className="absolute z-20 w-80 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl animate-fade-in flex flex-col"
            style={{ left: `${state.x}px`, top: `${state.y}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-3 border-b border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-300">Edit Masked Area</h3>
                <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close prompt">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="p-3 space-y-3">
                <textarea
                    placeholder="Describe the edit..."
                    value={state.promptText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    className="w-full bg-zinc-900 text-sm text-zinc-200 rounded-md border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2 resize-none outline-none"
                />
                <div 
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`w-full h-24 border-2 border-dashed rounded-md flex items-center justify-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-600 hover:border-zinc-500'}`}
                >
                    {state.droppedImage ? (
                        <img src={state.droppedImage} alt="Dropped preview" className="max-h-full max-w-full object-contain rounded-md" />
                    ) : (
                        <div className="text-center text-xs text-zinc-400">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                            <p>Drop or paste a reference image</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {appMode === 'edit' && (
                        <button
                            onClick={onRemoveBackground}
                            disabled={isGenerating}
                            className="p-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove Background"
                        >
                            <ScissorsIcon className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={onFixGenerate}
                        disabled={isGenerating || !state.promptText}
                        className="p-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Fix/Refine Masked Area"
                    >
                        <StraightenTextIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onGenerate}
                        disabled={isGenerating || (!state.promptText && !state.droppedImage)}
                        className="flex-grow bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-4 py-2 rounded-lg flex items-center justify-center font-semibold text-sm hover:from-blue-600 hover:to-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <>
                                <span>Generating...</span>
                                <SpinnerIcon className="w-4 h-4 animate-spin ml-2" />
                            </>
                        ) : (
                            <span>Generate</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaskPromptBox;