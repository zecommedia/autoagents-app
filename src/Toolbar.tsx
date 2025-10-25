import React, { useRef, useState, useMemo, useEffect } from 'react';
import { type Tool, type CanvasObjectType, type TextObject } from './types';
import { SendIcon, BrushIcon, LineIcon, RectIcon, CropIcon, TextIcon, ImageIcon, UndoIcon, RedoIcon, WandIcon, AspectRatioIcon, TrashIcon, InfoIcon, EraserIcon, StrokeWidthIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, SettingsIcon, SpinnerIcon, OpacityIcon, LayersIcon, AIEraserIcon, ExportIcon } from './constants';

interface ToolbarProps {
  activeTool: Tool;
  onToolSelect: (tool: Tool) => void;
  onImageUpload: (imageDataUrl: string) => void;
  onClearCanvas: () => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  fillColor: string;
  onFillColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedObject: CanvasObjectType | undefined;
  onUpdateSelectedObject: (updates: Partial<TextObject>) => void;
  onShowKeybindings: () => void;
  onGenerateImage: () => void;
  isGenerating: boolean;
  showLayers: boolean;
  onToggleLayers: () => void;
  isCompositionTask: boolean;
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  onShowExport: () => void;
}

const ToolButton: React.FC<{
  toolName: Tool;
  activeTool: Tool;
  onClick: (tool: Tool) => void;
  children: React.ReactNode;
  tooltip: string;
}> = ({ toolName, activeTool, onClick, children, tooltip }) => {
  const isActive = activeTool === toolName;
  return (
    <button
      onClick={() => onClick(toolName)}
      className={`relative group p-2 rounded-md transition-colors ${
        isActive ? 'bg-white text-black' : 'hover:bg-zinc-700'
      }`}
      aria-label={tooltip}
    >
      {children}
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tooltip}
      </span>
    </button>
  );
};

const EraserToolButton: React.FC<{
  activeTool: Tool;
  onClick: (tool: Tool) => void;
}> = ({ activeTool, onClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEraserActive = activeTool === 'eraser' || activeTool === 'ai_eraser';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef]);

  const handleSelect = (tool: 'eraser' | 'ai_eraser') => {
    onClick(tool);
    setIsOpen(false);
  };

  const currentIcon = activeTool === 'ai_eraser' 
    ? <AIEraserIcon className="w-5 h-5" /> 
    : <EraserIcon className="w-5 h-5" />;

  const currentTooltip = activeTool === 'ai_eraser' ? 'AI Eraser' : 'Pixel Eraser';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative group p-2 rounded-md transition-colors ${
          isEraserActive ? 'bg-white text-black' : 'hover:bg-zinc-700'
        }`}
        aria-label={currentTooltip}
      >
        {currentIcon}
        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {currentTooltip}
        </span>
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 bg-zinc-700 p-1 rounded-lg flex flex-col space-y-1 shadow-lg w-36 z-10">
          <button
            onClick={() => handleSelect('eraser')}
            className={`flex items-center space-x-2 w-full text-left p-2 rounded-md text-sm ${activeTool === 'eraser' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-600'}`}
          >
            <EraserIcon className="w-4 h-4" />
            <span>Pixel Eraser</span>
          </button>
          <button
            onClick={() => handleSelect('ai_eraser')}
            className={`flex items-center space-x-2 w-full text-left p-2 rounded-md text-sm ${activeTool === 'ai_eraser' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-600'}`}
          >
            <AIEraserIcon className="w-4 h-4" />
            <span>AI Eraser</span>
          </button>
        </div>
      )}
    </div>
  );
};


const ColorPicker: React.FC<{
    selectedColor: string;
    onChange: (color: string) => void;
    label: string;
}> = ({ selectedColor, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const colors = ['#000000', '#FFFFFF', '#EF4444', '#F97316', '#FACC15', '#4ADE80', '#3B82F6', '#8B5CF6'];
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [containerRef]);

    return (
        <div ref={containerRef} className="relative flex flex-col items-center">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-6 h-6 rounded-full border-2 border-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400"
                style={{ backgroundColor: selectedColor }}
                aria-label={label}
            />
            {isOpen && (
                <div className="absolute bottom-full mb-2 bg-zinc-700 p-1 rounded-lg flex space-x-1 shadow-lg">
                    {colors.map(color => (
                        <button
                            key={color}
                            onClick={() => {
                                onChange(color);
                                setIsOpen(false);
                            }}
                            className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: color }}
                            aria-label={`Color ${color}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const StrokeWidthPicker: React.FC<{
    selectedWidth: number;
    onChange: (width: number) => void;
}> = ({ selectedWidth, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const widths = [
        { value: 2, height: 'h-0.5' },
        { value: 5, height: 'h-1' },
        { value: 10, height: 'h-1.5' },
    ];
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [containerRef]);

    const handleWidthChange = (value: number) => {
        const newWidth = Math.max(1, Math.min(200, value || 1));
        onChange(newWidth);
    }

    return (
        <div ref={containerRef} className="relative flex flex-col items-center">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                aria-label="Stroke width"
            >
                <StrokeWidthIcon className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute bottom-full mb-2 bg-zinc-700 p-3 rounded-lg flex flex-col items-center space-y-3 shadow-lg w-48">
                    <div className="flex w-full justify-around">
                        {widths.map(({ value, height }) => (
                            <button
                                key={value}
                                onClick={() => {
                                    onChange(value);
                                    setIsOpen(false);
                                }}
                                className={`w-12 h-8 flex items-center justify-center rounded-md transition-colors ${selectedWidth === value ? 'bg-zinc-600' : 'hover:bg-zinc-600/70'}`}
                                aria-label={`Width ${value}`}
                            >
                                <div className={`bg-white rounded-full w-10/12 ${height}`}></div>
                            </button>
                        ))}
                    </div>
                    <div className="w-full px-1 space-y-2">
                         <input
                            type="range"
                            min="1"
                            max="200"
                            step="1"
                            value={selectedWidth}
                            onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                        />
                         <div className="flex items-center justify-between text-xs text-zinc-300">
                            <span>Width</span>
                            <input
                                type="number"
                                min="1"
                                max="200"
                                value={selectedWidth}
                                onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                                className="w-16 text-center bg-zinc-800 text-white rounded-md border border-zinc-600 focus:ring-lime-400 focus:border-lime-400 p-1"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const OpacityPicker: React.FC<{
    opacity: number;
    onChange: (opacity: number) => void;
}> = ({ opacity, onChange }) => {
    return (
        <div className="flex items-center space-x-2 px-2">
            <OpacityIcon className="w-5 h-5 text-zinc-400" />
            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                aria-label="Opacity"
            />
        </div>
    );
};

const NumberOfImagesPicker: React.FC<{
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  isDisabled: boolean;
}> = ({ numberOfImages, onNumberOfImagesChange, isDisabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = [1, 2, 3, 4];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef]);
  
  const tooltipText = isDisabled 
    ? "Multiple images not supported for composition" 
    : "Number of images to generate";

  return (
    <div ref={containerRef} className="relative group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled}
        className="p-2 flex items-center space-x-1 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed"
        aria-label="Number of images to generate"
      >
        <AspectRatioIcon className="w-5 h-5" />
        <span className="text-xs">{numberOfImages}</span>
      </button>
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tooltipText}
      </span>
      {isOpen && !isDisabled && (
        <div className="absolute bottom-full mb-2 bg-zinc-700 p-1 rounded-lg flex space-x-1 shadow-lg z-10">
          {options.map(num => (
            <button
              key={num}
              onClick={() => {
                onNumberOfImagesChange(num);
                setIsOpen(false);
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
                numberOfImages === num ? 'bg-zinc-600 text-white' : 'hover:bg-zinc-600/70'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onToolSelect, onImageUpload, onClearCanvas, strokeColor, onStrokeColorChange, fillColor, onFillColorChange, strokeWidth, onStrokeWidthChange, opacity, onOpacityChange, onUndo, onRedo, canUndo, canRedo, selectedObject, onUpdateSelectedObject, onShowKeybindings, onGenerateImage, isGenerating, showLayers, onToggleLayers, isCompositionTask, numberOfImages, onNumberOfImagesChange, onShowExport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageUpload(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleToolClick = (toolName: Tool) => {
    if (toolName === 'image') {
      fileInputRef.current?.click();
    } else {
        onToolSelect(toolName);
    }
  };

  const showStrokeColor = useMemo(() => ['brush', 'line', 'rect', 'text', 'ai_eraser'].includes(activeTool), [activeTool]);
  const showStrokeWidth = useMemo(() => ['brush', 'line', 'rect', 'eraser', 'ai_eraser'].includes(activeTool), [activeTool]);
  const showFillColor = useMemo(() => ['rect'].includes(activeTool), [activeTool]);
  const showOpacity = useMemo(() => ['brush', 'rect', 'line', 'ai_eraser'].includes(activeTool), [activeTool]);
  const showTextOptions = useMemo(() => selectedObject?.type === 'text', [selectedObject]);


  const tools: { name: Tool; icon: React.ReactNode; tooltip: string }[] = [
    { name: 'send', icon: <SendIcon className="w-5 h-5" />, tooltip: 'Select' },
    { name: 'brush', icon: <BrushIcon className="w-5 h-5" />, tooltip: 'Brush' },
    { name: 'eraser', icon: <EraserIcon className="w-5 h-5" />, tooltip: 'Eraser' },
    { name: 'line', icon: <LineIcon className="w-5 h-5" />, tooltip: 'Arrow' },
    { name: 'rect', icon: <RectIcon className="w-5 h-5" />, tooltip: 'Rectangle' },
    { name: 'text', icon: <TextIcon className="w-5 h-5" />, tooltip: 'Text' },
    { name: 'image', icon: <ImageIcon className="w-5 h-5" />, tooltip: 'Add Image' },
    { name: 'crop', icon: <CropIcon className="w-5 h-5" />, tooltip: 'Crop' },
  ];

  return (
    <footer className="w-full px-4 pb-4">
      <div className="bg-zinc-800 rounded-xl p-2 flex items-center justify-between shadow-lg">
        {/* Left Tools */}
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {tools.map(({ name, icon, tooltip }) => {
            if (name === 'eraser') {
                return <EraserToolButton key="eraser-tool" activeTool={activeTool} onClick={handleToolClick} />;
            }
            return (
                <ToolButton key={name} toolName={name} activeTool={activeTool} onClick={handleToolClick} tooltip={tooltip}>
                {icon}
                </ToolButton>
            );
          })}
          <div className="w-px h-6 bg-zinc-700 mx-2"></div>
          <div className="flex items-center space-x-3">
            {showStrokeColor && <ColorPicker label="Stroke Color" selectedColor={strokeColor} onChange={onStrokeColorChange} />}
            {showFillColor && <ColorPicker label="Fill Color" selectedColor={fillColor} onChange={onFillColorChange} />}
            {showStrokeWidth && <StrokeWidthPicker selectedWidth={strokeWidth} onChange={onStrokeWidthChange} />}
            {showOpacity && <OpacityPicker opacity={opacity} onChange={onOpacityChange} />}
          </div>
          {showTextOptions && (
            <>
              <div className="w-px h-6 bg-zinc-700 mx-1"></div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onUpdateSelectedObject({ align: 'left' })}
                  className={`p-2 rounded-md transition-colors ${(selectedObject as TextObject).align === 'left' ? 'bg-white text-black' : 'hover:bg-zinc-700'}`}
                  aria-label="Align left"
                >
                  <AlignLeftIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onUpdateSelectedObject({ align: 'center' })}
                  className={`p-2 rounded-md transition-colors ${(selectedObject as TextObject).align === 'center' ? 'bg-white text-black' : 'hover:bg-zinc-700'}`}
                  aria-label="Align center"
                >
                  <AlignCenterIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onUpdateSelectedObject({ align: 'right' })}
                  className={`p-2 rounded-md transition-colors ${(selectedObject as TextObject).align === 'right' ? 'bg-white text-black' : 'hover:bg-zinc-700'}`}
                  aria-label="Align right"
                >
                  <AlignRightIcon className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Center Actions */}
        <div className="flex items-center space-x-2">
          <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md hover:bg-zinc-700 text-zinc-400 disabled:text-zinc-600 disabled:cursor-not-allowed" aria-label="Undo">
            <UndoIcon className="w-5 h-5" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed" aria-label="Redo">
            <RedoIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={onGenerateImage} 
            disabled={isGenerating} 
            className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-4 py-2 rounded-lg flex items-center justify-center font-semibold text-sm hover:from-blue-600 hover:to-cyan-500 transition-colors disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <span>Generating...</span>
                <SpinnerIcon className="w-4 h-4 animate-spin ml-2" />
              </>
            ) : (
              <span>Generate Image</span>
            )}
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1">
           <NumberOfImagesPicker
            numberOfImages={numberOfImages}
            onNumberOfImagesChange={onNumberOfImagesChange}
            isDisabled={isCompositionTask}
          />
          <button 
            onClick={onShowExport} 
            className="p-2 rounded-md hover:bg-zinc-700" 
            aria-label="Export Canvas"
          >
            <ExportIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={onToggleLayers} 
            className={`p-2 rounded-md transition-colors ${showLayers ? 'bg-white text-black' : 'hover:bg-zinc-700'}`}
            aria-label="Toggle Layers"
          >
            <LayersIcon className="w-5 h-5" />
          </button>
          <button onClick={onClearCanvas} className="p-2 rounded-md hover:bg-zinc-700" aria-label="Delete">
            <TrashIcon className="w-5 h-5" />
          </button>
          <button onClick={onShowKeybindings} className="p-2 rounded-md hover:bg-zinc-700" aria-label="Settings & Keybindings">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Toolbar;