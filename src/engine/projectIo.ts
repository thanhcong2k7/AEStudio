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
    layers: [],
    assets: [],
    customFonts: [],
  };
}

import JSZip from 'jszip';

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
 * Exports project as a portable .aes ZIP container containing:
 * - project.json (clean comp settings, tracks, keyframes, effect params)
 * - media/ (raw binary media files for video, audio, image, and font assets)
 * Extremely memory efficient compared to embedding multi-gigabyte base64 strings!
 */
export async function exportProjectToAes(project: Project): Promise<Blob> {
  const zip = new JSZip();
  const cloned = JSON.parse(JSON.stringify(project)) as Project;
  const mediaFolder = zip.folder('media');

  for (const asset of cloned.assets) {
    // Strip giant base64 strings from project.json since raw binaries live in media/
    delete asset.dataBase64;

    const sourceUrl = asset.url || asset.dataBase64;
    if (sourceUrl) {
      try {
        const res = await fetch(sourceUrl);
        const arrayBuf = await res.arrayBuffer();
        const safeName = `${asset.id}_${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        mediaFolder?.file(safeName, arrayBuf);
        (asset as any).mediaPath = `media/${safeName}`;
      } catch (err) {
        console.warn(`Could not bundle media for asset ${asset.name}:`, err);
      }
    }
  }

  // Bundle custom TTF/OTF fonts
  if (cloned.customFonts && cloned.customFonts.length > 0) {
    for (const font of cloned.customFonts) {
      const fontSrc = font.url || font.dataBase64;
      if (fontSrc) {
        try {
          const res = await fetch(fontSrc);
          const fontBuf = await res.arrayBuffer();
          const safeFontName = `font_${font.family.replace(/[^a-zA-Z0-9._-]/g, '_')}.ttf`;
          mediaFolder?.file(safeFontName, fontBuf);
          (font as any).fontPath = `media/${safeFontName}`;
          delete font.dataBase64;
        } catch (err) {
          console.warn('Could not bundle font:', err);
        }
      }
    }
  }

  zip.file('project.json', JSON.stringify(cloned, null, 2));

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Loads and extracts an .aes ZIP package, restoring all binary media assets into Object URLs
 */
export async function loadProjectFromAes(file: File | Blob): Promise<Project> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Invalid .aes package: Missing project.json');
  }

  const jsonStr = await projectFile.async('text');
  const project = loadProjectFromJson(jsonStr);

  // Restore media assets from media/ folder inside zip
  for (const asset of project.assets) {
    const mediaPath = (asset as any).mediaPath || `media/${asset.id}_${asset.name}`;
    let zipEntry = zip.file(mediaPath);
    if (!zipEntry) {
      const match = Object.keys(zip.files).find(
        (p) => p.includes(asset.id) || p.endsWith(asset.name)
      );
      if (match) zipEntry = zip.file(match);
    }

    if (zipEntry) {
      const blob = await zipEntry.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      asset.url = blobUrl;
    }
  }

  // Restore custom fonts
  if (project.customFonts && project.customFonts.length > 0) {
    for (const font of project.customFonts) {
      const fontPath = (font as any).fontPath;
      let zipEntry = fontPath ? zip.file(fontPath) : null;
      if (!zipEntry) {
        const match = Object.keys(zip.files).find((p) => p.includes(font.family));
        if (match) zipEntry = zip.file(match);
      }
      if (zipEntry) {
        const fontBlob = await zipEntry.async('blob');
        const fontUrl = URL.createObjectURL(fontBlob);
        font.url = fontUrl;
        try {
          const fontFace = new FontFace(font.family, `url(${fontUrl})`);
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch (e) {
          console.warn('Failed to load font from .aes:', e);
        }
      }
    }
  }

  return project;
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
