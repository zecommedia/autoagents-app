export type Tool = 'send' | 'brush' | 'line' | 'rect' | 'crop' | 'text' | 'image' | 'eraser' | 'ai_eraser';

// Base interface for all canvas objects
interface CanvasObjectBase {
  id: string;
  visible?: boolean;
}

export interface ImageObject extends CanvasObjectBase {
  type: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PathObject extends CanvasObjectBase {
  type: 'path';
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
  opacity?: number;
}

export interface RectObject extends CanvasObjectBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  opacity?: number;
  rotation: number;
}

export interface LineObject extends CanvasObjectBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  opacity?: number;
}

export interface TextObject extends CanvasObjectBase {
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  strokeColor: string;
  fontSize: number;
  rotation: number;
  align: 'left' | 'center' | 'right';
}


export type CanvasObjectType = ImageObject | PathObject | RectObject | LineObject | TextObject;

export interface ToolSettings {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  align: 'left' | 'center' | 'right';
}

export interface StagedAsset {
  id: string;
  src: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
