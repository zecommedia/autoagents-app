/**
 * IMAGE PROCESSOR WEB WORKER
 * 
 * Handles all heavy image processing operations OFF the main thread
 * to keep UI responsive while processing full-resolution images.
 * 
 * Operations:
 * - Chroma keying with tolerance
 * - Edge choke (dilate/erode)
 * - Feather (Gaussian blur)
 * - Morphology operations
 * - SSAA (Super-Sample Anti-Aliasing)
 * - Decontamination
 * - Artifact cleanup (flood-fill)
 */

// Utility: Create Gaussian kernel for blur
function createGaussianKernel(radius) {
    const size = radius * 2 + 1;
    const kernel = new Float32Array(size);
    const sigma = radius / 3;
    const twoSigmaSquare = 2 * sigma * sigma;
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
        const x = i - radius;
        kernel[i] = Math.exp(-(x * x) / twoSigmaSquare);
        sum += kernel[i];
    }
    
    // Normalize
    for (let i = 0; i < size; i++) {
        kernel[i] /= sum;
    }
    
    return kernel;
}

// Utility: Box blur (faster approximation of Gaussian)
function boxBlurAlpha(alphaData, width, height, radius, outputData) {
    const temp = new Float32Array(width * height);
    
    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;
            
            for (let k = -radius; k <= radius; k++) {
                const nx = x + k;
                if (nx >= 0 && nx < width) {
                    sum += alphaData[y * width + nx];
                    count++;
                }
            }
            
            temp[y * width + x] = sum / count;
        }
    }
    
    // Vertical pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;
            
            for (let k = -radius; k <= radius; k++) {
                const ny = y + k;
                if (ny >= 0 && ny < height) {
                    sum += temp[ny * width + x];
                    count++;
                }
            }
            
            outputData[(y * width + x) * 4 + 3] = Math.round(sum / count);
        }
    }
}

// Utility: Color distance for chroma keying
function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Main processing function
self.onmessage = function(e) {
    const { 
        type, 
        imageData, 
        width, 
        height,
        params 
    } = e.data;
    
    if (type !== 'process') return;
    
    const data = imageData.data;
    let progress = 0;
    
    try {
        // STEP 1: Chroma Keying (20% of work)
        if (params.chromaTolerance !== undefined) {
            const targetChroma = params.targetChroma;
            const tolerance = params.chromaTolerance;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const dist = colorDistance(r, g, b, targetChroma.r, targetChroma.g, targetChroma.b);
                
                if (dist <= tolerance) {
                    data[i + 3] = 0; // Hard remove
                } else if (dist <= tolerance + 30) {
                    // Soft edge feathering
                    const alpha = ((dist - tolerance) / 30) * 255;
                    data[i + 3] = Math.min(data[i + 3], Math.round(alpha));
                }
                
                // Report progress every 1M pixels
                if (i % 4000000 === 0) {
                    progress = 20 * (i / data.length);
                    self.postMessage({ type: 'progress', progress: Math.round(progress) });
                }
            }
        }
        progress = 20;
        self.postMessage({ type: 'progress', progress });
        
        // STEP 2: Edge Choke (20% of work)
        if (params.edgeChoke !== 0) {
            const chokeAmount = Math.min(Math.round(Math.abs(params.edgeChoke)), 5);
            const isExpand = params.edgeChoke > 0;
            
            for (let iter = 0; iter < chokeAmount; iter++) {
                const tempData = new Uint8ClampedArray(data.length);
                tempData.set(data);
                
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = (y * width + x) * 4;
                        const alpha = data[idx + 3];
                        
                        if (alpha === 0 || alpha === 255) continue;
                        
                        const neighbors = [
                            data[((y-1) * width + x) * 4 + 3],
                            data[((y+1) * width + x) * 4 + 3],
                            data[(y * width + (x-1)) * 4 + 3],
                            data[(y * width + (x+1)) * 4 + 3]
                        ];
                        
                        if (isExpand) {
                            tempData[idx + 3] = Math.max(alpha, ...neighbors);
                        } else {
                            tempData[idx + 3] = Math.min(alpha, ...neighbors);
                        }
                    }
                    
                    // Report progress
                    if (y % 100 === 0) {
                        progress = 20 + 20 * ((iter + y / height) / chokeAmount);
                        self.postMessage({ type: 'progress', progress: Math.round(progress) });
                    }
                }
                data.set(tempData);
            }
        }
        progress = 40;
        self.postMessage({ type: 'progress', progress });
        
        // STEP 3: Feather/Blur (30% of work)
        if (params.featherRadius > 0) {
            const radius = Math.min(Math.round(params.featherRadius), 30);
            const tempAlpha = new Float32Array(width * height);
            
            // Extract alpha
            for (let i = 0; i < width * height; i++) {
                tempAlpha[i] = data[i * 4 + 3];
            }
            
            if (radius > 15) {
                // Fast box blur
                boxBlurAlpha(tempAlpha, width, height, radius, data);
            } else {
                // Accurate Gaussian blur
                const kernel = createGaussianKernel(radius);
                const temp1 = new Float32Array(width * height);
                
                // Horizontal pass
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        let sum = 0, weightSum = 0;
                        for (let k = -radius; k <= radius; k++) {
                            const nx = x + k;
                            if (nx >= 0 && nx < width) {
                                sum += tempAlpha[y * width + nx] * kernel[k + radius];
                                weightSum += kernel[k + radius];
                            }
                        }
                        temp1[y * width + x] = sum / weightSum;
                    }
                    
                    // Report progress
                    if (y % 100 === 0) {
                        progress = 40 + 15 * (y / height);
                        self.postMessage({ type: 'progress', progress: Math.round(progress) });
                    }
                }
                
                // Vertical pass
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        let sum = 0, weightSum = 0;
                        for (let k = -radius; k <= radius; k++) {
                            const ny = y + k;
                            if (ny >= 0 && ny < height) {
                                sum += temp1[ny * width + x] * kernel[k + radius];
                                weightSum += kernel[k + radius];
                            }
                        }
                        data[(y * width + x) * 4 + 3] = Math.round(sum / weightSum);
                    }
                    
                    // Report progress
                    if (y % 100 === 0) {
                        progress = 55 + 15 * (y / height);
                        self.postMessage({ type: 'progress', progress: Math.round(progress) });
                    }
                }
            }
        }
        progress = 70;
        self.postMessage({ type: 'progress', progress });
        
        // STEP 4: Morphology (15% of work)
        if (params.morphIter > 0 && params.morphOp) {
            const iterations = Math.min(params.morphIter, 10);
            
            for (let iter = 0; iter < iterations; iter++) {
                const tempData = new Uint8ClampedArray(data.length);
                tempData.set(data);
                
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = (y * width + x) * 4;
                        const alpha = data[idx + 3];
                        
                        const neighbors = [
                            data[((y-1) * width + (x-1)) * 4 + 3],
                            data[((y-1) * width + x) * 4 + 3],
                            data[((y-1) * width + (x+1)) * 4 + 3],
                            data[(y * width + (x-1)) * 4 + 3],
                            data[(y * width + (x+1)) * 4 + 3],
                            data[((y+1) * width + (x-1)) * 4 + 3],
                            data[((y+1) * width + x) * 4 + 3],
                            data[((y+1) * width + (x+1)) * 4 + 3]
                        ];
                        
                        if (params.morphOp === 'dilate') {
                            tempData[idx + 3] = Math.max(alpha, ...neighbors);
                        } else {
                            tempData[idx + 3] = Math.min(alpha, ...neighbors);
                        }
                    }
                    
                    // Report progress
                    if (y % 100 === 0) {
                        progress = 70 + 15 * ((iter + y / height) / iterations);
                        self.postMessage({ type: 'progress', progress: Math.round(progress) });
                    }
                }
                data.set(tempData);
            }
        }
        progress = 85;
        self.postMessage({ type: 'progress', progress });
        
        // STEP 5: Decontamination (10% of work)
        if (params.decontaminationStrength > 0) {
            const strength = params.decontaminationStrength;
            
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                
                // Only decontaminate semi-transparent pixels
                if (alpha > 0 && alpha < 200) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Calculate grayscale
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    // Blend towards grayscale
                    const factor = (1 - alpha / 255) * (strength / 100);
                    data[i] = Math.round(r * (1 - factor) + gray * factor);
                    data[i + 1] = Math.round(g * (1 - factor) + gray * factor);
                    data[i + 2] = Math.round(b * (1 - factor) + gray * factor);
                }
                
                // Report progress
                if (i % 4000000 === 0) {
                    progress = 85 + 10 * (i / data.length);
                    self.postMessage({ type: 'progress', progress: Math.round(progress) });
                }
            }
        }
        progress = 95;
        self.postMessage({ type: 'progress', progress });
        
        // STEP 6: SSAA downsampling (5% of work) - handled separately in main thread
        
        progress = 100;
        self.postMessage({ type: 'progress', progress });
        
        // Send back processed image data
        self.postMessage({ 
            type: 'complete', 
            imageData: imageData 
        }, [imageData.data.buffer]); // Transfer ownership for zero-copy
        
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    }
};
