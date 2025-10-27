/**
 * OpenAI Chat Service (Cloud API Wrapper)
 * Routes OpenAI chat calls through cloudApiService with GPT models
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

/**
 * Generate image from text prompt via OpenAI DALL-E
 * Returns array of base64 data URLs
 */
export async function openAIGenerateFromPrompt(prompt: string, numberOfImages: number = 1): Promise<string[]> {
  // Call cloud API without an input image so backend uses OpenAI generations
  const result = await cloudApiService.request({
    endpoint: '/proxy/redesign',
    data: { prompt, model: 'openai' },
    timeout: 180000,
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API failed');
  }

  // Ensure base64 is a string (handle nested object cases)
  let base64 = (result as any).data;
  if (typeof base64 === 'object' && base64 !== null) {
    base64 = base64.data || base64.base64 || base64.image || String(base64);
  }
  if (typeof base64 !== 'string') {
    console.error('Invalid base64 data from OpenAI generation:', base64);
    throw new Error('Invalid image data returned from OpenAI');
  }
  
  const dataUrl = `data:image/png;base64,${base64}`;
  return [dataUrl];
}

/**
 * Edit image with prompt via OpenAI DALL-E
 * @param imageUrl - Can be single URL or array of URLs (first one used)
 */
export async function openAIEditFromImageAndPrompt(imageUrl: string | string[], prompt: string, numberOfImages = 1): Promise<string[]> {
  const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], 'image.png', { type: blob.type });

  // Use OpenAI
  const result = await cloudApiService.redesign(file, prompt, 'openai');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API failed');
  }

  // Ensure base64 is a string (handle nested object cases)
  let base64 = result.data;
  if (typeof base64 === 'object' && base64 !== null) {
    base64 = (base64 as any).data || (base64 as any).base64 || (base64 as any).image || String(base64);
  }
  if (typeof base64 !== 'string') {
    console.error('Invalid base64 data from OpenAI edit:', base64);
    throw new Error('Invalid image data returned from OpenAI');
  }

  const dataUrl = `data:image/png;base64,${base64}`;
  return [dataUrl]; // Return array for compatibility
}

/**
 * Text chat via OpenAI GPT-5
 */
export async function openAITextChat(messages: any[]): Promise<string> {
  const result = await cloudApiService.chat(messages, 'gpt-5');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API chat failed');
  }

  return result.data;
}

