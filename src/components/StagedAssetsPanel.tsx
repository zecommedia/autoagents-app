import React, { useState, useEffect, useRef } from 'react';
import { type StagedAsset } from '../types';
import { CloseIcon } from '../constants';
import StagedAssetContextMenu from './StagedAssetContextMenu';

interface StagedAssetsPanelProps {
    assets: StagedAsset[];
    onDelete: (id: string) => void;
}

// Download icon SVG component
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const StagedAssetsPanel: React.FC<StagedAssetsPanelProps> = ({ assets, onDelete }) => {
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean; x: number; y: number; targetAssetSrc: string | null;
    }>({ visible: false, x: 0, y: 0, targetAssetSrc: null });

    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const closeMenu = () => setContextMenu(c => ({...c, visible: false}));
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, assetSrc: string) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetAssetSrc: assetSrc });
    };

    const handleDragStart = (e: React.DragEvent, asset: StagedAsset) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-staged-asset-src', asset.src);
    };

    const handleExport = (asset: StagedAsset) => {
        // Create a temporary link element to download the image
        const link = document.createElement('a');
        link.href = asset.src;
        link.download = `staged-asset-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (assets.length === 0) {
        return null;
    }

    return (
        <div ref={panelRef} className="w-64 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl animate-fade-in flex flex-col">
            <div className="flex justify-between items-center p-3 border-b border-zinc-700 flex-shrink-0">
                <h3 className="text-sm font-medium text-zinc-300">Staged Assets</h3>
            </div>
            <div className="p-2 flex-grow overflow-y-auto" style={{ maxHeight: '200px' }}>
                <div className="grid grid-cols-3 gap-2">
                    {assets.map(asset => (
                        <div 
                            key={asset.id} 
                            className="relative group aspect-square"
                            onContextMenu={(e) => handleContextMenu(e, asset.src)}
                        >
                            <img
                                src={asset.src}
                                alt="Staged asset"
                                draggable
                                onDragStart={(e) => handleDragStart(e, asset)}
                                className="w-full h-full object-contain rounded-md bg-zinc-700/50 cursor-grab active:cursor-grabbing"
                            />
                            <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                    onClick={() => handleExport(asset)}
                                    className="w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition-all"
                                    aria-label="Export asset"
                                >
                                    <DownloadIcon className="w-2.5 h-2.5" />
                                </button>
                                <button 
                                    onClick={() => onDelete(asset.id)}
                                    className="w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-all"
                                    aria-label="Delete asset"
                                >
                                    <CloseIcon className="w-2.5 h-2.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {contextMenu.visible && contextMenu.targetAssetSrc && (
                <StagedAssetContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    targetAssetSrc={contextMenu.targetAssetSrc}
                    onClose={() => setContextMenu({ visible: false, x: 0, y: 0, targetAssetSrc: null })}
                />
            )}
        </div>
    );
};

export default StagedAssetsPanel;
