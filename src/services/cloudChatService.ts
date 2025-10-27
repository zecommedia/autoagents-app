/**
 * Cloud Chat Service
 * Routes all chat requests through cloud API server
 * SECURITY: No API keys stored locally - all AI requests via cloud
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: any[];
}

export interface ChatOptions {
  model?: 'gemini' | 'openai';
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Send chat message to cloud server
 * @param messages - Array of chat messages
 * @param options - Chat configuration options
 * @returns Assistant's response text
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  try {
    const result = await cloudApiService.request({
      endpoint: '/proxy/chat',
      data: {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content || msg.parts?.map(p => p.text || '').join(' ') || ''
        })),
        model: options.model || 'gemini',
        stream: false,
        systemInstruction: options.systemInstruction,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Chat request failed');
    }

    // result.data is the full server response: {success, data, cost, processingTime}
    // Extract the actual text from result.data.data
    if (result.data && typeof result.data === 'object') {
      if (result.data.data) {
        return result.data.data; // Server's nested data field
      }
      // Fallback for other formats
      return result.data.text || result.data.message || '';
    }

    return result.data || '';
  } catch (error: any) {
    console.error('Chat service error:', error);
    throw new Error(error.message || 'Failed to send chat message');
  }
}

/**
 * Send chat with image
 * @param messages - Array of chat messages (may include images)
 * @param image - Image file if applicable
 * @param options - Chat configuration options
 */
export async function sendChatWithImage(
  messages: ChatMessage[],
  image: File | null,
  options: ChatOptions = {}
): Promise<string> {
  try {
    const data: any = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content || ''
      })),
      model: options.model || 'gemini',
      systemInstruction: options.systemInstruction
    };

    if (image) {
      data.image = image;
    }

    const result = await cloudApiService.request({
      endpoint: '/proxy/chat',
      data
    });

    if (!result.success) {
      throw new Error(result.error || 'Chat request failed');
    }

    return result.data || '';
  } catch (error: any) {
    console.error('Chat with image service error:', error);
    throw new Error(error.message || 'Failed to send chat message');
  }
}

/**
 * Legacy compatibility: Create a mock chat instance
 * This maintains API compatibility with old code while routing through cloud
 */
export function createCloudChat(config: any) {
  return {
    async generate(parts: any[]) {
      // Ensure parts is an array
      const partsArray = Array.isArray(parts) ? parts : [parts];
      const textContent = partsArray.map(p => p?.text || '').filter(t => t).join(' ');
      const messages: ChatMessage[] = [];

      if (config.history) {
        // Prepend history
        const historyMessages = config.history.map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : (h.role || 'user'),
          content: Array.isArray(h.parts) 
            ? h.parts.map((p: any) => p?.text || '').filter((t: string) => t).join(' ')
            : (h.content || '')
        }));
        messages.push(...historyMessages);
      }

      // Add current user message
      if (textContent) {
        messages.push({ role: 'user', content: textContent });
      }

      const response = await sendChatMessage(messages, {
        model: config.model || 'gemini',
        systemInstruction: config.systemInstruction
      });

      return {
        text: () => response
      };
    },
    
    // Add sendMessageStream for streaming responses
    async sendMessageStream(partsOrParams: any[] | { message: any[] }) {
      // Handle both formats: direct array or {message: array}
      let partsArray: any[];
      if (Array.isArray(partsOrParams)) {
        partsArray = partsOrParams;
      } else if (partsOrParams && Array.isArray(partsOrParams.message)) {
        partsArray = partsOrParams.message;
      } else {
        partsArray = [partsOrParams];
      }

      const textContent = partsArray.map(p => p?.text || '').filter(t => t).join(' ');
      const messages: ChatMessage[] = [];

      if (config.history) {
        const historyMessages = config.history.map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : (h.role || 'user'),
          content: Array.isArray(h.parts)
            ? h.parts.map((p: any) => p?.text || '').filter((t: string) => t).join(' ')
            : (h.content || '')
        }));
        messages.push(...historyMessages);
      }

      // Add current user message
      if (textContent) {
        messages.push({ role: 'user', content: textContent });
      }

      const response = await sendChatMessage(messages, {
        model: config.model || 'gemini',
        systemInstruction: config.systemInstruction
      });

      return {
        text: () => response,
        functionCalls: () => [] // No function calls for now
      };
    }
  };
}
