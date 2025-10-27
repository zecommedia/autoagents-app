// Cloud API Service - For cloud-based features
import { cloudAuthService } from './cloudAuthService';
import { CLOUD_API_CONFIG, getApiUrl } from '../config/cloudApiConfig';

interface CloudRequestOptions {
  endpoint: string;
  data: any;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

interface CloudResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    used: number;
    remaining: number;
  };
}

class CloudApiService {
  // Make API request to cloud
  async request<T = any>(options: CloudRequestOptions): Promise<CloudResponse<T>> {
    const { endpoint, data, timeout = CLOUD_API_CONFIG.REQUEST_TIMEOUT, onProgress } = options;

    // Check authentication
    if (!cloudAuthService.isAuthenticated()) {
      throw new Error('Not authenticated. Please enter your license key.');
    }

    // Check token expiry
    if (cloudAuthService.isTokenExpired()) {
      // Try to re-authenticate
      const reAuthSuccess = await cloudAuthService.reAuthenticate();
      if (!reAuthSuccess) {
        throw new Error('Your license has expired. Please renew your license.');
      }
    }

    try {
      const apiClient = cloudAuthService.getApiClient();

      // Determine if request contains file uploads (use multipart) or plain JSON
      const hasFileUpload = data && (
        data.image instanceof File || data.image instanceof Blob ||
        data.image1 instanceof File || data.image1 instanceof Blob ||
        data.image2 instanceof File || data.image2 instanceof Blob
      );

      if (hasFileUpload) {
        // Use multipart/form-data for file uploads
        const formData = new FormData();

        // Add files (if provided)
        if (data.image) formData.append('image', data.image);
        if (data.image1) formData.append('image1', data.image1);
        if (data.image2) formData.append('image2', data.image2);

        // Add other fields
        Object.keys(data || {}).forEach(key => {
          if (!key.startsWith('image')) {
            const value = data[key];
            if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else if (value !== undefined && value !== null) {
              formData.append(key, String(value));
            }
          }
        });

        const response = await apiClient.post(endpoint, formData, {
          timeout,
          // Ensure axios can set the multipart boundary by removing any forced JSON Content-Type
          headers: {
            'Content-Type': undefined as any,
          },
          onUploadProgress: (progressEvent: any) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(progress);
            }
          },
        });

        return {
          success: true,
          data: response.data,
          usage: response.data.usage,
        };
      }

      // For non-file requests (chat, status, etc.) send JSON body so express.json() can parse it
      const jsonBody: any = {};
      Object.keys(data || {}).forEach(key => {
        jsonBody[key] = data[key];
      });

      const response = await apiClient.post(endpoint, jsonBody, {
        timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data,
        usage: response.data.usage,
      };

    } catch (error: any) {
      console.error('Cloud API request failed:', error);

      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error,
        };
      }

      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
        };
      }

      if (!navigator.onLine) {
        return {
          success: false,
          error: 'No internet connection. Please check your network.',
        };
      }

      return {
        success: false,
        error: 'Failed to process request. Please try again.',
      };
    }
  }

  // AI Redesign (Nano Banana or GPT Image 1)
  async redesign(image: File, prompt: string, model?: string, onProgress?: (progress: number) => void) {
    return this.request({
      endpoint: '/proxy/redesign',
      data: { image, prompt, model: model || 'gemini' },
      timeout: 180000, // 3 minutes
      onProgress,
    });
  }

  // Text Chat (Gemini 2.5 Pro or GPT-5)
  async chat(messages: any[], model?: string) {
    return this.request({
      endpoint: '/proxy/chat',
      data: { messages, model: model || 'gemini' },
      timeout: 60000, // 1 minute for chat
    });
  }

  // AI Clone (Redesign with 2 images)
  async clone(image1: File, image2: File, prompt: string, model?: string, onProgress?: (progress: number) => void) {
    return this.request({
      endpoint: '/proxy/redesign',
      data: { image1, image2, prompt, model: model || 'gemini' },
      timeout: 180000,
      onProgress,
    });
  }

  // Upscale
  async upscale(image: File, scale: number = 2, onProgress?: (progress: number) => void) {
    return this.request({
      endpoint: '/proxy/upscale',
      data: { image, scale },
      timeout: 180000,
      onProgress,
    });
  }

  // Video Generation (Veo 3)
  async generateVideo(image: File, prompt: string, onProgress?: (progress: number) => void) {
    return this.request({
      endpoint: '/proxy/video',
      data: { image, prompt },
      timeout: 300000, // 5 minutes
      onProgress,
    });
  }

  // Check connection
  async checkConnection(): Promise<boolean> {
    try {
      const apiClient = cloudAuthService.getApiClient();
      const response = await apiClient.get('/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Get API status
  async getStatus() {
    try {
      const apiClient = cloudAuthService.getApiClient();
      const response = await apiClient.get('/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get API status:', error);
      return null;
    }
  }
}

// Export singleton instance
export const cloudApiService = new CloudApiService();
export default CloudApiService;
