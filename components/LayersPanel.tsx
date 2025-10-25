import React, { useMemo, useState } from 'react';
import { type CanvasObjectType } from '../types';
import { PhotoIcon, TextIcon, RectIcon, LineIcon, BrushIcon, EyeOpenIcon, EyeClosedIcon, TrashIcon, CloseIcon, ExportIcon } from '../constants';

interface LayersPanelProps {
    show: boolean;
    onClose: () => void;
    objects: CanvasObjectType[];
    selectedObjectId: string | null;
    onSelectObject: (id: string | null) => void;
    onToggleVisibility: (id:string) => void;
    onDeleteObject: (id: string) => void;
    onReorderObjects: (draggedId: string, targetId: string) => void;
    onSaveObject: (id: string) => void;
}

const getObjectInfo = (obj: CanvasObjectType): { icon: React.ReactNode, name: string } => {
    switch(obj.type) {
        case 'image': return { icon: <PhotoIcon className="w-4 h-4 text-zinc-400" />, name: 'Image' };
        case 'text': return { icon: <TextIcon className="w-4 h-4 text-zinc-400" />, name: obj.text.substring(0, 20) || 'Text' };
        case 'rect': return { icon: <RectIcon className="w-4 h-4 text-zinc-400" />, name: 'Rectangle' };
        case 'line': return { icon: <LineIcon className="w-4 h-4 text-zinc-400" />, name: 'Arrow' };
        case 'path': return { icon: <BrushIcon className="w-4 h-4 text-zinc-400" />, name: 'Drawing' };
        default: return { icon: <div className="w-4 h-4" />, name: 'Object' };
    }
}

const LayersPanel: React.FC<LayersPanelProps> = ({ show, onClose, objects, selectedObjectId, onSelectObject, onToggleVisibility, onDeleteObject, onReorderObjects, onSaveObject }) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const reversedObjects = useMemo(() => [...objects].reverse(), [objects]);
    
    if (!show) return null;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setDraggedId(id);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        const draggedIdFromData = e.dataTransfer.getData('text/plain');
        if (draggedIdFromData && draggedIdFromData !== targetId) {
            onReorderObjects(draggedIdFromData, targetId);
        }
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    return (
        <div className="w-64 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl animate-fade-in flex flex-col">
            <div className="flex justify-between items-center p-3 border-b border-zinc-700 flex-shrink-0">
                <h3 className="text-sm font-medium text-zinc-300">Layers</h3>
                <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close Layers Panel">
                  <CloseIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="p-2 flex-grow overflow-y-auto">
                {reversedObjects.length === 0 ? (
                     <div className="text-center text-xs text-zinc-500 py-4">Canvas is empty</div>
                ) : (
                    <div className="space-y-1">
                        {reversedObjects.map(obj => {
                            const { icon, name } = getObjectInfo(obj);
                            const isSelected = obj.id === selectedObjectId;
                            const isVisible = obj.visible ?? true;

                            return (
                                <div
                                    key={obj.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, obj.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, obj.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onSelectObject(obj.id)}
                                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all duration-150
                                        ${isSelected ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'hover:bg-zinc-700/50'}
                                        ${draggedId === obj.id ? 'opacity-50' : 'opacity-100'}
                                    `}
                                >
                                    <div className="flex items-center space-x-2 overflow-hidden">
                                        {icon}
                                        <span className={`text-xs truncate ${isVisible ? 'text-zinc-200' : 'text-zinc-500 italic'}`}>
                                            {name}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); onSaveObject(obj.id); }} className="text-zinc-400 hover:text-white" aria-label="Save Layer">
                                            <ExportIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(obj.id); }} className="text-zinc-400 hover:text-white" aria-label={isVisible ? "Hide Layer" : "Show Layer"}>
                                            {isVisible ? <EyeOpenIcon className="w-4 h-4" /> : <EyeClosedIcon className="w-4 h-4" />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }} className="text-zinc-400 hover:text-red-500" aria-label="Delete Layer">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LayersPanel;