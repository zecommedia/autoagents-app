
import React, { useRef, useState } from 'react';
import { ImageIcon } from '../constants';

interface ImageUploadPromptProps {
  onImageUpload: (imageDataUrl: string) => void;
}

const ImageUploadPrompt: React.FC<ImageUploadPromptProps> = ({ onImageUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageUpload(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`w-full h-full flex flex-col items-center justify-center bg-zinc-800/30 rounded-lg border-2 border-dashed transition-colors ${isDragging ? 'border-blue-500' : 'border-zinc-700'}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e.target.files)}
        accept="image/*"
        className="hidden"
      />
      <div className="text-center text-zinc-400">
        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-zinc-500" />
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Start by uploading an image</h2>
        <p className="mb-4">Drag & drop, paste, or click the button to upload.</p>
        <button
          onClick={handleButtonClick}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Upload Image
        </button>
      </div>
    </div>
  );
};

export default ImageUploadPrompt;
