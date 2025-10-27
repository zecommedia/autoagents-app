import React, { useState, useRef } from 'react';
import { cloudApiService } from '../../lib/services/cloudApiService';
import { SpinnerIcon, ImageIcon, TrashIcon } from '../constants';

interface ProcessedImage {
    filename: string;
    path: string;
    data?: string;
}

const MockupMode: React.FC = () => {
    const [stickerFile, setStickerFile] = useState<File | null>(null);
    const [stickerPreview, setStickerPreview] = useState<string | null>(null);
    const [psdFiles, setPsdFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const stickerInputRef = useRef<HTMLInputElement>(null);
    const psdInputRef = useRef<HTMLInputElement>(null);

    const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setStickerFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setStickerPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePsdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setPsdFiles((prev) => [...prev, ...files]);
    };

    const removePsdFile = (index: number) => {
        setPsdFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleProcess = async () => {
        if (!stickerFile || psdFiles.length === 0) {
            setErrorMessage('Vui lòng tải lên sticker và ít nhất một file PSD.');
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);
        setProcessedImages([]);
        setUploadProgress(0);

        try {
            // Process each PSD file
            const results: ProcessedImage[] = [];
            
            for (let i = 0; i < psdFiles.length; i++) {
                const psdFile = psdFiles[i];
                const progress = ((i + 1) / psdFiles.length) * 100;
                setUploadProgress(Math.round(progress));

                try {
                    // Use cloudApiService to process mockup
                    // This combines sticker + PSD background using AI image composition
                    const result = await cloudApiService.multiImageRedesign(
                        [psdFile, stickerFile],
                        'Place the second image (sticker/design) onto the first image (mockup template) naturally and professionally. Maintain the perspective and lighting of the mockup. Make it look realistic.',
                        'gemini',
                        (progressPercent) => {
                            const totalProgress = ((i + progressPercent / 100) / psdFiles.length) * 100;
                            setUploadProgress(Math.round(totalProgress));
                        }
                    );

                    if (result.success && result.data) {
                        // Convert base64 to data URL if needed
                        const imageData = result.data.startsWith('data:') 
                            ? result.data 
                            : `data:image/png;base64,${result.data}`;
                        
                        results.push({
                            filename: `mockup_${psdFile.name.replace('.psd', '.png')}`,
                            path: '', // Not used for cloud processing
                            data: imageData
                        });
                    } else {
                        console.error(`Failed to process ${psdFile.name}:`, result.error);
                        setErrorMessage(`Failed to process ${psdFile.name}: ${result.error}`);
                    }
                } catch (err) {
                    console.error(`Error processing ${psdFile.name}:`, err);
                    setErrorMessage(`Error processing ${psdFile.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }

            setProcessedImages(results);
            
            if (results.length === 0) {
                setErrorMessage('No mockups were processed successfully.');
            }

        } catch (error) {
            console.error('Error processing mockups:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định');
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = (dataUrl: string, filename: string) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleDownloadAll = () => {
        processedImages.forEach((image) => {
            if (image.data) {
                handleDownload(image.data, image.filename);
            }
        });
    };

    return (
        <div className="w-full h-full bg-zinc-900 flex flex-col overflow-hidden">
            <div className="flex-grow flex overflow-hidden">
                {/* Left Panel - Upload Section */}
                <div className="w-1/3 border-r border-zinc-700 p-6 overflow-y-auto">
                    <h2 className="text-xl font-semibold text-white mb-6">Tạo Mockup (AI)</h2>

                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg text-blue-300 text-sm">
                        <strong>✨ AI-Powered Mockup</strong>
                        <p className="mt-1 text-xs">
                            Upload your design and mockup templates. AI will intelligently place your design onto the mockup with proper perspective and lighting.
                        </p>
                    </div>

                    {/* Sticker Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Sticker / Design
                        </label>
                        <input
                            ref={stickerInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleStickerUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => stickerInputRef.current?.click()}
                            className="w-full h-32 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center hover:border-zinc-500 transition-colors"
                        >
                            {stickerPreview ? (
                                <img
                                    src={stickerPreview}
                                    alt="Sticker preview"
                                    className="max-h-28 max-w-full object-contain"
                                />
                            ) : (
                                <>
                                    <ImageIcon className="w-8 h-8 text-zinc-500 mb-2" />
                                    <span className="text-sm text-zinc-500">Tải lên ảnh sticker</span>
                                </>
                            )}
                        </button>
                        {stickerFile && (
                            <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                                <span className="truncate">{stickerFile.name}</span>
                                <button
                                    onClick={() => {
                                        setStickerFile(null);
                                        setStickerPreview(null);
                                    }}
                                    className="ml-2 text-red-400 hover:text-red-300"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mockup Templates Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Mockup Templates (Images)
                        </label>
                        <input
                            ref={psdInputRef}
                            type="file"
                            accept="image/*,.psd"
                            multiple
                            onChange={handlePsdUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => psdInputRef.current?.click()}
                            className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center justify-center"
                        >
                            <ImageIcon className="w-5 h-5 mr-2" />
                            Add Mockup Templates
                        </button>
                        <p className="mt-2 text-xs text-zinc-500">
                            Supports: PNG, JPG, PSD (rendered as image)
                        </p>
                        {psdFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {psdFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between bg-zinc-800 p-2 rounded"
                                    >
                                        <span className="text-sm text-zinc-300 truncate flex-1">
                                            {file.name}
                                        </span>
                                        <button
                                            onClick={() => removePsdFile(index)}
                                            className="ml-2 text-red-400 hover:text-red-300"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Process Button */}
                    <button
                        onClick={handleProcess}
                        disabled={!stickerFile || psdFiles.length === 0 || isProcessing}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                    >
                        {isProcessing ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 mr-2 animate-spin" />
                                Processing... {uploadProgress}%
                            </>
                        ) : (
                            'Generate Mockups'
                        )}
                    </button>

                    {errorMessage && (
                        <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* Right Panel - Results Section */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-white">Results</h2>
                        {processedImages.length > 0 && (
                            <button
                                onClick={handleDownloadAll}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                            >
                                Download All
                            </button>
                        )}
                    </div>

                    {processedImages.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center text-zinc-500">
                                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Generated mockups will appear here</p>
                                <p className="text-sm mt-2">AI will intelligently composite your design</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {processedImages.map((image, index) => (
                                <div
                                    key={index}
                                    className="bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
                                >
                                    <img
                                        src={image.data}
                                        alt={image.filename}
                                        className="w-full h-64 object-contain bg-zinc-900"
                                    />
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-sm text-zinc-300 truncate flex-1">
                                            {image.filename}
                                        </span>
                                        <button
                                            onClick={() => handleDownload(image.data!, image.filename)}
                                            className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockupMode;
