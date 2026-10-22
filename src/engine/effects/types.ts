/**
 * AEStudio - Effects Engine Context & Data Types
 * Derived 1:1 from Rust engine types (lib.rs, util.rs)
 */

export interface EffectCtx {
  params: Record<string, any>;
  time: number; // Layer time in seconds
  layerSize: [number, number]; // [width, height] in layer px
  seed: number;
  adjustment: boolean;
  env: {
    compTime: number; // Composition time in seconds
    frameRate: number;
    getLayerPixels?: (layerId: string, masksAndEffects?: boolean) => ImageData | null;
    getAudioSamples?: (layerId: string, start: number, frames: number, sampleRate?: number) => Float32Array | null;
    masks?: Array<{
      points: [number, number][];
      closed: boolean;
      inverted: boolean;
    }>;
  };
}

export type EffectFn = (ctx: EffectCtx, input: ImageData) => ImageData;
