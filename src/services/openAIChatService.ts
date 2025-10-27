/**
 * OpenAI Chat Service (Cloud API Wrapper)
 * Routes OpenAI chat calls through cloudApiService with GPT models
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

/**
 * Generate image from text prompt via OpenAI DALL-E
 */
export async function openAIGenerateFromPrompt(prompt: string): Promise<string> {
  // Create blank canvas as base
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1024, 1024);
  }

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png');
  });
  const file = new File([blob], 'blank.png', { type: 'image/png' });

  // Use OpenAI
  const result = await cloudApiService.redesign(file, prompt, 'openai');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API failed');
  }

  return `data:image/png;base64,${result.data}`;
}

/**
 * Edit image with prompt via OpenAI DALL-E
 */
export async function openAIEditFromImageAndPrompt(imageUrl: string, prompt: string, numberOfImages = 1): Promise<string[]> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const file = new File([blob], 'image.png', { type: blob.type });

  // Use OpenAI
  const result = await cloudApiService.redesign(file, prompt, 'openai');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API failed');
  }

  const dataUrl = `data:image/png;base64,${result.data}`;
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

