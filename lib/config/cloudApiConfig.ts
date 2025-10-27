// Cloud API Configuration
export const CLOUD_API_CONFIG = {
  // Cloud API URL - Can be set via VITE_CLOUD_API_URL in .env
  // Development: http://localhost:4000
  // Production: https://api-ditech.auto-agents.org
  API_URL: import.meta.env.VITE_CLOUD_API_URL || 'http://localhost:4000',
  
  // Fallback to local development
  LOCAL_API_URL: 'http://localhost:4000',
  
  // App Information
  APP_NAME: 'AutoAgents Agent',
  VERSION: '1.0.0',
  
  // Authentication
  TOKEN_REFRESH_DAYS: 30,
  TOKEN_STORAGE_KEY: 'autoagents_token',
  LICENSE_STORAGE_KEY: 'autoagents_license',
  
  // Feature Configuration
  FEATURES: {
    // Local Processing (Free, Offline)
    removeBackground: {
      type: 'local',
      library: '@imgly/background-removal',
      cost: 0,
      requiresInternet: false
    },
    edgeDetection: {
      type: 'local',
      library: 'canvas',
      cost: 0,
      requiresInternet: false
    },
    cropResize: {
      type: 'local',
      library: 'sharp',
      cost: 0,
      requiresInternet: false
    },
    
    // Cloud Processing (Paid, Online)
    aiRedesign: {
      type: 'cloud',
      endpoint: '/proxy/redesign',
      cost: 1,
      requiresInternet: true
    },
    aiClone: {
      type: 'cloud',
      endpoint: '/proxy/redesign',
      cost: 1,
      requiresInternet: true
    },
    upscale: {
      type: 'cloud',
      endpoint: '/proxy/upscale',
      cost: 2,
      requiresInternet: true
    },
    videoGen: {
      type: 'cloud',
      endpoint: '/proxy/video',
      cost: 5,
      requiresInternet: true
    }
  },
  
  // Telemetry
  TELEMETRY_ENABLED: true,
  TELEMETRY_INTERVAL: 60000, // 1 minute
  TELEMETRY_ENDPOINT: '/telemetry',
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 120000, // 2 minutes for image uploads
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // Cache
  CACHE_ENABLED: true,
  CACHE_MAX_AGE: 3600000, // 1 hour
};

// Environment detection
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

export const isProduction = () => {
  return process.env.NODE_ENV === 'production';
};

// Get appropriate API URL
export const getApiUrl = () => {
  // Always use production cloud API
  return CLOUD_API_CONFIG.API_URL;
  
  // Old logic (commented out):
  // if (isDevelopment()) {
  //   return CLOUD_API_CONFIG.LOCAL_API_URL;
  // }
  // return CLOUD_API_CONFIG.API_URL;
};

// Feature helper
export const isCloudFeature = (featureName: string): boolean => {
  const feature = CLOUD_API_CONFIG.FEATURES[featureName];
  return feature?.type === 'cloud';
};

export const getFeatureCost = (featureName: string): number => {
  const feature = CLOUD_API_CONFIG.FEATURES[featureName];
  return feature?.cost || 0;
};

export const requiresInternet = (featureName: string): boolean => {
  const feature = CLOUD_API_CONFIG.FEATURES[featureName];
  return feature?.requiresInternet || false;
};
