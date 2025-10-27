/**
 * Cursor Configuration
 * Provides custom cursor styles for drawing tools
 */

export function getCursorStyle(mode: string): string {
  switch (mode) {
    case 'pen':
    case 'draw':
      return 'crosshair';
    case 'eyedropper':
    case 'picker':
      return 'cell';
    case 'erase':
      return 'not-allowed';
    default:
      return 'default';
  }
}
