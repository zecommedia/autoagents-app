// Cloud API Authentication Service
import axios, { AxiosInstance } from 'axios';
import { CLOUD_API_CONFIG, getApiUrl } from '../config/cloudApiConfig';

interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    email: string;
    tier: string;
    usage: number;
    limit: number;
    expiresAt: string;
  };
}

interface VerifyRequest {
  licenseKey: string;
  machineId: string;
}

class CloudAuthService {
  private apiClient: AxiosInstance;
  private token: string | null = null;
  private machineId: string | null = null;

  constructor() {
    this.apiClient = axios.create({
      baseURL: getApiUrl(),
      timeout: CLOUD_API_CONFIG.REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load saved token and machine ID
    this.loadFromStorage();

    // Add request interceptor to include token
    this.apiClient.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status;
        const errorMessage = error.response?.data?.error;
        
        if (status === 401 || status === 403) {
          // Check if it's an invalid token signature (server restart)
          if (errorMessage === 'Invalid token' || errorMessage?.includes('signature')) {
            console.warn('Token signature invalid (server may have restarted). Clearing auth...');
            this.clearAuth();
            
            // Try to automatically re-authenticate if we have a stored license
            const storedLicense = this.getSavedLicenseKey();
            if (storedLicense) {
              console.log('Attempting automatic re-authentication...');
              try {
                await this.verifyLicense(storedLicense);
                console.log('✅ Automatic re-authentication successful');
                // Retry the original request
                return this.apiClient.request(error.config);
              } catch (reAuthError) {
                console.error('Automatic re-authentication failed:', reAuthError);
              }
            }
          } else {
            // Token expired or other auth issue
            this.clearAuth();
          }
          throw new Error('Authentication expired. Please re-enter your license key.');
        }
        throw error;
      }
    );
  }

  // Generate unique machine ID
  private async generateMachineId(): Promise<string> {
    if (this.machineId) return this.machineId;

    try {
      // Try to get from storage first
      const stored = localStorage.getItem('autoagents_machine_id');
      if (stored) {
        this.machineId = stored;
        return stored;
      }

      // Check if running in Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use Electron's machine ID
        try {
          const machineId = await (window as any).electronAPI.getMachineId();
          localStorage.setItem('autoagents_machine_id', machineId);
          this.machineId = machineId;
          return machineId;
        } catch (error) {
          console.error('Failed to get Electron machine ID:', error);
        }
      }
      
      // Fallback to browser fingerprint
      const randomId = `machine-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('autoagents_machine_id', randomId);
      this.machineId = randomId;
      return randomId;
    } catch (error) {
      // Fallback to random ID
      const randomId = `machine-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('autoagents_machine_id', randomId);
      this.machineId = randomId;
      return randomId;
    }
  }

  // Verify license key and get JWT token
  async verifyLicense(licenseKey: string): Promise<AuthResponse> {
    try {
      const machineId = await this.generateMachineId();
      
      console.log('🌐 Cloud API Base URL:', this.apiClient.defaults.baseURL);
      console.log('🔑 License Key:', licenseKey);
      console.log('💻 Machine ID:', machineId);
      console.log('📡 Sending POST to /auth/verify...');
      
      const response = await this.apiClient.post<AuthResponse>('/auth/verify', {
        licenseKey,
        machineId,
      } as VerifyRequest);

      console.log('📥 Response received:', response.status, response.statusText);
      console.log('📦 Response data:', response.data);

      if (response.data.success && response.data.token) {
        // Save token and license key
        this.token = response.data.token;
        localStorage.setItem(CLOUD_API_CONFIG.TOKEN_STORAGE_KEY, response.data.token);
        localStorage.setItem(CLOUD_API_CONFIG.LICENSE_STORAGE_KEY, licenseKey);
        localStorage.setItem('autoagents_user', JSON.stringify(response.data.user));

        return response.data;
      }

      throw new Error('Invalid response from server');
    } catch (error: any) {
      console.error('❌ License verification failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      
      throw new Error('Failed to verify license. Please check your internet connection.');
    }
  }

  // Load saved authentication
  private loadFromStorage(): void {
    try {
      this.token = localStorage.getItem(CLOUD_API_CONFIG.TOKEN_STORAGE_KEY);
      this.machineId = localStorage.getItem('autoagents_machine_id');
    } catch (error) {
      console.error('Failed to load auth from storage:', error);
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Get saved license key
  getSavedLicenseKey(): string | null {
    try {
      return localStorage.getItem(CLOUD_API_CONFIG.LICENSE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  // Get user info
  getUserInfo(): any {
    try {
      const userStr = localStorage.getItem('autoagents_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  // Clear authentication
  clearAuth(): void {
    this.token = null;
    try {
      localStorage.removeItem(CLOUD_API_CONFIG.TOKEN_STORAGE_KEY);
      localStorage.removeItem(CLOUD_API_CONFIG.LICENSE_STORAGE_KEY);
      localStorage.removeItem('autoagents_user');
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  // Get API client with auth
  getApiClient(): AxiosInstance {
    return this.apiClient;
  }

  // Check token expiry
  isTokenExpired(): boolean {
    const user = this.getUserInfo();
    if (!user || !user.expiresAt) return true;

    try {
      const expiryDate = new Date(user.expiresAt);
      return expiryDate < new Date();
    } catch {
      return true;
    }
  }

  // Re-authenticate with saved license
  async reAuthenticate(): Promise<boolean> {
    const savedLicense = this.getSavedLicenseKey();
    if (!savedLicense) return false;

    try {
      await this.verifyLicense(savedLicense);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const cloudAuthService = new CloudAuthService();
export default CloudAuthService;
