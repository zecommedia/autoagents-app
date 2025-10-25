import { imglyRemoveBackground, Config } from '@imgly/background-removal';

export interface ProcessingResult {
  imageData: ImageData;
  processingTime: number;
  method: string;
}

export class LocalImageProcessor {
  private worker: Worker | null = null;
  
  constructor() {
    // Initialize Web Worker for background processing
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('./imageProcessing.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (error) {
        console.warn('Web Worker not available, using main thread');
      }
    }
  }
  
  /**
   * Remove background using AI model running locally (WASM)
   */
  async removeBackground(imageBlob: Blob): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      const config: Config = {
        model: 'medium', // small | medium | large
        output: {
          format: 'image/png',
          quality: 0.9,
          type: 'foreground'
        }
      };
      
      const resultBlob = await imglyRemoveBackground(imageBlob, config);
      
      // Convert blob to ImageData
      const img = await createImageBitmap(resultBlob);
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      
      const processingTime = performance.now() - startTime;
      
      return {
        imageData,
        processingTime,
        method: 'ai-local'
      };
    } catch (error) {
      console.error('Background removal failed:', error);
      throw error;
    }
  }
  
  /**
   * Edge detection using Canvas API
   */
  async detectEdges(imageData: ImageData): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    if (this.worker) {
      return new Promise((resolve, reject) => {
        this.worker!.postMessage({
          type: 'detectEdges',
          imageData
        });
        
        this.worker!.onmessage = (e) => {
          if (e.data.type === 'edgeDetectionComplete') {
            resolve({
              imageData: e.data.result,
              processingTime: performance.now() - startTime,
              method: 'sobel-worker'
            });
          }
        };
        
        this.worker!.onerror = reject;
      });
    } else {
      const result = this.sobelEdgeDetection(imageData);
      return {
        imageData: result,
        processingTime: performance.now() - startTime,
        method: 'sobel-main'
      };
    }
  }
  
  /**
   * Sobel edge detection algorithm
   */
  private sobelEdgeDetection(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const output = new ImageData(width, height);
    
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
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            
            gx += gray * sobelX[ky + 1][kx + 1];
            gy += gray * sobelY[ky + 1][kx + 1];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const idx = (y * width + x) * 4;
        
        output.data[idx] = magnitude;
        output.data[idx + 1] = magnitude;
        output.data[idx + 2] = magnitude;
        output.data[idx + 3] = 255;
      }
    }
    
    return output;
  }
  
  /**
   * Refine edges using morphological operations
   */
  async refineEdges(
    imageData: ImageData,
    options: {
      dilate?: number;
      erode?: number;
      blur?: number;
    }
  ): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    let result = imageData;
    
    if (options.dilate) {
      result = this.morphologicalDilate(result, options.dilate);
    }
    
    if (options.erode) {
      result = this.morphologicalErode(result, options.erode);
    }
    
    if (options.blur) {
      result = this.gaussianBlur(result, options.blur);
    }
    
    return {
      imageData: result,
      processingTime: performance.now() - startTime,
      method: 'morphological'
    };
  }
  
  private morphologicalDilate(imageData: ImageData, iterations: number): ImageData {
    let current = imageData;
    
    for (let i = 0; i < iterations; i++) {
      const temp = new ImageData(current.width, current.height);
      
      for (let y = 1; y < current.height - 1; y++) {
        for (let x = 1; x < current.width - 1; x++) {
          let maxAlpha = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * current.width + (x + kx)) * 4 + 3;
              maxAlpha = Math.max(maxAlpha, current.data[idx]);
            }
          }
          
          const idx = (y * current.width + x) * 4;
          temp.data[idx] = current.data[idx];
          temp.data[idx + 1] = current.data[idx + 1];
          temp.data[idx + 2] = current.data[idx + 2];
          temp.data[idx + 3] = maxAlpha;
        }
      }
      
      current = temp;
    }
    
    return current;
  }
  
  private morphologicalErode(imageData: ImageData, iterations: number): ImageData {
    let current = imageData;
    
    for (let i = 0; i < iterations; i++) {
      const temp = new ImageData(current.width, current.height);
      
      for (let y = 1; y < current.height - 1; y++) {
        for (let x = 1; x < current.width - 1; x++) {
          let minAlpha = 255;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * current.width + (x + kx)) * 4 + 3;
              minAlpha = Math.min(minAlpha, current.data[idx]);
            }
          }
          
          const idx = (y * current.width + x) * 4;
          temp.data[idx] = current.data[idx];
          temp.data[idx + 1] = current.data[idx + 1];
          temp.data[idx + 2] = current.data[idx + 2];
          temp.data[idx + 3] = minAlpha;
        }
      }
      
      current = temp;
    }
    
    return current;
  }
  
  private gaussianBlur(imageData: ImageData, radius: number): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const ny = Math.max(0, Math.min(height - 1, y + ky));
            const nx = Math.max(0, Math.min(width - 1, x + kx));
            const idx = (ny * width + nx) * 4;
            
            r += imageData.data[idx];
            g += imageData.data[idx + 1];
            b += imageData.data[idx + 2];
            a += imageData.data[idx + 3];
            count++;
          }
        }
        
        const idx = (y * width + x) * 4;
        output.data[idx] = r / count;
        output.data[idx + 1] = g / count;
        output.data[idx + 2] = b / count;
        output.data[idx + 3] = a / count;
      }
    }
    
    return output;
  }
  
  destroy() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
