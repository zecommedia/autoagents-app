import React, { useState, useRef, useEffect } from 'react';
import { SpinnerIcon, ChatIcon, PlusIcon, MicIcon, ArrowUpIcon, CloseIcon, CopyIcon, RefreshIcon, EditIcon, CheckIcon, TrashIcon } from '../constants';
import type { Part } from '@google/genai';
import { type ChatMessage } from '../App';

interface ChatPanelProps {
    history: ChatMessage[];
    onSendMessage: (message: string, images: { data: string; mimeType: string }[], provider: 'gemini' | 'openai') => void;
    isGenerating: boolean;
    onImageClick: (src: string) => void;
    onRerunMessage: (index: number) => void;
    onEditMessage: (index: number) => void;
    editingMessage: ChatMessage | null;
    onCancelEdit: () => void;
    onDeleteMessage: (index: number) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ history, onSendMessage, isGenerating, onImageClick, onRerunMessage, onEditMessage, editingMessage, onCancelEdit, onDeleteMessage }) => {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState<{ dataUrl: string; file: File }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [aiModel, setAiModel] = useState<'gemini' | 'openai'>('gemini');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [history]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(200, textarea.scrollHeight);
            textarea.style.height = `${newHeight}px`;
        }
    }, [prompt, images]);

    useEffect(() => {
        if (editingMessage) {
            const textPart = editingMessage.parts.find(p => 'text' in p) as Part & { text: string } | undefined;
            const imageParts = editingMessage.parts.filter(p => 'inlineData' in p) as (Part & { inlineData: { data: string, mimeType: string }})[];

            setPrompt(textPart?.text || '');
            const imageStates = imageParts.map(p => {
                const dataUrl = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
                const file = new File([], "edited-image.png", { type: p.inlineData.mimeType }); // Dummy file
                return { dataUrl, file };
            });
            setImages(imageStates);
            textareaRef.current?.focus();
        } else {
            setPrompt('');
            setImages([]);
        }
    }, [editingMessage]);

    const handleSend = () => {
        if ((!prompt.trim() && images.length === 0) || isGenerating) return;

        const imageParts = images.map(img => {
            const [meta, base64Data] = img.dataUrl.split(',');
            const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
            return { data: base64Data, mimeType };
        });

        // Include provider selection so the app can route to the correct backend/model
        onSendMessage(prompt, imageParts, aiModel);
        setPrompt('');
        setImages([]);
    };
    
    const handleCancelEdit = () => {
        onCancelEdit();
        setPrompt('');
        setImages([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof event.target?.result === 'string') {
                    setImages(prev => [...prev, { dataUrl: event.target.result as string, file }]);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    processFile(file);
                }
            }
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(processFile);
        }
        if (e.target) {
          e.target.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(processFile);
        }
    };
    
    const handleRemoveImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };
    
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).catch(err => console.error("Failed to copy text:", err));
    };

    const hasContent = prompt.trim().length > 0 || images.length > 0;

    const MessageActions: React.FC<{ msg: ChatMessage, index: number }> = ({ msg, index }) => {
        const textPart = msg.parts.find(p => 'text' in p) as Part & { text: string } | undefined;
        return (
            <div className="absolute -bottom-2 right-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {msg.role === 'user' && (
                    <>
                        <button onClick={() => onEditMessage(index)} className="p-1.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white" title="Edit"><EditIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onRerunMessage(index)} className="p-1.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white" title="Rerun"><RefreshIcon className="w-3.5 h-3.5" /></button>
                    </>
                )}
                {msg.role === 'model' && textPart && (
                    <button onClick={() => handleCopyToClipboard(textPart.text)} className="p-1.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white" title="Copy"><CopyIcon className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => onDeleteMessage(index)} className="p-1.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col bg-zinc-900">
            <div className="flex-grow w-full max-w-4xl mx-auto p-4 sm:p-6 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
                        <ChatIcon className="w-16 h-16 mb-4 text-zinc-600"/>
                        <h1 className="text-3xl font-bold text-zinc-300 mb-2">Chat Mode</h1>
                        <p>Start a conversation to explore ideas, get assistance, and more.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {history.map((msg, index) => {
                             // Safety check: ensure parts is an array
                             if (!msg.parts || !Array.isArray(msg.parts)) {
                                 console.error('Invalid message parts:', msg);
                                 return null;
                             }
                             
                             const imageParts = msg.parts.filter(p => p && typeof p === 'object' && 'inlineData' in p);
                             const textPart = msg.parts.find(p => p && typeof p === 'object' && 'text' in p);
                             const hasImages = imageParts.length > 0;
                             
                             // Handle text content safely
                             let textContent = '';
                             if (textPart && 'text' in textPart) {
                                 const textValue = textPart.text;
                                 if (typeof textValue === 'string') {
                                     textContent = textValue;
                                 } else if (textValue && typeof textValue === 'object') {
                                     textContent = JSON.stringify(textValue);
                                 } else if (textValue) {
                                     textContent = String(textValue);
                                 }
                             }
                             const hasText = textContent && textContent.trim() !== '';
                             
                             return (
                                <div key={index} className={`flex group relative ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex items-start space-x-3 max-w-2xl`}>
                                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex-shrink-0" />}
                                        <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-zinc-700' : 'bg-zinc-800'}`}>
                                            {msg.role === 'model' && (
                                                <div className="mb-2">
                                                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                                                        {(msg as any).provider === 'openai' ? 'OpenAI' : 'Gemini'}
                                                    </span>
                                                </div>
                                            )}
                                            {hasImages && (
                                                <div className={`grid grid-cols-2 gap-2 ${hasText ? 'mb-3' : ''}`}>
                                                    {imageParts.map((part, partIndex) => {
                                                        const { mimeType } = (part as any).inlineData || {};
                                                        let data = (part as any).inlineData?.data as any;
                                                        // Defensive: some paths accidentally store an object or a full data URL
                                                        if (data && typeof data === 'object') {
                                                            data = data.data || data.base64 || data.image || '';
                                                        }
                                                        if (typeof data === 'string' && data.startsWith('data:')) {
                                                            // If a full data URL slipped in, extract pure base64 after the comma
                                                            const maybeBase64 = data.split(',')[1];
                                                            if (maybeBase64) data = maybeBase64;
                                                        }
                                                        const safeMime = typeof mimeType === 'string' && mimeType ? mimeType : 'image/png';
                                                        const src = `data:${safeMime};base64,${typeof data === 'string' ? data : ''}`;
                                                        return (
                                                            <div key={partIndex} className="aspect-square bg-zinc-900 rounded-lg overflow-hidden">
                                                                <img 
                                                                    src={src} 
                                                                    onClick={() => onImageClick(src)} 
                                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                                                                    alt={`Chat content ${partIndex + 1}`} 
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {(msg.role === 'user' && (msg as any).provider) && (
                                                <div className="mb-2">
                                                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                                                        {(msg as any).provider === 'openai' ? 'OpenAI' : 'Gemini'}
                                                    </span>
                                                </div>
                                            )}
                                            {hasText && (
                                                <pre className="text-sm whitespace-pre-wrap font-sans text-white">{textContent}</pre>
                                            )}
                                            {msg.role === 'model' && !hasText && !hasImages && (
                                                <SpinnerIcon className="w-5 h-5 animate-spin text-zinc-400" />
                                            )}
                                        </div>
                                    </div>
                                    {!(isGenerating && index === history.length - 1) && <MessageActions msg={msg} index={index} />}
                                </div>
                            )
                        })}
                         {isGenerating && history[history.length - 1]?.role === 'user' && (
                            <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex-shrink-0" />
                                <div className="max-w-xl p-4 rounded-2xl bg-zinc-800">
                                    <SpinnerIcon className="w-5 h-5 animate-spin text-zinc-400" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 px-2 sm:px-4 pt-2 pb-4">
                <div className="w-full max-w-4xl mx-auto">
                    {images.length > 0 && (
                        <div className="ml-12 mb-2 p-2 bg-zinc-800/50 rounded-lg">
                            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                                {images.map((image, index) => (
                                    <div key={index} className="relative flex-shrink-0">
                                        <img src={image.dataUrl} alt={`Pasted preview ${index}`} className="h-20 w-20 object-cover rounded-md" />
                                        <button
                                            onClick={() => handleRemoveImage(index)}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/75 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                                            aria-label="Remove image"
                                        >
                                            <CloseIcon className="w-3 h-3"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     {editingMessage && (
                        <div className="ml-12 mb-2 flex items-center space-x-2">
                            <div className="bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-full flex items-center space-x-2">
                                <EditIcon className="w-3 h-3" />
                                <span>Editing message</span>
                            </div>
                            <button onClick={handleCancelEdit} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
                        </div>
                    )}
                    <div 
                        className={`bg-zinc-800 rounded-2xl flex items-center p-2 space-x-2 transition-all duration-200 ${isDragging ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900' : ''}`}
                        onPaste={handlePaste}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700 transition-colors" aria-label="Attach file">
                            <PlusIcon className="w-5 h-5"/>
                        </button>
                        <div className="relative group">
                            <select
                                value={aiModel}
                                onChange={(e) => setAiModel(e.target.value as 'gemini' | 'openai')}
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
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter a prompt..."
                            rows={1}
                            className="flex-grow bg-transparent text-sm text-zinc-200 resize-none outline-none self-center"
                        />
                         <button className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700 transition-colors" aria-label="Use microphone">
                            <MicIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isGenerating || !hasContent}
                            className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed group
                                ${hasContent && !isGenerating ? 'bg-gradient-to-br from-blue-500 to-cyan-400' : 'bg-zinc-700'}`
                            }
                            aria-label="Send message"
                        >
                            {isGenerating ? 
                                <SpinnerIcon className="w-5 h-5 animate-spin text-white" /> :
                                (editingMessage ? <CheckIcon className="w-5 h-5 text-white" /> : <ArrowUpIcon className={`w-5 h-5 transition-colors ${hasContent ? 'text-white' : 'text-zinc-500'}`} />)
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;