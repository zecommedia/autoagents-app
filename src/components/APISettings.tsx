import React, { useState, useEffect } from 'react';
import { apiClient, API_ENDPOINTS } from '../config/api';
import { SettingsIcon, CheckIcon, XIcon, RefreshIcon } from '../constants';

export const APISettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseURL());
  const [isCustom, setIsCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [features, setFeatures] = useState(apiClient.getFeatures());

  useEffect(() => {
    checkConnection();
  }, [apiUrl]);

  const checkConnection = async () => {
    setIsChecking(true);
    setConnectionStatus('checking');

    try {
      const response = await fetch(`${apiUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        setConnectionStatus('connected');
        setFeatures(apiClient.getFeatures());
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = () => {
    const newUrl = isCustom ? customUrl : apiUrl;
    apiClient.saveConfig({ 
      baseURL: newUrl,
      mode: newUrl.includes('localhost') ? 'local' : 'remote'
    });
    
    // Reload page to apply changes
    window.location.reload();
  };

  const handleAutoDetect = async () => {
    setIsChecking(true);
    const detectedUrl = await apiClient.autoDetect();
    setApiUrl(detectedUrl);
    apiClient.saveConfig({ baseURL: detectedUrl });
    setIsChecking(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-zinc-700">
        {/* Header */}
        <div className="p-6 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">API Server Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Connection Status */}
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">Connection Status</h3>
              <button
                onClick={checkConnection}
                disabled={isChecking}
                className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshIcon className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                Test Connection
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <>
                  <CheckIcon className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Connected</span>
                  <span className="text-zinc-500 text-sm">({apiClient.getMode()})</span>
                </>
              )}
              {connectionStatus === 'disconnected' && (
                <>
                  <XIcon className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-medium">Disconnected</span>
                </>
              )}
              {connectionStatus === 'checking' && (
                <>
                  <RefreshIcon className="w-5 h-5 text-yellow-400 animate-spin" />
                  <span className="text-yellow-400 font-medium">Checking...</span>
                </>
              )}
            </div>

            {/* Current URL */}
            <div className="mt-3 text-sm text-zinc-400">
              <span className="font-mono bg-zinc-800 px-2 py-1 rounded">{apiUrl}</span>
            </div>
          </div>

          {/* API Endpoint Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Select API Endpoint
            </label>
            
            <div className="space-y-2">
              {/* Local */}
              <label className={`flex items-center p-4 bg-zinc-900 rounded-lg border-2 cursor-pointer transition-all ${
                apiUrl === API_ENDPOINTS.LOCAL && !isCustom
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="radio"
                  name="api-endpoint"
                  checked={apiUrl === API_ENDPOINTS.LOCAL && !isCustom}
                  onChange={() => {
                    setApiUrl(API_ENDPOINTS.LOCAL);
                    setIsCustom(false);
                  }}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">Local Server</div>
                  <div className="text-sm text-zinc-400 font-mono">{API_ENDPOINTS.LOCAL}</div>
                  <div className="text-xs text-zinc-500 mt-1">✓ Photoshop support available</div>
                </div>
              </label>

              {/* Remote */}
              <label className={`flex items-center p-4 bg-zinc-900 rounded-lg border-2 cursor-pointer transition-all ${
                apiUrl === API_ENDPOINTS.REMOTE && !isCustom
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="radio"
                  name="api-endpoint"
                  checked={apiUrl === API_ENDPOINTS.REMOTE && !isCustom}
                  onChange={() => {
                    setApiUrl(API_ENDPOINTS.REMOTE);
                    setIsCustom(false);
                  }}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">Remote Server (Cloud)</div>
                  <div className="text-sm text-zinc-400 font-mono">{API_ENDPOINTS.REMOTE}</div>
                  <div className="text-xs text-zinc-500 mt-1">⚠️ Photoshop mode not available</div>
                </div>
              </label>

              {/* Custom */}
              <label className={`flex items-center p-4 bg-zinc-900 rounded-lg border-2 cursor-pointer transition-all ${
                isCustom
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="radio"
                  name="api-endpoint"
                  checked={isCustom}
                  onChange={() => setIsCustom(true)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-white mb-2">Custom URL</div>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => {
                      setCustomUrl(e.target.value);
                      setApiUrl(e.target.value);
                    }}
                    placeholder="https://your-api-server.com"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                    disabled={!isCustom}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Auto Detect Button */}
          <button
            onClick={handleAutoDetect}
            disabled={isChecking}
            className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshIcon className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            Auto-Detect Best Server
          </button>

          {/* Features Status */}
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Available Features</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(features).map(([feature, available]) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  {available ? (
                    <CheckIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <XIcon className="w-4 h-4 text-red-400" />
                  )}
                  <span className={available ? 'text-zinc-300' : 'text-zinc-500'}>
                    {feature.charAt(0).toUpperCase() + feature.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-700 flex gap-3">
          <button
            onClick={handleSave}
            disabled={isChecking || connectionStatus === 'disconnected'}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
          >
            Save & Apply
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
