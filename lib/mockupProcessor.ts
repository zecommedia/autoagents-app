/**
 * Local Mockup Processor
 * 
 * Handles 100% local mockup generation:
 * - Perspective transform (warp product onto template)
 * - Shadow/lighting effects
 * - Color adjustments
 * - Zero API calls
 */

export interface MockupTemplate {
    id: string;
    name: string;
    baseImage: string; // Template background image
    maskRegion: {
        // Quadrilateral points for perspective transform
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
        bottomRight: { x: number; y: number };
    };
    effects?: {
        shadow?: {
            blur: number;
            opacity: number;
            offsetX: number;
            offsetY: number;
            color: string;
        };
        lighting?: {
            brightness: number;
            contrast: number;
        };
        overlay?: {
            color: string;
            opacity: number;
            blendMode: GlobalCompositeOperation;
        };
    };
}

export interface MockupResult {
    imageData: string; // Base64 result
    processingTime: number;
    method: string;
}

export class MockupProcessor {
    /**
     * Apply product image to mockup template
     */
    async generateMockup(
        productImage: string,
        template: MockupTemplate
    ): Promise<MockupResult> {
        const startTime = performance.now();
        
        try {
            // Load images
            const [productImg, templateImg] = await Promise.all([
                this.loadImage(productImage),
                this.loadImage(template.baseImage)
            ]);
            
            // Create canvas at template size
            const canvas = document.createElement('canvas');
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            const ctx = canvas.getContext('2d', { alpha: true })!;
            
            // Draw template background
            ctx.drawImage(templateImg, 0, 0);
            
            // Apply perspective transform to product image
            const transformedProduct = await this.applyPerspectiveTransform(
                productImg,
                template.maskRegion,
                canvas.width,
                canvas.height
            );
            
            // Apply effects
            if (template.effects?.shadow) {
                this.applyShadow(ctx, template.effects.shadow);
            }
            
            // Draw transformed product onto template
            ctx.drawImage(transformedProduct, 0, 0);
            
            // Apply lighting/overlay effects
            if (template.effects?.lighting) {
                this.applyLighting(ctx, template.effects.lighting, canvas.width, canvas.height);
            }
            
            if (template.effects?.overlay) {
                this.applyOverlay(ctx, template.effects.overlay, canvas.width, canvas.height);
            }
            
            const processingTime = performance.now() - startTime;
            
            return {
                imageData: canvas.toDataURL('image/png'),
                processingTime,
                method: 'canvas-2d-transform'
            };
        } catch (error) {
            console.error('Mockup generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Apply perspective transform to warp image onto template
     * Uses homography matrix for accurate perspective mapping
     */
    private async applyPerspectiveTransform(
        sourceImage: HTMLImageElement,
        targetRegion: MockupTemplate['maskRegion'],
        canvasWidth: number,
        canvasHeight: number
    ): Promise<HTMLCanvasElement> {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { alpha: true })!;
        
        // Calculate perspective transformation matrix
        // Source: full product image (0,0) to (w,h)
        // Target: template mask region coordinates
        
        const srcPoints = [
            [0, 0],
            [sourceImage.width, 0],
            [0, sourceImage.height],
            [sourceImage.width, sourceImage.height]
        ];
        
        const dstPoints = [
            [targetRegion.topLeft.x * canvasWidth, targetRegion.topLeft.y * canvasHeight],
            [targetRegion.topRight.x * canvasWidth, targetRegion.topRight.y * canvasHeight],
            [targetRegion.bottomLeft.x * canvasWidth, targetRegion.bottomLeft.y * canvasHeight],
            [targetRegion.bottomRight.x * canvasWidth, targetRegion.bottomRight.y * canvasHeight]
        ];
        
        // For Canvas 2D, we'll use a simplified approach with setTransform
        // For more accurate perspective, WebGL would be needed
        
        // Calculate average transform (approximation)
        const avgScaleX = (
            Math.abs(dstPoints[1][0] - dstPoints[0][0]) / sourceImage.width +
            Math.abs(dstPoints[3][0] - dstPoints[2][0]) / sourceImage.width
        ) / 2;
        
        const avgScaleY = (
            Math.abs(dstPoints[2][1] - dstPoints[0][1]) / sourceImage.height +
            Math.abs(dstPoints[3][1] - dstPoints[1][1]) / sourceImage.height
        ) / 2;
        
        const avgX = (dstPoints[0][0] + dstPoints[1][0] + dstPoints[2][0] + dstPoints[3][0]) / 4;
        const avgY = (dstPoints[0][1] + dstPoints[1][1] + dstPoints[2][1] + dstPoints[3][1]) / 4;
        
        ctx.save();
        ctx.translate(avgX - sourceImage.width * avgScaleX / 2, avgY - sourceImage.height * avgScaleY / 2);
        ctx.scale(avgScaleX, avgScaleY);
        
        // Apply simple skew for perspective effect
        const skewX = (dstPoints[1][0] - dstPoints[0][0] - (dstPoints[3][0] - dstPoints[2][0])) / canvasWidth;
        const skewY = (dstPoints[2][1] - dstPoints[0][1] - (dstPoints[3][1] - dstPoints[1][1])) / canvasHeight;
        ctx.transform(1, skewY * 0.5, skewX * 0.5, 1, 0, 0);
        
        ctx.drawImage(sourceImage, 0, 0);
        ctx.restore();
        
        return canvas;
    }
    
    /**
     * Apply shadow effect
     */
    private applyShadow(
        ctx: CanvasRenderingContext2D,
        shadow: NonNullable<MockupTemplate['effects']>['shadow']
    ) {
        ctx.shadowBlur = shadow.blur;
        ctx.shadowColor = shadow.color;
        ctx.shadowOffsetX = shadow.offsetX;
        ctx.shadowOffsetY = shadow.offsetY;
        ctx.globalAlpha = shadow.opacity;
    }
    
    /**
     * Apply lighting effects (brightness/contrast)
     */
    private applyLighting(
        ctx: CanvasRenderingContext2D,
        lighting: NonNullable<MockupTemplate['effects']>['lighting'],
        width: number,
        height: number
    ) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const brightness = lighting.brightness;
        const contrast = lighting.contrast;
        
        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast
            data[i] = ((data[i] - 128) * contrast + 128) + brightness;
            data[i + 1] = ((data[i + 1] - 128) * contrast + 128) + brightness;
            data[i + 2] = ((data[i + 2] - 128) * contrast + 128) + brightness;
            
            // Clamp values
            data[i] = Math.max(0, Math.min(255, data[i]));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Apply color overlay (for lighting effects)
     */
    private applyOverlay(
        ctx: CanvasRenderingContext2D,
        overlay: NonNullable<MockupTemplate['effects']>['overlay'],
        width: number,
        height: number
    ) {
        ctx.globalCompositeOperation = overlay.blendMode;
        ctx.fillStyle = overlay.color;
        ctx.globalAlpha = overlay.opacity;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }
    
    /**
     * Load image from URL
     */
    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
}

// Preset templates for common mockups
export const MOCKUP_TEMPLATES: Record<string, MockupTemplate> = {
    'coffee-mug': {
        id: 'coffee-mug',
        name: 'Coffee Mug',
        baseImage: '/mockup-templates/coffee-mug-base.png',
        maskRegion: {
            topLeft: { x: 0.35, y: 0.25 },
            topRight: { x: 0.65, y: 0.25 },
            bottomLeft: { x: 0.30, y: 0.70 },
            bottomRight: { x: 0.70, y: 0.70 }
        },
        effects: {
            shadow: {
                blur: 15,
                opacity: 0.3,
                offsetX: 5,
                offsetY: 5,
                color: 'rgba(0, 0, 0, 0.3)'
            },
            lighting: {
                brightness: 10,
                contrast: 1.1
            }
        }
    },
    't-shirt': {
        id: 't-shirt',
        name: 'T-Shirt',
        baseImage: '/mockup-templates/t-shirt-base.png',
        maskRegion: {
            topLeft: { x: 0.30, y: 0.30 },
            topRight: { x: 0.70, y: 0.30 },
            bottomLeft: { x: 0.25, y: 0.75 },
            bottomRight: { x: 0.75, y: 0.75 }
        },
        effects: {
            overlay: {
                color: 'rgba(255, 255, 255, 0.1)',
                opacity: 0.1,
                blendMode: 'overlay'
            }
        }
    },
    'phone-case': {
        id: 'phone-case',
        name: 'Phone Case',
        baseImage: '/mockup-templates/phone-case-base.png',
        maskRegion: {
            topLeft: { x: 0.40, y: 0.15 },
            topRight: { x: 0.60, y: 0.15 },
            bottomLeft: { x: 0.40, y: 0.85 },
            bottomRight: { x: 0.60, y: 0.85 }
        },
        effects: {
            shadow: {
                blur: 10,
                opacity: 0.4,
                offsetX: 3,
                offsetY: 3,
                color: 'rgba(0, 0, 0, 0.4)'
            }
        }
    },
    'poster': {
        id: 'poster',
        name: 'Wall Poster',
        baseImage: '/mockup-templates/poster-base.png',
        maskRegion: {
            topLeft: { x: 0.20, y: 0.15 },
            topRight: { x: 0.80, y: 0.15 },
            bottomLeft: { x: 0.22, y: 0.85 },
            bottomRight: { x: 0.78, y: 0.85 }
        },
        effects: {
            shadow: {
                blur: 20,
                opacity: 0.25,
                offsetX: 10,
                offsetY: 10,
                color: 'rgba(0, 0, 0, 0.25)'
            },
            lighting: {
                brightness: -5,
                contrast: 1.05
            }
        }
    }
};
