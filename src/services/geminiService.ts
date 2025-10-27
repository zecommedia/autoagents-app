/**
 * Gemini Service (Cloud API Wrapper)
 * Routes all Gemini AI calls through cloudApiService
 * Maintains backwards compatibility with existing App.tsx code
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

export interface VideoSuggestion {
  title: string;
  description: string;
  duration: string;
}

export interface RedesignConcept {
  title: string;
  description: string;
  style: string;
}

// Helper: Convert parts array to File + prompt
function partsToFileAndPrompt(parts: any[]): { file: File | null; prompt: string } {
  const imagePart = parts.find(p => p.inlineData);
  const textPart = parts.find(p => p.text);
  
  if (!imagePart) {
    return { file: null, prompt: textPart?.text || '' };
  }

  // Convert base64 to File
  const { data, mimeType } = imagePart.inlineData;
  const byteString = atob(data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([uint8Array], { type: mimeType });
  const file = new File([blob], 'image.png', { type: mimeType });

  return { file, prompt: textPart?.text || '' };
}

/**
 * Main image generation from parts (edit, inpaint, outpaint, etc.)
 * Routes to cloudApiService.redesign() with Gemini 2.5 Flash Image
 */
export async function generateImageFromParts(parts: any[], numberOfImages = 1): Promise<any> {
  const { file, prompt } = partsToFileAndPrompt(parts);
  
  if (!file) {
    throw new Error('No image found in parts');
  }

  // Use Gemini 2.5 Flash Image for image editing
  const result = await cloudApiService.redesign(file, prompt, 'gemini');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API redesign failed');
  }

  // Return in expected format for App.tsx
  return {
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: result.data, // Already base64
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
 * Generate images from text prompt only
 * Routes to cloudApiService.redesign() with blank canvas
 */
export async function generateImagesFromPrompt(prompt: string, numberOfImages = 1): Promise<any> {
  // Create a blank 1x1 transparent PNG as base
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

  // Use Gemini 2.5 Flash Image
  const result = await cloudApiService.redesign(file, prompt, 'gemini');
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API redesign failed');
  }

  return {
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: result.data,
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

export function dataUrlToPart(dataUrl: string): any {
  return {
    inlineData: {
      data: dataUrl.split(',')[1],
      mimeType: dataUrl.split(':')[1].split(';')[0]
    }
  };
}

/**
 * Video generation
 * Routes to cloudApiService.generateVideo()
 */
export async function generateVideoFromImageAndPrompt(imageDataUrl: string, prompt: string): Promise<any> {
  const file = await (async () => {
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    return new File([blob], 'image.png', { type: blob.type });
  })();

  const result = await cloudApiService.generateVideo(file, prompt);
  
  if (!result.success) {
    throw new Error(result.error || 'Cloud API video generation failed');
  }

  return result.data; // Return video URL
}

/**
 * Video suggestions (mock for now - can add cloud endpoint later)
 */
export async function generateVideoSuggestions(imageDataUrl: string): Promise<VideoSuggestion[]> {
  return [
    { title: 'Camera Pan Left', description: 'Smooth camera movement to the left', duration: '3s' },
    { title: 'Zoom In', description: 'Gradually zoom into the subject', duration: '3s' },
    { title: 'Fade Transition', description: 'Gentle fade effect', duration: '2s' }
  ];
}

/**
 * Redesign concepts (mock for now - can add cloud endpoint later)
 */
export async function generateRedesignConcepts(imageDataUrl: string): Promise<RedesignConcept[]> {
  return [
    { title: 'Modern Minimalist', description: 'Clean lines and simple colors', style: 'minimalist' },
    { title: 'Vintage Aesthetic', description: 'Retro colors and textures', style: 'vintage' },
    { title: 'Futuristic Tech', description: 'Neon lights and sci-fi elements', style: 'futuristic' }
  ];
}

/**
 * Detailed redesign prompts (mock for now)
 */
export async function generateDetailedRedesignPrompts(concept: string): Promise<string[]> {
  return [
    `Redesign with ${concept} theme, high detail`,
    `Transform using ${concept} style, professional quality`,
    `Apply ${concept} aesthetic, 4K resolution`
  ];
}
