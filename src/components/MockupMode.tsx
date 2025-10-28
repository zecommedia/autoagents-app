import React, { useState, useRef } from 'react';
import { SpinnerIcon, ImageIcon, TrashIcon } from '../constants';
import { processPsdsClientSide } from '../../lib/psdProcessor';

interface ProcessedImage {
    filename: string;
    data: string; // Base64 data URL
}

// Electron type definitions
declare global {
    interface Window {
        electron?: {
            isElectron: boolean;
            platform: string;
            checkPhotoshop: () => Promise<{ installed: boolean; path?: string }>;
            selectFile: (options?: any) => Promise<{ canceled: boolean; filePath: string | null }>;
            selectFiles: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
            processMockupsPhotoshop: (data: {
                podDesignPath: string;
                psdPaths: string[];
            }) => Promise<{
                success: boolean;
                processedImages?: ProcessedImage[];
                error?: string;
            }>;
            saveFileDialog: (options: any) => Promise<{ filePath: string; canceled: boolean }>;
            writeFile: (data: { filePath: string; data: string }) => Promise<{ success: boolean }>;
            getAppVersion: () => Promise<string>;
        };
    }
}

const MockupMode: React.FC = () => {
    const [podDesignFile, setPodDesignFile] = useState<File | null>(null);
    const [podDesignPreview, setPodDesignPreview] = useState<string | null>(null);
    const [podDesignPath, setPodDesignPath] = useState<string | null>(null); // For Electron
    const [psdFiles, setPsdFiles] = useState<File[]>([]);
    const [psdFilePaths, setPsdFilePaths] = useState<string[]>([]); // For Electron
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [usePhotoshop, setUsePhotoshop] = useState(false);
    const [photoshopAvailable, setPhotoshopAvailable] = useState<boolean | null>(null);
    const [photoshopPath, setPhotoshopPath] = useState<string | null>(null);
    const isElectron = typeof window.electron !== 'undefined' && window.electron?.isElectron;

    const podDesignInputRef = useRef<HTMLInputElement>(null);
    const psdInputRef = useRef<HTMLInputElement>(null);

    // Check Photoshop availability on mount
    React.useEffect(() => {
        const checkPhotoshop = async () => {
            try {
                if (isElectron && window.electron) {
                    // Desktop app - check local Photoshop
                    console.log('🖥️ Desktop Mode: Checking local Photoshop...');
                    const result = await window.electron.checkPhotoshop();
                    setPhotoshopAvailable(result.installed);
                    setPhotoshopPath(result.path || null);
                    console.log('Photoshop available (local):', result.installed, result.path);
                } else {
                    // Web app - check server Photoshop
                    console.log('🌐 Web Mode: Checking server Photoshop...');
                    const response = await fetch('http://localhost:4000/api/mockup/check-photoshop');
                    const result = await response.json();
                    setPhotoshopAvailable(result.installed);
                    setPhotoshopPath(result.path || null);
                    console.log('Photoshop available (server):', result.installed, result.path);
                }
            } catch (error) {
                console.error('Error checking Photoshop:', error);
                setPhotoshopAvailable(false);
            }
        };
        checkPhotoshop();
    }, [isElectron]);

    const handlePodDesignUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
        if (isElectron && window.electron) {
            // Desktop mode - use Electron dialog
            const result = await window.electron.selectFile({
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
                ],
                title: 'Select POD Design Image'
            });

            if (!result.canceled && result.filePath) {
                setPodDesignPath(result.filePath);
                // Create a preview - we'll use a file:// URL or read via IPC later
                // For now, just store the path and show filename
                setPodDesignPreview(null); // Will be handled by the processing
                console.log('Selected POD design:', result.filePath);
            }
        } else {
            // Web mode - use file input
            const file = e?.target.files?.[0];
            if (file) {
                setPodDesignFile(file);
                const reader = new FileReader();
                reader.onload = (event) => {
                    setPodDesignPreview(event.target?.result as string);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handlePsdUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
        if (isElectron && window.electron) {
            // Desktop mode - use Electron dialog
            const result = await window.electron.selectFiles({
                filters: [
                    { name: 'PSD Files', extensions: ['psd'] }
                ],
                title: 'Select PSD Template Files'
            });

            if (!result.canceled && result.filePaths.length > 0) {
                setPsdFilePaths(prev => [...prev, ...result.filePaths]);
            }
        } else {
            // Web mode - use file input
            const files = Array.from(e?.target.files || []);
            setPsdFiles((prev) => [...prev, ...files]);
        }
    };

    const removePsdFile = (index: number) => {
        if (isElectron) {
            setPsdFilePaths((prev) => prev.filter((_, i) => i !== index));
        } else {
            setPsdFiles((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const handleProcess = async () => {
        if (isElectron) {
            if (!podDesignPath || psdFilePaths.length === 0) {
                setErrorMessage('Vui lòng chọn POD design và ít nhất một file PSD.');
                return;
            }
        } else {
            if (!podDesignFile || psdFiles.length === 0) {
                setErrorMessage('Vui lòng tải lên POD design và ít nhất một file PSD.');
                return;
            }
        }

        setIsProcessing(true);
        setErrorMessage(null);
        setProcessedImages([]);

        try {
            if (usePhotoshop && photoshopAvailable) {
                if (isElectron && window.electron) {
                    // Desktop app - Process with LOCAL Photoshop
                    console.log('🖥️ Processing with LOCAL Photoshop...');
                    
                    if (!podDesignPath || psdFilePaths.length === 0) {
                        throw new Error('Could not get file paths. Please select files again.');
                    }

                    const result = await window.electron.processMockupsPhotoshop({
                        podDesignPath: podDesignPath,
                        psdPaths: psdFilePaths
                    });

                    if (result.success && result.processedImages) {
                        setProcessedImages(result.processedImages);
                        console.log(`✓ Processed ${result.processedImages.length} mockups with local Photoshop`);
                    } else {
                        throw new Error(result.error || 'Xử lý mockup thất bại');
                    }
                } else {
                    // Web app - Process with SERVER Photoshop
                    console.log('☁️ Processing with SERVER Photoshop...');
                    const formData = new FormData();
                    formData.append('sticker', podDesignFile!);
                    psdFiles.forEach((file) => {
                        formData.append('psdFiles', file);
                    });

                    const response = await fetch('http://localhost:4000/api/mockup/process-mockups-photoshop', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText || 'Xử lý mockup thất bại');
                    }

                    const result = await response.json();
                    setProcessedImages(result.processedImages);
                }
            } else {
                // Fast mode: Client-side processing with ag-psd
                console.log('⚡ Processing with Fast mode (client-side)...');
                const results = await processPsdsClientSide(podDesignFile!, psdFiles);
                setProcessedImages(results);
                console.log(`✓ Processed ${results.length} mockups client-side`);
            }
        } catch (error) {
            console.error('Error processing mockups:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async (dataUrl: string, filename: string) => {
        try {
            if (isElectron && window.electron) {
                // Desktop app - Use native save dialog
                const result = await window.electron.saveFileDialog({
                    defaultPath: filename,
                    filters: [
                        { name: 'PNG Images', extensions: ['png'] }
                    ]
                });

                if (!result.canceled && result.filePath) {
                    await window.electron.writeFile({
                        filePath: result.filePath,
                        data: dataUrl
                    });
                    console.log('✓ File saved:', result.filePath);
                }
            } else {
                // Web app - Download via browser
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
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
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-white">Tạo Mockup POD</h2>
                        {isElectron && (
                            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                                <span>🖥️</span>
                                <span>Desktop Mode</span>
                            </div>
                        )}
                    </div>

                    {/* POD Design Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            POD Design
                        </label>
                        {!isElectron && (
                            <input
                                ref={podDesignInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePodDesignUpload}
                                className="hidden"
                            />
                        )}
                        <button
                            onClick={() => isElectron ? handlePodDesignUpload() : podDesignInputRef.current?.click()}
                            className="w-full h-32 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center hover:border-zinc-500 transition-colors"
                        >
                            {podDesignPreview ? (
                                <img
                                    src={podDesignPreview}
                                    alt="POD design preview"
                                    className="max-h-28 max-w-full object-contain"
                                />
                            ) : podDesignPath ? (
                                <>
                                    <ImageIcon className="w-8 h-8 text-green-500 mb-2" />
                                    <span className="text-sm text-green-400">
                                        ✓ {podDesignPath.split('\\').pop()}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <ImageIcon className="w-8 h-8 text-zinc-500 mb-2" />
                                    <span className="text-sm text-zinc-500">
                                        {isElectron ? 'Chọn POD design' : 'Tải lên POD design'}
                                    </span>
                                </>
                            )}
                        </button>
                        {(podDesignFile || podDesignPath) && (
                            <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                                <span className="truncate">
                                    {podDesignPath ? podDesignPath.split('\\').pop() : podDesignFile?.name}
                                </span>
                                <button
                                    onClick={() => {
                                        setPodDesignFile(null);
                                        setPodDesignPreview(null);
                                        setPodDesignPath(null);
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
                                    {photoshopAvailable === true && usePhotoshop && (
                                        isElectron 
                                            ? '✓ Local Photoshop - Edit Smart Object directly'
                                            : '✓ Server Photoshop - Real Smart Object editing'
                                    )}
                                    {photoshopAvailable === true && !usePhotoshop && 'Quick browser-based overlay'}
                                </div>
                                {photoshopPath && (
                                    <div className="text-xs text-green-400 mt-1 truncate">
                                        📁 {photoshopPath}
                                    </div>
                                )}
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
                        {!isElectron && (
                            <input
                                ref={psdInputRef}
                                type="file"
                                accept=".psd"
                                multiple
                                onChange={handlePsdUpload}
                                className="hidden"
                            />
                        )}
                        <button
                            onClick={() => isElectron ? handlePsdUpload() : psdInputRef.current?.click()}
                            className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center justify-center"
                        >
                            <ImageIcon className="w-5 h-5 mr-2" />
                            {isElectron ? 'Chọn file PSD' : 'Thêm file PSD'}
                        </button>
                        {(psdFiles.length > 0 || psdFilePaths.length > 0) && (
                            <div className="mt-3 space-y-2">
                                {isElectron ? (
                                    psdFilePaths.map((filePath, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between bg-zinc-800 p-2 rounded"
                                        >
                                            <span className="text-sm text-zinc-300 truncate">
                                                {filePath.split('\\').pop()}
                                            </span>
                                            <button
                                                onClick={() => removePsdFile(index)}
                                                className="ml-2 text-red-400 hover:text-red-300"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    psdFiles.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between bg-zinc-800 p-2 rounded"
                                        >
                                            <span className="text-sm text-zinc-300 truncate">
                                                {file.name}
                                            </span>
                                            <button
                                                onClick={() => removePsdFile(index)}
                                                className="ml-2 text-red-400 hover:text-red-300"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Process Button */}
                    <button
                        onClick={handleProcess}
                        disabled={
                            isProcessing || 
                            (isElectron 
                                ? (!podDesignPath || psdFilePaths.length === 0)
                                : (!podDesignFile || psdFiles.length === 0)
                            )
                        }
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
                                        src={image.data}
                                        alt={image.filename}
                                        className="w-full h-64 object-contain bg-zinc-900"
                                    />
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-sm text-zinc-300 truncate flex-1">
                                            {image.filename}
                                        </span>
                                        <button
                                            onClick={() => handleDownload(image.data, image.filename)}
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
