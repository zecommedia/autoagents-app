/**
 * Gemini Service (Cloud API Wrapper)
 * Routes all Gemini AI calls through cloudApiService
 * Maintains backwards compatibility with existing App.tsx code
 */

import { cloudApiService } from '../../lib/services/cloudApiService';

export interface VideoSuggestion {
  vi: string; // Vietnamese short title
  en: string; // English detailed prompt
}

export interface RedesignConcept {
  vi: string; // Vietnamese short title
  en: string; // English detailed prompt
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
  // TEXT-TO-IMAGE: Use Imagen 4 (no input image)
  // Call cloud API directly with prompt only (no image file)
  const result = await cloudApiService.textToImage(prompt);
  
  console.log('🖼️ Cloud API result:', result);
  console.log('🖼️ result.data type:', typeof result.data);
  console.log('🖼️ result.data:', result.data);
  
  if (!result.success) {
    return { error: result.error || 'Image generation failed' };
  }

  // Extract base64 string from result
  // Cloud API may return nested object or direct string
  let base64Data: string;
  
  if (typeof result.data === 'string') {
    base64Data = result.data;
  } else if (result.data && typeof result.data === 'object') {
    // Handle nested response
    base64Data = result.data.data || result.data.image || result.data.base64 || '';
  } else {
    console.error('Unexpected result.data format:', result.data);
    return { error: 'Invalid image data format from server' };
  }
  
  console.log('🖼️ Extracted base64 length:', base64Data.length);

  // Return in the format expected by App.tsx
  return {
    newImageBase64s: [base64Data],
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
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
 * @param prompt - Video generation prompt
 * @param imageDataUrl - Base image for video
 * @param aspectRatio - Optional aspect ratio (unused for now)
 */
export async function generateVideoFromImageAndPrompt(prompt: string, imageDataUrl: string, aspectRatio?: string): Promise<any> {
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
 * Video suggestions
 * Uses dedicated /proxy/video-suggestions endpoint with Gemini 2.5 Flash
 */
export async function generateVideoSuggestions(
  imageDataUrl: string, 
  promptTemplate?: string | (() => string)
): Promise<VideoSuggestion[]> {
  try {
    // Convert image to File for cloud API
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });

    // Get prompt template (call function if it's a function)
    const prompt = typeof promptTemplate === 'function' ? promptTemplate() : (promptTemplate || `Analyze this image and suggest 3-4 creative video animation ideas. Return ONLY a JSON array with objects having "vi" (Vietnamese short title, 3-4 words) and "en" (English detailed prompt) keys.`);

    // Call dedicated video suggestions endpoint
    const result = await cloudApiService.videoSuggestions(file, prompt);

    console.log('Video suggestions result:', result); // Debug log

    if (result.success && result.data) {
      // Server returns {success: true, data: {success: true, data: suggestions}}
      // So we need result.data.data to get the actual array
      const suggestions = Array.isArray(result.data) ? result.data : result.data.data;
      return suggestions || [];
    }

    // Fallback to default suggestions if API fails
    return [
      { vi: 'Hơi nước', en: 'Cinematic shot of steam slowly rising, with subtle camera movement.' },
      { vi: 'Camera Pan', en: 'Smooth left-to-right camera pan movement.' },
      { vi: 'Zoom In', en: 'Gradually zoom into the main subject with cinematic feel.' }
    ];
  } catch (error) {
    console.error('Video suggestions generation failed:', error);
    // Return default suggestions on error
    return [
      { vi: 'Hơi nước', en: 'Cinematic shot of steam slowly rising, with subtle camera movement.' },
      { vi: 'Camera Pan', en: 'Smooth left-to-right camera pan movement.' },
      { vi: 'Zoom In', en: 'Gradually zoom into the main subject with cinematic feel.' }
    ];
  }
}

/**
 * Redesign concepts
 * Uses dedicated /proxy/redesign-suggestions endpoint with Gemini 2.5 Flash
 */
export async function generateRedesignConcepts(
  imageDataUrl: string, 
  promptTemplate?: string | (() => string)
): Promise<RedesignConcept[]> {
  try {
    // Convert image to File for cloud API
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });

    // Get prompt template (call function if it's a function)
    const prompt = typeof promptTemplate === 'function' ? promptTemplate() : (promptTemplate || `Analyze this design and suggest 4 creative redesign concepts. Return ONLY a JSON array with objects having "vi" (Vietnamese short concept, 3-5 words) and "en" (English detailed prompt) keys.`);

    // Call dedicated redesign suggestions endpoint
    const result = await cloudApiService.redesignSuggestions(file, prompt);

    console.log('Redesign suggestions result:', result); // Debug log

    if (result.success && result.data) {
      // Server returns {success: true, data: {success: true, data: suggestions}}
      // So we need result.data.data to get the actual array
      const suggestions = Array.isArray(result.data) ? result.data : result.data.data;
      return suggestions || [];
    }

    // Fallback to default suggestions if API fails
    return [
      { vi: '4 nhân vật kinh dị khác', en: 'Generate 4 different horror icons in this vintage style' },
      { vi: '3 phong cách nghệ thuật khác', en: 'Generate in 3 different art styles (minimalist, chibi, abstract)' },
      { vi: '4 nhân vật phản diện', en: 'Generate 4 different infamous villains in this macabre style' }
    ];
  } catch (error) {
    console.error('Redesign concepts generation failed:', error);
    return [
      { vi: '4 nhân vật kinh dị khác', en: 'Generate 4 different horror icons in this vintage style' },
      { vi: '3 phong cách nghệ thuật khác', en: 'Generate in 3 different art styles (minimalist, chibi, abstract)' },
      { vi: '4 nhân vật phản diện', en: 'Generate 4 different infamous villains in this macabre style' }
    ];
  }
}

/**
 * Detailed redesign prompts (mock for now)
 */
export async function generateDetailedRedesignPrompts(
  imageDataUrl: string,
  concept: string,
  numImages: number = 3,
  promptTemplate?: string
): Promise<string[]> {
  return [
    `Redesign with ${concept} theme, high detail`,
    `Transform using ${concept} style, professional quality`,
    `Apply ${concept} aesthetic, 4K resolution`
  ].slice(0, numImages);
}
