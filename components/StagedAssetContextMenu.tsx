import React from 'react';

interface StagedAssetContextMenuProps {
  x: number;
  y: number;
  targetAssetSrc: string;
  onClose: () => void;
}

const StagedAssetContextMenu: React.FC<StagedAssetContextMenuProps> = ({ x, y, targetAssetSrc, onClose }) => {

  const handleSave = () => {
    try {
        const link = document.createElement('a');
        link.href = targetAssetSrc;
        link.download = `asset_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Failed to save asset:', error);
        alert('Failed to save asset. An unexpected error occurred.');
    } finally {
        onClose();
    }
  };

  const handleCopy = async () => {
    try {
      const response = await fetch(targetAssetSrc);
      const blob = await response.blob();
      const blobType = blob.type || 'image/png';

      await navigator.clipboard.write([
        new ClipboardItem({
          [blobType]: new Blob([blob], { type: blobType }),
        }),
      ]);
    } catch (error) {
      console.error('Failed to copy asset:', error);
      alert('Failed to copy asset to clipboard. Your browser might not support this action.');
    } finally {
      onClose();
    }
  };

  return (
    <div
      className="fixed z-50 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg p-1 animate-fade-in"
      style={{ top: `${y}px`, left: `${x}px` }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={handleSave}
        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded-sm"
      >
        Save Image...
      </button>
      <button
        onClick={handleCopy}
        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded-sm"
      >
        Copy Image
      </button>
    </div>
  );
};

export default StagedAssetContextMenu;
