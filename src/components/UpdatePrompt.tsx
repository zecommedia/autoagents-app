import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * UpdatePrompt Component
 * 
 * Hiển thị notification khi có phiên bản mới của PWA
 * Users có thể chọn:
 * - ✅ Update Now: Cập nhật ngay lập tức
 * - ⏰ Remind Me Later: Đóng notification (sẽ hiện lại lần sau)
 * 
 * Auto-check mỗi giờ nếu user không update
 */

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log(`[PWA] Service Worker registered: ${swUrl}`);
      
      // Check for updates every hour
      if (r) {
        const interval = setInterval(async () => {
          console.log('[PWA] Checking for updates...');
          await r.update();
        }, 60 * 60 * 1000); // 1 hour

        // Cleanup on unmount
        return () => clearInterval(interval);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration failed:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  // Handle "Update Now" button
  const handleUpdateNow = () => {
    updateServiceWorker(true); // true = reload page after update
  };

  // Handle "Remind Me Later" button
  const handleRemindLater = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
    // Notification sẽ hiện lại khi user refresh page hoặc sau 1 giờ
  };

  // Don't show anything if no update needed
  if (!showPrompt || offlineReady) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] 
                 bg-gradient-to-br from-purple-600 to-blue-600 
                 text-white rounded-2xl shadow-2xl 
                 p-5 max-w-sm animate-slide-up"
      style={{
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Icon + Text */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">
            🎉 New Update Available!
          </h3>
          <p className="text-sm text-white/90">
            We've improved the app with bug fixes and new features.
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleUpdateNow}
          className="flex-1 bg-white text-purple-600 font-semibold 
                     px-4 py-2.5 rounded-lg hover:bg-gray-100 
                     transition-colors duration-200 
                     flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Update Now
        </button>

        <button
          onClick={handleRemindLater}
          className="flex-1 bg-white/10 backdrop-blur-sm 
                     text-white font-medium px-4 py-2.5 rounded-lg 
                     hover:bg-white/20 transition-colors duration-200 
                     flex items-center justify-center gap-2 border border-white/20"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Later
        </button>
      </div>

      {/* Small info text */}
      <p className="text-xs text-white/70 mt-3 text-center">
        Update takes only 5 seconds ⚡
      </p>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
