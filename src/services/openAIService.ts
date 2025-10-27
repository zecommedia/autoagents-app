/**
 * OpenAI Service (Cloud API Wrapper)
 * Routes all OpenAI calls through cloudApiService
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

/**
 * OpenAI image generation/edit
 * Routes to cloudApiService.redesign() with OpenAI DALL-E
 */
export async function generateImageOpenAI(prompt: string, imageDataUrl?: string): Promise<string> {
  let file: File;

  if (imageDataUrl) {
    // Edit existing image
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    file = new File([blob], 'image.png', { type: blob.type });
  } else {
    // Generate from prompt - use blank canvas
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
    file = new File([blob], 'blank.png', { type: 'image/png' });
  }

  // Use OpenAI
  const result = await cloudApiService.redesign(file, prompt, 'openai');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API OpenAI failed');
  }

  // Return as data URL
  return `data:image/png;base64,${result.data}`;
}

/**
 * OpenAI chat streaming (disabled - not supported in desktop yet)
 */
export async function* streamChatOpenAI(messages: any[]): AsyncGenerator<string> {
  throw new Error('OpenAI streaming not supported in desktop app yet');
}

