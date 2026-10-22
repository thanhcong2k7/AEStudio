/**
 * AEStudio - Channel Effects (8 effects)
 * Derived 1:1 from channel.rs
 */

import { EffectCtx } from './types';
import {
  luminance,
  rgbToHsl,
  hslToRgb,
  rgbToYuv,
  yuvToRgb,
  pickChannel,
  pickShiftChannel,
  blendSolid,
} from './color';

// 1. Set Channels (ec.channel.setchannels)
export function fxSetChannels(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const setRedTo = ctx.params.setRedTo ?? 0;
  const setGreenTo = ctx.params.setGreenTo ?? 1;
  const setBlueTo = ctx.params.setBlueTo ?? 2;
  const setAlphaTo = ctx.params.setAlphaTo ?? 3;

  // Source layers
  const l1 = ctx.params.sourceLayer1 ? ctx.env.getLayerPixels?.(ctx.params.sourceLayer1) : null;
  const l2 = ctx.params.sourceLayer2 ? ctx.env.getLayerPixels?.(ctx.params.sourceLayer2) : null;
  const l3 = ctx.params.sourceLayer3 ? ctx.env.getLayerPixels?.(ctx.params.sourceLayer3) : null;
  const l4 = ctx.params.sourceLayer4 ? ctx.env.getLayerPixels?.(ctx.params.sourceLayer4) : null;

  for (let i = 0; i < data.length; i += 4) {
    const rSelf = data[i] / 255;
    const gSelf = data[i + 1] / 255;
    const bSelf = data[i + 2] / 255;
    const aSelf = data[i + 3] / 255;

    const d1 = l1 ? l1.data : data;
    const d2 = l2 ? l2.data : data;
    const d3 = l3 ? l3.data : data;
    const d4 = l4 ? l4.data : data;

    const rVal = pickChannel(setRedTo, d1[i] / 255, d1[i + 1] / 255, d1[i + 2] / 255, d1[i + 3] / 255);
    const gVal = pickChannel(setGreenTo, d2[i] / 255, d2[i + 1] / 255, d2[i + 2] / 255, d2[i + 3] / 255);
    const bVal = pickChannel(setBlueTo, d3[i] / 255, d3[i + 1] / 255, d3[i + 2] / 255, d3[i + 3] / 255);
    const aVal = pickChannel(setAlphaTo, d4[i] / 255, d4[i + 1] / 255, d4[i + 2] / 255, d4[i + 3] / 255);

    outData[i] = Math.round(Math.max(0, Math.min(1, rVal)) * 255);
    outData[i + 1] = Math.round(Math.max(0, Math.min(1, gVal)) * 255);
    outData[i + 2] = Math.round(Math.max(0, Math.min(1, bVal)) * 255);
    outData[i + 3] = Math.round(Math.max(0, Math.min(1, aVal)) * 255);
  }
  return out;
}

// 2. Shift Channels (ec.channel.shiftchannels)
export function fxShiftChannels(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const takeRed = ctx.params.takeRedFrom ?? 1;
  const takeGreen = ctx.params.takeGreenFrom ?? 2;
  const takeBlue = ctx.params.takeBlueFrom ?? 3;
  const takeAlpha = ctx.params.takeAlphaFrom ?? 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3] / 255;

    const rVal = pickShiftChannel(takeRed, r, g, b, a);
    const gVal = pickShiftChannel(takeGreen, r, g, b, a);
    const bVal = pickShiftChannel(takeBlue, r, g, b, a);
    const aVal = pickShiftChannel(takeAlpha, r, g, b, a);

    outData[i] = Math.round(Math.max(0, Math.min(1, rVal)) * 255);
    outData[i + 1] = Math.round(Math.max(0, Math.min(1, gVal)) * 255);
    outData[i + 2] = Math.round(Math.max(0, Math.min(1, bVal)) * 255);
    outData[i + 3] = Math.round(Math.max(0, Math.min(1, aVal)) * 255);
  }
  return out;
}

// 3. Channel Combiner (ec.channel.combiner)
export function fxChannelCombiner(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const from = ctx.params.from ?? 8;
  const to = ctx.params.to ?? 4;
  const invert = ctx.params.invert ?? false;
  const solidAlpha = ctx.params.solidAlpha ?? false;

  const secLayer = (ctx.params.useSecondLayer && ctx.params.sourceLayer)
    ? ctx.env.getLayerPixels?.(ctx.params.sourceLayer)
    : null;
  const secData = secLayer ? secLayer.data : data;

  const iv = (v: number) => (invert ? 1.0 - v : v);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    let a = data[i + 3] / 255;

    const sr = secData[i] / 255;
    const sg = secData[i + 1] / 255;
    const sb = secData[i + 2] / 255;
    const sa = secData[i + 3] / 255;

    let outR = r;
    let outG = g;
    let outB = b;

    if (from <= 3) {
      let o: [number, number, number];
      if (from === 0) {
        // RGB to HLS
        const [h, s, l] = rgbToHsl(sr, sg, sb);
        o = [h, l, s];
      } else if (from === 1) {
        // HLS to RGB
        o = hslToRgb(sr, sb, sg);
      } else if (from === 2) {
        o = rgbToYuv(sr, sg, sb);
      } else {
        o = yuvToRgb(sr, sg, sb);
      }
      outR = iv(o[0]);
      outG = iv(o[1]);
      outB = iv(o[2]);
    } else {
      let v = 0;
      switch (from) {
        case 4: v = sr; break;
        case 5: v = sg; break;
        case 6: v = sb; break;
        case 7: v = sa; break;
        case 8: v = rgbToHsl(sr, sg, sb)[2]; break; // Lightness
        case 9: v = rgbToHsl(sr, sg, sb)[0]; break; // Hue
        case 10: v = rgbToHsl(sr, sg, sb)[1]; break; // Saturation
        case 11: v = luminance(sr, sg, sb); break;
        case 12: v = Math.max(sr, sg, sb); break;
        default: v = Math.min(sr, sg, sb); break;
      }
      v = iv(v);

      switch (to) {
        case 0: outR = v; outG = 0; outB = 0; break;
        case 1: outR = 0; outG = v; outB = 0; break;
        case 2: outR = 0; outG = 0; outB = v; break;
        case 3: a = Math.max(0, Math.min(1, v)); outR = 1; outG = 1; outB = 1; break;
        case 5: { // Hue only
          const [hr, hg, hb] = hslToRgb(v, 1.0, 0.5);
          outR = hr; outG = hg; outB = hb;
          break;
        }
        case 6: { // Saturation only
          const [sr2, sg2, sb2] = hslToRgb(0.0, Math.max(0, Math.min(1, v)), 0.5);
          outR = sr2; outG = sg2; outB = sb2;
          break;
        }
        case 8: { // Saturation multiplied
          const [h, s, l] = rgbToHsl(r, g, b);
          const [mr, mg, mb] = hslToRgb(h, Math.max(0, Math.min(1, s * v)), l);
          outR = mr; outG = mg; outB = mb;
          break;
        }
        default: // Grayscale or Lightness
          outR = v; outG = v; outB = v;
          break;
      }
    }

    if (solidAlpha) a = 1.0;

    outData[i] = Math.round(Math.max(0, Math.min(1, outR)) * 255);
    outData[i + 1] = Math.round(Math.max(0, Math.min(1, outG)) * 255);
    outData[i + 2] = Math.round(Math.max(0, Math.min(1, outB)) * 255);
    outData[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  return out;
}

// 4. Minimax (ec.channel.minimax)
export function fxMinimax(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const radius = Math.round(ctx.params.radius ?? 0);
  if (radius <= 0) return input;

  const op = ctx.params.operation ?? 1; // 0: Min, 1: Max, 2: Min then Max, 3: Max then Min
  const channel = ctx.params.channel ?? 0; // 0: Color, 1: Alpha, 2: Alpha & Color, 3: R, 4: G, 5: B
  const direction = ctx.params.direction ?? 0; // 0: H&V, 1: H only, 2: V only

  const rx = direction === 2 ? 0 : Math.min(width - 1, radius);
  const ry = direction === 1 ? 0 : Math.min(height - 1, radius);

  const sel = [
    channel === 0 || channel === 2 || channel === 3,
    channel === 0 || channel === 2 || channel === 4,
    channel === 0 || channel === 2 || channel === 5,
    channel === 1 || channel === 2,
  ];

  const morph1D = (
    src: Float32Array,
    dst: Float32Array,
    w: number,
    h: number,
    rad: number,
    isMax: boolean,
    horizontal: boolean
  ) => {
    if (rad <= 0) {
      dst.set(src);
      return;
    }
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;

    for (let o = 0; o < outer; o++) {
      const oOffset = horizontal ? o * w : o;
      const step = horizontal ? 1 : w;

      for (let i = 0; i < inner; i++) {
        let val = isMax ? -Infinity : Infinity;
        const start = Math.max(0, i - rad);
        const end = Math.min(inner - 1, i + rad);

        for (let k = start; k <= end; k++) {
          const v = src[oOffset + k * step];
          if (isMax) {
            if (v > val) val = v;
          } else {
            if (v < val) val = v;
          }
        }
        dst[oOffset + i * step] = val;
      }
    }
  };

  const applyMorph = (plane: Float32Array<any>, isMax: boolean): Float32Array<any> => {
    const temp = new Float32Array(width * height);
    const res = new Float32Array(width * height);
    if (rx > 0 && ry > 0) {
      morph1D(plane, temp, width, height, rx, isMax, true);
      morph1D(temp, res, width, height, ry, isMax, false);
      return res;
    } else if (rx > 0) {
      morph1D(plane, res, width, height, rx, isMax, true);
      return res;
    } else if (ry > 0) {
      morph1D(plane, res, width, height, ry, isMax, false);
      return res;
    }
    return plane;
  };

  const out = new ImageData(width, height);
  const outData = out.data;

  // Process 4 channels
  for (let c = 0; c < 4; c++) {
    const plane = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      plane[i] = data[i * 4 + c];
    }

    let processed: Float32Array<any> = plane;
    if (sel[c]) {
      if (op === 0) processed = applyMorph(plane, false); // Minimum
      else if (op === 1) processed = applyMorph(plane, true); // Maximum
      else if (op === 2) processed = applyMorph(applyMorph(plane, false), true); // Min then Max
      else if (op === 3) processed = applyMorph(applyMorph(plane, true), false); // Max then Min
    }

    for (let i = 0; i < width * height; i++) {
      outData[i * 4 + c] = Math.round(Math.max(0, Math.min(255, processed[i])));
    }
  }

  return out;
}

// 5. Arithmetic (ec.channel.arithmetic)
export function fxArithmetic(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const op = ctx.params.operator ?? 3; // 3 is Add
  const kr = (ctx.params.redValue ?? 0) / 255;
  const kg = (ctx.params.greenValue ?? 0) / 255;
  const kb = (ctx.params.blueValue ?? 0) / 255;
  const clip = ctx.params.clip ?? true;

  const applyOp = (v: number, k: number): number => {
    const iv = Math.round(v * 255);
    const ik = Math.round(k * 255);
    let r = 0;
    switch (op) {
      case 0: r = (iv & ik) / 255; break;
      case 1: r = (iv | ik) / 255; break;
      case 2: r = (iv ^ ik) / 255; break;
      case 3: r = v + k; break; // Add
      case 4: r = v - k; break; // Subtract
      case 5: r = Math.abs(v - k); break; // Difference
      case 6: r = Math.min(v, k); break;
      case 7: r = Math.max(v, k); break;
      case 8: r = v > k ? 0 : v; break;
      case 9: r = v < k ? 0 : v; break;
      case 10: r = v >= k ? 1 : 0; break;
      case 11: r = v * k; break;
      case 12: r = 1.0 - (1.0 - v) * (1.0 - k); break; // Screen
      default: r = v + k;
    }
    return clip ? Math.max(0, Math.min(1, r)) : Math.max(0, r);
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3];

    outData[i] = Math.round(applyOp(r, kr) * 255);
    outData[i + 1] = Math.round(applyOp(g, kg) * 255);
    outData[i + 2] = Math.round(applyOp(b, kb) * 255);
    outData[i + 3] = a;
  }
  return out;
}

// 6. Solid Composite (ec.channel.solidcomposite)
export function fxSolidComposite(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const so = (ctx.params.sourceOpacity ?? 100) / 100;
  const color = ctx.params.color || [1, 1, 1, 1];
  const opacity = ((ctx.params.opacity ?? 100) / 100) * (color[3] ?? 1.0);
  const mode = ctx.params.blendingMode ?? 0;

  for (let i = 0; i < data.length; i += 4) {
    const srcA = (data[i + 3] / 255) * so;
    const srcR = (data[i] / 255);
    const srcG = (data[i + 1] / 255);
    const srcB = (data[i + 2] / 255);

    const [blR, blG, blB] = blendSolid(mode, color[0], color[1], color[2], srcR, srcG, srcB);

    // Over solid
    const r = srcA * blR + (1.0 - srcA) * color[0];
    const g = srcA * blG + (1.0 - srcA) * color[1];
    const b = srcA * blB + (1.0 - srcA) * color[2];
    const a = Math.max(0, Math.min(1, opacity + srcA * (1.0 - opacity)));

    outData[i] = Math.round(Math.max(0, Math.min(1, r)) * 255);
    outData[i + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
    outData[i + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
    outData[i + 3] = Math.round(a * 255);
  }
  return out;
}

// 7. Remove Color Matting (ec.channel.removecolormatting)
export function fxRemoveColorMatting(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const bg = ctx.params.backgroundColor || [0, 0, 0, 1];
  const clipHdr = ctx.params.clipHdr ?? true;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a <= 1e-6) {
      outData[i] = 0;
      outData[i + 1] = 0;
      outData[i + 2] = 0;
      outData[i + 3] = 0;
      continue;
    }

    for (let c = 0; c < 3; c++) {
      const s = data[i + c] / 255;
      let v = Math.max(0, s - bg[c] * (1.0 - a));
      if (clipHdr) v = Math.min(a, v);
      outData[i + c] = Math.round(Math.max(0, Math.min(1, v / a)) * 255);
    }
    outData[i + 3] = data[i + 3];
  }
  return out;
}

// 8. Set Matte (ec.channel.setmatte)
export function fxSetMatte(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const takeMatteFrom = ctx.params.takeMatteFrom ?? 3; // Alpha
  const invertMatte = ctx.params.invertMatte ?? false;
  const compositeWithOrig = ctx.params.compositeMatteWithOriginal ?? true;
  const pre = ctx.params.premultiplyMatteLayer ?? true;

  const matteLayer = ctx.params.takeMatteFromLayer
    ? ctx.env.getLayerPixels?.(ctx.params.takeMatteFromLayer)
    : null;
  const mData = matteLayer ? matteLayer.data : data;

  for (let i = 0; i < data.length; i += 4) {
    const mr = mData[i] / 255;
    const mg = mData[i + 1] / 255;
    const mb = mData[i + 2] / 255;
    const ma = mData[i + 3] / 255;

    let mVal = pickChannel(takeMatteFrom, mr, mg, mb, ma);
    if (pre && takeMatteFrom !== 3 && takeMatteFrom !== 8 && takeMatteFrom !== 10) {
      mVal *= ma;
    }
    mVal = Math.max(0, Math.min(1, mVal));
    if (invertMatte) mVal = 1.0 - mVal;

    const origA = data[i + 3] / 255;
    const newA = compositeWithOrig ? origA * mVal : mVal;

    outData[i] = data[i];
    outData[i + 1] = data[i + 1];
    outData[i + 2] = data[i + 2];
    outData[i + 3] = Math.round(Math.max(0, Math.min(1, newA)) * 255);
  }
  return out;
}
