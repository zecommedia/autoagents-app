const LOCAL_API = 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GenerationResult {
  result: string; // base64 image
  cost: number;
  processingTime?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = LOCAL_API) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async checkHealth() {
    return this.request<{ status: string; userId: string; hasToken: boolean }>('/health');
  }

  // Authentication
  async login(licenseKey: string) {
    return this.request<{ success: boolean; userId: string; features: string[] }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ licenseKey }),
      }
    );
  }

  // AI Generation endpoints (proxy to cloud)
  async redesignImage(
    image: string,
    prompt: string,
    mode: string
  ): Promise<GenerationResult> {
    return this.request<GenerationResult>('/api/redesign', {
      method: 'POST',
      body: JSON.stringify({ image, prompt, mode }),
    });
  }

  async generateVideo(
    images: string[],
    config: any
  ): Promise<GenerationResult> {
    return this.request<GenerationResult>('/api/video', {
      method: 'POST',
      body: JSON.stringify({ images, config }),
    });
  }

  async generateMockup(
    image: string,
    template: string,
    options: any
  ): Promise<GenerationResult> {
    return this.request<GenerationResult>('/api/mockup', {
      method: 'POST',
      body: JSON.stringify({ image, template, options }),
    });
  }

  async generateCanvas(
    image: string,
    mask: string,
    prompt: string,
    options: any
  ): Promise<GenerationResult> {
    return this.request<GenerationResult>('/api/canvas/generate', {
      method: 'POST',
      body: JSON.stringify({ image, mask, prompt, options }),
    });
  }

  // Local processing telemetry
  async trackLocalProcessing(data: {
    feature: string;
    processingTime: number;
    method?: string;
    imageSize?: number;
  }) {
    return this.request('/telemetry', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(err => {
      console.warn('Failed to send telemetry:', err);
      // Silent fail - telemetry is not critical
    });
  }
}

export const apiClient = new ApiClient();
