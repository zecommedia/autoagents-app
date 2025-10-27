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

  // Multi-Image Redesign (for 2+ images)
  async multiImageRedesign(images: File[], prompt: string, model?: string, onProgress?: (progress: number) => void) {
    console.log(`🎯 multiImageRedesign called with ${images.length} images, model: ${model}`);
    
    const data: any = { prompt, model: model || 'gemini' };
    
    // Add images with proper naming for backend
    if (images.length === 1) {
      console.log('📎 Sending as single image (field: image)');
      data.image = images[0];
    } else if (images.length === 2) {
      console.log('📎 Sending as dual images (fields: image1, image2)');
      data.image1 = images[0];
      data.image2 = images[1];
    } else if (images.length >= 3) {
      // For 3+ images, still use image1, image2 for now (backend limitation)
      // TODO: Backend should support unlimited images via array
      console.log(`📎 Sending first 2 of ${images.length} images (fields: image1, image2)`);
      data.image1 = images[0];
      data.image2 = images[1];
      console.warn(`Only using first 2 images out of ${images.length}. Backend doesn't support 3+ images yet.`);
    }
    
    console.log('📤 Request data keys:', Object.keys(data));
    
    return this.request({
      endpoint: '/proxy/redesign',
      data,
      timeout: 180000,
      onProgress,
    });
  }

  // Text-to-Image Generation (Imagen 4)
  async textToImage(prompt: string, onProgress?: (progress: number) => void) {
    return this.request({
      endpoint: '/proxy/redesign',
      data: { prompt, model: 'imagen' }, // No image, just prompt - triggers Imagen 4
      timeout: 180000,
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

  // Video Generation (Veo 2.0) - Returns Blob URL
  async generateVideo(image: File, prompt: string, aspectRatio?: string, onProgress?: (progress: number) => void) {
    try {
      const apiClient = cloudAuthService.getApiClient();
      
      const formData = new FormData();
      formData.append('image', image, 'image.png');
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio || 'auto');

      const response = await apiClient.post('/proxy/video', formData, {
        timeout: 300000, // 5 minutes
        responseType: 'blob', // ✅ CRITICAL: Receive binary data
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

      // Create Blob URL from binary response
      const videoBlob = new Blob([response.data], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);

      return {
        success: true,
        data: videoUrl, // Return Blob URL for video player
      };

    } catch (error: any) {
      console.error('Video generation failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Video generation failed',
      };
    }
  }

  // Video Suggestions (Gemini 2.5 Flash with Image)
  async videoSuggestions(image: File, prompt: string) {
    return this.request({
      endpoint: '/proxy/video-suggestions',
      data: { image, prompt },
      timeout: 120000, // 2 minutes (Gemini structured output can be slow)
    });
  }

  // Redesign Suggestions (Gemini 2.5 Flash Image with structured output)
  async redesignSuggestions(image: File, prompt: string) {
    return this.request({
      endpoint: '/proxy/redesign-suggestions',
      data: { image, prompt },
      timeout: 120000, // 2 minutes (Gemini structured output can be slow)
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
