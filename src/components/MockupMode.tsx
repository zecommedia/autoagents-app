import React, { useState, useRef } from 'react';
import { SpinnerIcon, ImageIcon, TrashIcon } from '../constants';

interface ProcessedImage {
    filename: string;
    path: string;
}

const MockupMode: React.FC = () => {
    const [stickerFile, setStickerFile] = useState<File | null>(null);
    const [stickerPreview, setStickerPreview] = useState<string | null>(null);
    const [psdFiles, setPsdFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedImages, setProcessedImages] = useState<Array<{ filename: string, path: string, data?: string }>>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [usePhotoshop, setUsePhotoshop] = useState(false); // Toggle Photoshop mode
    const [photoshopAvailable, setPhotoshopAvailable] = useState<boolean | null>(null); // null = checking, false = not available, true = available

    const stickerInputRef = useRef<HTMLInputElement>(null);
    const psdInputRef = useRef<HTMLInputElement>(null);

    // Check Photoshop availability on mount
    React.useEffect(() => {
        const checkPhotoshop = async () => {
            try {
                const response = await fetch('http://localhost:4000/api/mockup/check-photoshop');
                const result = await response.json();
                setPhotoshopAvailable(result.installed);
                console.log('Photoshop available:', result.installed, result.path);
            } catch (error) {
                console.error('Error checking Photoshop:', error);
                setPhotoshopAvailable(false);
            }
        };
        checkPhotoshop();
    }, []);

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

        try {
            const formData = new FormData();
            formData.append('sticker', stickerFile);
            psdFiles.forEach((file) => {
                formData.append('psdFiles', file);
            });

            // Choose endpoint based on mode
            const endpoint = usePhotoshop 
                ? 'http://localhost:4000/api/mockup/process-mockups-photoshop'
                : 'http://localhost:4000/api/mockup/process-mockups';

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Xử lý mockup thất bại');
            }

            const result = await response.json();
            setProcessedImages(result.processedImages);
        } catch (error) {
            console.error('Error processing mockups:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async (dataOrPath: string, filename: string) => {
        try {
            // If it's a data URL, download directly
            if (dataOrPath.startsWith('data:')) {
                const a = document.createElement('a');
                a.href = dataOrPath;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                // Otherwise fetch from server (fallback)
                const response = await fetch(`http://localhost:4000${dataOrPath}`);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    };

    return (
        <div className="w-full h-full bg-zinc-900 flex flex-col overflow-hidden">
            <div className="flex-grow flex overflow-hidden">
                {/* Left Panel - Upload Section */}
                <div className="w-1/3 border-r border-zinc-700 p-6 overflow-y-auto">
                    <h2 className="text-xl font-semibold text-white mb-6">Tạo Mockup</h2>

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

                    {/* Mode Toggle */}
                    <div className="mb-6">
                        <label className={`flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700 transition-colors ${
                            photoshopAvailable === false 
                                ? 'opacity-50 cursor-not-allowed' 
                                : 'cursor-pointer hover:border-zinc-600'
                        }`}>
                            <div className="flex-1">
                                <div className="font-medium text-white mb-1">
                                    {usePhotoshop ? '🎨 Photoshop Mode (Real Edit)' : '⚡ Fast Mode (Overlay)'}
                                </div>
                                <div className="text-xs text-zinc-400">
                                    {photoshopAvailable === null && 'Checking Photoshop...'}
                                    {photoshopAvailable === false && '❌ Photoshop not installed - Fast mode only'}
                                    {photoshopAvailable === true && usePhotoshop && 'Edit Smart Object content directly'}
                                    {photoshopAvailable === true && !usePhotoshop && 'Quick overlay processing'}
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={usePhotoshop}
                                onChange={(e) => setUsePhotoshop(e.target.checked)}
                                disabled={!photoshopAvailable}
                                className="ml-3 w-10 h-5 appearance-none bg-zinc-700 rounded-full relative cursor-pointer transition-colors checked:bg-blue-600 before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </label>
                    </div>

                    {/* PSD Files Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            File PSD Mockup
                        </label>
                        <input
                            ref={psdInputRef}
                            type="file"
                            accept=".psd"
                            multiple
                            onChange={handlePsdUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => psdInputRef.current?.click()}
                            className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center justify-center"
                        >
                            <ImageIcon className="w-5 h-5 mr-2" />
                            Thêm file PSD
                        </button>
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
                                Đang xử lý...
                            </>
                        ) : (
                            'Tạo Mockup'
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
                    <h2 className="text-xl font-semibold text-white mb-6">Kết quả</h2>
                    {processedImages.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center text-zinc-500">
                                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Các mockup đã xử lý sẽ hiển thị ở đây</p>
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
                                        src={image.data || `http://localhost:4000${image.path}`}
                                        alt={image.filename}
                                        className="w-full h-64 object-contain bg-zinc-900"
                                    />
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-sm text-zinc-300 truncate flex-1">
                                            {image.filename}
                                        </span>
                                        <button
                                            onClick={() => handleDownload(image.data || image.path, image.filename)}
                                            className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                        >
                                            Tải về
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
