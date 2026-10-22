/**
 * AEStudio - Color conversion and blending routines
 * Derived 1:1 from _color_lib.rs, _color_blend.rs, and util.rs
 */

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (Math.abs(max - min) < 1e-7) {
    return [0.0, 0.0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6.0 : 0.0)) / 6.0;
  } else if (max === g) {
    h = ((b - r) / d + 2.0) / 6.0;
  } else {
    h = ((r - g) / d + 4.0) / 6.0;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s <= 0.0) {
    return [l, l, l];
  }
  const q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  const p = 2.0 * l - q;
  const f = (t: number) => {
    let tNorm = ((t % 1.0) + 1.0) % 1.0;
    if (tNorm < 1.0 / 6.0) return p + (q - p) * 6.0 * tNorm;
    if (tNorm < 0.5) return q;
    if (tNorm < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - tNorm) * 6.0;
    return p;
  };
  return [f(h + 1.0 / 3.0), f(h), f(h - 1.0 / 3.0)];
}

export function rgbToYuv(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return [y, 0.492 * (b - y) + 0.5, 0.877 * (r - y) + 0.5];
}

export function yuvToRgb(y: number, u: number, v: number): [number, number, number] {
  const uShift = u - 0.5;
  const vShift = v - 0.5;
  const r = y + vShift / 0.877;
  const b = y + uShift / 0.492;
  const g = (y - 0.299 * r - 0.114 * b) / 0.587;
  return [r, g, b];
}

// Channel picking from util.rs:
// Red(0), Green(1), Blue(2), Alpha(3), Luminance(4), Hue(5), Lightness(6), Saturation(7), Full(8), Half(9), Off(10)
export function pickChannel(srcIdx: number, r: number, g: number, b: number, a: number): number {
  switch (srcIdx) {
    case 0: return r;
    case 1: return g;
    case 2: return b;
    case 3: return a;
    case 4: return luminance(r, g, b);
    case 5: return rgbToHsl(r, g, b)[0];
    case 6: return rgbToHsl(r, g, b)[2];
    case 7: return rgbToHsl(r, g, b)[1];
    case 8: return 1.0;
    case 9: return 0.5;
    case 10: return 0.0;
    default: return r;
  }
}

// Shift Channels order: Alpha(0), Red(1), Green(2), Blue(3), Luminance(4), Hue(5), Lightness(6), Saturation(7), Full On(8), Half On(9), Full Off(10)
export function pickShiftChannel(srcIdx: number, r: number, g: number, b: number, a: number): number {
  switch (srcIdx) {
    case 0: return a;
    case 1: return r;
    case 2: return g;
    case 3: return b;
    case 4: return luminance(r, g, b);
    case 5: return rgbToHsl(r, g, b)[0];
    case 6: return rgbToHsl(r, g, b)[2];
    case 7: return rgbToHsl(r, g, b)[1];
    case 8: return 1.0;
    case 9: return 0.5;
    case 10: return 0.0;
    default: return a;
  }
}

// Solid composite blend modes matching SOLID_MODES in channel.rs
export function blendSolid(
  mode: number,
  baseR: number, baseG: number, baseB: number,
  srcR: number, srcG: number, srcB: number
): [number, number, number] {
  switch (mode) {
    case 1: // Add
      return [baseR + srcR, baseG + srcG, baseB + srcB];
    case 2: // Multiply
      return [baseR * srcR, baseG * srcG, baseB * srcB];
    case 3: // Screen
      return [
        baseR + srcR - baseR * srcR,
        baseG + srcG - baseG * srcG,
        baseB + srcB - baseB * srcB,
      ];
    case 4: { // Overlay
      const hardLight = (cb: number, cs: number) =>
        cs <= 0.5 ? cb * 2.0 * cs : cb + (2.0 * cs - 1.0) - cb * (2.0 * cs - 1.0);
      return [hardLight(baseR, srcR), hardLight(baseG, srcG), hardLight(baseB, srcB)];
    }
    case 5: { // Soft Light
      const sl = (cb: number, cs: number) => {
        if (cs <= 0.5) {
          return cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
        }
        const d = cb <= 0.25 ? ((16.0 * cb - 12.0) * cb + 4.0) * cb : Math.sqrt(Math.max(0, cb));
        return cb + (2.0 * cs - 1.0) * (d - cb);
      };
      return [sl(baseR, srcR), sl(baseG, srcG), sl(baseB, srcB)];
    }
    case 6: { // Hard Light
      const hl = (cb: number, cs: number) =>
        cs <= 0.5 ? cb * 2.0 * cs : cb + (2.0 * cs - 1.0) - cb * (2.0 * cs - 1.0);
      return [hl(srcR, baseR), hl(srcG, baseG), hl(srcB, baseB)];
    }
    case 7: // Darken
      return [Math.min(baseR, srcR), Math.min(baseG, srcG), Math.min(baseB, srcB)];
    case 8: // Lighten
      return [Math.max(baseR, srcR), Math.max(baseG, srcG), Math.max(baseB, srcB)];
    case 9: // Difference
      return [Math.abs(baseR - srcR), Math.abs(baseG - srcG), Math.abs(baseB - srcB)];
    case 10: { // Color
      const hslS = rgbToHsl(srcR, srcG, srcB);
      const hslB = rgbToHsl(baseR, baseG, baseB);
      return hslToRgb(hslS[0], hslS[1], hslB[2]);
    }
    case 11: { // Luminosity
      const hslS = rgbToHsl(srcR, srcG, srcB);
      const hslB = rgbToHsl(baseR, baseG, baseB);
      return hslToRgb(hslB[0], hslB[1], hslS[2]);
    }
    case 0: // Normal
    default:
      return [srcR, srcG, srcB];
  }
}

export const STYLE_BLEND_MODES = [
  'Normal',
  'Dissolve',
  'Darken',
  'Multiply',
  'Color Burn',
  'Linear Burn',
  'Darker Color',
  'Lighten',
  'Screen',
  'Color Dodge',
  'Linear Dodge (Add)',
  'Lighter Color',
  'Overlay',
  'Soft Light',
  'Hard Light',
  'Vivid Light',
  'Linear Light',
  'Pin Light',
  'Hard Mix',
  'Difference',
  'Exclusion',
  'Subtract',
  'Divide',
  'Hue',
  'Saturation',
  'Color',
  'Luminosity',
];

function burnVal(cb: number, cs: number): number {
  if (cb >= 1.0) return 1.0;
  if (cs <= 0.0) return 0.0;
  return 1.0 - Math.min(1.0, (1.0 - cb) / cs);
}

function dodgeVal(cb: number, cs: number): number {
  if (cb <= 0.0) return 0.0;
  if (cs >= 1.0) return 1.0;
  return Math.min(1.0, cb / (1.0 - cs));
}

function hardLightVal(cb: number, cs: number): number {
  if (cs <= 0.5) return cb * 2.0 * cs;
  const s = 2.0 * cs - 1.0;
  return cb + s - cb * s;
}

function softLightVal(cb: number, cs: number): number {
  if (cs <= 0.5) {
    return cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  }
  const d = cb <= 0.25 ? ((16.0 * cb - 12.0) * cb + 4.0) * cb : Math.sqrt(Math.max(0, cb));
  return cb + (2.0 * cs - 1.0) * (d - cb);
}

function vividLightVal(cb: number, cs: number): number {
  return cs <= 0.5 ? burnVal(cb, 2.0 * cs) : dodgeVal(cb, 2.0 * (cs - 0.5));
}

/**
 * Blend modes for Layer Styles (derived 1:1 from styles.rs and _color_blend.rs)
 */
export function blendPhotoshop(
  mode: number,
  cbR: number, cbG: number, cbB: number,
  csR: number, csG: number, csB: number
): [number, number, number] {
  switch (mode) {
    case 0: // Normal
      return [csR, csG, csB];
    case 1: // Dissolve (per-pixel noise handled externally or pass-through)
      return [csR, csG, csB];
    case 2: // Darken
      return [Math.min(cbR, csR), Math.min(cbG, csG), Math.min(cbB, csB)];
    case 3: // Multiply
      return [cbR * csR, cbG * csG, cbB * csB];
    case 4: // Color Burn
      return [burnVal(cbR, csR), burnVal(cbG, csG), burnVal(cbB, csB)];
    case 5: // Linear Burn
      return [
        Math.max(0, cbR + csR - 1.0),
        Math.max(0, cbG + csG - 1.0),
        Math.max(0, cbB + csB - 1.0),
      ];
    case 6: { // Darker Color
      const lSrc = luminance(csR, csG, csB);
      const lBase = luminance(cbR, cbG, cbB);
      return lSrc < lBase ? [csR, csG, csB] : [cbR, cbG, cbB];
    }
    case 7: // Lighten
      return [Math.max(cbR, csR), Math.max(cbG, csG), Math.max(cbB, csB)];
    case 8: // Screen
      return [
        cbR + csR - cbR * csR,
        cbG + csG - cbG * csG,
        cbB + csB - cbB * csB,
      ];
    case 9: // Color Dodge
      return [dodgeVal(cbR, csR), dodgeVal(cbG, csG), dodgeVal(cbB, csB)];
    case 10: // Linear Dodge (Add)
      return [cbR + csR, cbG + csG, cbB + csB];
    case 11: { // Lighter Color
      const lSrc = luminance(csR, csG, csB);
      const lBase = luminance(cbR, cbG, cbB);
      return lSrc > lBase ? [csR, csG, csB] : [cbR, cbG, cbB];
    }
    case 12: // Overlay
      return [hardLightVal(csR, cbR), hardLightVal(csG, cbG), hardLightVal(csB, cbB)];
    case 13: // Soft Light
      return [softLightVal(cbR, csR), softLightVal(cbG, csG), softLightVal(cbB, csB)];
    case 14: // Hard Light
      return [hardLightVal(cbR, csR), hardLightVal(cbG, csG), hardLightVal(cbB, csB)];
    case 15: // Vivid Light
      return [vividLightVal(cbR, csR), vividLightVal(cbG, csG), vividLightVal(cbB, csB)];
    case 16: // Linear Light
      return [
        Math.min(1.0, Math.max(0, cbR + 2.0 * csR - 1.0)),
        Math.min(1.0, Math.max(0, cbG + 2.0 * csG - 1.0)),
        Math.min(1.0, Math.max(0, cbB + 2.0 * csB - 1.0)),
      ];
    case 17: // Pin Light
      return [
        csR <= 0.5 ? Math.min(cbR, 2.0 * csR) : Math.max(cbR, 2.0 * csR - 1.0),
        csG <= 0.5 ? Math.min(cbG, 2.0 * csG) : Math.max(cbG, 2.0 * csG - 1.0),
        csB <= 0.5 ? Math.min(cbB, 2.0 * csB) : Math.max(cbB, 2.0 * csB - 1.0),
      ];
    case 18: // Hard Mix
      return [
        cbR + csR >= 1.0 ? 1.0 : 0.0,
        cbG + csG >= 1.0 ? 1.0 : 0.0,
        cbB + csB >= 1.0 ? 1.0 : 0.0,
      ];
    case 19: // Difference
      return [Math.abs(cbR - csR), Math.abs(cbG - csG), Math.abs(cbB - csB)];
    case 20: // Exclusion
      return [
        cbR + csR - 2.0 * cbR * csR,
        cbG + csG - 2.0 * cbG * csG,
        cbB + csB - 2.0 * cbB * csB,
      ];
    case 21: // Subtract
      return [Math.max(0, cbR - csR), Math.max(0, cbG - csG), Math.max(0, cbB - csB)];
    case 22: // Divide
      return [
        csR <= 0 ? (cbR > 0 ? 1.0 : 0.0) : Math.min(1.0, cbR / csR),
        csG <= 0 ? (cbG > 0 ? 1.0 : 0.0) : Math.min(1.0, cbG / csG),
        csB <= 0 ? (cbB > 0 ? 1.0 : 0.0) : Math.min(1.0, cbB / csB),
      ];
    case 23: { // Hue
      const hslS = rgbToHsl(csR, csG, csB);
      const hslB = rgbToHsl(cbR, cbG, cbB);
      return hslToRgb(hslS[0], hslB[1], hslB[2]);
    }
    case 24: { // Saturation
      const hslS = rgbToHsl(csR, csG, csB);
      const hslB = rgbToHsl(cbR, cbG, cbB);
      return hslToRgb(hslB[0], hslS[1], hslB[2]);
    }
    case 25: { // Color
      const hslS = rgbToHsl(csR, csG, csB);
      const hslB = rgbToHsl(cbR, cbG, cbB);
      return hslToRgb(hslS[0], hslS[1], hslB[2]);
    }
    case 26: { // Luminosity
      const hslS = rgbToHsl(csR, csG, csB);
      const hslB = rgbToHsl(cbR, cbG, cbB);
      return hslToRgb(hslB[0], hslB[1], hslS[2]);
    }
    default:
      return [csR, csG, csB];
  }
}
