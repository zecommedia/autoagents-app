/**
 * OpenAI Service (Cloud API Wrapper)
 * Routes all OpenAI calls through cloudApiService
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

/**
 * OpenAI image generation/edit
 * Routes to cloudApiService.redesign() with OpenAI DALL-E
 * 
 * @param parts - Array of parts (image and text prompt) in Gemini format
 * @param numberOfImages - Number of images to generate (currently unused)
 */
export async function generateImageOpenAI(parts: any[], numberOfImages = 1): Promise<any> {
  // Extract image and prompt from parts
  const imagePart = parts.find(p => p.inlineData);
  const textPart = parts.find(p => p.text);
  
  const prompt = textPart?.text || '';
  let file: File | null = null;

  if (imagePart) {
    // Edit existing image - convert base64 to File
    const { data, mimeType } = imagePart.inlineData;
    const byteString = atob(data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([uint8Array], { type: mimeType });
    file = new File([blob], 'image.png', { type: mimeType });
  }

  if (!file) {
    return { error: 'No image found in parts' };
  }

  // Use OpenAI through cloud API
  const result = await cloudApiService.redesign(file, prompt, 'openai');
  
  if (!result.success) {
    return { error: result.error || 'Cloud API OpenAI failed' };
  }

  // Extract base64 string (handle nested objects)
  let base64Data = result.data;
  if (typeof base64Data === 'object' && base64Data !== null) {
    base64Data = base64Data.data || base64Data.base64 || base64Data.image || String(base64Data);
  }
  if (typeof base64Data !== 'string') {
    return { error: 'Invalid image data format from server' };
  }

  // Return in BOTH formats for compatibility with CloneMode and App.tsx
  return {
    newImageBase64s: [base64Data], // For CloneMode
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: base64Data, // Ensured to be string
                  mimeType: 'image/png'
                }
              }
            ]
          }
        }
      ]
    }
  };
}

/**
 * OpenAI chat streaming (disabled - not supported in desktop yet)
 */
export async function* streamChatOpenAI(messages: any[]): AsyncGenerator<string> {
  throw new Error('OpenAI streaming not supported in desktop app yet');
}

