import React from 'react';
import { type ImageObject } from '../types';

interface ImageContextMenuProps {
  x: number;
  y: number;
  targetImage: ImageObject;
  onClose: () => void;
}

const ImageContextMenu: React.FC<ImageContextMenuProps> = ({ x, y, targetImage, onClose }) => {

  const handleSaveAsPng = () => {
    try {
        const link = document.createElement('a');
        link.href = targetImage.src;
        link.download = `image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Failed to save image as PNG:', error);
        alert('Failed to save image. An unexpected error occurred.');
    } finally {
        onClose();
    }
  };

  const handleSaveAsJpeg = async () => {
    try {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        const p = new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        img.src = targetImage.src;
        await p;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `image_${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to save as JPEG:', error);
      alert('Failed to save image as JPEG.');
    } finally {
      onClose();
    }
  };

  const handleCopy = async () => {
    try {
      const response = await fetch(targetImage.src);
      const blob = await response.blob();
      
      const blobType = blob.type || 'image/png';

      await navigator.clipboard.write([
        new ClipboardItem({
          [blobType]: new Blob([blob], { type: blobType }),
        }),
      ]);
    } catch (error) {
      console.error('Failed to copy image:', error);
      alert('Failed to copy image to clipboard. Your browser might not support this action or there might be a network issue.');
    } finally {
      onClose();
    }
  };


  return (
    <div
      className="absolute z-30 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg p-1 animate-fade-in"
      style={{ top: `${y}px`, left: `${x}px` }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={handleCopy}
        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded-sm"
      >
        Copy Image
      </button>
      <div className="my-1 h-px bg-zinc-700" />
      <button
        onClick={handleSaveAsPng}
        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded-sm"
      >
        Save as PNG...
      </button>
      <button
        onClick={handleSaveAsJpeg}
        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded-sm"
      >
        Save as JPEG...
      </button>
    </div>
  );
};

export default ImageContextMenu;