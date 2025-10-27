// Local Processing Service - For offline features
import { removeBackground } from '@imgly/background-removal';

export interface ProcessingProgress {
  stage: string;
  progress: number; // 0-100
}

// Remove Background (WASM - Offline)
export async function removeBgLocal(
  imageUrl: string | File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({ stage: 'Loading model...', progress: 10 });
    
    const blob = await removeBackground(imageUrl, {
      progress: (key, current, total) => {
        const progressPercent = Math.round((current / total) * 90) + 10; // 10-100%
        onProgress?.({ stage: `Processing (${key})...`, progress: progressPercent });
      }
    });
    
    onProgress?.({ stage: 'Complete!', progress: 100 });
    return blob;
  } catch (error) {
    console.error('Remove background error:', error);
    throw new Error('Failed to remove background. Please try again.');
  }
}

// Edge Detection (Canvas API - Offline)
export async function detectEdges(
  imageUrl: string | File,
  threshold: number = 50,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<string> {
  try {
    onProgress?.({ stage: 'Loading image...', progress: 10 });
    
    // Load image
    const img = await loadImage(imageUrl);
    onProgress?.({ stage: 'Processing...', progress: 30 });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Draw image
    ctx.drawImage(img, 0, 0);
    onProgress?.({ stage: 'Analyzing...', progress: 50 });
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert to grayscale
    onProgress?.({ stage: 'Converting to grayscale...', progress: 60 });
    const gray = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i / 4] = grayscale;
    }
    
    // Apply Sobel filter
    onProgress?.({ stage: 'Detecting edges...', progress: 80 });
    const edges = applySobelFilter(gray, canvas.width, canvas.height, threshold);
    
    // Put edge data back to canvas
    for (let i = 0; i < edges.length; i++) {
      const idx = i * 4;
      const value = edges[i];
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
    
    ctx.putImageData(imageData, 0, 0);
    onProgress?.({ stage: 'Complete!', progress: 100 });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Edge detection error:', error);
    throw new Error('Failed to detect edges. Please try again.');
  }
}

// Sobel filter implementation
function applySobelFilter(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): Uint8ClampedArray {
  const edges = new Uint8ClampedArray(width * height);
  
  // Sobel kernels
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];
  
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      
      // Apply kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const pixel = gray[idx];
          
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }
      
      // Calculate gradient magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      
      // Apply threshold
      edges[y * width + x] = magnitude > threshold ? 255 : 0;
    }
  }
  
  return edges;
}

// Crop/Resize (Canvas - Offline)
export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
}

export async function cropImage(
  imageUrl: string | File,
  options: CropOptions,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<string> {
  try {
    onProgress?.({ stage: 'Loading image...', progress: 30 });
    
    const img = await loadImage(imageUrl);
    onProgress?.({ stage: 'Cropping...', progress: 70 });
    
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(
      img,
      options.x, options.y, options.width, options.height,
      0, 0, options.width, options.height
    );
    
    onProgress?.({ stage: 'Complete!', progress: 100 });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Crop error:', error);
    throw new Error('Failed to crop image. Please try again.');
  }
}

export async function resizeImage(
  imageUrl: string | File,
  options: ResizeOptions,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<string> {
  try {
    onProgress?.({ stage: 'Loading image...', progress: 30 });
    
    const img = await loadImage(imageUrl);
    onProgress?.({ stage: 'Resizing...', progress: 70 });
    
    let newWidth = options.width || img.width;
    let newHeight = options.height || img.height;
    
    // Maintain aspect ratio if requested
    if (options.maintainAspectRatio) {
      const aspectRatio = img.width / img.height;
      if (options.width && !options.height) {
        newHeight = options.width / aspectRatio;
      } else if (options.height && !options.width) {
        newWidth = options.height * aspectRatio;
      }
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    
    onProgress?.({ stage: 'Complete!', progress: 100 });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Resize error:', error);
    throw new Error('Failed to resize image. Please try again.');
  }
}

// Helper function to load image
function loadImage(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    if (typeof source === 'string') {
      img.src = source;
    } else {
      // File object
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(source);
    }
  });
}

// Convert blob to data URL
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Download helper
export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
