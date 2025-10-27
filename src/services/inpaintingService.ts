/**
 * Inpainting Service (Legacy Stub)
 * This is a stub for backwards compatibility with existing App.tsx code.
 * Desktop app should use cloudApiService instead.
 */

export async function createMaskedImage(...args: any[]): Promise<string> {
  throw new Error('Inpainting service not available in desktop app. Please use cloudApiService instead.');
}

export async function describeMaskedArea(...args: any[]): Promise<string> {
  throw new Error('Inpainting service not available in desktop app. Please use cloudApiService instead.');
}

export async function cropImageByMask(...args: any[]): Promise<string> {
  throw new Error('Inpainting service not available in desktop app. Please use localProcessingService.cropImage() instead.');
}
