/**
 * AEStudio - Project Serialization & File I/O
 */

import { Project, CompSettings } from './types';

export const CURRENT_PROJECT_VERSION = 1;

export const DEFAULT_COMP_SETTINGS: CompSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 10.0, // 10 seconds
  backgroundColor: '#121316',
  shutterAngle: 180,
  shutterSamples: 16,
  aspectRatioLocked: true,
};

/**
 * Creates a clean default AEStudio project
 */
export function createDefaultProject(): Project {
  return {
    version: CURRENT_PROJECT_VERSION,
    name: 'Untitled Composition',
    comp: { ...DEFAULT_COMP_SETTINGS },
    layers: [
      {
        id: 'layer_bg',
        name: 'Background Solid',
        type: 'solid',
        inPoint: 0,
        outPoint: 10.0,
        startTime: 0,
        duration: 10.0,
        visible: true,
        locked: false,
        solo: false,
        mute: false,
        blendMode: 'normal',
        width: 1920,
        height: 1080,
        solidColor: '#1a1c23',
        position: { value: [960, 540], keyframes: [], animated: false },
        scale: { value: [100, 100], keyframes: [], animated: false },
        rotation: { value: 0, keyframes: [], animated: false },
        anchor: { value: [960, 540], keyframes: [], animated: false },
        opacity: { value: 100, keyframes: [], animated: false },
        masks: [],
        effects: [],
      },
      {
        id: 'layer_title',
        name: 'AEStudio Motion',
        type: 'text',
        inPoint: 0,
        outPoint: 10.0,
        startTime: 0,
        duration: 10.0,
        visible: true,
        locked: false,
        solo: false,
        mute: false,
        blendMode: 'normal',
        width: 1000,
        height: 200,
        textData: {
          text: 'AEStudio\nMotion Graphics & Video Editor',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 64,
          fillColor: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: 2,
        },
        position: {
          value: [960, 540],
          keyframes: [
            { id: 'kf_1', time: 0, value: [960, 600], interpolation: 'ease' },
            { id: 'kf_2', time: 1.5, value: [960, 540], interpolation: 'ease' },
          ],
          animated: true,
        },
        scale: { value: [100, 100], keyframes: [], animated: false },
        rotation: { value: 0, keyframes: [], animated: false },
        anchor: { value: [500, 100], keyframes: [], animated: false },
        opacity: {
          value: 100,
          keyframes: [
            { id: 'kf_op1', time: 0, value: 0, interpolation: 'linear' },
            { id: 'kf_op2', time: 1.0, value: 100, interpolation: 'linear' },
          ],
          animated: true,
        },
        masks: [],
        effects: [],
      },
    ],
    assets: [],
    customFonts: [],
  };
}

/**
 * Serializes project to JSON, optionally omitting heavy base64 data if not requested
 */
export function exportProjectToJson(project: Project, embedMedia: boolean = true): string {
  const cloned = JSON.parse(JSON.stringify(project)) as Project;
  if (!embedMedia) {
    for (const a of cloned.assets) {
      delete a.dataBase64;
    }
  }
  return JSON.stringify(cloned, null, 2);
}

/**
 * Validates and migrates imported project JSON
 */
export function loadProjectFromJson(jsonString: string): Project {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Invalid JSON file: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Project file root must be an object');
  }

  if (!parsed.comp || typeof parsed.comp.width !== 'number') {
    throw new Error('Missing or corrupt composition settings');
  }

  if (!Array.isArray(parsed.layers)) {
    throw new Error('Project layers must be an array');
  }

  // Version migration hook
  if (!parsed.version) {
    parsed.version = 1;
  }

  if (!Array.isArray(parsed.assets)) {
    parsed.assets = [];
  }

  if (!Array.isArray(parsed.customFonts)) {
    parsed.customFonts = [];
  }

  return parsed as Project;
}
