import React, { useRef, useState, useMemo, useEffect } from 'react';
import { type Tool, type CanvasObjectType, type TextObject, type RectObject } from '../types';
import { type AppMode, type AspectRatio, type VideoAspectRatio } from '../App';
import { SendIcon, BrushIcon, LineIcon, RectIcon, CropIcon, TextIcon, ImageIcon, UndoIcon, RedoIcon, AspectRatioIcon, TrashIcon, EraserIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, SettingsIcon, SpinnerIcon, LayersIcon, AIEraserIcon, ExportIcon, CheckIcon, CloseIcon, SquareIcon, LandscapeIcon, PortraitIcon, SlidersIcon, FillIcon, PhotoIcon, WandIcon } from '../constants';
import { type VideoSuggestion, type RedesignConcept } from '../services/geminiService';

interface ToolbarProps {
  appMode: AppMode;
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
  onGenerateImage: (e?: React.MouseEvent) => void;
  onManualRedesign: (e?: React.MouseEvent) => void;
  onExecuteRedesignSuggestion: (suggestion: RedesignConcept) => void;
  hasImage: boolean;
  onGenerateVideo: () => void;
  isGenerating: boolean;
  showLayers: boolean;
  onToggleLayers: () => void;
  isCompositionTask: boolean;
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  onShowExport: () => void;
  onApplyStandardCrop: () => void;
  onApplyGenerativeCrop: () => void;
  onCancelCrop: () => void;
  cropAspectRatio: AspectRatio;
  onCropAspectRatioChange: (aspectRatio: AspectRatio) => void;
  cropRect: RectObject | null;
  onCropRectChange: (updates: Partial<RectObject>) => void;
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  provider: 'gemini' | 'openai';
  onProviderChange: (prov: 'gemini' | 'openai') => void;
  videoSuggestions: VideoSuggestion[];
  isLoadingSuggestions: boolean;
  generatedVideoUrl: string | null;
  videoAspectRatio: VideoAspectRatio;
  onVideoAspectRatioChange: (aspectRatio: VideoAspectRatio) => void;
  redesignSuggestions: RedesignConcept[];
  isLoadingRedesignSuggestions: boolean;
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
      className={`relative group p-2.5 rounded-lg transition-colors ${
        isActive ? 'bg-white text-black' : 'hover:bg-zinc-700'
      }`}
      aria-label={tooltip}
    >
      {children}
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
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

  const currentTooltip = activeTool === 'ai_eraser' ? 'AI Eraser (E)' : 'Pixel Eraser (E)';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative group p-2.5 rounded-lg transition-colors ${
          isEraserActive ? 'bg-white text-black' : 'hover:bg-zinc-700'
        }`}
        aria-label={currentTooltip}
      >
        {currentIcon}
         <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            {currentTooltip}
        </span>
      </button>
      {isOpen && (
        <div className="absolute left-full ml-2 top-0 bg-zinc-700 p-1 rounded-lg flex flex-col space-y-1 shadow-lg w-36 z-10">
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


const NumberOfImagesPicker: React.FC<{
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  isCompositionTask: boolean;
  appMode: AppMode;
}> = ({ numberOfImages, onNumberOfImagesChange, isCompositionTask, appMode }) => {
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
  
  const tooltipText = appMode === 'edit'
    ? "Number of redesigns to generate"
    : (isCompositionTask ? "Number of variations to generate" : "Number of images to generate");

  return (
    <div ref={containerRef} className="relative group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 flex items-center space-x-1 rounded-md hover:bg-zinc-700"
        aria-label={tooltipText}
      >
        <AspectRatioIcon className="w-5 h-5" />
        <span className="text-xs">{numberOfImages}</span>
      </button>
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tooltipText}
      </span>
      {isOpen && (
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

const SettingsPopover: React.FC<Omit<ToolbarProps, 'appMode' | 'onToolSelect' | 'onImageUpload' | 'onClearCanvas' | 'onUndo' | 'onRedo' | 'canUndo' | 'canRedo' | 'onShowKeybindings' | 'onGenerateImage' | 'onManualRedesign' | 'onExecuteRedesignSuggestion' |'hasImage' | 'onGenerateVideo' | 'isGenerating' | 'onToggleLayers' | 'isCompositionTask' | 'onNumberOfImagesChange' | 'onShowExport' | 'onApplyStandardCrop' | 'onApplyGenerativeCrop' | 'onCancelCrop' | 'onCropAspectRatioChange' | 'prompt' | 'onPromptChange' | 'videoSuggestions' | 'isLoadingSuggestions' | 'generatedVideoUrl' | 'videoAspectRatio' | 'onVideoAspectRatioChange' | 'cropRect' | 'onCropRectChange' | 'redesignSuggestions' | 'isLoadingRedesignSuggestions'>> = (props) => {
    const { activeTool, strokeColor, onStrokeColorChange, fillColor, onFillColorChange, strokeWidth, onStrokeWidthChange, opacity, onOpacityChange, selectedObject, onUpdateSelectedObject } = props;

    const showStrokeColor = useMemo(() => ['brush', 'line', 'rect', 'text', 'ai_eraser'].includes(activeTool), [activeTool]);
    const showStrokeWidth = useMemo(() => ['brush', 'line', 'rect', 'eraser', 'ai_eraser'].includes(activeTool), [activeTool]);
    const showFillColor = useMemo(() => ['rect'].includes(activeTool), [activeTool]);
    const showOpacity = useMemo(() => ['brush', 'rect', 'line', 'ai_eraser'].includes(activeTool), [activeTool]);
    const showTextOptions = useMemo(() => selectedObject?.type === 'text', [selectedObject]);

    const ColorButton: React.FC<{ color: string, selectedColor: string, onClick: (c:string) => void }> = ({ color, selectedColor, onClick }) => (
        <button
            onClick={() => onClick(color)}
            className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-700' : ''}`}
            style={{ backgroundColor: color }}
            aria-label={`Color ${color}`}
        />
    );

    const colors = ['#000000', '#FFFFFF', '#EF4444', '#F97316', '#FACC15', '#4ADE80', '#3B82F6', '#8B5CF6'];

    return (
        <div className="absolute bottom-full mb-2 right-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex flex-col space-y-3 shadow-lg w-64 z-10">
            {showStrokeColor && (
                <div>
                    <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5 mb-2">
                        <BrushIcon className="w-3 h-3" /><span>Stroke</span>
                    </label>
                    <div className="flex justify-between px-1">
                        {colors.map(c => <ColorButton key={`stroke-${c}`} color={c} selectedColor={strokeColor} onClick={onStrokeColorChange} />)}
                    </div>
                </div>
            )}
             {showFillColor && (
                <div>
                    <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5 mb-2">
                        <FillIcon className="w-3 h-3" /><span>Fill</span>
                    </label>
                    <div className="flex justify-between px-1">
                        {colors.map(c => <ColorButton key={`fill-${c}`} color={c} selectedColor={fillColor} onClick={onFillColorChange} />)}
                    </div>
                </div>
            )}
             {showStrokeWidth && (
                 <div>
                    <label className="text-xs font-medium text-zinc-400 mb-1">Width</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="range" min="1" max="200" step="1"
                            value={strokeWidth}
                            onChange={(e) => onStrokeWidthChange(parseInt(e.target.value, 10))}
                            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                        />
                         <input
                            type="number" min="1" max="200"
                            value={strokeWidth}
                            onChange={(e) => onStrokeWidthChange(parseInt(e.target.value, 10))}
                            className="w-14 text-center bg-zinc-900 text-white text-sm rounded-md border border-zinc-600 focus:ring-blue-500 focus:border-blue-500 p-1"
                        />
                    </div>
                </div>
            )}
             {showOpacity && (
                 <div>
                    <label className="text-xs font-medium text-zinc-400 mb-1">Opacity</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={opacity}
                            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                        />
                         <span className="text-sm text-zinc-300 w-12 text-center">{Math.round(opacity * 100)}%</span>
                    </div>
                </div>
            )}
            {showTextOptions && (
                <div>
                    <label className="text-xs font-medium text-zinc-400 mb-2">Align</label>
                    <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1">
                        <button onClick={() => onUpdateSelectedObject({ align: 'left' })} className={`flex-1 p-1.5 rounded-md transition-colors ${(selectedObject as TextObject).align === 'left' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/60'}`} aria-label="Align left"><AlignLeftIcon className="w-5 h-5 mx-auto" /></button>
                        <button onClick={() => onUpdateSelectedObject({ align: 'center' })} className={`flex-1 p-1.5 rounded-md transition-colors ${(selectedObject as TextObject).align === 'center' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/60'}`} aria-label="Align center"><AlignCenterIcon className="w-5 h-5 mx-auto" /></button>
                        <button onClick={() => onUpdateSelectedObject({ align: 'right' })} className={`flex-1 p-1.5 rounded-md transition-colors ${(selectedObject as TextObject).align === 'right' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/60'}`} aria-label="Align right"><AlignRightIcon className="w-5 h-5 mx-auto" /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

const VideoAspectRatioPicker: React.FC<{
  videoAspectRatio: VideoAspectRatio;
  onVideoAspectRatioChange: (ratio: VideoAspectRatio) => void;
}> = ({ videoAspectRatio, onVideoAspectRatioChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const aspectRatios: { name: VideoAspectRatio; icon: React.ReactNode; tooltip: string }[] = [
      { name: 'auto', icon: <PhotoIcon className="w-5 h-5" />, tooltip: 'Match Image Aspect' },
      { name: '16:9', icon: <LandscapeIcon className="w-5 h-5" />, tooltip: 'Landscape (16:9)' },
      { name: '9:16', icon: <PortraitIcon className="w-5 h-5" />, tooltip: 'Portrait (9:16)' },
      { name: '1:1', icon: <SquareIcon className="w-5 h-5" />, tooltip: 'Square (1:1)' },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [containerRef]);

    const currentSelection = aspectRatios.find(r => r.name === videoAspectRatio) || aspectRatios[0];

    return (
        <div ref={containerRef} className="relative group flex-shrink-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-md hover:bg-zinc-700 flex items-center space-x-2 transition-colors ${isOpen ? 'bg-zinc-700' : 'bg-zinc-900'}`}
                aria-label="Video Aspect Ratio"
            >
                {currentSelection.icon}
                <span className="text-xs">{currentSelection.tooltip.split(' ')[0]}</span>
            </button>
             <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Video Aspect Ratio
            </span>
            {isOpen && (
                <div className="absolute bottom-full mb-2 bg-zinc-700 p-1 rounded-lg flex flex-col space-y-1 shadow-lg z-10 w-48">
                    {aspectRatios.map(({ name, icon, tooltip }) => (
                        <button
                            key={name}
                            onClick={() => { onVideoAspectRatioChange(name); setIsOpen(false); }}
                            className={`flex items-center space-x-2 w-full text-left p-2 rounded-md text-sm transition-colors ${videoAspectRatio === name ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-600'}`}
                        >
                            {icon}
                            <span>{tooltip}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const Toolbar: React.FC<ToolbarProps> = (props) => {
  const { appMode, activeTool, onToolSelect, onImageUpload, onClearCanvas, onUndo, onRedo, canUndo, canRedo, onShowKeybindings, onGenerateImage, onManualRedesign, onExecuteRedesignSuggestion, hasImage, onGenerateVideo, isGenerating, showLayers, onToggleLayers, isCompositionTask, numberOfImages, onNumberOfImagesChange, onShowExport, onApplyStandardCrop, onApplyGenerativeCrop, onCancelCrop, cropAspectRatio, onCropAspectRatioChange, cropRect, onCropRectChange, prompt, onPromptChange, videoSuggestions, isLoadingSuggestions, generatedVideoUrl, videoAspectRatio, onVideoAspectRatioChange, redesignSuggestions, isLoadingRedesignSuggestions } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiModel, setAiModel] = useState<'gemini' | 'openai'>(props.provider);
  useEffect(() => { setAiModel(props.provider); }, [props.provider]);
  
  const [localCropWidth, setLocalCropWidth] = useState('');
  const [localCropHeight, setLocalCropHeight] = useState('');

  useEffect(() => {
    if (cropRect) {
        setLocalCropWidth(String(Math.abs(Math.round(cropRect.width))));
        setLocalCropHeight(String(Math.abs(Math.round(cropRect.height))));
    }
  }, [cropRect]);

  const handleDimensionChange = (dimension: 'width' | 'height', value: string) => {
    const numericValue = parseInt(value, 10);
    if (dimension === 'width') {
        setLocalCropWidth(value);
        if (!isNaN(numericValue) && numericValue > 0) {
            onCropRectChange({ width: numericValue });
        }
    } else {
        setLocalCropHeight(value);
        if (!isNaN(numericValue) && numericValue > 0) {
            onCropRectChange({ height: numericValue });
        }
    }
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsRef]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (appMode === 'clone') {
            window.dispatchEvent(new CustomEvent('clone:file-selected', { detail: { dataUrl: reader.result } }));
          } else {
            onImageUpload(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleToolClick = (toolName: Tool) => {
    if (appMode === 'clone') {
      if (toolName === 'image') {
        fileInputRef.current?.click();
        return;
      }
      window.dispatchEvent(new CustomEvent('clone:set-tool', { detail: { tool: toolName } }));
      return;
    }
    if (toolName === 'image') {
      fileInputRef.current?.click();
    } else {
      onToolSelect(toolName);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !isGenerating && !event.shiftKey) {
        event.preventDefault();
        if (appMode === 'video') {
            onGenerateVideo();
        } else if (appMode === 'edit') {
            onManualRedesign();
        } else {
            onGenerateImage();
        }
    }
  };

  const showToolSettings = useMemo(() => 
    ['brush', 'line', 'rect', 'text', 'eraser', 'ai_eraser'].includes(activeTool) || props.selectedObject?.type === 'text'
  , [activeTool, props.selectedObject]);


  const visibleTools = useMemo(() => {
    const allTools: { name: Tool; icon: React.ReactNode; tooltip: string }[] = [
      { name: 'send', icon: <SendIcon className="w-5 h-5" />, tooltip: 'Select (V)' },
      { name: 'brush', icon: <BrushIcon className="w-5 h-5" />, tooltip: 'Brush (B)' },
      { name: 'eraser', icon: <EraserIcon className="w-5 h-5" />, tooltip: 'Eraser (E)' },
      { name: 'line', icon: <LineIcon className="w-5 h-5" />, tooltip: 'Arrow (L)' },
      { name: 'rect', icon: <RectIcon className="w-5 h-5" />, tooltip: 'Rectangle (M)' },
      { name: 'text', icon: <TextIcon className="w-5 h-5" />, tooltip: 'Text (T)' },
      { name: 'crop', icon: <CropIcon className="w-5 h-5" />, tooltip: appMode === 'edit' ? 'Resize' : 'Crop & Expand (C)' },
    ];

    if (appMode === 'edit') {
      return allTools.filter(tool => !['line', 'rect', 'text'].includes(tool.name));
    }
    return allTools;
  }, [appMode]);


  const cropAspectRatios: { name: AspectRatio; icon: React.ReactNode; tooltip: string }[] = [
    { name: 'free', icon: <CropIcon className="w-5 h-5" />, tooltip: 'Freeform' },
    { name: '1:1', icon: <SquareIcon className="w-5 h-5" />, tooltip: 'Square (1:1)' },
    { name: '4:3', icon: <PortraitIcon className="w-5 h-5" />, tooltip: 'Portrait (4:3)' },
    { name: '16:9', icon: <LandscapeIcon className="w-5 h-5" />, tooltip: 'Landscape (16:9)' },
  ];

  const generateButtonText = appMode === 'video' ? 'Generate Video' : (appMode === 'edit' ? 'Redesign' : 'Generate');
  const handleGenerateClick = appMode === 'video' ? onGenerateVideo : (appMode === 'edit' ? onManualRedesign : onGenerateImage);
  const generateButtonDisabled = isGenerating || (appMode === 'edit' && !hasImage);
  const generateButtonTooltip = isGenerating ? 'Generation in progress...' : `Generate (Shift+Enter)`;

  const handleExportVideo = () => {
    if (!generatedVideoUrl) return;
    const link = document.createElement('a');
    link.href = generatedVideoUrl;
    link.download = `video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Left Vertical Toolbar */}
    {appMode !== 'video' && appMode !== 'sheet' && (
    <div className="absolute top-1/2 left-4 -translate-y-1/2 z-10">
      <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-1.5 flex flex-col items-center space-y-1 shadow-2xl">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        {visibleTools.map(({ name, icon, tooltip }) => {
        if (name === 'eraser') {
          return <EraserToolButton key="eraser-tool" activeTool={activeTool} onClick={handleToolClick} />;
        }
        return (
          <ToolButton key={name} toolName={name} activeTool={activeTool} onClick={handleToolClick} tooltip={tooltip}>
          {icon}
          </ToolButton>
        );
        })}
        {appMode === 'clone' && (
          <>
            <div className="w-10/12 h-px bg-zinc-700 my-0.5"></div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('clone:toggle-pen'))}
              className="relative group p-2.5 rounded-lg transition-colors hover:bg-zinc-700"
              aria-label="Pen Tool (P)"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M 8 0 L 6 4 L 10 4 Z"/>
                <path d="M 8 4 L 8 12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <circle cx="8" cy="12" r="2"/>
              </svg>
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Pen Tool (P)
              </span>
            </button>
          </>
        )}
        <div className="w-10/12 h-px bg-zinc-700 my-0.5"></div>
        <ToolButton toolName="image" activeTool={activeTool} onClick={handleToolClick} tooltip="Add Image">
          <ImageIcon className="w-5 h-5" />
        </ToolButton>
      </div>
    </div>
    )}

      {/* Bottom Actions Bar (hidden in clone mode) */}
      {activeTool !== 'crop' ? (appMode === 'clone' ? null : (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          {appMode === 'video' && generatedVideoUrl ? (
            <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-2 flex items-center space-x-2 shadow-2xl">
              <button
                onClick={handleExportVideo}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center space-x-2"
              >
                <ExportIcon className="w-4 h-4" />
                <span className="whitespace-nowrap">Export Video</span>
              </button>
              <div className="relative group">
                <button
                  onClick={onClearCanvas}
                  className="p-2.5 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600"
                  aria-label="Create new video"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Create New
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-2 flex flex-col items-center space-y-2 shadow-2xl">
                {appMode === 'edit' && hasImage && (isLoadingRedesignSuggestions || redesignSuggestions.length > 0) && (
                    <div className="flex items-center justify-center h-auto px-2 mb-2 flex-wrap gap-2 max-w-3xl">
                        {isLoadingRedesignSuggestions && (
                            <div className="flex items-center space-x-2">
                                <SpinnerIcon className="w-4 h-4 text-zinc-400 animate-spin"/>
                                <span className="text-xs text-zinc-400">Đang tạo ý tưởng...</span>
                            </div>
                        )}
                        {!isLoadingRedesignSuggestions && redesignSuggestions.length > 0 && (
                            <>
                                <span className="text-xs text-zinc-400 mr-2">Ý tưởng:</span>
                                {redesignSuggestions.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        onClick={() => onExecuteRedesignSuggestion(suggestion)}
                                        disabled={isGenerating}
                                        className="px-3 py-1 bg-zinc-700 text-xs text-zinc-200 rounded-full hover:bg-zinc-600 transition-colors text-left disabled:opacity-50 disabled:cursor-wait"
                                        title={suggestion.en}
                                    >
                                        {suggestion.vi}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}
                {appMode === 'video' && (isLoadingSuggestions || videoSuggestions.length > 0) && (
                    <div className="flex items-center justify-center h-7 px-2">
                        {isLoadingSuggestions && (
                            <div className="flex items-center space-x-2">
                                <SpinnerIcon className="w-4 h-4 text-zinc-400 animate-spin"/>
                                <span className="text-xs text-zinc-400">Đang nghĩ ý tưởng...</span>
                            </div>
                        )}
                        {!isLoadingSuggestions && videoSuggestions.length > 0 && (
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-zinc-400 mr-2">Gợi ý:</span>
                                {videoSuggestions.slice(0, 4).map(suggestion => (
                                    <button
                                        key={suggestion.en}
                                        onClick={() => onPromptChange(suggestion.en)}
                                        className="px-3 py-1 bg-zinc-700 text-xs text-zinc-200 rounded-full hover:bg-zinc-600 transition-colors"
                                    >
                                        {suggestion.vi}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1 flex-shrink-0">
                      {appMode === 'video' && !generatedVideoUrl && (
                        <VideoAspectRatioPicker
                            videoAspectRatio={videoAspectRatio}
                            onVideoAspectRatioChange={onVideoAspectRatioChange}
                        />
                      )}
                      {appMode !== 'video' && appMode !== 'sheet' && (
                        <>
                          <div className="relative group">
                            <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md hover:bg-zinc-700 text-zinc-400 disabled:text-zinc-600 disabled:cursor-not-allowed" aria-label="Undo">
                                <UndoIcon className="w-5 h-5" />
                            </button>
                             <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Undo (Ctrl+Z)</span>
                          </div>
                          <div className="relative group">
                            <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed" aria-label="Redo">
                                <RedoIcon className="w-5 h-5" />
                            </button>
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Redo (Ctrl+Shift+Z)</span>
                          </div>
                        </>
                      )}
                    </div>
                    
          {appMode !== 'sheet' && (
            <div className="flex items-center space-x-2 flex-grow" style={{minWidth: "500px"}}>
              <div className="relative group">
                <select
                  value={aiModel}
                  onChange={(e) => { const v = e.target.value as 'gemini' | 'openai'; setAiModel(v); props.onProviderChange(v); }}
                  className="appearance-none bg-zinc-700 text-white text-xs font-medium rounded-md pl-3 pr-7 py-1.5 border border-transparent hover:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
                  aria-label="Select AI Model"
                >
                  <option value="gemini" className="bg-zinc-800 font-medium">Gemini</option>
                  <option value="openai" className="bg-zinc-800 font-medium">OpenAI</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <input
                type="text"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={appMode === 'video' ? "Describe the video to generate..." : "Enter a prompt to generate, edit, or redesign..."}
                className="w-full bg-zinc-900 text-sm text-zinc-200 rounded-lg border border-zinc-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 outline-none transition-colors"
              />
              <div className="relative group">
                <button 
                  onClick={(e) => handleGenerateClick(e as any)}
                  disabled={generateButtonDisabled} 
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-4 py-2 rounded-lg flex items-center justify-center font-semibold text-sm hover:from-blue-600 hover:to-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isGenerating ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <span className="whitespace-nowrap">{generateButtonText}</span>}
                </button>
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {generateButtonTooltip}
                </span>
              </div>
            </div>
          )}

                    {appMode !== 'video' && appMode !== 'sheet' && (
                      <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1 flex-shrink-0">
                          <div ref={settingsRef} className="relative group">
                              {showToolSettings && (
                                <button onClick={() => setIsSettingsOpen(prev => !prev)} className={`p-2 rounded-md transition-colors ${isSettingsOpen ? 'bg-zinc-700' : 'hover:bg-zinc-700'}`} aria-label="Tool Settings">
                                    <SlidersIcon className="w-5 h-5" />
                                </button>
                              )}
                              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Tool Settings
                              </span>
                              {isSettingsOpen && <SettingsPopover {...props} />}
                          </div>
                          
                          <NumberOfImagesPicker appMode={appMode} numberOfImages={numberOfImages} onNumberOfImagesChange={onNumberOfImagesChange} isCompositionTask={isCompositionTask} />
                          <div className="relative group">
                            <button onClick={onShowExport} className="p-2 rounded-md hover:bg-zinc-700" aria-label="Export Canvas"><ExportIcon className="w-5 h-5" /></button>
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Export</span>
                          </div>
                          <div className="relative group">
                            <button onClick={onToggleLayers} className={`p-2 rounded-md transition-colors ${showLayers ? 'bg-white text-black' : 'hover:bg-zinc-700'}`} aria-label="Toggle Layers"><LayersIcon className="w-5 h-5" /></button>
                             <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Layers</span>
                          </div>
                          <div className="relative group">
                            <button onClick={onClearCanvas} className="p-2 rounded-md hover:bg-zinc-700" aria-label="Clear Canvas"><TrashIcon className="w-5 h-5" /></button>
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Clear Canvas</span>
                          </div>
                          <div className="relative group">
                            <button onClick={onShowKeybindings} className="p-2 rounded-md hover:bg-zinc-700" aria-label="Keybindings"><SettingsIcon className="w-5 h-5" /></button>
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Keybindings</span>
                          </div>
                      </div>
                    )}
                </div>
            </div>
          )}
        </div>
      )) : (
        /* Crop Toolbar */
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-auto">
             <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-2 flex items-center justify-between space-x-4 shadow-2xl">
                <div className="relative group">
                    <button onClick={onCancelCrop} className="px-3 py-2 text-sm rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 flex items-center space-x-2">
                        <CloseIcon className="w-4 h-4" />
                        <span>Cancel</span>
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Cancel (Esc)</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-xs text-zinc-400">
                        <span>W</span>
                        <input
                            type="number"
                            value={localCropWidth}
                            onChange={(e) => handleDimensionChange('width', e.target.value)}
                            className="w-16 text-center bg-zinc-900 text-white text-sm rounded-md border border-zinc-600 focus:ring-blue-500 focus:border-blue-500 p-1"
                        />
                    </div>
                     <div className="flex items-center space-x-1 text-xs text-zinc-400">
                        <span>H</span>
                        <input
                            type="number"
                            value={localCropHeight}
                            onChange={(e) => handleDimensionChange('height', e.target.value)}
                            className="w-16 text-center bg-zinc-900 text-white text-sm rounded-md border border-zinc-600 focus:ring-blue-500 focus:border-blue-500 p-1"
                        />
                    </div>
                </div>
                <div className="flex items-center bg-zinc-900 rounded-lg p-1 space-x-1">
                    {cropAspectRatios.map(({ name, icon, tooltip }) => (
                        <button
                            key={name}
                            onClick={() => onCropAspectRatioChange(name)}
                            className={`relative group p-2 rounded-md transition-colors ${
                                cropAspectRatio === name ? 'bg-white text-black' : 'hover:bg-zinc-700'
                            }`}
                            aria-label={tooltip}
                        >
                            {icon}
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {tooltip}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative group">
                    <button
                        onClick={onApplyGenerativeCrop}
                        className="px-3 py-2 text-sm rounded-lg flex items-center space-x-2 transition-colors bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:from-blue-600 hover:to-cyan-500"
                        aria-label="Apply Generative Fill"
                    >
                        <WandIcon className="w-4 h-4" />
                        <span className="whitespace-nowrap">Generative Fill</span>
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Fill empty space with AI
                    </span>
                </div>
                <div className="relative group">
                    <button onClick={onApplyStandardCrop} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center space-x-2">
                        <CheckIcon className="w-4 h-4" />
                        <span>Apply</span>
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Apply Crop (Enter)</span>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;
