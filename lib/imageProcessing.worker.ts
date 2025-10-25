self.onmessage = async (e: MessageEvent) => {
  const { type, imageData } = e.data;
  
  if (type === 'detectEdges') {
    const result = sobelEdgeDetection(imageData);
    self.postMessage({
      type: 'edgeDetectionComplete',
      result
    });
  }
};

function sobelEdgeDetection(imageData: ImageData): ImageData {
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
