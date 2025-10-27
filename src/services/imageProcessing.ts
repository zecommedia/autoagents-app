/**
 * Image Processing Service (Legacy Stub)
 * Desktop app should use localProcessingService instead.
 */

export async function processCutout(...args: any[]): Promise<any> {
  throw new Error('Image processing not available. Use localProcessingService.removeBgLocal() instead.');
}

export function makeCacheKey(...args: any[]): string {
  return Date.now().toString();
}

export async function createFinalJob(...args: any[]): Promise<string> {
  throw new Error('Job processing not available in desktop app.');
}

export async function getJob(...args: any[]): Promise<any> {
  throw new Error('Job processing not available in desktop app.');
}
