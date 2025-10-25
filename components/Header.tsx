import React from 'react';
import { CanvasIcon, PhotoIcon, VideoIcon, ChatIcon, TrashIcon, ImageIcon } from '../constants';
import { TableIcon } from '../constants';
import { CloneIcon } from '../constants';
import { type AppMode } from '../App';

interface HeaderProps {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onNewChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ appMode, onModeChange, onNewChat }) => {
  const modeNameToDisplay = appMode === 'edit' ? 'Redesign' : appMode;

  return (
    <header className="flex-shrink-0 bg-zinc-900 px-4 sm:px-6 py-2 flex items-center justify-between z-20">
      <div className="w-32 sm:w-48">
        <h1 className="text-lg font-semibold text-white capitalize">{modeNameToDisplay}</h1>
      </div>

      <div className="flex-grow flex justify-center">
        <div className="bg-zinc-800 border border-zinc-700 rounded-full p-1 flex items-center space-x-1 shadow-lg">
          <button
            onClick={() => onModeChange('chat')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'chat' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Chat Mode"
          >
            <ChatIcon className="w-4 h-4" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => onModeChange('edit')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'edit' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Redesign Mode"
          >
            <PhotoIcon className="w-4 h-4" />
            <span>Redesign</span>
          </button>
          <button
            onClick={() => onModeChange('video')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'video' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Video Mode"
          >
            <VideoIcon className="w-4 h-4" />
            <span>Video</span>
          </button>
          <button
            onClick={() => onModeChange('canvas')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'canvas' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Canvas Mode"
          >
            <CanvasIcon className="w-4 h-4" />
            <span>Canvas</span>
          </button>
          <button
            onClick={() => onModeChange('sheet')}
            disabled
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'sheet' ? 'bg-white text-zinc-900' : 'text-zinc-300 opacity-50 cursor-not-allowed'}`}
            aria-label="Sheet Mode"
          >
            <TableIcon className="w-4 h-4" />
            <span>Sheet</span>
            <span className="absolute -top-2 -right-1 bg-yellow-500 text-zinc-900 text-xs font-bold px-1.5 py-0.5 rounded">Soon</span>
          </button>
          <button
            onClick={() => onModeChange('clone')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'clone' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Clone Mode"
          >
            <CloneIcon className="w-4 h-4" />
            <span>Clone</span>
            <span className="absolute -top-2 -right-1 bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">New</span>
          </button>
          <button
            onClick={() => onModeChange('mockup')}
            className={`relative group px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${appMode === 'mockup' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700'}`}
            aria-label="Mockup Mode"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Mockup</span>
            <span className="absolute -top-2 -right-1 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">New</span>
          </button>
        </div>
      </div>

      <div className="w-32 sm:w-48 flex justify-end">
        {appMode === 'chat' && (
          <button
            onClick={onNewChat}
            className="text-sm text-zinc-300 hover:text-white flex items-center space-x-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
            aria-label="New Chat"
          >
            <TrashIcon className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
