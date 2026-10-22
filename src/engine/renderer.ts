/**
 * AEStudio - Canvas Compositor, Snapping Engine & 29-Effect Pipeline
 */

import { Layer, CompSettings, PreviewQuality, Asset, BlendMode } from './types';
import { evaluateProp } from './evaluator';
import { applyEffect, EffectCtx } from './effects';
import { getLayerAudioSamples } from './audio';

export interface SnappingGuide {
  type: 'x' | 'y';
  pos: number;
}

export interface RenderContext {
  comp: CompSettings;
  layers: Layer[];
  assets: Asset[];
  time: number;
  quality: PreviewQuality;
  selectedLayerIds: string[];
  mediaElements: Map<string, HTMLImageElement | HTMLVideoElement>;
  isPlaying?: boolean;
}

export function qualityToScale(quality: PreviewQuality): number {
  switch (quality) {
    case 'half':
      return 0.5;
    case 'third':
      return 1 / 3;
    case 'quarter':
      return 0.25;
    case 'full':
    default:
      return 1.0;
  }
}

export function mapBlendMode(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'difference':
      return 'difference';
    case 'add':
      return 'lighter';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'normal':
    default:
      return 'source-over';
  }
}

/**
 * Checks snapping of target box against canvas boundaries and other layer boxes.
 * Threshold is in comp pixels (e.g. 6px).
 */
export function calculateSnapping(
  targetBox: { x: number; y: number; width: number; height: number },
  otherBoxes: { x: number; y: number; width: number; height: number }[],
  comp: CompSettings,
  threshold: number = 6
): { snappedX: number; snappedY: number; guides: SnappingGuide[] } {
  let snappedX = targetBox.x;
  let snappedY = targetBox.y;
  const guides: SnappingGuide[] = [];

  const tLeft = targetBox.x;
  const tCenter = targetBox.x + targetBox.width / 2;
  const tRight = targetBox.x + targetBox.width;

  const tTop = targetBox.y;
  const tMiddle = targetBox.y + targetBox.height / 2;
  const tBottom = targetBox.y + targetBox.height;

  // X Candidates: Canvas Left, Center, Right, and Other Boxes Left, Center, Right
  const xCandidates = [0, comp.width / 2, comp.width];
  for (const b of otherBoxes) {
    xCandidates.push(b.x, b.x + b.width / 2, b.x + b.width);
  }

  // Y Candidates: Canvas Top, Middle, Bottom, and Other Boxes Top, Middle, Bottom
  const yCandidates = [0, comp.height / 2, comp.height];
  for (const b of otherBoxes) {
    yCandidates.push(b.y, b.y + b.height / 2, b.y + b.height);
  }

  // Check X snapping
  let minDiffX = threshold + 1;
  let chosenXCandidate: number | null = null;
  let alignOffsetX = 0;

  for (const c of xCandidates) {
    // Left edge
    const diffL = Math.abs(tLeft - c);
    if (diffL <= threshold && diffL < minDiffX) {
      minDiffX = diffL;
      chosenXCandidate = c;
      alignOffsetX = 0;
    }
    // Center
    const diffC = Math.abs(tCenter - c);
    if (diffC <= threshold && diffC < minDiffX) {
      minDiffX = diffC;
      chosenXCandidate = c;
      alignOffsetX = -targetBox.width / 2;
    }
    // Right edge
    const diffR = Math.abs(tRight - c);
    if (diffR <= threshold && diffR < minDiffX) {
      minDiffX = diffR;
      chosenXCandidate = c;
      alignOffsetX = -targetBox.width;
    }
  }

  if (chosenXCandidate !== null) {
    snappedX = chosenXCandidate + alignOffsetX;
    guides.push({ type: 'x', pos: chosenXCandidate });
  }

  // Check Y snapping
  let minDiffY = threshold + 1;
  let chosenYCandidate: number | null = null;
  let alignOffsetY = 0;

  for (const c of yCandidates) {
    // Top edge
    const diffT = Math.abs(tTop - c);
    if (diffT <= threshold && diffT < minDiffY) {
      minDiffY = diffT;
      chosenYCandidate = c;
      alignOffsetY = 0;
    }
    // Middle
    const diffM = Math.abs(tMiddle - c);
    if (diffM <= threshold && diffM < minDiffY) {
      minDiffY = diffM;
      chosenYCandidate = c;
      alignOffsetY = -targetBox.height / 2;
    }
    // Bottom edge
    const diffB = Math.abs(tBottom - c);
    if (diffB <= threshold && diffB < minDiffY) {
      minDiffY = diffB;
      chosenYCandidate = c;
      alignOffsetY = -targetBox.height;
    }
  }

  if (chosenYCandidate !== null) {
    snappedY = chosenYCandidate + alignOffsetY;
    guides.push({ type: 'y', pos: chosenYCandidate });
  }

  return { snappedX, snappedY, guides };
}

/**
 * Evaluates world transform matrix for a layer
 */
export function getLayerTransform(layer: Layer, time: number) {
  const pos = evaluateProp(layer.position, time, layer.id, 'position');
  const scale = evaluateProp(layer.scale, time, layer.id, 'scale');
  const rot = evaluateProp(layer.rotation, time, layer.id, 'rotation');
  const anchor = evaluateProp(layer.anchor, time, layer.id, 'anchor');
  const opacity = evaluateProp(layer.opacity, time, layer.id, 'opacity') / 100;

  return {
    x: pos[0],
    y: pos[1],
    scaleX: scale[0] / 100,
    scaleY: scale[1] / 100,
    rotation: (rot * Math.PI) / 180,
    anchorX: anchor[0],
    anchorY: anchor[1],
    opacity: Math.max(0, Math.min(1, opacity)),
  };
}

/**
 * Reusable offscreen canvas pool to avoid GC thrashing during rendering
 */
let cachedOffscreenCanvas: HTMLCanvasElement | null = null;
let cachedOffscreenCtx: CanvasRenderingContext2D | null = null;

function getOffscreenContext(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  if (!cachedOffscreenCanvas) {
    cachedOffscreenCanvas = document.createElement('canvas');
    cachedOffscreenCtx = cachedOffscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  cachedOffscreenCanvas.width = Math.max(1, w);
  cachedOffscreenCanvas.height = Math.max(1, h);
  return { canvas: cachedOffscreenCanvas, ctx: cachedOffscreenCtx! };
}

/**
 * Main composition render function
 */
export function renderComposition(
  targetCanvas: HTMLCanvasElement,
  rc: RenderContext
) {
  const { comp, layers, time, quality, mediaElements, isPlaying } = rc;
  const qScale = qualityToScale(quality);

  const renderW = Math.max(1, Math.round(comp.width * qScale));
  const renderH = Math.max(1, Math.round(comp.height * qScale));

  // Match target canvas size to scaled quality
  if (targetCanvas.width !== renderW || targetCanvas.height !== renderH) {
    targetCanvas.width = renderW;
    targetCanvas.height = renderH;
  }

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Clear & fill background
  ctx.save();
  ctx.scale(qScale, qScale);
  ctx.fillStyle = comp.backgroundColor || '#000000';
  ctx.fillRect(0, 0, comp.width, comp.height);

  const anySolo = layers.some((l) => l.solo);

  // Render bottom-to-top: layers array index 0 is top track in AE
  const renderOrder = [...layers].reverse();

  // Only allocate and retain cross-layer pixel cache if an active effect actually references other layers
  const needsCrossLayerSampling = layers.some(
    (l) => l.effects && l.effects.some((e) => e.enabled && (e.effectId === 'ec.channel.setchannels' || e.effectId === 'ec.channel.setmatte'))
  );
  const renderedLayerPixels = new Map<string, ImageData>();

  for (const layer of renderOrder) {
    if (!layer.visible) continue;
    if (anySolo && !layer.solo) continue;
    if (layer.type === 'audio') continue; // Audio has no visual rendering

    const layerTime = time - layer.startTime;
    if (layerTime < layer.inPoint || layerTime > layer.outPoint) {
      continue; // Outside layer in/out bounds
    }

    const t = getLayerTransform(layer, time);
    if (t.opacity <= 0) continue;

    const layerW = Math.max(1, Math.round(layer.width));
    const layerH = Math.max(1, Math.round(layer.height));

    if (layer.type === 'adjustment') {
      // Adjustment layer: grabs canvas beneath it, runs effects, and blends back
      const adjW = comp.width;
      const adjH = comp.height;
      const { canvas: adjCanvas, ctx: adjCtx } = getOffscreenContext(adjW, adjH);
      adjCtx.drawImage(targetCanvas, 0, 0, adjW, adjH);

      let currentImageData = adjCtx.getImageData(0, 0, adjW, adjH);

      // Run effects stack
      if (layer.effects && layer.effects.length > 0) {
        for (const effect of layer.effects) {
          if (!effect.enabled) continue;

          const evaluatedParams: Record<string, any> = {};
          for (const [k, v] of Object.entries(effect.params)) {
            evaluatedParams[k] = evaluateProp(v, layerTime, layer.id, k);
          }

          const fxCtx: EffectCtx = {
            params: evaluatedParams,
            time: layerTime,
            layerSize: [adjW, adjH],
            seed: (layer.id.length * 31 + effect.id.length * 17) >>> 0,
            adjustment: true,
            env: {
              compTime: time,
              frameRate: comp.fps || 30,
              getLayerPixels: (id) => renderedLayerPixels.get(id) || null,
              getAudioSamples: (id, start, frames, sRate) => {
                const targetLayer = layers.find((l) => l.id === id);
                if (!targetLayer?.assetId) return null;
                const asset = rc.assets.find((a) => a.id === targetLayer.assetId);
                if (!asset?.audioBuffer) return null;
                return getLayerAudioSamples(asset.audioBuffer, start, frames, sRate);
              },
            },
          };

          currentImageData = applyEffect(effect.effectId, fxCtx, currentImageData);
        }
      }

      adjCtx.putImageData(currentImageData, 0, 0);

      ctx.save();
      ctx.globalAlpha = t.opacity;
      ctx.globalCompositeOperation = mapBlendMode(layer.blendMode);
      ctx.drawImage(adjCanvas, 0, 0, comp.width, comp.height);
      ctx.restore();
      continue;
    }

    // Standard layer: render base content to offscreen canvas
    const { canvas: layerCanvas, ctx: layerCtx } = getOffscreenContext(layerW, layerH);
    layerCtx.clearRect(0, 0, layerW, layerH);

    // Sync video elements to playhead time
    if (layer.type === 'video' && layer.assetId) {
      const video = mediaElements.get(layer.assetId);
      if (video && video instanceof HTMLVideoElement) {
        const targetVidTime = Math.max(0, layerTime);
        if (Math.abs(video.currentTime - targetVidTime) > 0.08) {
          video.currentTime = targetVidTime;
        }
        if (isPlaying && video.paused) {
          video.play().catch(() => {});
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      }
    }

    // Render Layer Base Content
    renderLayerContent(layerCtx, layer, rc, layerTime);

    // Extract image data for effect pipeline
    let currentImageData = layerCtx.getImageData(0, 0, layerW, layerH);

    // Execute 29-Effect Pipeline
    if (layer.effects && layer.effects.length > 0) {
      for (const effect of layer.effects) {
        if (!effect.enabled) continue;

        const evaluatedParams: Record<string, any> = {};
        for (const [k, v] of Object.entries(effect.params)) {
          evaluatedParams[k] = evaluateProp(v, layerTime, layer.id, k);
        }

        const fxCtx: EffectCtx = {
          params: evaluatedParams,
          time: layerTime,
          layerSize: [layerW, layerH],
          seed: (layer.id.length * 31 + effect.id.length * 17) >>> 0,
          adjustment: false,
          env: {
            compTime: time,
            frameRate: comp.fps || 30,
            getLayerPixels: (id) => renderedLayerPixels.get(id) || null,
            getAudioSamples: (id, start, frames, sRate) => {
              const targetLayer = layers.find((l) => l.id === id);
              if (!targetLayer?.assetId) return null;
              const asset = rc.assets.find((a) => a.id === targetLayer.assetId);
              if (!asset?.audioBuffer) return null;
              const bufferTime = (start - targetLayer.startTime) + targetLayer.inPoint;
              if (bufferTime < 0 || bufferTime >= asset.audioBuffer.duration) return null;
              return getLayerAudioSamples(asset.audioBuffer, bufferTime, frames, sRate);
            },
          },
        };

        currentImageData = applyEffect(effect.effectId, fxCtx, currentImageData);
      }
    }

    // Cache rendered pixels only if cross-layer sampling is required (Set Channels, Set Matte)
    if (needsCrossLayerSampling) {
      renderedLayerPixels.set(layer.id, currentImageData);
    }

    // Write back processed pixels
    layerCtx.putImageData(currentImageData, 0, 0);

    // Draw transformed layer to main composition
    ctx.save();
    ctx.globalAlpha = t.opacity;
    ctx.globalCompositeOperation = mapBlendMode(layer.blendMode);

    // Apply 2D layer transformation
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.scale(t.scaleX, t.scaleY);
    ctx.translate(-t.anchorX, -t.anchorY);

    ctx.drawImage(layerCanvas, 0, 0, layerW, layerH);

    ctx.restore();
  }

  renderedLayerPixels.clear();
  ctx.restore();
}

function renderLayerContent(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  rc: RenderContext,
  layerTime: number
) {
  const { width, height } = layer;

  switch (layer.type) {
    case 'solid': {
      if (layer.solidColor && layer.solidColor !== 'transparent') {
        ctx.fillStyle = layer.solidColor;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'shape': {
      const s = layer.shapeData;
      if (!s) break;
      ctx.fillStyle = s.fillColor;
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth;

      if (s.shapeType === 'rectangle') {
        if (s.cornerRadius > 0 && ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(0, 0, width, height, s.cornerRadius);
          ctx.fill();
          if (s.strokeWidth > 0) ctx.stroke();
        } else {
          ctx.fillRect(0, 0, width, height);
          if (s.strokeWidth > 0) ctx.strokeRect(0, 0, width, height);
        }
      } else if (s.shapeType === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (s.strokeWidth > 0) ctx.stroke();
      } else if (s.shapeType === 'line') {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        if (s.strokeWidth > 0) ctx.stroke();
      } else if (s.shapeType === 'star' || s.shapeType === 'polygon') {
        const cx = width / 2;
        const cy = height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = s.innerRadius || outerR * 0.45;
        const pts = s.points || 5;

        ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) {
          const r = s.shapeType === 'star' ? (i % 2 === 0 ? outerR : innerR) : outerR;
          const a = (i * Math.PI) / (s.shapeType === 'star' ? pts : pts / 2) - Math.PI / 2;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        if (s.strokeWidth > 0) ctx.stroke();
      }
      break;
    }

    case 'text': {
      const td = layer.textData;
      if (!td || !td.text) break;
      ctx.font = `${td.fontSize}px "${td.fontFamily || 'Plus Jakarta Sans'}", sans-serif`;
      ctx.textAlign = td.textAlign || 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = td.fillColor || '#ffffff';

      const lines = td.text.split('\n');
      const lh = td.fontSize * (td.lineHeight || 1.2);
      let y = 0;

      for (const line of lines) {
        let x = 0;
        if (td.textAlign === 'center') x = width / 2;
        else if (td.textAlign === 'right') x = width;

        if (td.letterSpacing && td.letterSpacing !== 0) {
          let curX = x;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            ctx.fillText(ch, curX, y);
            curX += ctx.measureText(ch).width + td.letterSpacing;
          }
        } else {
          ctx.fillText(line, x, y);
          if (td.strokeWidth && td.strokeWidth > 0 && td.strokeColor) {
            ctx.strokeStyle = td.strokeColor;
            ctx.lineWidth = td.strokeWidth;
            ctx.strokeText(line, x, y);
          }
        }
        y += lh;
      }
      break;
    }

    case 'image':
    case 'video': {
      if (!layer.assetId) break;
      const media = rc.mediaElements.get(layer.assetId);
      if (media && (media instanceof HTMLImageElement || media instanceof HTMLVideoElement)) {
        try {
          ctx.drawImage(media, 0, 0, width, height);
        } catch {
          // Ignore transient video seek errors
        }
      } else {
        // Fallback placeholder
        ctx.fillStyle = '#23252a';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#3e424d';
        ctx.strokeRect(0, 0, width, height);
      }
      break;
    }

    case 'adjustment': {
      break;
    }
  }
}
