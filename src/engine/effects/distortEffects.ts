/**
 * AEStudio - Distort Effects (10 effects)
 * Derived 1:1 from distort.rs
 */

import { EffectCtx } from './types';
import { sampleBilinear, hash1, Mat3 } from './geom';

// Helper for inverse-mapped resample
function remap(
  input: ImageData,
  f: (x: number, y: number) => [number, number],
  clamp: boolean = false
): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const [sx, sy] = f(x + 0.5, y + 0.5);
      const [r, g, b, a] = sampleBilinear(data, width, height, sx - 0.5, sy - 0.5, clamp);
      const idx = rowOffset + x * 4;
      outData[idx] = Math.round(r);
      outData[idx + 1] = Math.round(g);
      outData[idx + 2] = Math.round(b);
      outData[idx + 3] = Math.round(a);
    }
  }
  return out;
}

// 1. Twirl (ec.distort.twirl)
export function fxTwirl(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const angle = ((ctx.params.angle ?? 0) * Math.PI) / 180;
  const radiusPct = (ctx.params.radius ?? 30) / 100;
  const r = Math.max(1, radiusPct * Math.max(width, height));
  const center = ctx.params.center || [0.5, 0.5];
  const cx = center[0] * width;
  const cy = center[1] * height;

  return remap(input, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r) return [x, y];
    const t = 1.0 - d / r;
    const a = -angle * t * t;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    return [cx + dx * cosA - dy * sinA, cy + dx * sinA + dy * cosA];
  });
}

// 2. Spherize (ec.distort.spherize)
export function fxSpherize(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const r = Math.max(1, ctx.params.radius ?? (Math.min(width, height) * 0.4));
  const center = ctx.params.center || [0.5, 0.5];
  const cx = center[0] * width;
  const cy = center[1] * height;

  return remap(input, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r || d === 0) return [x, y];
    const nd = d / r;
    const k = Math.asin(nd) / (Math.PI / 2) / nd;
    return [cx + dx * k, cy + dy * k];
  });
}

// 3. Bulge (ec.distort.bulge)
export function fxBulge(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const rx = Math.max(1, ctx.params.hradius ?? 50);
  const ry = Math.max(1, ctx.params.vradius ?? 50);
  const center = ctx.params.center || [0.5, 0.5];
  const cx = center[0] * width;
  const cy = center[1] * height;
  const h = ctx.params.height ?? 1.0;
  const taper = 1.0 + Math.max(0, ctx.params.taperRadius ?? 0) / 100.0 * 3.0;
  const pin = ctx.params.pinAllEdges ?? false;

  return remap(input, (x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const d2 = dx * dx + dy * dy;
    if (d2 >= 1.0) return [x, y];
    let amt = h * Math.pow(1.0 - d2, taper) * 0.5;
    if (pin) {
      const edge = Math.max(1, Math.min(width, height) * 0.1);
      const ex = Math.max(0, Math.min(1, Math.min(x, width - x) / edge));
      const ey = Math.max(0, Math.min(1, Math.min(y, height - y) / edge));
      amt *= Math.min(ex, ey);
    }
    const k = 1.0 - amt;
    return [cx + dx * rx * k, cy + dy * ry * k];
  });
}

// Wave shapes helper
function waveShape(kind: number, t: number, seed: number): number {
  const tau = Math.PI * 2;
  const ph = (((t % tau) + tau) % tau) / tau;
  const half = (u: number) => Math.sqrt(Math.max(0, 1.0 - Math.pow(2.0 * u - 1.0, 2)));
  const noise = (i: number) => hash1(Math.floor(i), 0x5eed, seed) * 2.0 - 1.0;

  switch (kind) {
    case 1: // Square
      return ph < 0.5 ? 1.0 : -1.0;
    case 2: // Triangle
      return 1.0 - 4.0 * Math.abs(ph - 0.5);
    case 3: // Sawtooth
      return 2.0 * ph - 1.0;
    case 4: // Circle
      return ph < 0.5 ? half(ph * 2.0) : -half(ph * 2.0 - 1.0);
    case 5: // Semicircle
      return 2.0 * half((ph * 2.0) % 1.0) - 1.0;
    case 6: // Uncircle
      return 1.0 - 2.0 * half((ph * 2.0) % 1.0);
    case 7: // Noise
      return noise(Math.floor((t / tau) * 2.0));
    case 8: { // Smooth Noise
      const u = (t / tau) * 2.0;
      const i = Math.floor(u);
      const f = u - i;
      const s = f * f * (3.0 - 2.0 * f);
      return noise(i) * (1.0 - s) + noise(i + 1.0) * s;
    }
    case 0: // Sine
    default:
      return Math.sin(t);
  }
}

// 4. Wave Warp (ec.distort.wavewarp)
export function fxWaveWarp(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const h = ctx.params.height ?? 10;
  const w = Math.max(1, ctx.params.width ?? 40);
  const dir = ((ctx.params.direction ?? 90) * Math.PI) / 180;
  const speed = ctx.params.speed ?? 1.0;
  const phase = ((ctx.params.phase ?? 0) * Math.PI) / 180 + ctx.time * speed * Math.PI * 2;
  const kind = ctx.params.waveType ?? 0;
  const pin = ctx.params.pinning ?? 0;
  const seed = (ctx.seed ^ 0x3a7e) >>> 0;

  const dx = Math.sin(dir);
  const dy = -Math.cos(dir);

  const wavePinWeight = (x: number, y: number): number => {
    const u = Math.max(0, Math.min(1, x / width));
    const v = Math.max(0, Math.min(1, y / height));
    const horiz = Math.max(0, Math.min(1, Math.min(v, 1.0 - v) * 2.0));
    const vert = Math.max(0, Math.min(1, Math.min(u, 1.0 - u) * 2.0));
    switch (pin) {
      case 1: return Math.min(horiz, vert); // All Edges
      case 2: return Math.min(1.0, Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2.0); // Center
      case 3: return u; // Left Edge pinned
      case 4: return v; // Top Edge pinned
      case 5: return 1.0 - u; // Right Edge pinned
      case 6: return 1.0 - v; // Bottom Edge pinned
      case 7: return horiz; // Horizontal Edges pinned
      case 8: return vert; // Vertical Edges pinned
      default: return 1.0; // None
    }
  };

  return remap(input, (x, y) => {
    const along = x * dx + y * dy;
    const disp = waveShape(kind, (along / w) * Math.PI * 2 + phase, seed) * h * wavePinWeight(x, y);
    return [x + dy * disp, y - dx * disp];
  });
}

// 5. Ripple (ec.distort.ripple)
export function fxRipple(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const radiusPct = (ctx.params.radius ?? 50) / 100;
  const r = Math.max(1, radiusPct * Math.max(width, height) * 0.5);
  const asymmetric = (ctx.params.conversion ?? 0) === 0;
  const center = ctx.params.center || [0.5, 0.5];
  const cx = center[0] * width;
  const cy = center[1] * height;
  const w = Math.max(1, ctx.params.waveWidth ?? 20);
  const h = ctx.params.waveHeight ?? 10;
  const speed = ctx.params.speed ?? 1.0;
  const phase = ((ctx.params.phase ?? 0) * Math.PI) / 180 - ctx.time * speed * Math.PI * 2;

  return remap(input, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r || d === 0) return [x, y];
    const fall = 1.0 - d / r;
    const arg = (d / w) * Math.PI * 2 + phase;
    const o = Math.sin(arg) * h * fall;
    const t = asymmetric ? Math.cos(arg) * h * fall * 0.5 : 0.0;
    const ux = dx / d;
    const uy = dy / d;
    return [x + ux * o - uy * t, y + uy * o + ux * t];
  });
}

// 6. Mirror (ec.distort.mirror)
export function fxMirror(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const center = ctx.params.center || [0.5, 0.5];
  const cx = center[0] * width;
  const cy = center[1] * height;
  const a = ((ctx.params.angle ?? 0) * Math.PI) / 180;
  const nx = Math.cos(a);
  const ny = Math.sin(a);

  return remap(input, (x, y) => {
    const d = (x - cx) * nx + (y - cy) * ny;
    if (d > 0.0) {
      return [x - 2.0 * d * nx, y - 2.0 * d * ny];
    }
    return [x, y];
  });
}

// 7. Offset (ec.distort.offset)
export function fxOffset(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const shift = ctx.params.shift || [0.5, 0.5];
  const sx = shift[0] * width;
  const sy = shift[1] * height;
  const blend = (ctx.params.blend ?? 0) / 100.0;

  const cx = width / 2;
  const cy = height / 2;

  const shifted = remap(input, (x, y) => [
    (((x - (sx - cx)) % width) + width) % width,
    (((y - (sy - cy)) % height) + height) % height,
  ]);

  if (blend > 0) {
    const outData = shifted.data;
    for (let i = 0; i < data.length; i += 4) {
      outData[i] = Math.round(outData[i] * (1 - blend) + data[i] * blend);
      outData[i + 1] = Math.round(outData[i + 1] * (1 - blend) + data[i + 1] * blend);
      outData[i + 2] = Math.round(outData[i + 2] * (1 - blend) + data[i + 2] * blend);
      outData[i + 3] = Math.round(outData[i + 3] * (1 - blend) + data[i + 3] * blend);
    }
  }

  return shifted;
}

// 8. Polar Coordinates (ec.distort.polar)
export function fxPolarCoordinates(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const amt = (ctx.params.interpolation ?? 0) / 100.0;
  if (amt <= 0.0) return input;
  const toPolar = (ctx.params.conversion ?? 0) === 1; // 0: Rect to Polar, 1: Polar to Rect

  const cx = width / 2.0;
  const cy = height / 2.0;
  const rmax = Math.min(cx, cy);

  return remap(
    input,
    (x, y) => {
      let px = x;
      let py = y;
      if (toPolar) {
        const dx = x - cx;
        const dy = y - cy;
        const a = (((Math.atan2(dx, -dy) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        const r = Math.sqrt(dx * dx + dy * dy) / rmax;
        px = (a / (Math.PI * 2)) * width;
        py = height - r * height;
      } else {
        const a = (x / width) * Math.PI * 2;
        const r = ((height - y) / height) * rmax;
        px = cx + r * Math.sin(a);
        py = cy - r * Math.cos(a);
      }
      return [x + (px - x) * amt, y + (py - y) * amt];
    },
    true
  );
}

// 9. Transform (ec.distort.transform)
export function fxTransform(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const anchor = ctx.params.anchor || [0.5, 0.5];
  const pos = ctx.params.position || [0.5, 0.5];
  const ax = anchor[0] * width;
  const ay = anchor[1] * height;
  const px = pos[0] * width;
  const py = pos[1] * height;

  const uniform = ctx.params.uniform ?? true;
  const sh = ctx.params.scaleHeight ?? 100;
  const sw = uniform ? sh : (ctx.params.scaleWidth ?? 100);
  const skew = ctx.params.skew ?? 0;
  const skewAxis = ctx.params.skewAxis ?? 0;
  const rot = ctx.params.rotation ?? 0;
  const opacity = (ctx.params.opacity ?? 100) / 100;

  // Forward matrix: T(pos) * R(rot) * Skew * S * T(-anchor)
  const m = Mat3.translate(px, py)
    .multiply(Mat3.rotateDeg(rot))
    .multiply(Mat3.skewDeg(skew, skewAxis))
    .multiply(Mat3.scale(sw / 100, sh / 100))
    .multiply(Mat3.translate(-ax, -ay));

  const invM = m.inverse();
  if (!invM) return input;

  const out = remap(input, (x, y) => invM.apply(x, y));
  if (opacity < 1.0) {
    const d = out.data;
    for (let i = 3; i < d.length; i += 4) {
      d[i] = Math.round(d[i] * opacity);
    }
  }
  return out;
}

// 10. Corner Pin (ec.distort.cornerpin)
export function fxCornerPin(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const ul = ctx.params.ul || [0, 0];
  const ur = ctx.params.ur || [1, 0];
  const lr = ctx.params.lr || [1, 1];
  const ll = ctx.params.ll || [0, 1];

  const q: [number, number][] = [
    [ul[0] * width, ul[1] * height],
    [ur[0] * width, ur[1] * height],
    [lr[0] * width, lr[1] * height],
    [ll[0] * width, ll[1] * height],
  ];

  const quad = Mat3.squareToQuad(q);
  // Scale from layer pixels to unit square: S(1/w, 1/h)
  const fullM = quad.multiply(Mat3.scale(1.0 / width, 1.0 / height));
  const invM = fullM.inverse();
  if (!invM) return input;

  return remap(input, (x, y) => invM.apply(x, y));
}
