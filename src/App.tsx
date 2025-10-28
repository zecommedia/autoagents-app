import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import authService from './services/auth';
import { getApiUrl } from '../lib/config/cloudApiConfig';
import { cloudApiService } from '../lib/services/cloudApiService';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import Header from './components/Header';
import ExamplePopup from './components/ExamplePopup';
import KeybindingsPopup from './components/KeybindingsPopup';
import LayersPanel from './components/LayersPanel';
import StagedAssetsPanel from './components/StagedAssetsPanel';
import MaskPromptBox from './components/MaskPromptBox';
import ImageUploadPrompt from './components/ImageUploadPrompt';
import RestorePopup from './components/RestorePopup';
import ExportPopup, { type ExportOptions } from './components/ExportPopup';
import DebugPopup from './components/DebugPopup';
import VariationViewer from './components/VariationViewer';
import ChatPanel from './components/ChatPanel';
import Lightbox from './components/Lightbox';
import Login from './components/Login';
import SheetMode from './components/SheetMode';
import CloneMode from './components/CloneMode';
import MockupMode from './components/MockupMode';
import UpdatePrompt from './components/UpdatePrompt';
import { type Tool, type CanvasObjectType, type ImageObject, type TextObject, type LineObject, type PathObject, type RectObject, type ToolSettings, type BoundingBox } from './types';
import { generateImageFromParts, generateImagesFromPrompt, dataUrlToPart, generateVideoFromImageAndPrompt, generateVideoSuggestions, generateRedesignConcepts, generateDetailedRedesignPrompts, type VideoSuggestion, type RedesignConcept } from './services/geminiService';
import { openAIGenerateFromPrompt, openAIEditFromImageAndPrompt } from './services/openAIChatService';
import { createCloudChat, type ChatMessage as CloudChatMessage } from './services/cloudChatService';
import { createMaskedImage, describeMaskedArea, cropImageByMask } from './services/inpaintingService';
import { canvasCompositionPrompt, editModeBasePrompt, getInpaintingPrompt, getAIEraserPrompt, getBackgroundRemovalPrompt, getFixInpaintingPrompt, videoGenerationMessages, getVideoSuggestionsPrompt, getRedesignPrompt, getDetailedRedesignPrompts, getOutpaintingPrompt, getRedesignConceptsPrompt } from './prompts';
import { type Part, type Chat, type FunctionDeclaration, Type, Modality } from '@google/genai';
import { SpinnerIcon } from './constants';

// SECURITY NOTE: No API keys stored locally
// All AI requests are routed through cloud server
// This maintains type compatibility only

const APP_HELPER_SYSTEM_INSTRUCTION = `Bạn là một trợ lý AI thân thiện và nhiệt tình cho ứng dụng "Zecom Redesign", một bộ công cụ sáng tạo mạnh mẽ. Vai trò chính của bạn là giúp người dùng hiểu và sử dụng các tính năng của ứng dụng một cách hiệu quả. Khi người dùng đặt câu hỏi về ứng dụng, hãy đưa ra những lời giải thích rõ ràng, súc tích và hữu ích.

Ứng dụng có bốn chế độ chính:

1.  **Chế độ Chat (Bạn đang ở đây!)**: Đây là giao diện trò chuyện.
    *   Người dùng có thể yêu cầu bạn tạo hình ảnh từ văn bản (ví dụ: "vẽ một bức tranh con mèo"). Bạn có công cụ \`generateImage\` cho việc này.
    *   Người dùng có thể tải lên hình ảnh và yêu cầu bạn chỉnh sửa chúng (ví dụ: "xóa người trong ảnh này"). Bạn có công cụ \`editImage\` cho việc này.
    *   Người dùng có thể hỏi bạn về cách sử dụng ứng dụng. Hãy trả lời họ dựa trên thông tin dưới đây.

2.  **Chế độ Redesign (Thiết kế lại)**: Chế độ này dùng để chỉnh sửa và biến đổi một hình ảnh duy nhất.
    *   **Tính năng chính**: Người dùng tải lên một hình ảnh và có thể sử dụng AI để thiết kế lại nó.
    *   **Công cụ**:
        *   **Brush Tool (Cọ vẽ)**: Dùng để vẽ một lớp mặt nạ (mask) lên một khu vực. Sau khi tạo mặt nạ, một hộp thoại sẽ xuất hiện để người dùng mô tả thay đổi họ muốn trong khu vực đó (inpainting).
        *   **AI Eraser (Tẩy AI)**: Xóa các vật thể hoặc khuyết điểm không mong muốn khỏi hình ảnh một cách kỳ diệu.
        *   **Thanh nhập Redesign**: Người dùng có thể nhập mô tả về một thay đổi lớn họ muốn (ví dụ: "thay đổi phong cách thành cyberpunk") và AI sẽ tạo ra các phiên bản mới.
        *   **Gợi ý Redesign**: AI tự động đề xuất các ý tưởng sáng tạo để thiết kế lại hình ảnh.

3.  **Chế độ Video**: Chế độ này làm cho hình ảnh tĩnh trở nên sống động.
    *   **Tính năng chính**: Người dùng tải lên một hình ảnh, viết một câu lệnh (ví dụ: "làm cho mây di chuyển chậm"), và AI sẽ tạo ra một video clip ngắn.
    *   **Gợi ý Video**: AI cung cấp các ý tưởng câu lệnh để làm cho hình ảnh chuyển động.

4.  **Chế độ Canvas (Bảng vẽ)**: Đây là một không gian sáng tạo tự do, đa lớp.
    *   **Tính năng chính**: Người dùng có thể kết hợp nhiều hình ảnh, vẽ bằng cọ, thêm văn bản và tạo ra các bố cục phức tạp.
    *   **Công cụ**: Bao gồm công cụ Chọn, Cọ vẽ, Mũi tên, Hình chữ nhật, Văn bản và Cắt.
    *   **Tạo bằng AI**: Nút "Generate" trong chế độ này sẽ coi toàn bộ bảng vẽ (tất cả hình ảnh, bản vẽ và văn bản) như một câu lệnh hình ảnh duy nhất để tạo ra một hình ảnh mới.

Khi người dùng hỏi "Làm thế nào để...?", hãy cung cấp hướng dẫn đơn giản, từng bước. Hãy luôn động viên và nhiệt tình giúp đỡ!`;

type History = {
  past: CanvasObjectType[][];
  present: CanvasObjectType[];
  future: CanvasObjectType[][];
}
export type AppMode = 'canvas' | 'edit' | 'video' | 'chat' | 'sheet' | 'clone' | 'mockup';
export type AspectRatio = 'free' | '1:1' | '4:3' | '16:9';
export type VideoAspectRatio = 'auto' | '16:9' | '9:16' | '1:1';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
    provider?: 'gemini' | 'openai';
}

const initialHistoryState: History = { past: [], present: [], future: [] };

const initialToolSettings: Record<Tool, Partial<ToolSettings>> = {
  send: {},
  brush: { strokeColor: '#3B82F6', strokeWidth: 5, opacity: 1.0 },
  line: { strokeColor: '#EF4444', strokeWidth: 2, opacity: 1.0 },
  rect: { strokeColor: '#3B82F6', fillColor: '#FFFFFF', strokeWidth: 2, opacity: 0.5 },
  crop: {},
  text: { strokeColor: '#000000', fontSize: 16, align: 'left' },
  image: {},
  eraser: { strokeWidth: 20 },
  ai_eraser: { strokeColor: '#8B5CF6', strokeWidth: 20, opacity: 0.5 },
};

export interface MaskPromptState {
  visible: boolean;
  x: number;
  y: number;
  targetObjectId: string | null;
  promptText: string;
  droppedImage: string | null; // data URL
}

interface Variation {
    src: string;
    width: number;
    height: number;
}
interface VariationState {
  visible: boolean;
  images: Variation[];
  currentIndex: number;
  originalImageSrc: string;
  targetObjectId: string | null;
}

export interface StagedAsset {
  id: string;
  src: string;
}

export interface CloneModeState {
  originalImage: string | null;
  clonedImage: string | null;
  upscaledImage: string | null;
  finalImage: string | null;
  previewImage: string | null;
  step: 'upload' | 'cloning' | 'detecting' | 'upscaling' | 'resizing' | 'done';
  chromaTolerance: number;
  morphOp: 'dilate' | 'erode';
  morphIter: number;
  featherRadius: number;
  ssaaQuality: number;
  decontamination: number;
  edgeChoke: number;
  cornerSmoothing: number;
  cornerRefinement: number;
  edgeSmoothing: number;
  borderCleanup: number;
  contrastEnhancement: number;
  edgeRadius: number;
  matteEdge: number;
  chromaMode: 'green' | 'magenta';
  artifactCleanupSize: number;
  selectedUpscaleModel: string;
}

export interface MockupModeState {
  stickerPreview: string | null;
  processedImages: Array<{ filename: string; path: string; data?: string }>;
  usePhotoshop: boolean;
  rotationAngle?: number;
  ssaaQuality?: number;
}

interface SavedState {
  canvasHistory: History;
  editHistory: History;
  videoHistory: History;
  chatHistory: ChatMessage[];
  cloneState?: CloneModeState;
  mockupState?: MockupModeState;
}

const AUTOSAVE_KEY = 'ai-image-editor-autosave';
const AUTOSAVE_INTERVAL = 3000; // 3 seconds

const getObjectBoundingBox = (obj: CanvasObjectType): BoundingBox | null => {
    const rotation = 'rotation' in obj ? obj.rotation : 0;
    if (rotation !== 0 && ('width' in obj) && ('height' in obj)) {
         const rad = rotation * Math.PI / 180;
         const c = Math.cos(rad);
         const s = Math.sin(rad);
         const cx = obj.x + obj.width / 2;
         const cy = obj.y + obj.height / 2;
         const w = obj.width / 2;
         const h = obj.height / 2;
         const corners = [ { x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }];
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         corners.forEach(p => {
             const rotatedX = p.x * c - p.y * s + cx;
             const rotatedY = p.x * s + p.y * c + cy;
             minX = Math.min(minX, rotatedX);
             maxX = Math.max(maxX, rotatedX);
             minY = Math.min(minY, rotatedY);
             maxY = Math.max(maxY, rotatedY);
         });
         return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    switch (obj.type) {
        case 'image':
        case 'rect':
        case 'text':
            return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        case 'path': {
            if (obj.points.length === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            obj.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            const halfStroke = obj.strokeWidth / 2;
            return {
                x: minX - halfStroke,
                y: minY - halfStroke,
                width: (maxX - minX) + obj.strokeWidth,
                height: (maxY - minY) + obj.strokeWidth,
            };
        }
        case 'line': {
            const minX = Math.min(obj.x1, obj.x2);
            const minY = Math.min(obj.y1, obj.y2);
            const maxX = Math.max(obj.x1, obj.x2);
            const maxY = Math.max(obj.y1, obj.y2);
            const buffer = (8 + obj.strokeWidth * 2);
            return {
                x: minX - buffer,
                y: minY - buffer,
                width: (maxX - minX) + buffer * 2,
                height: (maxY - minY) + buffer * 2,
            };
        }
        default:
            return null;
    }
}

const calculateFitDimensions = (
    imgWidth: number,
    imgHeight: number,
    containerWidth: number,
    containerHeight: number
) => {
    const containerAspectRatio = containerWidth / containerHeight;
    const imageAspectRatio = imgWidth / imgHeight;
    let newWidth, newHeight;
    const scaleFactor = 0.95;

    if (imageAspectRatio > containerAspectRatio) {
        newWidth = containerWidth * scaleFactor;
        newHeight = newWidth / imageAspectRatio;
    } else {
        newHeight = containerHeight * scaleFactor;
        newWidth = newHeight * imageAspectRatio;
    }
    return { width: newWidth, height: newHeight };
};

const generateImageFunctionDeclaration: FunctionDeclaration = {
    name: 'generateImage',
    description: 'Generates an image based on a user-provided text prompt. Use this when the user explicitly asks to create, make, draw, or generate a picture, image, or photo of something.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: 'A detailed description of the image to be generated.',
        },
      },
      required: ['prompt'],
    },
};

const editImageFunctionDeclaration: FunctionDeclaration = {
    name: 'editImage',
    description: 'Edits an image based on user instructions when one or more images are provided in the prompt. Use this for tasks like placing one image into another (mockups), changing colors, adding or removing objects when the user provides the base image.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: 'A detailed description of the edit to be performed. For example: "place the first image onto the t-shirt in the second image".',
        },
      },
      required: ['prompt'],
    },
};


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [showExample, setShowExample] = useState<boolean>(false);
  const [showKeybindings, setShowKeybindings] = useState<boolean>(false);
  const [showLayers, setShowLayers] = useState<boolean>(false);
  
  const [canvasHistory, setCanvasHistory] = useState<History>(initialHistoryState);
  const [editHistory, setEditHistory] = useState<History>(initialHistoryState);
  const [videoHistory, setVideoHistory] = useState<History>(initialHistoryState);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [cloneState, setCloneState] = useState<CloneModeState | null>(null);

  const { history, setHistory } = useMemo(() => {
    if (appMode === 'edit') {
        return { history: editHistory, setHistory: setEditHistory };
    }
    if (appMode === 'video') {
        return { history: videoHistory, setHistory: setVideoHistory };
    }
    // 'canvas' mode
    return { history: canvasHistory, setHistory: setCanvasHistory };
  }, [appMode, canvasHistory, editHistory, videoHistory]);

  const { present: objects, past, future } = history;
  
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [toolSettings, setToolSettings] = useState(initialToolSettings);
  
  const [editingText, setEditingText] = useState<TextObject | null>(null);
  const [clipboard, setClipboard] = useState<CanvasObjectType | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [viewTransform, setViewTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isSpacebarDown, setIsSpacebarDown] = useState(false);
  const [maskPrompt, setMaskPrompt] = useState<MaskPromptState>({
    visible: false,
    x: 0,
    y: 0,
    targetObjectId: null,
    promptText: '',
    droppedImage: null,
  });
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [restorableData, setRestorableData] = useState<SavedState | null>(null);
  const [showExport, setShowExport] = useState<boolean>(false);
  const [objectToExport, setObjectToExport] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<AspectRatio>('free');
  const [cropRect, setCropRect] = useState<RectObject | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ parts: Part[], fullPrompt: string, sourceImages: {title: string, base64: string}[] } | null>(null);
  const [variations, setVariations] = useState<VariationState>({
    visible: false, images: [], currentIndex: 0, originalImageSrc: '', targetObjectId: null,
  });
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('auto');
  const [redesignSuggestions, setRedesignSuggestions] = useState<RedesignConcept[]>([]);
  const [isLoadingRedesignSuggestions, setIsLoadingRedesignSuggestions] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const [lastChatProvider, setLastChatProvider] = useState<'gemini' | 'openai'>('gemini');
  const [isChatting, setIsChatting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [sheetPosition, setSheetPosition] = useState<'left' | 'right'>('left');
    const [sheetUrl, setSheetUrl] = useState<string | null>(process.env.SHEET_URL || null);
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [providerSelection, setProviderSelection] = useState<'gemini' | 'openai'>('gemini');


  const mainContainerRef = useRef<HTMLElement>(null);
  
  const selectedObject = useMemo(() => 
    objects.find(obj => obj.id === selectedObjectId)
  , [objects, selectedObjectId]);

  const editingMessage = useMemo(() => {
    if (editingMessageIndex !== null && chatHistory[editingMessageIndex]) {
        return chatHistory[editingMessageIndex];
    }
    return null;
  }, [editingMessageIndex, chatHistory]);
  
  const activeSettings = useMemo(() => {
    const defaults: ToolSettings = {
        strokeColor: '#000000',
        fillColor: '#FFFFFF',
        strokeWidth: 2,
        opacity: 1,
        fontSize: 16,
        align: 'left'
    };
    return { ...defaults, ...toolSettings[activeTool] };
  }, [activeTool, toolSettings]);

  const imageForVideo = useMemo(() => {
    return objects.find(o => o.type === 'image') as ImageObject | undefined;
  }, [objects]);

  const imageForEdit = useMemo(() => {
    if (appMode !== 'edit') return undefined;
    return objects.find(o => o.type === 'image') as ImageObject | undefined;
  }, [appMode, objects]);

  const hasImage = useMemo(() => objects.some(o => o.type === 'image'), [objects]);

  useEffect(() => {
        const token = authService.getToken();
        if (token) setIsAuthenticated(true);
        else setIsAuthenticated(false);
    }, []);

    useEffect(() => {
    const fetchSuggestions = async () => {
        if (appMode === 'video' && imageForVideo) {
            setIsLoadingSuggestions(true);
            setVideoSuggestions([]);
            try {
                const suggestions = await generateVideoSuggestions(imageForVideo.src, getVideoSuggestionsPrompt());
                setVideoSuggestions(suggestions);
            } catch (error) {
                console.error("Failed to fetch video suggestions", error);
                setVideoSuggestions([]);
            } finally {
                setIsLoadingSuggestions(false);
            }
        } else {
            setVideoSuggestions([]);
        }
    };
    
    fetchSuggestions();
  }, [appMode, imageForVideo]);

  useEffect(() => {
    const fetchRedesignSuggestions = async () => {
        if (imageForEdit) {
            setIsLoadingRedesignSuggestions(true);
            setRedesignSuggestions([]);
            try {
                const concepts = await generateRedesignConcepts(imageForEdit.src, getRedesignConceptsPrompt());
                setRedesignSuggestions(concepts);
            } catch (error) {
                console.error("Failed to fetch redesign suggestions", error);
                setRedesignSuggestions([]);
            } finally {
                setIsLoadingRedesignSuggestions(false);
            }
        } else {
            setRedesignSuggestions([]);
        }
    };
    
    fetchRedesignSuggestions();
  }, [imageForEdit?.id]);

  const handleCancelCrop = () => {
    setActiveTool('send');
  };

  const handleSettingChange = useCallback((updates: Partial<ToolSettings>) => {
    setToolSettings(prev => ({
        ...prev,
        [activeTool]: {
            ...prev[activeTool],
            ...updates
        }
    }));
  }, [activeTool]);

  const isCompositionTask = useMemo(() => {
      if (appMode === 'edit') return true; // Always treat edit mode as a composition/edit task
      const imageObjects = objects.filter(o => o.type === 'image');
      const hasAnnotations = objects.some(o => o.type !== 'image');
      return imageObjects.length >= 2 || (imageObjects.length > 0 && hasAnnotations);
  }, [objects, appMode]);

    // Auto-save logic (trim large inline image data from chat to avoid quota exceeded)
    useEffect(() => {
        const handler = setTimeout(() => {
                if ((canvasHistory.present.length > 0 || editHistory.present.length > 0 || videoHistory.present.length > 0 || chatHistory.length > 0 || cloneState) && (canvasHistory !== initialHistoryState || editHistory !== initialHistoryState || videoHistory !== initialHistoryState || chatHistory.length > 0 || cloneState)) {
                        // Trim chatHistory inline image data to reduce size
                        const trimmedChat = chatHistory.map(msg => ({
                            ...msg,
                            parts: msg.parts.map(p => {
                                if ('inlineData' in p) {
                                    const anyP: any = p;
                                    return { inlineData: { mimeType: anyP.inlineData?.mimeType || 'image/png', data: '' } } as Part; // omit heavy data
                                }
                                return p;
                            })
                        }));
                        const stateToSave: SavedState = { 
                            canvasHistory, 
                            editHistory, 
                            videoHistory, 
                            chatHistory: trimmedChat,
                            cloneState: cloneState || undefined
                        };
                        try {
                            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
                        } catch (e) {
                            // If quota exceeded, silently skip autosave for this tick
                            // Optionally, we could set a flag or notify user once.
                        }
                }
        }, AUTOSAVE_INTERVAL);

        return () => clearTimeout(handler);
    }, [canvasHistory, editHistory, videoHistory, chatHistory, cloneState]);

  // Check for restorable data on mount
  useEffect(() => {
      const savedData = localStorage.getItem(AUTOSAVE_KEY);
      if (savedData) {
          try {
              const parsedData = JSON.parse(savedData);
              if (parsedData.canvasHistory && parsedData.editHistory && parsedData.videoHistory) {
                  setRestorableData(parsedData);
              }
          } catch (e) {
              console.error("Failed to parse auto-saved data:", e);
              localStorage.removeItem(AUTOSAVE_KEY);
          }
      }
  }, []);
  
    const createChat = (history: ChatMessage[] = []) => {
    const chatInstance = createCloudChat({ 
        model: 'gemini-2.5-flash',
        history: history,
        systemInstruction: APP_HELPER_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [generateImageFunctionDeclaration, editImageFunctionDeclaration] }],
    }) as any; // Cast to maintain type compatibility
    setChat(chatInstance);
  };
  
  // Initialize chat on first load if in chat mode
  useEffect(() => {
    if (appMode === 'chat' && !chat) {
        createChat();
    }
  }, [appMode, chat]);

  const handleRestore = () => {
    if (restorableData) {
        setCanvasHistory(restorableData.canvasHistory);
        setEditHistory(restorableData.editHistory);
        setVideoHistory(restorableData.videoHistory);
        setChatHistory(restorableData.chatHistory || []);
        setCloneState(restorableData.cloneState || null);
        if (restorableData.chatHistory && restorableData.chatHistory.length > 0) {
            createChat(restorableData.chatHistory);
        }
        setRestorableData(null);
    }
  };

  const handleDiscard = () => {
      localStorage.removeItem(AUTOSAVE_KEY);
      setRestorableData(null);
  };
  
  const setObjects = useCallback((updater: React.SetStateAction<CanvasObjectType[]>, addToHistory: boolean = true) => {
    setHistory(currentHistory => {
        const newPresent = typeof updater === 'function' ? updater(currentHistory.present) : updater;
        if (newPresent === currentHistory.present) {
            return currentHistory;
        }
        if (addToHistory) {
            return {
                past: [...currentHistory.past, currentHistory.present],
                present: newPresent,
                future: [],
            };
        }
        return {
            ...currentHistory,
            present: newPresent,
        };
    });
  }, [setHistory]);

  const handleClear = () => {
      if (appMode === 'chat') {
        setChatHistory([]);
        createChat();
      } else {
        setHistory(initialHistoryState);
        if (appMode === 'video') {
            setGeneratedVideoUrl(null);
        }
      }
      
      let historiesToCheck: History[] = [];
      if (appMode === 'canvas') historiesToCheck = [editHistory, videoHistory];
      if (appMode === 'edit') historiesToCheck = [canvasHistory, videoHistory];
      if (appMode === 'video') historiesToCheck = [canvasHistory, editHistory];

      if (appMode !== 'chat' && historiesToCheck.every(h => h.present.length === 0) && chatHistory.length === 0) {
          localStorage.removeItem(AUTOSAVE_KEY);
      } else if (appMode === 'chat' && canvasHistory.present.length === 0 && editHistory.present.length === 0 && videoHistory.present.length === 0) {
          localStorage.removeItem(AUTOSAVE_KEY);
      }
  };

  const handleModeChange = (newMode: AppMode) => {
    if (appMode === newMode) return;

    setAppMode(newMode);
    setEditingText(null);
    setSelectedObjectId(null);

    if (newMode === 'chat') {
        if (!chat) {
            createChat(chatHistory);
        }
    } else if(newMode === 'video') {
        setActiveTool('send');
    } else {
        setActiveTool(newMode === 'edit' ? 'brush' : 'send');
    }
  };

    const executeChatTurn = async (currentUserParts: Part[], historySoFar: ChatMessage[], provider: 'gemini' | 'openai') => {
        if (isChatting || isGeneratingImage) return;

        setIsChatting(true);
    const userMessage: ChatMessage = { role: 'user', parts: currentUserParts, provider };
        
        // Update UI immediately with user message and model placeholder
        // Fix for App.tsx:510
        // Explicitly type the model placeholder to ensure the new history array is of type ChatMessage[]
    const modelPlaceholder: ChatMessage = { role: 'model', parts: [{ text: '' }], provider };
        const newHistoryForUI = [...historySoFar, userMessage, modelPlaceholder];
        const modelResponseIndex = newHistoryForUI.length - 1;
        setChatHistory(newHistoryForUI);

        // If using Gemini, prepare a chat instance; OpenAI path handled separately
        let chatForThisTurn: any = null; // Changed from Chat | null to any for cloud compatibility
        if (provider === 'gemini') {
            chatForThisTurn = createCloudChat({
                model: 'gemini-2.5-flash',
                history: historySoFar,
                systemInstruction: APP_HELPER_SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: [generateImageFunctionDeclaration, editImageFunctionDeclaration] }],
            }) as any; // Cast to maintain type compatibility
            setChat(chatForThisTurn);
        }

        try {
            if (provider === 'openai') {
                // If user attached images => treat as edit with OpenAI Images API
                const hasImage = currentUserParts.some(p => 'inlineData' in p);
                const textInPrompt = currentUserParts.filter((p: any) => p.text).map((p: any) => p.text).join(' ').trim();
                const wantsImageGen = !hasImage && /\b(generate|create|draw|vẽ|vẽ|tạo ảnh|tao anh|tạo hình|tao hinh|tạo|ve|vẽ)\b/i.test(textInPrompt);

                if (hasImage) {
                    const userProvidedImages = currentUserParts.filter(p => 'inlineData' in p);
                    const numImages = userProvidedImages.length;
                    const promptText = textInPrompt || 'Please edit the image according to the previous instructions.';
                    
                    console.log(`🎨 OpenAI edit path: ${numImages} image(s) detected`);
                    
                    // Update placeholder message
                    const editingText = numImages > 1 
                        ? `OK, editing ${numImages} images with OpenAI...`
                        : `OK, applying your edit to the image with OpenAI...`;
                    
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: editingText }], provider };
                        return newHistory;
                    });

                    try {
                        // Convert image parts to File objects
                        const imageFiles: File[] = [];
                        for (const imgPart of userProvidedImages) {
                            if (!('inlineData' in imgPart)) continue;
                            
                            let base64Data = imgPart.inlineData.data;
                            if (typeof base64Data === 'object' && base64Data !== null) {
                                base64Data = (base64Data as any).data || (base64Data as any).base64 || String(base64Data);
                            }
                            if (!base64Data || typeof base64Data !== 'string') {
                                console.error('Invalid base64 data:', base64Data);
                                continue;
                            }
                            
                            const mimeType = imgPart.inlineData.mimeType || 'image/png';
                            const dataUrl = `data:${mimeType};base64,${base64Data}`;
                            
                            try {
                                const response = await fetch(dataUrl);
                                const blob = await response.blob();
                                const file = new File([blob], `image-${imageFiles.length}.png`, { type: mimeType });
                                imageFiles.push(file);
                            } catch (err) {
                                console.error('Failed to convert image to File:', err);
                            }
                        }
                        
                        if (imageFiles.length === 0) {
                            throw new Error('No valid images could be processed');
                        }
                        
                        console.log(`🖼️ OpenAI: Processing ${imageFiles.length} image(s)`);
                        
                        // Call appropriate service based on number of images
                        let result;
                        if (imageFiles.length === 1) {
                            result = await cloudApiService.redesign(imageFiles[0], promptText, 'openai');
                        } else {
                            console.log(`📤 Calling multiImageRedesign with ${imageFiles.length} images for OpenAI`);
                            result = await cloudApiService.multiImageRedesign(imageFiles, promptText, 'openai');
                        }
                        
                        if (!result.success) {
                            throw new Error(result.error || 'Image editing failed');
                        }
                        
                        // Ensure base64 data is a string
                        let editedBase64 = result.data;
                        if (typeof editedBase64 === 'object' && editedBase64 !== null) {
                            editedBase64 = (editedBase64 as any).data || (editedBase64 as any).base64 || String(editedBase64);
                        }
                        
                        const imagePart: Part = { inlineData: { mimeType: 'image/png', data: editedBase64 } };
                        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "Here is the edited image:" }, imagePart], provider }]);
                    } catch (e: any) {
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: `OpenAI edit failed: ${e?.message || 'Unknown error'}` }], provider };
                            return newHistory;
                        });
                    }
                    return;
                } else if (wantsImageGen) {
                    // Pure text prompt indicates image generation intent
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: 'OK, generating an image...' }], provider };
                        return newHistory;
                    });
                    try {
                        const images = await openAIGenerateFromPrompt(textInPrompt || 'Create a high-quality image per the user description.', 1);
                        if (images && images.length > 0) {
                            // Extract base64 from data URL
                            let base64Data = images[0].split(',')[1] || images[0];
                            
                            // Defensive: ensure base64Data is a string
                            if (typeof base64Data === 'object' && base64Data !== null) {
                                base64Data = (base64Data as any).data || (base64Data as any).base64 || String(base64Data);
                            }
                            if (typeof base64Data !== 'string') {
                                throw new Error('Invalid base64 data from OpenAI');
                            }
                            
                            const imagePart: Part = { inlineData: { mimeType: 'image/png', data: base64Data } };
                            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "Here's the image you requested:" }, imagePart], provider }]);
                        } else {
                            setChatHistory(prev => {
                                const newHistory = [...prev];
                                newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: 'Sorry, the image generation did not return a result.' }], provider };
                                return newHistory;
                            });
                        }
                    } catch (e: any) {
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: `OpenAI generation failed: ${e?.message || 'Unknown error'}` }], provider };
                            return newHistory;
                        });
                    }
                    return;
                }

                // Else: Streaming via server proxy; includes image_url parts
                const partsToOpenAIContent = (parts: Part[]) => {
                    const content: any[] = [];
                    parts.forEach(p => {
                        if ('text' in p && (p as any).text) {
                            content.push({ type: 'text', text: (p as any).text });
                        } else if ('inlineData' in p) {
                            const { mimeType, data } = (p as any).inlineData;
                            const dataUrl = `data:${mimeType};base64,${data}`;
                            content.push({ type: 'image_url', image_url: { url: dataUrl } });
                        }
                    });
                    if (content.length === 0) content.push({ type: 'text', text: '' });
                    return content;
                };

                const historyMessages = historySoFar.map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: partsToOpenAIContent(h.parts),
                }));
                const body = {
                    system: APP_HELPER_SYSTEM_INSTRUCTION,
                    messages: [
                        ...historyMessages,
                        { role: 'user', content: partsToOpenAIContent(currentUserParts) },
                    ],
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                };

                // Get auth token from cloudAuthService
                const token = localStorage.getItem('autoagents_token');
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const cloudApiUrl = getApiUrl();
                const resp = await fetch(`${cloudApiUrl}/api/chat/openai/stream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                
                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(`OpenAI proxy error: ${resp.status} ${resp.statusText} - ${errText}`);
                }

                // Server returns JSON, not streaming
                const jsonResult = await resp.json();
                let modelResponseText = jsonResult.data || jsonResult.message || '';
                
                // Ensure text is a string (handle complex objects from API)
                if (typeof modelResponseText !== 'string') {
                    modelResponseText = JSON.stringify(modelResponseText);
                }
                
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[modelResponseIndex] = { 
                        role: 'model', 
                        parts: [{ text: modelResponseText }], 
                        provider 
                    };
                    return newHistory;
                });
                
                return; // Done with OpenAI path
            }

            // Gemini path (via cloud - no streaming for now)
            if (!chatForThisTurn) throw new Error('Gemini chat not initialized');
            
            // AI-POWERED INTENT DETECTION
            const userText = currentUserParts
                .filter(p => 'text' in p && p.text)
                .map(p => ('text' in p ? p.text : ''))
                .join(' ');
            
            const hasImages = currentUserParts.some(p => 'inlineData' in p);
            const numImages = currentUserParts.filter(p => 'inlineData' in p).length;
            
            // Check if recent chat history contains an image (for context)
            const recentMessages = [...historySoFar, { role: 'user' as const, parts: currentUserParts, provider }].slice(-5);
            const hasRecentImage = recentMessages.some(msg => 
                msg.parts.some(p => 'inlineData' in p)
            );
            
            // Use AI to detect user intent instead of hardcoded keywords
            const { analyzeUserIntent } = await import('./services/intentDetection');
            
            try {
                const intentAnalysis = await analyzeUserIntent(userText, hasImages, hasRecentImage, numImages);
                console.log('Intent detected:', intentAnalysis);
                
                // Route based on AI-detected intent
                if (intentAnalysis.intent === 'IMAGE_GENERATION' && !hasImages) {
                    setIsGeneratingImage(true);
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[modelResponseIndex] = { 
                            role: 'model', 
                            parts: [{ text: `OK, generating an image: "${userText}"...` }], 
                            provider
                        };
                        return newHistory;
                    });
                    
                    try {
                        const images = await generateImagesFromPrompt(userText, 1);
                        console.log('Image generation result:', images);
                        
                        if (images.error) throw new Error(images.error);
                        if (images.newImageBase64s && images.newImageBase64s.length > 0) {
                            // Ensure base64 data is a string (handle both string and nested object cases)
                            let base64String = images.newImageBase64s[0];
                            if (typeof base64String === 'object' && base64String !== null) {
                                // Extract string from object if needed
                                base64String = base64String.data || base64String.base64 || base64String.image || String(base64String);
                            }
                            console.log('Base64 data length:', base64String?.length);
                            
                            const imagePart: Part = { 
                                inlineData: { 
                                    mimeType: 'image/png', 
                                    data: base64String
                                } 
                            };
                            // Replace the placeholder message with the result
                            setChatHistory(prev => {
                                const newHistory = [...prev];
                                newHistory[modelResponseIndex] = { 
                                    role: 'model', 
                                    parts: [{ text: "Here's the image you requested:" }, imagePart], 
                                    provider 
                                };
                                console.log('Updated chat history with image:', newHistory[modelResponseIndex]);
                                return newHistory;
                            });
                        } else {
                            console.error('No image data in result:', images);
                        }
                    } catch (e: any) {
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            newHistory[modelResponseIndex] = { 
                                role: 'model', 
                                parts: [{ text: `Image generation failed: ${e?.message || 'Unknown error'}` }], 
                                provider 
                            };
                            return newHistory;
                        });
                    } finally {
                        setIsGeneratingImage(false);
                    }
                    return;
                }
                
                // IMAGE_EDIT intent: Edit image(s) from user input or recent history
                if (intentAnalysis.intent === 'IMAGE_EDIT' && (hasImages || hasRecentImage)) {
                    setIsGeneratingImage(true);
                    
                    // Check if user provided images in current message
                    const userProvidedImages = currentUserParts.filter(p => 'inlineData' in p);
                    const numImages = userProvidedImages.length;
                    
                    const editingText = numImages > 1 
                        ? `OK, editing ${numImages} images: "${userText}"...`
                        : `OK, editing the image: "${userText}"...`;
                    
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[modelResponseIndex] = { 
                            role: 'model', 
                            parts: [{ text: editingText }], 
                            provider
                        };
                        return newHistory;
                    });
                    
                    try {
                        let imagesToEdit: Part[] = [];
                        
                        if (userProvidedImages.length > 0) {
                            // User attached images in current message → use those
                            imagesToEdit = userProvidedImages;
                        } else {
                            // No images in current input → find the most recent image from history
                            for (let i = recentMessages.length - 1; i >= 0; i--) {
                                const imagePart = recentMessages[i].parts.find(p => 'inlineData' in p);
                                if (imagePart) {
                                    imagesToEdit = [imagePart];
                                    break;
                                }
                            }
                        }
                        
                        if (imagesToEdit.length === 0) {
                            throw new Error('No image found to edit');
                        }
                        
                        // Convert all images to File objects
                        const imageFiles: File[] = [];
                        for (const imgPart of imagesToEdit) {
                            if (!('inlineData' in imgPart)) continue;
                            
                            // Ensure base64 data is a string
                            let base64Data = imgPart.inlineData.data;
                            if (typeof base64Data === 'object' && base64Data !== null) {
                                base64Data = (base64Data as any).data || (base64Data as any).base64 || (base64Data as any).image || String(base64Data);
                            }
                            if (!base64Data || typeof base64Data !== 'string') {
                                console.error('Invalid base64 data:', base64Data);
                                continue;
                            }
                            
                            const mimeType = imgPart.inlineData.mimeType || 'image/png';
                            const dataUrl = `data:${mimeType};base64,${base64Data}`;
                            
                            try {
                                const response = await fetch(dataUrl);
                                const blob = await response.blob();
                                const file = new File([blob], `image-${imageFiles.length}.png`, { type: mimeType });
                                imageFiles.push(file);
                            } catch (err) {
                                console.error('Failed to convert image to File:', err);
                            }
                        }
                        
                        if (imageFiles.length === 0) {
                            throw new Error('No valid images could be processed');
                        }
                        
                        console.log(`🖼️ IMAGE_EDIT: Processing ${imageFiles.length} image(s) with provider: ${provider}`);
                        
                        // Call appropriate service based on number of images
                        let result;
                        if (imageFiles.length === 1) {
                            result = await cloudApiService.redesign(imageFiles[0], userText, provider === 'openai' ? 'openai' : 'gemini');
                        } else {
                            // Multi-image editing
                            console.log(`📤 Calling multiImageRedesign with ${imageFiles.length} images`);
                            result = await cloudApiService.multiImageRedesign(imageFiles, userText, provider === 'openai' ? 'openai' : 'gemini');
                        }
                        
                        if (!result.success) {
                            throw new Error(result.error || 'Image editing failed');
                        }
                        
                        // Ensure base64 data is a string (handle both string and nested object cases)
                        let editedBase64 = result.data;
                        if (typeof editedBase64 === 'object' && editedBase64 !== null) {
                            editedBase64 = editedBase64.data || editedBase64.base64 || editedBase64.image || String(editedBase64);
                        }
                        
                        const editedImagePart: Part = { 
                            inlineData: { 
                                mimeType: 'image/png', 
                                data: editedBase64
                            } 
                        };
                        
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            newHistory[modelResponseIndex] = { 
                                role: 'model', 
                                parts: [{ text: "Here's the edited image:" }, editedImagePart], 
                                provider 
                            };
                            return newHistory;
                        });
                    } catch (e: any) {
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            newHistory[modelResponseIndex] = { 
                                role: 'model', 
                                parts: [{ text: `Image editing failed: ${e?.message || 'Unknown error'}` }], 
                                provider 
                            };
                            return newHistory;
                        });
                    } finally {
                        setIsGeneratingImage(false);
                    }
                    return;
                }
                
            } catch (intentError) {
                console.error('Intent detection failed, falling back to chat:', intentError);
            }
            
            // Regular chat response (or fallback)
            const response = await chatForThisTurn.sendMessageStream(currentUserParts);
            const modelResponseText = response.text();
            
            setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory[modelResponseIndex] = { role: 'model', parts: [{ text: modelResponseText }], provider };
                return newHistory;
            });
        } catch (error) {
            console.error("Chat failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMessage = newHistory[modelResponseIndex];
                 if (lastMessage && lastMessage.role === 'model') {
                    newHistory[modelResponseIndex] = { ...lastMessage, parts: [{ text: `Sorry, an error occurred: ${errorMessage}` }] };
                }
                return newHistory;
            });
        } finally {
            setIsChatting(false);
            setIsGeneratingImage(false);
        }
    };

    const handleSendChatMessage = async (message: string, images: { data: string; mimeType: string }[], provider: 'gemini' | 'openai' = 'gemini') => {
        const parts: Part[] = [];
        if (images && images.length > 0) {
            images.forEach(image => parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } }));
        }
        if (message.trim()) {
            parts.push({ text: message });
        }
        if (parts.length === 0) return;

        const historyPrefix = editingMessageIndex !== null ? chatHistory.slice(0, editingMessageIndex) : chatHistory;
        setLastChatProvider(provider);
        await executeChatTurn(parts, historyPrefix, provider);

        setEditingMessageIndex(null); // Always reset editing state after sending
    };
    
    const handleRerunMessage = async (messageIndex: number) => {
        const messageToRerun = chatHistory[messageIndex];
        if (!messageToRerun || messageToRerun.role !== 'user') return;
        
        const historyPrefix = chatHistory.slice(0, messageIndex);
        const provider = messageToRerun.provider || lastChatProvider;
        await executeChatTurn(messageToRerun.parts, historyPrefix, provider);
    };

    const handleEditMessage = (messageIndex: number) => {
        const messageToEdit = chatHistory[messageIndex];
        if (messageToEdit && messageToEdit.role === 'user') {
            setEditingMessageIndex(messageIndex);
        }
    };

    const handleDeleteMessage = (indexToDelete: number) => {
        setChatHistory(prev => prev.filter((_, index) => index !== indexToDelete));
    };


  const handleUpdateSelectedObject = (updates: Partial<TextObject>) => {
    if (!selectedObjectId) return;
    setObjects(prev => prev.map(obj => 
        (obj.id === selectedObjectId && obj.type === 'text') ? { ...obj, ...updates } : obj
    ));
    
    // Also update the default for the text tool if a relevant property is changed
    if (updates.align) {
      setToolSettings(prev => ({
          ...prev,
          text: { ...prev.text, align: updates.align }
      }));
    }
  };
  
  const handleToggleVisibility = (objectId: string) => {
    setObjects(prev => prev.map(obj => 
        obj.id === objectId ? { ...obj, visible: !(obj.visible ?? true) } : obj
    ));
  };

  const handleDeleteObject = (objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObjectId === objectId) {
        setSelectedObjectId(null);
    }
  };

  const handleReorderObjects = (draggedId: string, targetId: string) => {
    setObjects(prev => {
        const draggedIndex = prev.findIndex(obj => obj.id === draggedId);
        const targetIndex = prev.findIndex(obj => obj.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return prev;

        const newObjects = [...prev];
        const [draggedItem] = newObjects.splice(draggedIndex, 1);
        newObjects.splice(targetIndex, 0, draggedItem);
        return newObjects;
    });
  };

  const handleUndo = useCallback(() => {
    setHistory(h => {
        if (h.past.length === 0) return h;
        return {
            past: h.past.slice(0, h.past.length - 1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
        };
    });
  }, [setHistory]);

  const handleRedo = useCallback(() => {
    setHistory(h => {
        if (h.future.length === 0) return h;
        return {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
        };
    });
  }, [setHistory]);
  
  const handleToolSelect = useCallback((tool: Tool) => {
    if (tool !== 'crop') {
        setSelectedObjectId(null);
        setCropAspectRatio('free');
    }
    setActiveTool(tool);
  }, []);

  const handleImageUpload = useCallback((imageDataUrl: string) => {
    const image = new Image();
    image.onload = () => {
      const container = mainContainerRef.current;
      if (!container) return;

      const { width: newWidth, height: newHeight } = calculateFitDimensions(
        image.width, image.height, container.clientWidth, container.clientHeight
      );
      
      const newImageObject: ImageObject = {
        id: `image-${Date.now()}`,
        type: 'image',
        src: imageDataUrl,
        x: (container.clientWidth - newWidth) / 2,
        y: (container.clientHeight - newHeight) / 2,
        width: newWidth,
        height: newHeight,
        visible: true,
        rotation: 0,
      };

      if (appMode === 'edit' || appMode === 'video') {
        setHistory(() => ({ past: [], present: [newImageObject], future: [] }));
        setSelectedObjectId(null);
        handleToolSelect(appMode === 'edit' ? 'brush' : 'send');
      } else {
        setObjects(prevObjects => [...prevObjects, newImageObject]);
        setActiveTool('send');
        setSelectedObjectId(newImageObject.id);
      }
    };
    image.src = imageDataUrl;
  }, [appMode, handleToolSelect, setHistory, setObjects]);

  const drawObjectsOnContext = async (
    ctx: CanvasRenderingContext2D,
    objectsToDraw: CanvasObjectType[],
    options: {
        backgroundColor?: string;
        width: number;
        height: number;
    }
  ) => {
      if (options.backgroundColor) {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);
      }
  
      const tempImageCache = new Map<string, HTMLImageElement>();
      await Promise.all(
          objectsToDraw
              .filter((obj): obj is ImageObject => obj.type === 'image')
              .map(obj => new Promise<void>((resolve, reject) => {
                  if (tempImageCache.has(obj.src)) return resolve();
                  const img = new Image();
                  img.src = obj.src;
                  img.onload = () => {
                      tempImageCache.set(img.src, img);
                      resolve();
                  };
                  img.onerror = reject;
              }))
      );
  
      const drawObject = (obj: CanvasObjectType) => {
            if (obj.visible === false) return;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.save();
            const rotation = 'rotation' in obj ? obj.rotation : 0;
            if (rotation !== 0 && 'x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
              const centerX = obj.x + obj.width / 2;
              const centerY = obj.y + obj.height / 2;
              ctx.translate(centerX, centerY);
              ctx.rotate(rotation * Math.PI / 180);
              ctx.translate(-centerX, -centerY);
            }
  
            switch (obj.type) {
              case 'image':
                const img = tempImageCache.get(obj.src);
                if (img) ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
                break;
              case 'path':
                ctx.globalAlpha = obj.opacity ?? 1;
                ctx.strokeStyle = obj.strokeColor;
                ctx.lineWidth = obj.strokeWidth;
                ctx.beginPath();
                if (obj.points.length > 2) {
                    ctx.moveTo(obj.points[0].x, obj.points[0].y);
                    for (let i = 1; i < obj.points.length - 2; i++) {
                        const xc = (obj.points[i].x + obj.points[i + 1].x) / 2;
                        const yc = (obj.points[i].y + obj.points[i + 1].y) / 2;
                        ctx.quadraticCurveTo(obj.points[i].x, obj.points[i].y, xc, yc);
                    }
                    ctx.quadraticCurveTo(obj.points[obj.points.length - 2].x, obj.points[obj.points.length - 2].y, obj.points[obj.points.length - 1].x, obj.points[obj.points.length - 1].y);
                } else {
                    if(obj.points.length > 0) {
                        ctx.moveTo(obj.points[0].x, obj.points[0].y);
                        obj.points.forEach(point => ctx.lineTo(point.x, point.y));
                    }
                }
                ctx.stroke();
                break;
              case 'rect':
                ctx.globalAlpha = obj.opacity ?? 1;
                if(obj.fillColor) {
                    ctx.fillStyle = obj.fillColor;
                    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                }
                if (obj.strokeWidth > 0) {
                  ctx.strokeStyle = obj.strokeColor;
                  ctx.lineWidth = obj.strokeWidth;
                  ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                }
                break;
              case 'line': {
                ctx.globalAlpha = obj.opacity ?? 1;
                const headlen = 8 + obj.strokeWidth * 2;
                const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
                const lineLength = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
                const arrowHeight = headlen * Math.cos(Math.PI / 6);
                if (lineLength > arrowHeight) {
                   const lineEndX = obj.x2 - arrowHeight * Math.cos(angle);
                   const lineEndY = obj.y2 - arrowHeight * Math.sin(angle);
                   ctx.beginPath();
                   ctx.moveTo(obj.x1, obj.y1);
                   ctx.lineTo(lineEndX, lineEndY);
                   ctx.strokeStyle = obj.strokeColor;
                   ctx.lineWidth = obj.strokeWidth;
                   ctx.stroke();
                }
                ctx.beginPath();
                ctx.moveTo(obj.x2, obj.y2);
                ctx.lineTo(obj.x2 - headlen * Math.cos(angle - Math.PI / 6), obj.y2 - headlen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(obj.x2 - headlen * Math.cos(angle + Math.PI / 6), obj.y2 - headlen * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fillStyle = obj.strokeColor;
                ctx.fill();
                break;
              }
              case 'text':
                ctx.fillStyle = obj.strokeColor;
                ctx.font = `${obj.fontSize}px sans-serif`;
                ctx.textAlign = obj.align || 'left';
                ctx.textBaseline = 'top';
                const textX = obj.align === 'center' ? obj.x + obj.width / 2 : obj.align === 'right' ? obj.x + obj.width : obj.x;
                const lines = obj.text.split('\n');
                let currentY = obj.y;
                const lineHeight = obj.fontSize * 1.2;
                lines.forEach(line => {
                    let currentLine = '';
                    const words = line.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine + words[i] + ' ';
                        const metrics = ctx.measureText(testLine);
                        if (metrics.width > obj.width && i > 0) {
                            ctx.fillText(currentLine, textX, currentY);
                            currentLine = words[i] + ' ';
                            currentY += lineHeight;
                        } else {
                            currentLine = testLine;
                        }
                    }
                    ctx.fillText(currentLine, textX, currentY);
                    currentY += lineHeight;
                });
                break;
            }
            ctx.restore();
            ctx.globalAlpha = 1;
        };
  
      objectsToDraw.forEach(drawObject);
  };

  const getCanvasAsBase64 = async (): Promise<string | null> => {
    if (!mainContainerRef.current) return null;

    const canvasWidth = mainContainerRef.current.clientWidth;
    const canvasHeight = mainContainerRef.current.clientHeight;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    const ctx = offscreenCanvas.getContext('2d');

    if (!ctx) {
        throw new Error("Could not create offscreen canvas context");
    }
    
    // In edit mode, we want a transparent background to show transparency.
    // In canvas mode, we simulate a solid white background.
    const backgroundColor = appMode === 'canvas' ? 'white' : undefined;
    await drawObjectsOnContext(ctx, objects, { backgroundColor, width: canvasWidth, height: canvasHeight });
    
    return offscreenCanvas.toDataURL('image/png').split(',')[1];
  }

  const handleExportCanvas = async (options: ExportOptions) => {
    setIsExporting(true);
    try {
        if (!mainContainerRef.current) throw new Error("Main container ref not found");
        const { clientWidth, clientHeight } = mainContainerRef.current;

        const { scale, format, quality } = options;
        const exportCanvas = document.createElement('canvas');
        const firstImage = objects.find(o => o.type === 'image') as ImageObject;

        if (appMode === 'edit' && firstImage) {
            exportCanvas.width = firstImage.width * scale;
            exportCanvas.height = firstImage.height * scale;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not create export canvas context");

            ctx.scale(scale, scale);

            const relativeObjects = objects.map(obj => {
                const newObj = { ...obj };
                if ('x' in newObj && 'y' in newObj) {
                    newObj.x -= firstImage.x;
                    newObj.y -= firstImage.y;
                } else if ('x1' in newObj) {
                    (newObj as any).x1 -= firstImage.x;
                    (newObj as any).y1 -= firstImage.y;
                    (newObj as any).x2 -= firstImage.x;
                    (newObj as any).y2 -= firstImage.y;
                } else if ('points' in newObj) {
                    (newObj as any).points = (newObj as any).points.map((p: {x:number, y:number}) => ({ x: p.x - firstImage.x, y: p.y - firstImage.y }));
                }
                return newObj;
            });
            await drawObjectsOnContext(ctx, relativeObjects, { width: firstImage.width, height: firstImage.height });
        } else {
            exportCanvas.width = clientWidth * scale;
            exportCanvas.height = clientHeight * scale;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not create export canvas context");
            
            ctx.scale(scale, scale);
            await drawObjectsOnContext(ctx, objects, { 
                backgroundColor: 'white',
                width: clientWidth,
                height: clientHeight,
            });
        }
        
        const dataUrl = exportCanvas.toDataURL(`image/${format}`, quality);

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `export-${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Export failed:", error);
        alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsExporting(false);
        setShowExport(false);
    }
  };

  const handleExportObject = async (options: ExportOptions) => {
    if (!objectToExport) return;
    setIsExporting(true);
    try {
      const object = objects.find(o => o.id === objectToExport);
      if (!object) throw new Error("Object not found for export.");

      const bbox = getObjectBoundingBox(object);
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) throw new Error("Cannot export object with invalid dimensions.");

      const { scale, format, quality } = options;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = bbox.width * scale;
      exportCanvas.height = bbox.height * scale;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create export canvas context");
      
      ctx.scale(scale, scale);
      // Translate the context so the object's top-left corner is at (0,0)
      ctx.translate(-bbox.x, -bbox.y);

      await drawObjectsOnContext(ctx, [object], { width: bbox.width, height: bbox.height });

      const dataUrl = exportCanvas.toDataURL(`image/${format}`, quality);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${object.type}-${object.id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
        console.error("Layer export failed:", error);
        alert(`Layer export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsExporting(false);
        setObjectToExport(null);
    }
  };

  const handleDoExport = (options: ExportOptions) => {
    if (objectToExport) {
        handleExportObject(options);
    } else {
        handleExportCanvas(options);
    }
  };


  const processAndDisplayGeneratedImages = (base64Strings: string[]) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const newImageObjects: ImageObject[] = [];

    const firstImage = new Image();
    firstImage.onload = () => {
        const { width: newWidth, height: newHeight } = calculateFitDimensions(
            firstImage.width,
            firstImage.height,
            container.clientWidth,
            container.clientHeight
        );

        const x = (container.clientWidth - newWidth) / 2;
        const y = (container.clientHeight - newHeight) / 2;
        
        base64Strings.forEach((b64, index) => {
            const imageSrc = `data:image/png;base64,${b64}`;
            const newImageObject: ImageObject = {
                id: `image-${Date.now()}-${index}`,
                type: 'image',
                src: imageSrc,
                x, y, width: newWidth, height: newHeight,
                visible: true,
                rotation: 0,
            };
            newImageObjects.push(newImageObject);
        });
        
        const finalObjects = appMode === 'edit' ? [newImageObjects[0]] : newImageObjects;
        setHistory(h => ({ past: [...h.past, h.present], present: finalObjects, future: [] }));

        if (finalObjects.length > 0) {
            setSelectedObjectId(finalObjects[finalObjects.length - 1].id);
        }
        setActiveTool(appMode === 'edit' ? 'brush' : 'send');
    };
    firstImage.src = `data:image/png;base64,${base64Strings[0]}`;
  };

  const continueImageGeneration = async (parts: Part[]) => {
    try {
        if (!isCompositionTask) {
              // Simple text-to-image
              const userPrompt = (parts.find(p => 'text' in p) as Part & { text: string })?.text || '';
              // Respect Toolbar provider selection for generation flows
              if (providerSelection === 'openai') {
                  const images = await openAIGenerateFromPrompt(userPrompt, numberOfImages);
                  processAndDisplayGeneratedImages(images);
              } else {
                  const result = await generateImagesFromPrompt(userPrompt, numberOfImages);
                  if (result.error) throw new Error(result.error);
                  if (result.newImageBase64s) {
                      processAndDisplayGeneratedImages(result.newImageBase64s);
                  }
              }
          } else {
              // Composition or Edit tasks
              if (providerSelection === 'openai') {
                  // For OpenAI edit/compose: send a PNG with transparency (first image part) + prompt
                  const firstImage = parts.find(p => 'inlineData' in p) as Part & { inlineData: { mimeType: string, data: string } } | undefined;
                  const text = (parts.find(p => 'text' in p) as any)?.text || '';
                  if (!firstImage) throw new Error('No image found to edit for OpenAI');
                  const dataUrl = `data:${firstImage.inlineData.mimeType};base64,${firstImage.inlineData.data}`;
                  const images = await openAIEditFromImageAndPrompt(dataUrl, text, numberOfImages);
                  if (images && images.length > 0) {
                      const imagesAsDataUrls = images.map(b64 => `data:image/png;base64,${b64}`);
                      if (appMode === 'edit') {
                          const targetImage = objects.find(o => o.type === 'image') as ImageObject;
                          if (!targetImage) throw new Error('No image found to edit.');
                          const variationPromises = imagesAsDataUrls.map(src => new Promise<Variation>((resolve, reject) => {
                              const img = new Image();
                              img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                              img.onerror = reject;
                              img.src = src;
                          }));
                          const loadedVariations = await Promise.all(variationPromises);
                          setVariations({ visible: true, images: loadedVariations, currentIndex: 0, originalImageSrc: targetImage.src, targetObjectId: targetImage.id });
                          handleSelectVariation(0, loadedVariations);
                      } else {
                          processAndDisplayGeneratedImages(images);
                      }
                  }
              } else {
                  const result = await generateImageFromParts(parts, numberOfImages);
                  if (result.error) throw new Error(result.error);

                  if (result.newImageBase64s && result.newImageBase64s.length > 0) {
                  const imagesAsDataUrls = result.newImageBase64s.map(b64 => `data:image/png;base64,${b64}`);

                  if (appMode === 'edit') {
                      const targetImage = objects.find(o => o.type === 'image') as ImageObject;
                      if (!targetImage) throw new Error("No image found to edit.");
                      
                      const variationPromises = imagesAsDataUrls.map(src =>
                        new Promise<Variation>((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                            img.onerror = reject;
                            img.src = src;
                        })
                      );

                      const loadedVariations = await Promise.all(variationPromises);
                      
                      setVariations({
                          visible: true,
                          images: loadedVariations,
                          currentIndex: 0,
                          originalImageSrc: targetImage.src,
                          targetObjectId: targetImage.id,
                      });

                      handleSelectVariation(0, loadedVariations);

                  } else {
                      processAndDisplayGeneratedImages(result.newImageBase64s);
                  }
                  }
              }
          }
      } catch (error) {
          console.error("Image generation failed:", error);
          alert(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
          setIsGenerating(false);
          setLoadingMessage('');
          setDebugInfo(null);
      }
  };

  const handleMaskedGeneration = useCallback(async (e?: React.MouseEvent) => {
    if (!maskPrompt.promptText && !maskPrompt.droppedImage) {
        alert("Please enter a prompt or drop an image for the masked area.");
        return;
    }

    setIsGenerating(true);
    setLoadingMessage('Generating masked area...');
    const originalMaskPromptState = { ...maskPrompt };
    setMaskPrompt({ ...maskPrompt, visible: false });

    try {
        const maskObject = objects.find(o => o.id === originalMaskPromptState.targetObjectId) as PathObject;
        if (!maskObject) throw new Error("Mask object not found.");

        const targetImage = (appMode === 'edit'
          ? objects.find(o => o.type === 'image')
          : objects.slice(0, objects.findIndex(o => o.id === maskObject.id)).reverse().find(o => o.type === 'image')
        ) as ImageObject;

        if (!targetImage) {
            alert("Could not find an image under the mask. Please ensure the mask is drawn over an image.");
            throw new Error("Target image for masking not found.");
        }
        
        const maskedContentDescription = await describeMaskedArea(targetImage, maskObject);
        // Create a version of the image with a transparent hole for the API
        const maskedImageUrl = await createMaskedImage(targetImage, maskObject);
        
        let finalUserPrompt = originalMaskPromptState.promptText;
        if (!finalUserPrompt && originalMaskPromptState.droppedImage) {
            finalUserPrompt = "Replace the masked area with the provided source image.";
        }
        const finalPrompt = getInpaintingPrompt(maskedContentDescription, finalUserPrompt);

        const parts: Part[] = [];
        const sourceImages: {title: string, base64: string}[] = [];

        if (originalMaskPromptState.droppedImage) {
            const sourceImagePart = { inlineData: { mimeType: 'image/png', data: originalMaskPromptState.droppedImage.split(',')[1] }};
            parts.push(sourceImagePart);
            sourceImages.push({ title: 'Reference Image', base64: originalMaskPromptState.droppedImage.split(',')[1] });
        }
        
        const maskedImagePart = { inlineData: { mimeType: 'image/png', data: maskedImageUrl.split(',')[1] }};
        parts.push(maskedImagePart);
        sourceImages.push({ title: 'Masked Image (with hole)', base64: maskedImageUrl.split(',')[1] });

        parts.push({ text: finalPrompt });

        if (e?.altKey) {
            setDebugInfo({ parts, fullPrompt: finalPrompt, sourceImages });
            return;
        }
        
        const result = await generateImageFromParts(parts, numberOfImages);
    
        if (result.error) throw new Error(result.error);

        if (result.newImageBase64s && result.newImageBase64s.length > 0) {
            const imagesAsDataUrls = result.newImageBase64s.map(b64 => `data:image/png;base64,${b64}`);
             const variationPromises = imagesAsDataUrls.map(src =>
                new Promise<Variation>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                    img.onerror = reject;
                    img.src = src;
                })
              );
            const loadedVariations = await Promise.all(variationPromises);
            
            setVariations({
                visible: true,
                images: loadedVariations,
                currentIndex: 0,
                originalImageSrc: targetImage.src,
                targetObjectId: targetImage.id
            });
            
            // Show first variation and remove mask object
            const firstVariation = loadedVariations[0];
            const container = mainContainerRef.current;
            if(!container) return;

            const { width: fitWidth, height: fitHeight } = calculateFitDimensions(
                firstVariation.width, firstVariation.height,
                container.clientWidth, container.clientHeight
            );

            setObjects(prev => prev
                .map(obj => obj.id === targetImage.id ? { ...obj, src: firstVariation.src, width: fitWidth, height: fitHeight } : obj)
                .filter(obj => obj.id !== maskObject.id), 
            false);
            setSelectedObjectId(targetImage.id);

        } else {
            throw new Error("The AI model did not return an image.");
        }

    } catch (error) {
        console.error("Masked generation failed:", error);
        alert(`Masked generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // If it fails, remove the mask object that was used for the attempt
        if (originalMaskPromptState.targetObjectId) {
            setObjects(prev => prev.filter(obj => obj.id !== originalMaskPromptState.targetObjectId));
        }
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
        setDebugInfo(null);
        setMaskPrompt({ visible: false, x: 0, y: 0, targetObjectId: null, promptText: '', droppedImage: null });
    }
  }, [maskPrompt, objects, setObjects, appMode, numberOfImages]);

  const handleFixGeneration = useCallback(async (e?: React.MouseEvent) => {
    if (!maskPrompt.promptText) {
        alert("Please enter a prompt to describe the fix.");
        return;
    }

    setIsGenerating(true);
    setLoadingMessage('Applying fix...');
    const originalMaskPromptState = { ...maskPrompt };
    setMaskPrompt({ ...maskPrompt, visible: false });

    try {
        const maskObject = objects.find(o => o.id === originalMaskPromptState.targetObjectId) as PathObject;
        if (!maskObject) throw new Error("Mask object not found.");

        const targetImage = (appMode === 'edit'
          ? objects.find(o => o.type === 'image')
          : objects.slice(0, objects.findIndex(o => o.id === maskObject.id)).reverse().find(o => o.type === 'image')
        ) as ImageObject;

        if (!targetImage) {
            alert("Could not find an image under the mask. Please ensure the mask is drawn over an image.");
            throw new Error("Target image for masking not found.");
        }
        
        const maskedImageUrl = await createMaskedImage(targetImage, maskObject);
        const contentImageUrl = await cropImageByMask(targetImage, maskObject);
        const finalPrompt = getFixInpaintingPrompt(originalMaskPromptState.promptText);

        const parts: Part[] = [];
        const sourceImages: {title: string, base64: string}[] = [];

        const maskedImagePart = await dataUrlToPart(maskedImageUrl);
        parts.push(maskedImagePart);
        sourceImages.push({ title: 'Masked Image (with hole)', base64: maskedImageUrl.split(',')[1] });

        const contentImagePart = await dataUrlToPart(contentImageUrl);
        parts.push(contentImagePart);
        sourceImages.push({ title: 'Original Content Image (Cropped)', base64: contentImageUrl.split(',')[1] });

        parts.push({ text: finalPrompt });

        if (e?.altKey) {
            setDebugInfo({ parts, fullPrompt: finalPrompt, sourceImages });
            return;
        }
        
        const result = await generateImageFromParts(parts, numberOfImages);
    
        if (result.error) throw new Error(result.error);

        if (result.newImageBase64s && result.newImageBase64s.length > 0) {
            const imagesAsDataUrls = result.newImageBase64s.map(b64 => `data:image/png;base64,${b64}`);
            const variationPromises = imagesAsDataUrls.map(src =>
                new Promise<Variation>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                    img.onerror = reject;
                    img.src = src;
                })
            );
            const loadedVariations = await Promise.all(variationPromises);
            
            setVariations({
                visible: true,
                images: loadedVariations,
                currentIndex: 0,
                originalImageSrc: targetImage.src,
                targetObjectId: targetImage.id
            });
            
            handleSelectVariation(0, loadedVariations, maskObject.id);

        } else {
            throw new Error("The AI model did not return an image.");
        }

    } catch (error) {
        console.error("Fix generation failed:", error);
        alert(`Fix generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (originalMaskPromptState.targetObjectId) {
            setObjects(prev => prev.filter(obj => obj.id !== originalMaskPromptState.targetObjectId));
        }
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
        setDebugInfo(null);
        setMaskPrompt({ visible: false, x: 0, y: 0, targetObjectId: null, promptText: '', droppedImage: null });
    }
  }, [maskPrompt, objects, setObjects, appMode, numberOfImages]);

  const handleRemoveBackground = useCallback(async (e?: React.MouseEvent) => {
    setIsGenerating(true);
    setLoadingMessage('Removing background...');
    const originalMaskPromptState = { ...maskPrompt };
    setMaskPrompt({ ...maskPrompt, visible: false });

    try {
        const maskObject = objects.find(o => o.id === originalMaskPromptState.targetObjectId) as PathObject;
        if (!maskObject) throw new Error("Mask object not found.");
        
        const targetImage = objects.find(o => o.type === 'image') as ImageObject;
        if (!targetImage) throw new Error("Target image for background removal not found.");

        const croppedImageUrl = await cropImageByMask(targetImage, maskObject);
        const croppedImagePart = await dataUrlToPart(croppedImageUrl);
        
        const finalPrompt = getBackgroundRemovalPrompt();
        const parts: Part[] = [
            croppedImagePart,
            { text: finalPrompt }
        ];

        if (e?.altKey) {
            setDebugInfo({ 
                parts, 
                fullPrompt: finalPrompt, 
                sourceImages: [
                    { title: 'Cropped Source Image', base64: (croppedImagePart.inlineData as any).data },
                ]
            });
            return;
        }

        const result = await generateImageFromParts(parts, 1);
        if (result.error) throw new Error(result.error);
        
        if (result.newImageBase64s && result.newImageBase64s.length > 0) {
            const newImageSrc = `data:image/png;base64,${result.newImageBase64s[0]}`;
            const newAsset: StagedAsset = {
                id: `asset-${Date.now()}`,
                src: newImageSrc,
            };
            setStagedAssets(prev => [newAsset, ...prev]);
        } else {
            throw new Error("The AI model did not return an image for background removal.");
        }

    } catch (error) {
        console.error("Background removal failed:", error);
        alert(`Background removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
        setDebugInfo(null);
        // Clean up the mask object from the canvas after the operation
        if (originalMaskPromptState.targetObjectId) {
            setObjects(prev => prev.filter(obj => obj.id !== originalMaskPromptState.targetObjectId));
        }
        setMaskPrompt(prev => ({ ...prev, visible: false, targetObjectId: null }));
    }
}, [maskPrompt, objects, setObjects]);

  const handleGenerateImage = useCallback(async (e?: React.MouseEvent) => {
      // If a mask operation is pending (even if the prompt box was closed),
      // the main generate button should intelligently trigger the mask workflow.
      if (maskPrompt.targetObjectId) {
        return handleMaskedGeneration(e);
      }

      setIsGenerating(true);
      setLoadingMessage(isCompositionTask ? 'Generating composition...' : 'Generating image...');
      try {
          const textFromToolbar = prompt.trim();
          let userPrompt = '';

          if (textFromToolbar) {
              userPrompt = textFromToolbar;
          } else {
              const textObjects = objects.filter((o): o is TextObject => o.type === 'text');
              userPrompt = textObjects
                .map(o => {
                    const defaultTexts = ['Double click to edit', 'Add label'];
                    return defaultTexts.includes(o.text) ? '' : o.text;
                })
                .join(' ')
                .trim();
          }
              
          const hasTextPrompt = userPrompt.length > 0;

          if (!hasTextPrompt && !isCompositionTask) {
              alert("Please provide a text prompt or annotate an image to generate an edit.");
              setIsGenerating(false);
              setLoadingMessage('');
              return;
          }
          
          if (isCompositionTask) {
              const base64ImageData = await getCanvasAsBase64();
              if (!base64ImageData) throw new Error("Could not capture canvas");
              
              const basePrompt = appMode === 'edit' ? editModeBasePrompt : canvasCompositionPrompt;
              const finalPrompt = hasTextPrompt ? `${basePrompt}\n\n**User's Request:** "${userPrompt}"` : `${basePrompt}\n\n**User's Request:** The user has not provided a text prompt. Infer the desired edit from the visual annotations alone.`;
      
              const parts: Part[] = [
                { inlineData: { data: base64ImageData, mimeType: 'image/png' } },
                { text: finalPrompt }
              ];

              if (e?.altKey) {
                setDebugInfo({ 
                    parts, 
                    fullPrompt: finalPrompt, 
                    sourceImages: [{ title: 'Canvas Screenshot', base64: base64ImageData }] 
                });
                return;
              }
      
              await continueImageGeneration(parts);

          } else { // Simple text-to-image generation
              const parts: Part[] = [{ text: userPrompt }];
              await continueImageGeneration(parts);
          }
      } catch (error) {
          console.error("Image generation failed:", error);
          alert(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsGenerating(false);
          setLoadingMessage('');
      }
  }, [objects, appMode, isCompositionTask, numberOfImages, getCanvasAsBase64, maskPrompt.targetObjectId, handleMaskedGeneration, prompt, setHistory]);

  const handleGenerateVideo = useCallback(async () => {
    if (!imageForVideo) {
        alert("Please upload an image to generate a video from.");
        return;
    }
    const userPrompt = prompt.trim();
    if (!userPrompt) {
        alert("Please enter a prompt to describe the video you want to create.");
        return;
    }

    setIsGeneratingVideo(true);
    setGeneratedVideoUrl(null);
    
    try {
        setLoadingMessage(videoGenerationMessages[0]);
        
        // Add a prefix to help bypass face detection safety filters by framing the subject as a character/artwork.
        const bypassPrefix = "A photorealistic, animated rendering of a character. ";
        const finalPrompt = bypassPrefix + userPrompt;

        const videoUrl = await generateVideoFromImageAndPrompt(finalPrompt, imageForVideo.src, videoAspectRatio);
        setGeneratedVideoUrl(videoUrl);

    } catch (error) {
        console.error("Video generation failed:", error);
        alert(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGeneratingVideo(false);
        setLoadingMessage('');
    }
}, [imageForVideo, prompt, videoAspectRatio]);

  const executeRedesign = async (userConcept: string, numImages: number) => {
    setIsGenerating(true);
    setLoadingMessage('Generating redesigns...');
    try {
        const baseImage = objects.find(o => o.type === 'image') as ImageObject;
        if (!baseImage) {
            alert("Please have an image on the canvas to redesign.");
            throw new Error("Base image not found for redesign.");
        }

        const ideaPrompts = await generateDetailedRedesignPrompts(baseImage.src, userConcept, numImages, getDetailedRedesignPrompts(numImages));
        const imageGenerationPromises = ideaPrompts.map(async (ideaPrompt) => {
            const baseImagePart = await dataUrlToPart(baseImage.src);
            const finalPromptForGeneration = `${getRedesignPrompt()}\n\n**User's Request:** "${ideaPrompt}"`;
            const parts: Part[] = [baseImagePart, { text: finalPromptForGeneration }];
            
            const result = await generateImageFromParts(parts, 1);
            if (result.error || !result.newImageBase64s || result.newImageBase64s.length === 0) {
                console.error(`Failed to generate image for prompt: "${ideaPrompt}"`, result.error);
                return null;
            }
            return `data:image/png;base64,${result.newImageBase64s[0]}`;
        });

        const imagesAsDataUrls = (await Promise.all(imageGenerationPromises)).filter((url): url is string => url !== null);

        if (imagesAsDataUrls.length > 0) {
            const variationPromises = imagesAsDataUrls.map(src =>
                new Promise<Variation>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                    img.onerror = reject;
                    img.src = src;
                })
            );
            const loadedVariations = await Promise.all(variationPromises);

            setVariations({
                visible: true,
                images: loadedVariations,
                currentIndex: 0,
                originalImageSrc: baseImage.src,
                targetObjectId: baseImage.id,
            });

            handleSelectVariation(0, loadedVariations);
        } else {
            throw new Error("The AI model did not return any images for the redesign concepts.");
        }

    } catch (error) {
        console.error("Image redesign failed:", error);
        alert(`Image redesign failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
        setDebugInfo(null);
    }
  };
  
  const handleManualRedesign = useCallback(async (e?: React.MouseEvent) => {
      if (appMode !== 'edit') return;
      const userPrompt = prompt.trim();
      if (!userPrompt) {
          alert("Please provide a text prompt to describe the redesign ideas.");
          return;
      }
      await executeRedesign(userPrompt, numberOfImages);
  }, [objects, prompt, numberOfImages, appMode, setObjects]);
  
  const handleExecuteRedesignSuggestion = useCallback(async (suggestion: string) => {
    if (appMode !== 'edit') return;
    const match = suggestion.match(/(\d+)/);
    const numImages = match ? parseInt(match[1], 10) : 1;
    
    setNumberOfImages(numImages);
    setPrompt(suggestion);
    
    await executeRedesign(suggestion, numImages);
}, [objects, appMode, setObjects]);


  const handleAIEraserGeneration = useCallback(async (maskObject: PathObject) => {
    setIsGenerating(true);
    setLoadingMessage('Applying AI eraser...');

    try {
        const targetImage = (appMode === 'edit'
          ? objects.find(o => o.type === 'image')
          : objects.slice(0, objects.findIndex(o => o.id === maskObject.id)).reverse().find(o => o.type === 'image')
        ) as ImageObject;

        if (!targetImage) {
            const alertMessage = appMode === 'edit' 
              ? "Could not find a background image to edit."
              : "AI Eraser must be used on top of an image.";
            alert(alertMessage);
            throw new Error("Target image for AI eraser not found.");
        }
        
        const maskedImageUrl = await createMaskedImage(targetImage, maskObject);
        const maskedImagePart = { inlineData: { mimeType: 'image/png', data: maskedImageUrl.split(',')[1] }};
        
        const finalPrompt = getAIEraserPrompt();
        const parts: Part[] = [maskedImagePart, { text: finalPrompt }];
        
        const result = await generateImageFromParts(parts, 1);
        if (result.error) throw new Error(result.error);
        
        if (result.newImageBase64s && result.newImageBase64s.length > 0) {
            const newImageSrc = `data:image/png;base64,${result.newImageBase64s[0]}`;
            const tempImg = new Image();
            tempImg.onload = () => {
                const { width: fitWidth, height: fitHeight } = calculateFitDimensions(
                    tempImg.naturalWidth, tempImg.naturalHeight,
                    targetImage.width, targetImage.height 
                );

                const updatedImageObject: ImageObject = {
                    ...targetImage,
                    src: newImageSrc,
                    width: fitWidth,
                    height: fitHeight,
                };
                
                setObjects(prevObjects => {
                    return prevObjects
                        .map(obj => obj.id === targetImage.id ? updatedImageObject : obj)
                        .filter(obj => obj.id !== maskObject.id);
                });
                setSelectedObjectId(targetImage.id);
            };
            tempImg.src = newImageSrc;
        } else {
            throw new Error("The AI model did not return an image for AI Eraser.");
        }

    } catch (error) {
        console.error("AI Eraser failed:", error);
        if (!(error instanceof Error && error.message.includes("Target image for AI eraser not found"))) {
            alert(`AI Eraser failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        setObjects(prev => prev.filter(obj => obj.id !== maskObject.id));
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
        setActiveTool('send');
    }
  }, [objects, setObjects, appMode, setActiveTool]);


  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (appMode === 'chat' || editingText || maskPrompt.visible || showExport || !!objectToExport || debugInfo || variations.visible || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
    }
    
    if (e.key === ' ' && !e.repeat) {
      e.preventDefault();
      setIsSpacebarDown(true);
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      setShowKeybindings(false);
      setShowExport(false);
      setObjectToExport(null);
      if (activeTool === 'crop') {
        handleCancelCrop();
      }
    } else if (e.key === 'Enter' && activeTool === 'crop') {
        handleApplyStandardCrop();
    } else if (e.shiftKey && e.key === 'Enter') {
        if (!isGenerating) {
            e.preventDefault();
            handleGenerateImage();
        }
    } else if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
    } else if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
    } else if (isCtrl && e.key === 'c') {
        if (selectedObject) {
            e.preventDefault();
            setClipboard(JSON.parse(JSON.stringify(selectedObject)));
        }
    } else if (isCtrl && e.key === 'v') {
        if (clipboard) {
            e.preventDefault();
            const newObject: CanvasObjectType = { ...clipboard };
            newObject.id = `${newObject.type}-${Date.now()}`;
            newObject.visible = true;
            
            if ('x' in newObject && 'y' in newObject) {
                newObject.x += 20;
                newObject.y += 20;
            } else if ('x1' in newObject) {
                (newObject as any).x1 += 20;
                (newObject as any).y1 += 20;
                (newObject as any).x2 += 20;
                (newObject as any).y2 += 20;
            } else if ('points' in newObject) {
                (newObject as any).points = (newObject as any).points.map((p: {x: number, y: number}) => ({ x: p.x + 20, y: p.y + 20 }));
            }
            
            setObjects(prev => [...prev, newObject]);
            setSelectedObjectId(newObject.id);
        }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedObjectId) {
            e.preventDefault();
            setObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
            setSelectedObjectId(null);
        }
    } else if (!isCtrl && e.key !== ' ' && activeTool !== 'crop') {
      switch (e.key.toLowerCase()) {
        case 'v': handleToolSelect('send'); break;
        case 'b': handleToolSelect('brush'); break;
        case 'e': handleToolSelect('eraser'); break;
        case 'l': handleToolSelect('line'); break;
        case 'm': handleToolSelect('rect'); break;
        case 't': handleToolSelect('text'); break;
        case 'c': handleToolSelect('crop'); break;
      }
    }
  }, [selectedObject, clipboard, handleUndo, handleRedo, setObjects, editingText, maskPrompt.visible, handleToolSelect, isGenerating, handleGenerateImage, setIsSpacebarDown, showExport, objectToExport, activeTool, debugInfo, variations.visible, appMode]);
  
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      setIsSpacebarDown(false);
    }
  }, [setIsSpacebarDown]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (appMode === 'chat' || appMode === 'clone' || appMode === 'mockup' || editingText || maskPrompt.visible || showExport || !!objectToExport || debugInfo || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (typeof event.target?.result === 'string') {
                        handleImageUpload(event.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
            break; 
        }
    }
  }, [handleImageUpload, editingText, maskPrompt.visible, showExport, objectToExport, debugInfo, appMode]);

  useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('paste', handlePaste);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          window.removeEventListener('paste', handlePaste);
      };
  }, [handleKeyDown, handleKeyUp, handlePaste]);

  const handleSelectVariation = (index: number, allVariations = variations.images, maskIdToRemove?: string) => {
    if (!variations.targetObjectId && !maskIdToRemove) return;
    const targetId = variations.targetObjectId || (objects.find(o => o.type === 'image') as ImageObject)?.id;
    if (!targetId || !allVariations[index]) return;
    
    const newVariation = allVariations[index];
    const container = mainContainerRef.current;
    if (!container) return;

    const targetObject = objects.find(o => o.id === targetId) as ImageObject;
    if (!targetObject) return;
    
    const { width: fitWidth, height: fitHeight } = calculateFitDimensions(
        newVariation.width,
        newVariation.height,
        container.clientWidth,
        container.clientHeight
    );
    
    const newObjects = objects
        .map(obj => obj.id === targetId ? { ...obj, src: newVariation.src, width: fitWidth, height: fitHeight } : obj)
        .filter(obj => !maskIdToRemove || obj.id !== maskIdToRemove);

    setObjects(newObjects, false);
    setSelectedObjectId(targetId);
  
    setVariations(prev => ({ ...prev, currentIndex: index }));
  };
  
  const handleAcceptVariation = () => {
    if (!variations.targetObjectId || variations.images.length === 0) return;
    
    const finalVariation = variations.images[variations.currentIndex];
    const container = mainContainerRef.current;
    if (!container) return;

    const { width: fitWidth, height: fitHeight } = calculateFitDimensions(
        finalVariation.width,
        finalVariation.height,
        container.clientWidth,
        container.clientHeight
    );

    setObjects(prev => prev.map(obj => 
        obj.id === variations.targetObjectId ? { ...obj, src: finalVariation.src, width: fitWidth, height: fitHeight } : obj
    ), true); // Add to history
  
    setVariations({ visible: false, images: [], currentIndex: 0, originalImageSrc: '', targetObjectId: null });
  };
  
  const handleCancelVariation = () => {
    if (!variations.targetObjectId) return;
  
    setObjects(prev => prev.map(obj => 
        obj.id === variations.targetObjectId ? { ...obj, src: variations.originalImageSrc } : obj
    ), true); // Revert and add to history
  
    setVariations({ visible: false, images: [], currentIndex: 0, originalImageSrc: '', targetObjectId: null });
  };


  const handleTextUpdate = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (editingText) {
        const newText = e.target.value;
        setEditingText(prev => prev ? {...prev, text: newText} : null);
        
        setHistory(h => ({
            ...h,
            present: h.present.map(obj => 
                obj.id === editingText.id ? { ...obj, text: newText } as TextObject : obj
            )
        }));
    }
  };

  const handleTextEditEnd = () => {
    if (!editingText) return;
    
    const finalEditingText = { ...editingText };

    setObjects(prevObjects => prevObjects.map(obj => 
        obj.id === finalEditingText.id ? { ...obj, text: finalEditingText.text } as TextObject : obj
    ));

    setEditingText(null);
  }

  const handleOpenMaskPrompt = useCallback((objectId: string, clientX: number, clientY: number) => {
    const BOX_WIDTH = 320;
    const BOX_HEIGHT = 296; 
    const PADDING = 16;
    const TOOLBAR_RESERVED_HEIGHT = 90;
    const CURSOR_OFFSET = 20;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const safeArea = {
        top: PADDING,
        right: screenWidth - PADDING,
        bottom: screenHeight - TOOLBAR_RESERVED_HEIGHT - PADDING,
        left: PADDING,
    };

    let y = clientY + CURSOR_OFFSET;
    let x = clientX + CURSOR_OFFSET;

    if (y + BOX_HEIGHT > safeArea.bottom) {
        y = clientY - BOX_HEIGHT - CURSOR_OFFSET;
    }

    if (x + BOX_WIDTH > safeArea.right) {
        x = clientX - BOX_WIDTH - CURSOR_OFFSET;
    }

    x = Math.max(safeArea.left, Math.min(x, safeArea.right - BOX_WIDTH));
    y = Math.max(safeArea.top, Math.min(y, safeArea.bottom - BOX_HEIGHT));

    setMaskPrompt({
        visible: true,
        x: x,
        y: y,
        targetObjectId: objectId,
        promptText: '',
        droppedImage: null
    });
  }, []);

  const handleCropRectChange = useCallback((updates: Partial<RectObject>) => {
    setCropRect(prev => {
        if (!prev) return null;
        const newRect = { ...prev, ...updates };
        // If width/height is updated from toolbar, resize from center
        if (updates.width && !updates.x) {
            const oldWidth = prev.width || 0;
            newRect.x = prev.x + (oldWidth - newRect.width) / 2;
        }
        if (updates.height && !updates.y) {
            const oldHeight = prev.height || 0;
            newRect.y = prev.y + (oldHeight - newRect.height) / 2;
        }
        return newRect;
    });
}, []);

const getCroppedCanvasAndRect = async (
    cropRect: RectObject, 
    objectsToCrop: CanvasObjectType[]
): Promise<{ canvas: HTMLCanvasElement, finalRect: RectObject } | null> => {
    if (Math.abs(cropRect.width) < 1 || Math.abs(cropRect.height) < 1) {
        return null;
    }

    const rect = { ...cropRect };
    if (rect.width < 0) {
        rect.x += rect.width;
        rect.width *= -1;
    }
    if (rect.height < 0) {
        rect.y += rect.height;
        rect.height *= -1;
    }
    
    const processCanvas = document.createElement('canvas');
    processCanvas.width = rect.width;
    processCanvas.height = rect.height;
    const ctx = processCanvas.getContext('2d');
    if (!ctx) {
        alert("Could not create canvas context for cropping.");
        return null;
    }

    const translatedObjects = objectsToCrop.map(obj => {
        const newObj = JSON.parse(JSON.stringify(obj)); // Deep copy
        if ('x' in newObj && 'y' in newObj) {
            newObj.x -= rect.x;
            newObj.y -= rect.y;
        } else if ('x1' in newObj) {
            (newObj as any).x1 -= rect.x;
            (newObj as any).y1 -= rect.y;
            (newObj as any).x2 -= rect.x;
            (newObj as any).y2 -= rect.y;
        } else if ('points' in newObj) {
            (newObj as any).points = (newObj as any).points.map((p: {x:number, y:number}) => ({ x: p.x - rect.x, y: p.y - rect.y }));
        }
        return newObj;
    });

    await drawObjectsOnContext(ctx, translatedObjects, { width: rect.width, height: rect.height });
    
    return { canvas: processCanvas, finalRect: rect };
};

const handleApplyStandardCrop = useCallback(async () => {
    if (!cropRect) return;
    const result = await getCroppedCanvasAndRect(cropRect, objects);
    if (!result) {
        setActiveTool('send');
        return;
    }
    
    const { canvas, finalRect } = result;
    const croppedDataUrl = canvas.toDataURL('image/png');
    const newImageObject: ImageObject = {
        id: `image-${Date.now()}`,
        type: 'image',
        src: croppedDataUrl,
        x: finalRect.x,
        y: finalRect.y,
        width: finalRect.width,
        height: finalRect.height,
        visible: true,
        rotation: 0,
    };
    setObjects([newImageObject]);
    setSelectedObjectId(newImageObject.id);
    setActiveTool('send');
}, [cropRect, objects, setObjects]);

const handleApplyGenerativeCrop = useCallback(async () => {
    if (!cropRect) return;
    const result = await getCroppedCanvasAndRect(cropRect, objects);
    if (!result) {
        setActiveTool('send');
        return;
    }
    const { canvas, finalRect } = result;
    
    setActiveTool('send');
    setIsGenerating(true);
    setLoadingMessage('Applying generative fill...');
    try {
        const imageWithTransparency = canvas.toDataURL('image/png');
        const imagePart = await dataUrlToPart(imageWithTransparency);
        const finalPrompt = getOutpaintingPrompt();
        const parts: Part[] = [imagePart, { text: finalPrompt }];
        
        const genResult = await generateImageFromParts(parts, 1);
        if (genResult.error || !genResult.newImageBase64s || !genResult.newImageBase64s[0]) {
            throw new Error(genResult.error || "Generative fill failed to return an image.");
        }
        
        const newImageSrc = `data:image/png;base64,${genResult.newImageBase64s[0]}`;
        const newImageObject: ImageObject = {
            id: `image-${Date.now()}`,
            type: 'image',
            src: newImageSrc,
            x: finalRect.x,
            y: finalRect.y,
            width: finalRect.width,
            height: finalRect.height,
            visible: true,
            rotation: 0,
        };
        setObjects([newImageObject]);
        setSelectedObjectId(newImageObject.id);
    } catch (error) {
        console.error("Generative fill failed:", error);
        alert(`Generative fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
}, [cropRect, objects, setObjects]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }
  
  return (
    <div className="bg-zinc-900 text-white h-screen flex flex-col font-sans">
      <Header appMode={appMode} onModeChange={handleModeChange} onNewChat={handleClear} />
      <main ref={mainContainerRef} className="flex-grow relative min-h-0">
        {restorableData && <RestorePopup onRestore={handleRestore} onDiscard={handleDiscard} />}
        
        {(isGenerating || isGeneratingVideo) && loadingMessage && appMode !== 'chat' && (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-zinc-800/80 backdrop-blur-sm z-30">
                <SpinnerIcon className="w-10 h-10 animate-spin text-zinc-300 mb-3" />
                <p className="text-md font-medium text-zinc-200">{loadingMessage}</p>
            </div>
        )}

                {appMode === 'chat' ? (
                        <ChatPanel 
                history={chatHistory}
                onSendMessage={(msg, imgs, provider) => handleSendChatMessage(msg, imgs, provider)}
                                isGenerating={isChatting || isGeneratingImage}
                                onImageClick={setLightboxImageSrc}
                                onEditMessage={handleEditMessage}
                                onRerunMessage={handleRerunMessage}
                                editingMessage={editingMessage}
                                onCancelEdit={() => setEditingMessageIndex(null)}
                                onDeleteMessage={handleDeleteMessage}
                        />
                ) : appMode === 'sheet' ? (
                        <div className="w-full h-full">
                            <div className="absolute top-4 right-4 z-30">
                                <button onClick={() => setSheetPosition(prev => prev === 'left' ? 'right' : 'left')} className="px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200">
                                    Switch sheet to {sheetPosition === 'left' ? 'right' : 'left'}
                                </button>
                            </div>
                            <div className="w-full h-full">
                                <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center">Loading...</div>}>
                                    {/* lazy import to avoid increasing bundle too much */}
                                    <SheetMode 
                                        history={chatHistory}
                                        onSendMessage={(msg, imgs, provider) => handleSendChatMessage(msg, imgs, provider)}
                                        isGenerating={isChatting || isGeneratingImage}
                                        onImageClick={setLightboxImageSrc}
                                        onRerunMessage={handleRerunMessage}
                                        onEditMessage={handleEditMessage}
                                        editingMessage={editingMessage}
                                        onCancelEdit={() => setEditingMessageIndex(null)}
                                        onDeleteMessage={handleDeleteMessage}
                                        sheetUrl={sheetUrl}
                                        sheetOnLeft={sheetPosition === 'left'}
                                    />
                                </React.Suspense>
                            </div>
                        </div>
                ) : appMode === 'clone' ? (
                    <CloneMode 
                        initialState={cloneState}
                        onStateChange={setCloneState}
                    />
                ) : appMode === 'mockup' ? (
                    <MockupMode />
                ) : (
            <div className="w-full h-full">
                {appMode === 'video' && generatedVideoUrl && !isGeneratingVideo && (
                    <div className="w-full h-full bg-black flex items-center justify-center p-4 box-border">
                      <video src={generatedVideoUrl} controls autoPlay loop className="max-w-full max-h-full object-contain" />
                    </div>
                )}
                
                {!(appMode === 'video' && generatedVideoUrl) && !((isGenerating || isGeneratingVideo) && loadingMessage) && (
                    <>
                        {(appMode === 'edit' || appMode === 'video') && !hasImage ? (
                            <ImageUploadPrompt onImageUpload={handleImageUpload} />
                        ) : (
                            <Canvas
                                activeTool={activeTool}
                                setActiveTool={setActiveTool}
                                objects={objects}
                                setObjects={setObjects}
                                selectedObjectId={selectedObjectId}
                                setSelectedObjectId={setSelectedObjectId}
                                strokeColor={activeSettings.strokeColor}
                                fillColor={activeSettings.fillColor}
                                strokeWidth={activeSettings.strokeWidth}
                                setStrokeWidth={(width) => handleSettingChange({ strokeWidth: width })}
                                opacity={activeSettings.opacity}
                                setOpacity={(opacity) => handleSettingChange({ opacity })}
                                onTextDoubleClick={setEditingText}
                                onImageDrop={handleImageUpload}
                                editingText={editingText}
                                viewTransform={viewTransform}
                                setViewTransform={setViewTransform}
                                isSpacebarDown={isSpacebarDown}
                                onOpenMaskPrompt={handleOpenMaskPrompt}
                                onAIEraserFinish={handleAIEraserGeneration}
                                canvasMode={appMode === 'canvas' ? 'canvas' : 'edit'}
                                textAlign={activeSettings.align}
                                textFontSize={activeSettings.fontSize}
                                cropAspectRatio={cropAspectRatio}
                                cropRect={cropRect}
                                onCropRectChange={setCropRect}
                            />
                        )}
                    </>
                )}
            </div>
        )}


        {appMode !== 'chat' && editingText && (() => {
            const screenWidth = editingText.width * viewTransform.scale;
            const screenHeight = editingText.height * viewTransform.scale;
            const screenCenterX = (editingText.x + editingText.width / 2) * viewTransform.scale + viewTransform.offsetX;
            const screenCenterY = (editingText.y + editingText.height / 2) * viewTransform.scale + viewTransform.offsetY;
            const screenLeft = screenCenterX - screenWidth / 2;
            const screenTop = screenCenterY - screenHeight / 2;
            
            return (
                <textarea
                    value={editingText.text}
                    onChange={handleTextUpdate}
                    onBlur={handleTextEditEnd}
                    autoFocus
                    style={{
                        position: 'absolute',
                        left: `${screenLeft}px`,
                        top: `${screenTop}px`,
                        width: `${screenWidth}px`,
                        height: `${screenHeight}px`,
                        transform: `rotate(${editingText.rotation}deg)`,
                        transformOrigin: 'center center',
                        fontSize: `${editingText.fontSize * viewTransform.scale}px`,
                        lineHeight: 1.2,
                        color: editingText.strokeColor,
                        background: 'transparent',
                        border: '1px dashed #007bff',
                        outline: 'none',
                        resize: 'none',
                        overflow: 'hidden',
                        fontFamily: 'sans-serif',
                        textAlign: editingText.align,
                        zIndex: 10,
                    }}
                />
            );
        })()}

        <ExamplePopup show={showExample} onClose={() => setShowExample(false)} />
        <KeybindingsPopup show={showKeybindings} onClose={() => setShowKeybindings(false)} />
        {lightboxImageSrc && <Lightbox src={lightboxImageSrc} onClose={() => setLightboxImageSrc(null)} />}
        
        {appMode !== 'chat' && (
            <>
                <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2" style={{maxHeight: 'calc(100% - 2rem)'}}>
                    {(appMode === 'canvas' || hasImage) && appMode !== 'video' &&
                      <LayersPanel 
                          show={showLayers}
                          onClose={() => setShowLayers(false)}
                          objects={objects}
                          selectedObjectId={selectedObjectId}
                          onSelectObject={setSelectedObjectId}
                          onToggleVisibility={handleToggleVisibility}
                          onDeleteObject={handleDeleteObject}
                          onReorderObjects={handleReorderObjects}
                          onSaveObject={setObjectToExport}
                      />
                    }
                    <StagedAssetsPanel
                      assets={stagedAssets}
                      onDelete={(id) => setStagedAssets(prev => prev.filter(a => a.id !== id))}
                    />
                </div>

                {maskPrompt.visible && (
                    <MaskPromptBox
                        state={maskPrompt}
                        onStateChange={setMaskPrompt}
                        onClose={() => setMaskPrompt(prev => ({ ...prev, visible: false }))}
                        onGenerate={handleMaskedGeneration}
                        onRemoveBackground={handleRemoveBackground}
                        onFixGenerate={handleFixGeneration}
                        isGenerating={isGenerating}
                        appMode={appMode === 'canvas' ? 'canvas' : 'edit'}
                    />
                )}
                {variations.visible && (
                  <VariationViewer
                    images={variations.images}
                    currentIndex={variations.currentIndex}
                    onSelectVariation={(index) => handleSelectVariation(index)}
                    onAccept={handleAcceptVariation}
                    onCancel={handleCancelVariation}
                  />
                )}
                <ExportPopup 
                  show={showExport || !!objectToExport}
                  onClose={() => {
                    setShowExport(false);
                    setObjectToExport(null);
                  }}
                  onExport={handleDoExport}
                  isExporting={isExporting}
                />
                {debugInfo && (
                    <DebugPopup
                        debugInfo={debugInfo}
                        onClose={() => {
                            setDebugInfo(null);
                            setIsGenerating(false);
                        }}
                        onContinue={() => continueImageGeneration(debugInfo.parts)}
                    />
                )}

                {appMode !== 'chat' && appMode !== 'sheet' && appMode !== 'clone' && appMode !== 'mockup' && (
                <Toolbar
                    appMode={appMode}
                    activeTool={activeTool}
                    onToolSelect={handleToolSelect}
                    onImageUpload={handleImageUpload}
                    onClearCanvas={handleClear}
                    strokeColor={activeSettings.strokeColor}
                    onStrokeColorChange={(color) => handleSettingChange({ strokeColor: color })}
                    fillColor={activeSettings.fillColor}
                    onFillColorChange={(color) => handleSettingChange({ fillColor: color })}
                    strokeWidth={activeSettings.strokeWidth}
                    onStrokeWidthChange={(width) => handleSettingChange({ strokeWidth: width })}
                    opacity={activeSettings.opacity}
                    onOpacityChange={(opacity) => handleSettingChange({ opacity })}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    selectedObject={selectedObject}
                    onUpdateSelectedObject={handleUpdateSelectedObject}
                    onShowKeybindings={() => setShowKeybindings(true)}
                    onGenerateImage={handleGenerateImage}
                    onManualRedesign={handleManualRedesign}
                    onExecuteRedesignSuggestion={(concept) => handleExecuteRedesignSuggestion(concept.en)}
                    hasImage={hasImage}
                    onGenerateVideo={handleGenerateVideo}
                    isGenerating={isGenerating || isGeneratingVideo}
                    showLayers={showLayers}
                    onToggleLayers={() => setShowLayers(prev => !prev)}
                    isCompositionTask={isCompositionTask}
                    numberOfImages={numberOfImages}
                    onNumberOfImagesChange={setNumberOfImages}
                    onShowExport={() => setShowExport(true)}
                    onApplyStandardCrop={handleApplyStandardCrop}
                    onApplyGenerativeCrop={handleApplyGenerativeCrop}
                    onCancelCrop={handleCancelCrop}
                    cropAspectRatio={cropAspectRatio}
                    onCropAspectRatioChange={setCropAspectRatio}
                    cropRect={cropRect}
                    onCropRectChange={handleCropRectChange}
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    provider={providerSelection}
                    onProviderChange={setProviderSelection}
                    videoSuggestions={videoSuggestions}
                    isLoadingSuggestions={isLoadingSuggestions}
                    generatedVideoUrl={generatedVideoUrl}
                    videoAspectRatio={videoAspectRatio}
                    onVideoAspectRatioChange={setVideoAspectRatio}
                    redesignSuggestions={redesignSuggestions}
                    isLoadingRedesignSuggestions={isLoadingRedesignSuggestions}
                />
                )}
            </>
        )}
      </main>
      
      {/* PWA Update Prompt - Shows when new version available */}
      <UpdatePrompt />
    </div>
  );
};

export default App;