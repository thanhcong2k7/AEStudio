/**
 * AEStudio - Layer Styles Effects Engine
 * Derived 1:1 from styles.rs and _color_blend.rs
 *
 * Implements the 9 Photoshop / After Effects Layer Styles:
 * 1. Drop Shadow
 * 2. Inner Shadow
 * 3. Outer Glow
 * 4. Inner Glow
 * 5. Bevel and Emboss
 * 6. Satin
 * 7. Color Overlay
 * 8. Gradient Overlay
 * 9. Stroke
 */

import { EffectCtx } from './types';
import { blendPhotoshop } from './color';

// ============================================================================
// Fast Mathematical Utilities (Chamfer Distance Transform & Separable Blur)
// ============================================================================

const SQRT2 = 1.4142135623730951;

/**
 * Computes fast 8-neighbor Chamfer Euclidean Distance Transform for both
 * outside (distance to foreground) and inside (distance to background).
 */
export function computeDistanceFields(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  threshold: number = 32
): { distOutside: Float32Array; distInside: Float32Array } {
  const size = w * h;
  const distOutside = new Float32Array(size);
  const distInside = new Float32Array(size);
  const INF = 1e6;

  for (let i = 0; i < size; i++) {
    const isSolid = alpha[i] >= threshold;
    distOutside[i] = isSolid ? 0 : INF;
    distInside[i] = isSolid ? INF : 0;
  }

  // Forward Pass (Top-Left to Bottom-Right)
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;

      // Inside Field
      let dIn = distInside[idx];
      if (dIn > 0) {
        if (x > 0) dIn = Math.min(dIn, distInside[idx - 1] + 1);
        if (y > 0) {
          dIn = Math.min(dIn, distInside[idx - w] + 1);
          if (x > 0) dIn = Math.min(dIn, distInside[idx - w - 1] + SQRT2);
          if (x < w - 1) dIn = Math.min(dIn, distInside[idx - w + 1] + SQRT2);
        }
        distInside[idx] = dIn;
      }

      // Outside Field
      let dOut = distOutside[idx];
      if (dOut > 0) {
        if (x > 0) dOut = Math.min(dOut, distOutside[idx - 1] + 1);
        if (y > 0) {
          dOut = Math.min(dOut, distOutside[idx - w] + 1);
          if (x > 0) dOut = Math.min(dOut, distOutside[idx - w - 1] + SQRT2);
          if (x < w - 1) dOut = Math.min(dOut, distOutside[idx - w + 1] + SQRT2);
        }
        distOutside[idx] = dOut;
      }
    }
  }

  // Backward Pass (Bottom-Right to Top-Left)
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w;
    for (let x = w - 1; x >= 0; x--) {
      const idx = row + x;

      // Inside Field
      let dIn = distInside[idx];
      if (dIn > 0) {
        if (x < w - 1) dIn = Math.min(dIn, distInside[idx + 1] + 1);
        if (y < h - 1) {
          dIn = Math.min(dIn, distInside[idx + w] + 1);
          if (x < w - 1) dIn = Math.min(dIn, distInside[idx + w + 1] + SQRT2);
          if (x > 0) dIn = Math.min(dIn, distInside[idx + w - 1] + SQRT2);
        }
        distInside[idx] = dIn;
      }

      // Outside Field
      let dOut = distOutside[idx];
      if (dOut > 0) {
        if (x < w - 1) dOut = Math.min(dOut, distOutside[idx + 1] + 1);
        if (y < h - 1) {
          dOut = Math.min(dOut, distOutside[idx + w] + 1);
          if (x < w - 1) dOut = Math.min(dOut, distOutside[idx + w + 1] + SQRT2);
          if (x > 0) dOut = Math.min(dOut, distOutside[idx + w - 1] + SQRT2);
        }
        distOutside[idx] = dOut;
      }
    }
  }

  return { distOutside, distInside };
}

/**
 * Fast 3-pass separable box blur approximating Gaussian blur in linear time.
 */
export function fastGaussianBlur(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0.5) return new Uint8ClampedArray(src);
  const r = Math.min(Math.max(1, Math.round(radius)), 120);
  const size = w * h;
  let current = new Uint8ClampedArray(src);
  let temp = new Uint8ClampedArray(size);

  const passes = 2; // 2 passes produces great quality and high performance
  for (let p = 0; p < passes; p++) {
    // Horizontal blur
    const invW = 1.0 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const x = Math.min(w - 1, Math.max(0, i));
        sum += current[row + x];
      }
      for (let x = 0; x < w; x++) {
        temp[row + x] = (sum * invW) | 0;
        const xRem = Math.max(0, x - r);
        const xAdd = Math.min(w - 1, x + r + 1);
        sum += current[row + xAdd] - current[row + xRem];
      }
    }

    // Vertical blur
    const invH = 1.0 / (r + r + 1);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const y = Math.min(h - 1, Math.max(0, i));
        sum += temp[y * w + x];
      }
      for (let y = 0; y < h; y++) {
        current[y * w + x] = (sum * invH) | 0;
        const yRem = Math.max(0, y - r);
        const yAdd = Math.min(h - 1, y + r + 1);
        sum += temp[(yAdd) * w + x] - temp[(yRem) * w + x];
      }
    }
  }

  return current;
}

// Pseudo-random noise generator based on pixel coordinate
function getNoise(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1013904223) >>> 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296.0;
}

// ============================================================================
// 1. Drop Shadow (`dropShadow` / `ec.style.dropshadow`)
// ============================================================================
export function fxDropShadow(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 3); // Multiply default
  const color = Array.isArray(p.color) ? p.color : [0, 0, 0, 1];
  const opacity = (Number(p.opacity ?? 75) / 100);
  const angle = Number(p.angle ?? 120.0);
  const distance = Number(p.distance ?? 5.0);
  const spread = Math.min(100, Math.max(0, Number(p.spread ?? 0.0))) / 100;
  const size = Math.max(0, Number(p.size ?? 5.0));
  const noise = (Number(p.noise ?? 0.0) / 100);
  const knocksOut = p.knocksOut !== false;

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  // Offset vector: light angle in Photoshop convention
  // 120°: light from top-left, casts shadow to bottom-right (+x, +y)
  const rad = (angle * Math.PI) / 180;
  const dx = Math.round(-Math.cos(rad) * distance);
  const dy = Math.round(Math.sin(rad) * distance);

  // Extract source alpha shifted by (dx, dy)
  const shiftedAlpha = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    const srcRow = sy * w;
    const dstRow = y * w;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= w) continue;
      shiftedAlpha[dstRow + x] = src[(srcRow + sx) * 4 + 3];
    }
  }

  // Apply spread & blur
  const blurredAlpha = size > 0 ? fastGaussianBlur(shiftedAlpha, w, h, size) : shiftedAlpha;

  // Render & Composite
  const shadowR = color[0] ?? 0;
  const shadowG = color[1] ?? 0;
  const shadowB = color[2] ?? 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;

      let sAlpha = blurredAlpha[i] / 255;
      if (spread > 0 && sAlpha > 0) {
        sAlpha = Math.min(1.0, sAlpha / (1.0 - spread * 0.95));
      }

      if (noise > 0 && sAlpha > 0) {
        const n = getNoise(x, y, ctx.seed);
        sAlpha = Math.max(0, sAlpha * (1.0 - noise * (1.0 - n)));
      }

      sAlpha *= opacity;

      // Layer knocks out shadow if specified
      if (knocksOut && origA > 0) {
        sAlpha *= (1.0 - origA);
      }

      if (origA <= 0 && sAlpha <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      // If shadow is present and no original pixel
      if (origA <= 0) {
        outData[pi] = (shadowR * 255) | 0;
        outData[pi + 1] = (shadowG * 255) | 0;
        outData[pi + 2] = (shadowB * 255) | 0;
        outData[pi + 3] = (sAlpha * 255) | 0;
        continue;
      }

      // Original pixel present
      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      if (sAlpha <= 0) {
        outData[pi] = src[pi];
        outData[pi + 1] = src[pi + 1];
        outData[pi + 2] = src[pi + 2];
        outData[pi + 3] = src[pi + 3];
      } else {
        // Blend shadow under or with original pixel
        const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, shadowR, shadowG, shadowB);
        const finalR = baseR * (1 - sAlpha) + blended[0] * sAlpha;
        const finalG = baseG * (1 - sAlpha) + blended[1] * sAlpha;
        const finalB = baseB * (1 - sAlpha) + blended[2] * sAlpha;
        const finalA = Math.min(1.0, origA + sAlpha * (1 - origA));

        outData[pi] = (finalR * 255) | 0;
        outData[pi + 1] = (finalG * 255) | 0;
        outData[pi + 2] = (finalB * 255) | 0;
        outData[pi + 3] = (finalA * 255) | 0;
      }
    }
  }

  return out;
}

// ============================================================================
// 2. Inner Shadow (`innerShadow` / `ec.style.innershadow`)
// ============================================================================
export function fxInnerShadow(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 3); // Multiply default
  const color = Array.isArray(p.color) ? p.color : [0, 0, 0, 1];
  const opacity = (Number(p.opacity ?? 75) / 100);
  const angle = Number(p.angle ?? 120.0);
  const distance = Number(p.distance ?? 5.0);
  const choke = Math.min(100, Math.max(0, Number(p.choke ?? 0.0))) / 100;
  const size = Math.max(0, Number(p.size ?? 5.0));
  const noise = (Number(p.noise ?? 0.0) / 100);

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  // Inverted mask shifted by (-dx, -dy)
  const rad = (angle * Math.PI) / 180;
  const dx = Math.round(-Math.cos(rad) * distance);
  const dy = Math.round(Math.sin(rad) * distance);

  const invertedShifted = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    const dstRow = y * w;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      let alphaVal = 0;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        alphaVal = src[(sy * w + sx) * 4 + 3];
      }
      invertedShifted[dstRow + x] = 255 - alphaVal;
    }
  }

  const blurredInverted = size > 0 ? fastGaussianBlur(invertedShifted, w, h, size) : invertedShifted;

  const shadowR = color[0] ?? 0;
  const shadowG = color[1] ?? 0;
  const shadowB = color[2] ?? 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;
      if (origA <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      let shadowA = blurredInverted[i] / 255;
      if (choke > 0 && shadowA > 0) {
        shadowA = Math.min(1.0, shadowA / (1.0 - choke * 0.95));
      }

      if (noise > 0 && shadowA > 0) {
        const n = getNoise(x, y, ctx.seed);
        shadowA = Math.max(0, shadowA * (1.0 - noise * (1.0 - n)));
      }

      shadowA *= opacity * origA;

      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, shadowR, shadowG, shadowB);
      outData[pi] = Math.round((baseR * (1 - shadowA) + blended[0] * shadowA) * 255);
      outData[pi + 1] = Math.round((baseG * (1 - shadowA) + blended[1] * shadowA) * 255);
      outData[pi + 2] = Math.round((baseB * (1 - shadowA) + blended[2] * shadowA) * 255);
      outData[pi + 3] = src[pi + 3];
    }
  }

  return out;
}

// ============================================================================
// 3. Outer Glow (`outerGlow` / `ec.style.outerglow`)
// ============================================================================
export function fxOuterGlow(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 8); // Screen default
  const opacity = (Number(p.opacity ?? 75) / 100);
  const color = Array.isArray(p.color) ? p.color : [1.0, 1.0, 190 / 255, 1.0];
  const spread = Math.min(100, Math.max(0, Number(p.spread ?? 0.0))) / 100;
  const size = Math.max(0.5, Number(p.size ?? 5.0));
  const range = Number(p.range ?? 50.0);
  const noise = (Number(p.noise ?? 0.0) / 100);

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  // Extract alpha
  const alphaOnly = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    alphaOnly[i] = src[i * 4 + 3];
  }

  const blurredAlpha = fastGaussianBlur(alphaOnly, w, h, size);

  const glowR = color[0] ?? 1.0;
  const glowG = color[1] ?? 1.0;
  const glowB = color[2] ?? 190 / 255;

  const gamma = 50 / Math.max(1, range);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;

      let glowA = blurredAlpha[i] / 255;
      if (spread > 0 && glowA > 0) {
        glowA = Math.min(1.0, glowA / (1.0 - spread * 0.95));
      }
      glowA = Math.pow(Math.max(0, glowA), gamma);

      if (noise > 0 && glowA > 0) {
        const n = getNoise(x, y, ctx.seed);
        glowA = Math.max(0, glowA * (1.0 - noise * (1.0 - n)));
      }

      glowA *= opacity;
      glowA *= (1.0 - origA); // Only outside foreground

      if (origA <= 0 && glowA <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      if (origA <= 0) {
        outData[pi] = (glowR * 255) | 0;
        outData[pi + 1] = (glowG * 255) | 0;
        outData[pi + 2] = (glowB * 255) | 0;
        outData[pi + 3] = (glowA * 255) | 0;
        continue;
      }

      outData[pi] = src[pi];
      outData[pi + 1] = src[pi + 1];
      outData[pi + 2] = src[pi + 2];
      outData[pi + 3] = src[pi + 3];
    }
  }

  return out;
}

// ============================================================================
// 4. Inner Glow (`innerGlow` / `ec.style.innerglow`)
// ============================================================================
export function fxInnerGlow(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 8); // Screen default
  const opacity = (Number(p.opacity ?? 75) / 100);
  const color = Array.isArray(p.color) ? p.color : [1.0, 1.0, 190 / 255, 1.0];
  const source = Number(p.source ?? 1); // 0 = Center, 1 = Edge
  const choke = Math.min(100, Math.max(0, Number(p.choke ?? 0.0))) / 100;
  const size = Math.max(1.0, Number(p.size ?? 5.0));
  const range = Number(p.range ?? 50.0);
  const noise = (Number(p.noise ?? 0.0) / 100);

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  // Extract inverted alpha for edge glow
  const inverted = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    inverted[i] = 255 - src[i * 4 + 3];
  }

  const blurredInverted = fastGaussianBlur(inverted, w, h, size);

  const glowR = color[0] ?? 1.0;
  const glowG = color[1] ?? 1.0;
  const glowB = color[2] ?? 190 / 255;
  const gamma = 50 / Math.max(1, range);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;
      if (origA <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      let glowA = (source === 1 ? blurredInverted[i] : (255 - blurredInverted[i])) / 255;
      if (choke > 0 && glowA > 0) {
        glowA = Math.min(1.0, glowA / (1.0 - choke * 0.95));
      }
      glowA = Math.pow(Math.max(0, glowA), gamma);

      if (noise > 0 && glowA > 0) {
        const n = getNoise(x, y, ctx.seed);
        glowA = Math.max(0, glowA * (1.0 - noise * (1.0 - n)));
      }

      glowA *= opacity * origA;

      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, glowR, glowG, glowB);
      outData[pi] = Math.round((baseR * (1 - glowA) + blended[0] * glowA) * 255);
      outData[pi + 1] = Math.round((baseG * (1 - glowA) + blended[1] * glowA) * 255);
      outData[pi + 2] = Math.round((baseB * (1 - glowA) + blended[2] * glowA) * 255);
      outData[pi + 3] = src[pi + 3];
    }
  }

  return out;
}

// ============================================================================
// 5. Bevel and Emboss (`bevelEmboss` / `ec.style.bevelemboss`)
// ============================================================================
export function fxBevelEmboss(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const style = Number(p.style ?? 1); // 0=Outer Bevel, 1=Inner Bevel, 2=Emboss, 3=Pillow Emboss, 4=Stroke Emboss
  const depth = Number(p.depth ?? 100.0) / 100.0;
  const direction = Number(p.direction ?? 0); // 0=Up, 1=Down
  const size = Math.max(1.0, Number(p.size ?? 5.0));
  const angle = Number(p.angle ?? 120.0);
  const altitude = Number(p.altitude ?? 30.0);
  const highlightMode = Number(p.highlightMode ?? 8); // Screen default
  const highlightColor = Array.isArray(p.highlightColor) ? p.highlightColor : [1, 1, 1, 1];
  const highlightOpacity = (Number(p.highlightOpacity ?? 75) / 100);
  const shadowMode = Number(p.shadowMode ?? 3); // Multiply default
  const shadowColor = Array.isArray(p.shadowColor) ? p.shadowColor : [0, 0, 0, 1];
  const shadowOpacity = (Number(p.shadowOpacity ?? 75) / 100);

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  // Compute Distance Fields
  const alphaOnly = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    alphaOnly[i] = src[i * 4 + 3];
  }
  const { distInside, distOutside } = computeDistanceFields(alphaOnly, w, h);

  // Compute height map based on bevel style
  const heightMap = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const dIn = distInside[i];
    const dOut = distOutside[i];
    let hVal = 0;

    if (style === 1) {
      // Inner Bevel
      hVal = Math.min(1.0, dIn / size);
    } else if (style === 0) {
      // Outer Bevel
      hVal = Math.max(0.0, 1.0 - dOut / size);
    } else if (style === 2) {
      // Emboss (both sides)
      if (dIn > 0) hVal = 0.5 + 0.5 * Math.min(1.0, dIn / size);
      else hVal = 0.5 - 0.5 * Math.min(1.0, dOut / size);
    } else if (style === 3) {
      // Pillow Emboss
      hVal = 1.0 - Math.abs(dIn - size / 2) / (size / 2);
      hVal = Math.max(0.0, Math.min(1.0, hVal));
    } else {
      hVal = Math.min(1.0, dIn / size);
    }

    if (direction === 1) {
      hVal = 1.0 - hVal;
    }
    heightMap[i] = hVal;
  }

  // Calculate Light Direction Vector
  const radA = (angle * Math.PI) / 180;
  const radAlt = (altitude * Math.PI) / 180;
  const cosAlt = Math.cos(radAlt);
  const sinAlt = Math.sin(radAlt);
  const lx = -Math.cos(radA) * cosAlt;
  const ly = Math.sin(radA) * cosAlt;
  const lz = sinAlt;

  // Render Bevel Surface Shading
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;

      const isInside = origA > 0.05;
      if (style === 1 && !isInside) {
        // Inner Bevel only applies inside
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      // Central differences for surface slope
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);

      const dx = (heightMap[row + x1] - heightMap[row + x0]) * depth;
      const dy = (heightMap[y1 * w + x] - heightMap[y0 * w + x]) * depth;

      // Normal vector (-dx, -dy, 1) normalized
      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;

      const dot = nx * lx + ny * ly + nz * lz;

      let baseR = src[pi] / 255;
      let baseG = src[pi + 1] / 255;
      let baseB = src[pi + 2] / 255;

      if (!isInside) {
        baseR = 0.5;
        baseG = 0.5;
        baseB = 0.5;
      }

      if (dot > 0.05) {
        // Highlight
        const hlIntensity = Math.min(1.0, (dot - 0.05) * 1.5) * highlightOpacity;
        const hlR = highlightColor[0] ?? 1;
        const hlG = highlightColor[1] ?? 1;
        const hlB = highlightColor[2] ?? 1;
        const blended = blendPhotoshop(highlightMode, baseR, baseG, baseB, hlR, hlG, hlB);
        baseR = baseR * (1 - hlIntensity) + blended[0] * hlIntensity;
        baseG = baseG * (1 - hlIntensity) + blended[1] * hlIntensity;
        baseB = baseB * (1 - hlIntensity) + blended[2] * hlIntensity;
      } else if (dot < -0.05) {
        // Shadow
        const shIntensity = Math.min(1.0, (-dot - 0.05) * 1.5) * shadowOpacity;
        const shR = shadowColor[0] ?? 0;
        const shG = shadowColor[1] ?? 0;
        const shB = shadowColor[2] ?? 0;
        const blended = blendPhotoshop(shadowMode, baseR, baseG, baseB, shR, shG, shB);
        baseR = baseR * (1 - shIntensity) + blended[0] * shIntensity;
        baseG = baseG * (1 - shIntensity) + blended[1] * shIntensity;
        baseB = baseB * (1 - shIntensity) + blended[2] * shIntensity;
      }

      outData[pi] = Math.round(baseR * 255);
      outData[pi + 1] = Math.round(baseG * 255);
      outData[pi + 2] = Math.round(baseB * 255);
      outData[pi + 3] = src[pi + 3];
    }
  }

  return out;
}

// ============================================================================
// 6. Satin (`satin` / `ec.style.satin`)
// ============================================================================
export function fxSatin(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 3); // Multiply default
  const color = Array.isArray(p.color) ? p.color : [0, 0, 0, 1];
  const opacity = (Number(p.opacity ?? 50) / 100);
  const angle = Number(p.angle ?? 19.0);
  const distance = Number(p.distance ?? 11.0);
  const size = Math.max(1.0, Number(p.size ?? 14.0));
  const invert = p.invert !== false;

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  const rad = (angle * Math.PI) / 180;
  const dx = Math.round(Math.cos(rad) * distance);
  const dy = Math.round(Math.sin(rad) * distance);

  const diffMask = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const x1 = Math.min(w - 1, Math.max(0, x + dx));
      const y1 = Math.min(h - 1, Math.max(0, y + dy));
      const a1 = src[(y1 * w + x1) * 4 + 3];

      const x2 = Math.min(w - 1, Math.max(0, x - dx));
      const y2 = Math.min(h - 1, Math.max(0, y - dy));
      const a2 = src[(y2 * w + x2) * 4 + 3];

      diffMask[idx] = Math.abs(a1 - a2);
    }
  }

  const blurredDiff = fastGaussianBlur(diffMask, w, h, size);

  const satinR = color[0] ?? 0;
  const satinG = color[1] ?? 0;
  const satinB = color[2] ?? 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;
      if (origA <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      let val = blurredDiff[i] / 255;
      if (invert) val = 1.0 - val;
      const sAlpha = val * opacity * origA;

      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, satinR, satinG, satinB);
      outData[pi] = Math.round((baseR * (1 - sAlpha) + blended[0] * sAlpha) * 255);
      outData[pi + 1] = Math.round((baseG * (1 - sAlpha) + blended[1] * sAlpha) * 255);
      outData[pi + 2] = Math.round((baseB * (1 - sAlpha) + blended[2] * sAlpha) * 255);
      outData[pi + 3] = src[pi + 3];
    }
  }

  return out;
}

// ============================================================================
// 7. Color Overlay (`colorOverlay` / `ec.style.coloroverlay`)
// ============================================================================
export function fxColorOverlay(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 0); // Normal default
  const color = Array.isArray(p.color) ? p.color : [1, 0, 0, 1]; // Red default
  const opacity = (Number(p.opacity ?? 100) / 100);

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  const overlayR = color[0] ?? 1;
  const overlayG = color[1] ?? 0;
  const overlayB = color[2] ?? 0;

  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    const a = src[pi + 3];
    if (a <= 0) {
      outData[pi] = 0;
      outData[pi + 1] = 0;
      outData[pi + 2] = 0;
      outData[pi + 3] = 0;
      continue;
    }

    const baseR = src[pi] / 255;
    const baseG = src[pi + 1] / 255;
    const baseB = src[pi + 2] / 255;

    const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, overlayR, overlayG, overlayB);
    outData[pi] = Math.round((baseR * (1 - opacity) + blended[0] * opacity) * 255);
    outData[pi + 1] = Math.round((baseG * (1 - opacity) + blended[1] * opacity) * 255);
    outData[pi + 2] = Math.round((baseB * (1 - opacity) + blended[2] * opacity) * 255);
    outData[pi + 3] = a;
  }

  return out;
}

// ============================================================================
// 8. Gradient Overlay (`gradientOverlay` / `ec.style.gradientoverlay`)
// ============================================================================
export function fxGradientOverlay(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const blendMode = Number(p.blendMode ?? 0); // Normal default
  const opacity = (Number(p.opacity ?? 100) / 100);
  const color1 = Array.isArray(p.color1) ? p.color1 : [0, 0, 0, 1];
  const color2 = Array.isArray(p.color2) ? p.color2 : [1, 1, 1, 1];
  const angle = Number(p.angle ?? 90.0);
  const style = Number(p.style ?? 0); // 0=Linear, 1=Radial, 2=Angle, 3=Reflected, 4=Diamond
  const reverse = Boolean(p.reverse);
  const scale = Number(p.scale ?? 100.0) / 100.0;
  const offset = Array.isArray(p.offset) ? p.offset : [0.5, 0.5];

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const cx = offset[0] * w;
  const cy = offset[1] * h;
  const diag = Math.sqrt(w * w + h * h) * 0.5 * Math.max(0.1, scale);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const a = src[pi + 3];
      if (a <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      const dx = x - cx;
      const dy = y - cy;

      let t = 0;
      if (style === 1) {
        // Radial
        t = Math.sqrt(dx * dx + dy * dy) / diag;
      } else if (style === 2) {
        // Angle
        const th = Math.atan2(dy, dx) - rad;
        t = ((th / (2 * Math.PI)) % 1.0 + 1.0) % 1.0;
      } else if (style === 3) {
        // Reflected
        const proj = (dx * cosA + dy * sinA) / diag;
        t = Math.min(1.0, Math.abs(proj));
      } else if (style === 4) {
        // Diamond
        const rx = Math.abs(dx * cosA + dy * sinA);
        const ry = Math.abs(-dx * sinA + dy * cosA);
        t = (rx + ry) / diag;
      } else {
        // Linear
        const proj = (dx * cosA + dy * sinA) / diag;
        t = proj * 0.5 + 0.5;
      }

      t = Math.max(0.0, Math.min(1.0, t));
      if (reverse) t = 1.0 - t;

      const c1 = color1;
      const c2 = color2;
      const gradR = (c1[0] ?? 0) * (1 - t) + (c2[0] ?? 1) * t;
      const gradG = (c1[1] ?? 0) * (1 - t) + (c2[1] ?? 1) * t;
      const gradB = (c1[2] ?? 0) * (1 - t) + (c2[2] ?? 1) * t;

      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, gradR, gradG, gradB);
      outData[pi] = Math.round((baseR * (1 - opacity) + blended[0] * opacity) * 255);
      outData[pi + 1] = Math.round((baseG * (1 - opacity) + blended[1] * opacity) * 255);
      outData[pi + 2] = Math.round((baseB * (1 - opacity) + blended[2] * opacity) * 255);
      outData[pi + 3] = a;
    }
  }

  return out;
}

// ============================================================================
// 9. Stroke (`stroke` / `ec.style.stroke`)
// ============================================================================
export function fxStroke(ctx: EffectCtx, input: ImageData): ImageData {
  const p = ctx.params;
  const color = Array.isArray(p.color) ? p.color : [1, 0, 0, 1]; // Red default
  const blendMode = Number(p.blendMode ?? 0); // Normal default
  const size = Math.max(1.0, Number(p.size ?? 3.0));
  const opacity = (Number(p.opacity ?? 100) / 100);
  const position = Number(p.position ?? 0); // 0=Outside, 1=Inside, 2=Center

  const w = input.width;
  const h = input.height;
  const src = input.data;
  const out = new ImageData(w, h);
  const outData = out.data;

  const alphaOnly = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    alphaOnly[i] = src[i * 4 + 3];
  }

  const { distInside, distOutside } = computeDistanceFields(alphaOnly, w, h);

  const strokeR = color[0] ?? 1;
  const strokeG = color[1] ?? 0;
  const strokeB = color[2] ?? 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const pi = i * 4;
      const origA = src[pi + 3] / 255;

      let strokeA = 0;

      if (position === 0) {
        // Outside stroke
        const d = distOutside[i];
        if (d <= size) {
          strokeA = Math.min(1.0, size - d + 0.5) * opacity;
          strokeA *= (1.0 - origA);
        }
      } else if (position === 1) {
        // Inside stroke
        const d = distInside[i];
        if (d <= size && origA > 0) {
          strokeA = Math.min(1.0, size - d + 0.5) * opacity * origA;
        }
      } else {
        // Center stroke (half size inside, half size outside)
        const half = size * 0.5;
        if (origA > 0.5) {
          const d = distInside[i];
          if (d <= half) strokeA = Math.min(1.0, half - d + 0.5) * opacity;
        } else {
          const d = distOutside[i];
          if (d <= half) strokeA = Math.min(1.0, half - d + 0.5) * opacity;
        }
      }

      if (origA <= 0 && strokeA <= 0) {
        outData[pi] = 0;
        outData[pi + 1] = 0;
        outData[pi + 2] = 0;
        outData[pi + 3] = 0;
        continue;
      }

      if (origA <= 0) {
        // Pure outside stroke
        outData[pi] = Math.round(strokeR * 255);
        outData[pi + 1] = Math.round(strokeG * 255);
        outData[pi + 2] = Math.round(strokeB * 255);
        outData[pi + 3] = Math.round(strokeA * 255);
        continue;
      }

      // Over original pixel
      const baseR = src[pi] / 255;
      const baseG = src[pi + 1] / 255;
      const baseB = src[pi + 2] / 255;

      if (strokeA <= 0) {
        outData[pi] = src[pi];
        outData[pi + 1] = src[pi + 1];
        outData[pi + 2] = src[pi + 2];
        outData[pi + 3] = src[pi + 3];
      } else {
        const blended = blendPhotoshop(blendMode, baseR, baseG, baseB, strokeR, strokeG, strokeB);
        outData[pi] = Math.round((baseR * (1 - strokeA) + blended[0] * strokeA) * 255);
        outData[pi + 1] = Math.round((baseG * (1 - strokeA) + blended[1] * strokeA) * 255);
        outData[pi + 2] = Math.round((baseB * (1 - strokeA) + blended[2] * strokeA) * 255);
        outData[pi + 3] = src[pi + 3];
      }
    }
  }

  return out;
}
