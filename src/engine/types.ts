/**
 * AEStudio - Core Type Definitions
 */

export type LayerType = 'text' | 'image' | 'video' | 'audio' | 'shape' | 'solid' | 'adjustment';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'difference'
  | 'add'
  | 'darken'
  | 'lighten';

export type KeyframeInterpolation = 'linear' | 'hold' | 'bezier' | 'ease';

export interface Keyframe<T = number> {
  id: string;
  time: number; // in seconds
  value: T;
  interpolation: KeyframeInterpolation;
  inHandle?: [number, number]; // [timeOffset, valueOffset]
  outHandle?: [number, number];
}

export interface WiggleSettings {
  enabled: boolean;
  freq: number; // oscillations per second
  amp: number; // amplitude in property units
  octaves: number; // noise octaves (default 1)
  amp_mult: number; // octave multiplier (default 0.5)
}

export interface AnimatableProp<T = number> {
  value: T;
  keyframes: Keyframe<T>[];
  animated: boolean;
  wiggle?: WiggleSettings;
}

export interface MaskShape {
  id: string;
  name: string;
  points: [number, number][]; // in layer pixel coordinates
  closed: boolean;
  inverted: boolean;
}

export type ParamKind =
  | 'slider'
  | 'popup'
  | 'checkbox'
  | 'color'
  | 'point'
  | 'layer'
  | 'angle'
  | 'mask'
  | 'hidden';

export interface ParamUi {
  type: ParamKind;
  min?: number;
  max?: number;
  sliderMin?: number;
  sliderMax?: number;
  decimals?: number;
  options?: string[]; // for popup enum options
}

export interface EffectParamSpec {
  id: string;
  name: string;
  default: any;
  ui: ParamUi;
}

export interface EffectSpec {
  id: string;
  name: string;
  category: 'Channel' | 'Distort' | 'Generate';
  params: EffectParamSpec[];
}

export interface EffectInstance {
  id: string;
  effectId: string;
  name: string;
  enabled: boolean;
  params: Record<string, AnimatableProp<any>>;
}

export interface ShapeData {
  shapeType: 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
  points?: number; // for star/polygon
  innerRadius?: number; // for star
}

export interface TextData {
  text: string;
  fontFamily: string;
  fontSize: number;
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  inPoint: number; // seconds
  outPoint: number; // seconds
  startTime: number; // composition time where layer starts (seconds)
  sourceOffset?: number; // media trim offset (seconds)
  duration: number; // natural duration (for video/audio/image)
  visible: boolean;
  locked: boolean;
  solo: boolean;
  mute: boolean;
  blendMode: BlendMode;

  // Spatial Dimensions
  width: number;
  height: number;

  // Transform Animatable Properties
  position: AnimatableProp<[number, number]>;
  scale: AnimatableProp<[number, number]>; // percentage, 100 = 1.0
  rotation: AnimatableProp<number>; // degrees
  anchor: AnimatableProp<[number, number]>; // in layer pixels
  opacity: AnimatableProp<number>; // percentage 0..100

  // Masks and Effects
  masks: MaskShape[];
  effects: EffectInstance[];

  // Type Specific Data
  assetId?: string; // image, video, audio
  solidColor?: string; // solid/empty
  shapeData?: ShapeData; // shape
  textData?: TextData; // text
}

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'font';
  url: string;
  dataBase64?: string;
  width?: number;
  height?: number;
  duration?: number; // seconds
  audioBuffer?: AudioBuffer;
  waveformPeaks?: Float32Array; // cached waveform min/max peaks
}

export interface CompSettings {
  width: number;
  height: number;
  fps: number;
  duration: number; // seconds
  backgroundColor: string;
  shutterAngle: number; // 0..720 degrees
  shutterSamples: number; // 2..64
  aspectRatioLocked?: boolean;
}

export type PreviewQuality = 'full' | 'half' | 'third' | 'quarter';

export interface Project {
  version: number;
  name: string;
  comp: CompSettings;
  layers: Layer[];
  assets: Asset[];
  customFonts: { family: string; url: string; dataBase64?: string }[];
}
