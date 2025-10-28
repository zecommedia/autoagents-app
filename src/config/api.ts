// API Configuration - Support both local and remote API
export interface APIConfig {
  baseURL: string;
  mode: 'local' | 'remote' | 'auto';
  timeout: number;
}

// Default configuration
const DEFAULT_CONFIG: APIConfig = {
  baseURL: 'http://localhost:4000',
  mode: 'auto',
  timeout: 60000 // 60 seconds for large file uploads
};

// Predefined API endpoints
export const API_ENDPOINTS = {
  LOCAL: 'http://localhost:4000',
  REMOTE: 'https://api-ditech.auto-agents.org'
};

class APIClient {
  private config: APIConfig;
  private isConnected: boolean = false;
  private isLocal: boolean = true;

  constructor() {
    this.config = this.loadConfig();
    this.detectConnection();
  }

  /**
   * Load configuration from localStorage or environment
   */
  private loadConfig(): APIConfig {
    // Priority:
    // 1. User setting from localStorage
    // 2. Environment variable
    // 3. Default

    const savedConfig = localStorage.getItem('apiConfig');
    if (savedConfig) {
      try {
        return JSON.parse(savedConfig);
      } catch (e) {
        console.error('Failed to parse API config:', e);
      }
    }

    // Check environment variables (from Vite)
    const envURL = import.meta.env.VITE_API_URL;
    if (envURL) {
      return {
        ...DEFAULT_CONFIG,
        baseURL: envURL,
        mode: 'remote'
      };
    }

    return DEFAULT_CONFIG;
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig(config: Partial<APIConfig>) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('apiConfig', JSON.stringify(this.config));
    this.detectConnection();
  }

  /**
   * Detect if API is local or remote
   */
  private async detectConnection() {
    this.isLocal = this.config.baseURL.includes('localhost') || 
                   this.config.baseURL.includes('127.0.0.1');

    // Try to ping API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseURL}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      this.isConnected = response.ok;

      console.log(`📡 API Connection: ${this.isConnected ? 'Connected' : 'Disconnected'} (${this.isLocal ? 'Local' : 'Remote'})`);
    } catch (error) {
      this.isConnected = false;
      console.warn('⚠️ API not reachable:', error);
    }
  }

  /**
   * Auto-detect best API endpoint
   */
  async autoDetect(): Promise<string> {
    // Try local first
    try {
      const response = await fetch(`${API_ENDPOINTS.LOCAL}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        console.log('✓ Using local API');
        return API_ENDPOINTS.LOCAL;
      }
    } catch (e) {
      // Local not available
    }

    // Try remote
    try {
      const response = await fetch(`${API_ENDPOINTS.REMOTE}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        console.log('✓ Using remote API');
        return API_ENDPOINTS.REMOTE;
      }
    } catch (e) {
      // Remote not available
    }

    console.warn('⚠️ No API available, falling back to local');
    return API_ENDPOINTS.LOCAL;
  }

  /**
   * Get current API base URL
   */
  getBaseURL(): string {
    return this.config.baseURL;
  }

  /**
   * Get API mode
   */
  getMode(): 'local' | 'remote' {
    return this.isLocal ? 'local' : 'remote';
  }

  /**
   * Check if API is connected
   */
  isAPIConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get feature availability based on connection
   */
  getFeatures() {
    return {
      mockup: this.isConnected,
      mockupPhotoshop: this.isLocal && this.isConnected, // Photoshop only on local
      redesign: this.isConnected,
      clone: this.isConnected,
      chat: this.isConnected,
      video: this.isConnected
    };
  }

  /**
   * Build full API URL
   */
  buildURL(endpoint: string): string {
    const base = this.config.baseURL.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  /**
   * Make API request with error handling
   */
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = this.buildURL(endpoint);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export helper for backward compatibility
export const API_BASE = apiClient.getBaseURL();
