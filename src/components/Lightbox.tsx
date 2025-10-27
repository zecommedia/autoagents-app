import React, { useState, useEffect, useRef } from 'react';
import ZoomableImage from './ZoomableImage';
import { CloseIcon, DownloadIcon, CopyIcon, SpinnerIcon } from '../constants';

interface LightboxProps {
    src: string;
    onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ src, onClose }) => {
    const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');
    // Zoom/pan handled by ZoomableImage component

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = src;
        link.download = `gemini-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopy = async () => {
        if (copyState !== 'idle') return;
        setCopyState('copying');
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const blobType = blob.type || 'image/png';
            await navigator.clipboard.write([
                new ClipboardItem({ [blobType]: new Blob([blob], { type: blobType }) }),
            ]);
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 2000);
        } catch (error) {
            console.error('Failed to copy image:', error);
            alert('Failed to copy image to clipboard.');
            setCopyState('idle');
        }
    };

    const copyButtonText = {
        idle: 'Copy Image',
        copying: 'Copying...',
        copied: 'Copied!',
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div className="relative w-full h-full p-4 sm:p-8 md:p-16 flex items-center justify-center">
                <ZoomableImage src={src} className="max-w-full max-h-full overflow-hidden rounded-lg shadow-2xl" />

                <div className="absolute top-4 right-4 flex items-center space-x-2">
                    <div className="flex items-center space-x-2 mr-2">
                        <button onClick={(e) => { e.stopPropagation(); /* zoom control can be added via ref if needed */ }} className="p-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors">+</button>
                        <button onClick={(e) => { e.stopPropagation(); }} className="p-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors">−</button>
                        <button onClick={(e) => { e.stopPropagation(); }} className="p-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors">Reset</button>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                        className="p-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors"
                        aria-label="Download image"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                        className="px-4 py-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors flex items-center space-x-2 text-sm"
                        aria-label="Copy image"
                        disabled={copyState !== 'idle'}
                    >
                        {copyState === 'copying' && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                        {copyState !== 'copying' && <CopyIcon className="w-4 h-4" />}
                        <span>{copyButtonText[copyState]}</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors"
                        aria-label="Close lightbox"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Lightbox;
