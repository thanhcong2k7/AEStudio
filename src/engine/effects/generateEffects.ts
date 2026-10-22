/**
 * AEStudio - Generate Effects (11 effects)
 * Derived 1:1 from generate3.rs
 */

import { EffectCtx } from './types';
import { hslToRgb, rgbToHsl, luminance } from './color';
import { hash1, sampleBilinear } from './geom';
import { computeFftMagnitudes } from './fft';

// 1. Fractal (ec.generate.fractal)
export function fxFractal(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const setChoice = ctx.params.setChoice ?? 0; // 0: Mandelbrot, 4: Julia, etc.
  const power = 2 + Math.min(2, ctx.params.equation ?? 0);
  const mcX = ctx.params['mandelbrot/mandelbrotX'] ?? -0.74;
  const mcY = ctx.params['mandelbrot/mandelbrotY'] ?? 0.15;
  const mmag = ctx.params['mandelbrot/mandelbrotMagnification'] ?? 0.0;
  const mlim = Math.max(1.01, ctx.params['mandelbrot/mandelbrotEscapeLimit'] ?? 4.0);

  const jcX = ctx.params['julia/juliaX'] ?? 0.0;
  const jcY = ctx.params['julia/juliaY'] ?? 0.0;
  const jmag = ctx.params['julia/juliaMagnification'] ?? 0.0;
  const jlim = Math.max(1.01, ctx.params['julia/juliaEscapeLimit'] ?? 4.0);

  const isJulia = setChoice === 4 || setChoice === 5;
  const isInverse = setChoice === 1 || setChoice === 3 || setChoice === 5;
  const isOverJulia = setChoice === 2 || setChoice === 3;

  const overlay = ctx.params['fractalColor/overlay'] ?? false;
  const transparency = ctx.params['fractalColor/transparency'] ?? false;
  const palette = ctx.params['fractalColor/palette'] ?? 0;
  const hue = ((ctx.params['fractalColor/hue'] ?? 0) / 360.0) % 1.0;
  const steps = Math.max(1, ctx.params['fractalColor/cycleSteps'] ?? 32.0);
  const cycOff = (ctx.params['fractalColor/cycleOffset'] ?? 0) / 360.0;
  const edge = ctx.params['fractalColor/edgeHighlight'] ?? false;

  const mag = isJulia ? jmag : mmag;
  const span = 3.5 / Math.pow(2.0, mag);
  const lim = isJulia ? jlim : mlim;
  const lim2 = lim * lim;
  const maxIter = Math.min(500, Math.floor(96 + 48 * Math.max(0, mag)));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      let u = ((x - width * 0.5) / width) * span + (isJulia ? jcX : mcX);
      let v = ((y - height * 0.5) / width) * span + (isJulia ? jcY : mcY);

      if (isInverse) {
        const d = Math.max(1e-12, u * u + v * v);
        u = u / d;
        v = -v / d;
      }

      let zx = isJulia ? u : isOverJulia ? jcX : 0.0;
      let zy = isJulia ? v : isOverJulia ? jcY : 0.0;
      const cx = isJulia ? mcX : u;
      const cy = isJulia ? mcY : v;

      let escapeCount: number | null = null;
      for (let i = 0; i < maxIter; i++) {
        let nx = 0;
        let ny = 0;
        if (power === 3) {
          nx = zx * zx * zx - 3.0 * zx * zy * zy;
          ny = 3.0 * zx * zx * zy - zy * zy * zy;
        } else if (power === 4) {
          const a = zx * zx - zy * zy;
          const b = 2.0 * zx * zy;
          nx = a * a - b * b;
          ny = 2.0 * a * b;
        } else {
          nx = zx * zx - zy * zy;
          ny = 2.0 * zx * zy;
        }

        zx = nx + cx;
        zy = ny + cy;
        const m2 = zx * zx + zy * zy;
        if (m2 > lim2) {
          const lz = Math.log(m2) * 0.5;
          const nu = Math.log(Math.max(1e-9, lz / Math.log(lim))) / Math.log(power);
          escapeCount = Math.max(0, i + 1.0 - nu);
          break;
        }
      }

      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 1.0;

      if (palette === 3) {
        // Solid Color
        const [sr, sg, sb] = hslToRgb(hue, 1.0, 0.5);
        const inside = escapeCount === null;
        const visible = inside !== transparency;
        pr = sr; pg = sg; pb = sb;
        pa = visible ? 1.0 : 0.0;
      } else if (escapeCount === null) {
        pa = transparency || overlay ? 0.0 : 1.0;
      } else {
        const bandVal = ((escapeCount / steps + cycOff) % 1.0 + 1.0) % 1.0;
        if (palette === 1) {
          // Hue Wheel
          const [hr, hg, hb] = hslToRgb((hue + bandVal) % 1.0, 1.0, 0.5);
          pr = hr; pg = hg; pb = hb;
        } else if (palette === 2) {
          // Black And White
          const bw = Math.floor(escapeCount / steps + cycOff) % 2 === 0 ? 0 : 1;
          pr = bw; pg = bw; pb = bw;
        } else {
          // Lightness Gradient
          const [lr, lg, lb] = hslToRgb(hue, 0.85, bandVal);
          pr = lr; pg = lg; pb = lb;
        }

        if (edge && (escapeCount % 1.0) < 0.12) {
          pr = pr * 0.4 + 0.6;
          pg = pg * 0.4 + 0.6;
          pb = pb * 0.4 + 0.6;
        }
      }

      const idx = rowOffset + x * 4;
      if (overlay) {
        const origA = data[idx + 3] / 255;
        const rComp = pr * pa + (data[idx] / 255) * (1 - pa);
        const gComp = pg * pa + (data[idx + 1] / 255) * (1 - pa);
        const bComp = pb * pa + (data[idx + 2] / 255) * (1 - pa);
        outData[idx] = Math.round(rComp * 255);
        outData[idx + 1] = Math.round(gComp * 255);
        outData[idx + 2] = Math.round(bComp * 255);
        outData[idx + 3] = Math.round(Math.max(origA, pa) * 255);
      } else {
        outData[idx] = Math.round(pr * 255);
        outData[idx + 1] = Math.round(pg * 255);
        outData[idx + 2] = Math.round(pb * 255);
        outData[idx + 3] = Math.round(pa * 255);
      }
    }
  }
  return out;
}

// 2. Scribble (ec.generate.scribble)
export function fxScribble(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  const composite = ctx.params.composite ?? 1; // 0: On Orig, 1: On Transparent, 2: Reveal Orig
  if (composite === 0) {
    c2d.putImageData(input, 0, 0);
  }

  const col = ctx.params.color || [1, 0, 0, 1];
  const opacity = (ctx.params.opacity ?? 100) / 100 * (col[3] ?? 1);
  const strokeWidth = ctx.params.strokeWidth ?? 2;
  const angle = ((ctx.params.angle ?? 45) * Math.PI) / 180;
  const spacing = Math.max(2, ctx.params['strokeOptions/spacing'] ?? 5);
  const curviness = (ctx.params['strokeOptions/curviness'] ?? 50) / 100;
  const wps = ctx.params.wigglesPerSecond ?? 5;
  const seed = (ctx.seed ^ Math.floor(ctx.time * wps)) >>> 0;

  c2d.strokeStyle = `rgba(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)}, ${opacity})`;
  c2d.lineWidth = strokeWidth;
  c2d.lineCap = 'round';
  c2d.lineJoin = 'round';

  c2d.save();
  c2d.translate(width / 2, height / 2);
  c2d.rotate(angle);

  const diag = Math.sqrt(width * width + height * height);
  const halfDiag = diag / 2;

  c2d.beginPath();
  let toggle = false;
  for (let y = -halfDiag; y <= halfDiag; y += spacing) {
    const xLeft = -halfDiag + (hash1(y, 1, seed) - 0.5) * spacing * curviness;
    const xRight = halfDiag + (hash1(y, 2, seed) - 0.5) * spacing * curviness;
    if (!toggle) {
      c2d.moveTo(xLeft, y);
      c2d.lineTo(xRight, y);
    } else {
      c2d.moveTo(xRight, y);
      c2d.lineTo(xLeft, y);
    }
    toggle = !toggle;
  }
  c2d.stroke();
  c2d.restore();

  if (composite === 2) {
    // Reveal original
    const scribbleImg = c2d.getImageData(0, 0, width, height);
    const sData = scribbleImg.data;
    const inData = input.data;
    for (let i = 0; i < inData.length; i += 4) {
      const a = (sData[i + 3] / 255) * (inData[i + 3] / 255);
      sData[i] = inData[i];
      sData[i + 1] = inData[i + 1];
      sData[i + 2] = inData[i + 2];
      sData[i + 3] = Math.round(a * 255);
    }
    return scribbleImg;
  }

  return c2d.getImageData(0, 0, width, height);
}

// 3. Stroke (ec.generate.stroke)
export function fxStroke(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  const paintStyle = ctx.params.paintStyle ?? 0;
  if (paintStyle === 0) {
    c2d.putImageData(input, 0, 0);
  }

  const col = ctx.params.color || [1, 1, 1, 1];
  const opacity = (ctx.params.opacity ?? 100) / 100 * (col[3] ?? 1);
  const brushSize = ctx.params.brushSize ?? 2;
  const start = (ctx.params.start ?? 0) / 100;
  const end = (ctx.params.end ?? 100) / 100;

  c2d.strokeStyle = `rgba(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)}, ${opacity})`;
  c2d.lineWidth = brushSize;
  c2d.lineCap = 'round';
  c2d.lineJoin = 'round';

  const masks = ctx.env.masks;
  if (masks && masks.length > 0) {
    for (const mask of masks) {
      if (mask.points.length < 2) continue;
      c2d.beginPath();
      const n = mask.points.length;
      const startIndex = Math.floor(start * (n - 1));
      const endIndex = Math.ceil(end * (n - 1));

      for (let i = startIndex; i <= endIndex; i++) {
        const pt = mask.points[i];
        if (i === startIndex) c2d.moveTo(pt[0], pt[1]);
        else c2d.lineTo(pt[0], pt[1]);
      }
      if (mask.closed && start === 0 && end === 1) c2d.closePath();
      c2d.stroke();
    }
  } else {
    // If no mask, stroke outer border of layer
    c2d.beginPath();
    c2d.rect(brushSize / 2, brushSize / 2, width - brushSize, height - brushSize);
    c2d.stroke();
  }

  return c2d.getImageData(0, 0, width, height);
}

// 4. Vegas (ec.generate.vegas)
export function fxVegas(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  const blendMode = ctx.params.blendMode ?? 1; // 0: Transparent, 1: Over, 2: Under
  if (blendMode === 1) {
    c2d.putImageData(input, 0, 0);
  }

  const col = ctx.params.color || [1, 1, 1, 1];
  const segments = Math.max(1, ctx.params.segments ?? 32);
  const segLen = Math.max(0.01, Math.min(1.0, ctx.params.length ?? 0.5));
  const rotation = (ctx.params.rotation ?? 0) / 360;
  const lineWidth = ctx.params.width ?? 2;

  c2d.strokeStyle = `rgba(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)}, ${col[3] ?? 1})`;
  c2d.lineWidth = lineWidth;
  c2d.lineCap = 'round';

  // Vegas draws neon animated dash pulses along the perimeter/contour
  const perimeter = 2 * (width + height);
  const each = (perimeter / segments) * segLen;

  c2d.beginPath();
  for (let s = 0; s < segments; s++) {
    const frac = (s / segments + rotation) % 1.0;
    const dist = frac * perimeter;
    // Map dist along rectangular perimeter
    const getPerimeterPoint = (d: number): [number, number] => {
      d = ((d % perimeter) + perimeter) % perimeter;
      if (d < width) return [d, 0];
      d -= width;
      if (d < height) return [width, d];
      d -= height;
      if (d < width) return [width - d, height];
      d -= width;
      return [0, height - d];
    };

    const p0 = getPerimeterPoint(dist);
    const p1 = getPerimeterPoint(dist + each);
    c2d.moveTo(p0[0], p0[1]);
    c2d.lineTo(p1[0], p1[1]);
  }
  c2d.stroke();

  if (blendMode === 2) {
    // Under original
    const vegasData = c2d.getImageData(0, 0, width, height);
    const v = vegasData.data;
    const d = input.data;
    for (let i = 0; i < d.length; i += 4) {
      const origA = d[i + 3] / 255;
      v[i] = Math.round(d[i] * origA + v[i] * (1 - origA));
      v[i + 1] = Math.round(d[i + 1] * origA + v[i + 1] * (1 - origA));
      v[i + 2] = Math.round(d[i + 2] * origA + v[i + 2] * (1 - origA));
      v[i + 3] = Math.round(Math.max(origA, v[i + 3] / 255) * 255);
    }
    return vegasData;
  }

  return c2d.getImageData(0, 0, width, height);
}

// 5. Write-on (ec.generate.writeon)
export function fxWriteOn(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  const paintStyle = ctx.params.paintStyle ?? 0;
  if (paintStyle === 0) {
    c2d.putImageData(input, 0, 0);
  }

  const col = ctx.params.color || [1, 1, 1, 1];
  const opacity = ((ctx.params.brushOpacity ?? 100) / 100) * (col[3] ?? 1);
  const size = ctx.params.brushSize ?? 6;
  const pos = ctx.params.brushPosition || [0.5, 0.5];
  const px = pos[0] * width;
  const py = pos[1] * height;

  c2d.fillStyle = `rgba(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)}, ${opacity})`;
  c2d.beginPath();
  c2d.arc(px, py, size / 2, 0, Math.PI * 2);
  c2d.fill();

  return c2d.getImageData(0, 0, width, height);
}

// 6. Paint Bucket (ec.generate.paintbucket)
export function fxPaintBucket(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  out.data.set(data);
  const outData = out.data;

  const fp = ctx.params.fillPoint || [0.5, 0.5];
  const sx = Math.floor(fp[0] * width);
  const sy = Math.floor(fp[1] * height);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return out;

  const tol = ctx.params.tolerance ?? 10;
  const col = ctx.params.color || [1, 0, 0, 1];
  const opacity = (ctx.params.opacity ?? 100) / 100;
  const targetR = Math.round(col[0] * 255);
  const targetG = Math.round(col[1] * 255);
  const targetB = Math.round(col[2] * 255);

  const startIdx = (sy * width + sx) * 4;
  const baseR = data[startIdx];
  const baseG = data[startIdx + 1];
  const baseB = data[startIdx + 2];
  const baseA = data[startIdx + 3];

  const match = (idx: number) => {
    return (
      Math.abs(data[idx] - baseR) <= tol &&
      Math.abs(data[idx + 1] - baseG) <= tol &&
      Math.abs(data[idx + 2] - baseB) <= tol &&
      Math.abs(data[idx + 3] - baseA) <= tol
    );
  };

  const visited = new Uint8Array(width * height);
  const queue = [sx, sy];
  visited[sy * width + sx] = 1;

  while (queue.length > 0) {
    const cy = queue.pop()!;
    const cx = queue.pop()!;
    const idx = (cy * width + cx) * 4;

    outData[idx] = Math.round(outData[idx] * (1 - opacity) + targetR * opacity);
    outData[idx + 1] = Math.round(outData[idx + 1] * (1 - opacity) + targetG * opacity);
    outData[idx + 2] = Math.round(outData[idx + 2] * (1 - opacity) + targetB * opacity);

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIndex = ny * width + nx;
        if (!visited[nIndex]) {
          visited[nIndex] = 1;
          if (match(nIndex * 4)) {
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  return out;
}

// 7. Eyedropper Fill (ec.generate.eyedropperfill)
export function fxEyedropperFill(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const sp = ctx.params.samplePoint || [0.5, 0.5];
  const sx = Math.floor(sp[0] * width);
  const sy = Math.floor(sp[1] * height);

  let [r, g, b, a] = sampleBilinear(data, width, height, sx, sy, true);
  const keepAlpha = ctx.params.maintainOriginalAlpha ?? false;
  const blend = (ctx.params.blendWithOriginal ?? 0) / 100;

  const out = new ImageData(width, height);
  const outData = out.data;

  for (let i = 0; i < data.length; i += 4) {
    const origA = data[i + 3];
    const fillR = Math.round(r * (1 - blend) + data[i] * blend);
    const fillG = Math.round(g * (1 - blend) + data[i + 1] * blend);
    const fillB = Math.round(b * (1 - blend) + data[i + 2] * blend);

    outData[i] = fillR;
    outData[i + 1] = fillG;
    outData[i + 2] = fillB;
    outData[i + 3] = keepAlpha ? origA : Math.round(a);
  }
  return out;
}

// 8. CC Glue Gun (ec.generate.ccgluegun)
export function fxCCGlueGun(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const out = new ImageData(width, height);
  out.data.set(input.data);
  const outData = out.data;

  const pos = ctx.params.brushPosition || [0.5, 0.5];
  const cx = pos[0] * width;
  const cy = pos[1] * height;
  const rad = Math.max(1, (ctx.params.strokeWidth ?? 25) * 0.5);
  const strength = (ctx.params.strength ?? 100) / 100;
  const refl = ((ctx.params.reflection ?? 45) * Math.PI) / 180;
  const light = [Math.cos(refl) * 0.6, -Math.sin(refl) * 0.6, 0.53];

  const minX = Math.max(0, Math.floor(cx - rad));
  const maxX = Math.min(width - 1, Math.ceil(cx + rad));
  const minY = Math.max(0, Math.floor(cy - rad));
  const maxY = Math.min(height - 1, Math.ceil(cy + rad));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / rad;
      const dy = (y - cy) / rad;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1.0) continue;

      const hgt = Math.sqrt(1.0 - d2);
      const ndl = Math.max(0, dx * light[0] + dy * light[1] + hgt * light[2]);
      const spec = Math.pow(ndl, 20) * 255;

      const idx = (y * width + x) * 4;
      outData[idx] = Math.round(Math.min(255, outData[idx] * (0.7 + 0.3 * ndl) + spec * strength));
      outData[idx + 1] = Math.round(Math.min(255, outData[idx + 1] * (0.7 + 0.3 * ndl) + spec * strength));
      outData[idx + 2] = Math.round(Math.min(255, outData[idx + 2] * (0.7 + 0.3 * ndl) + spec * strength));
    }
  }

  return out;
}

// 9. CC Threads (ec.generate.ccthreads)
export function fxCCThreads(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height, data } = input;
  const out = new ImageData(width, height);
  const outData = out.data;

  const tw = Math.max(2, ctx.params.width ?? 50);
  const th = Math.max(2, ctx.params.height ?? 50);
  const overlaps = Math.max(1, Math.round(ctx.params.overlaps ?? 1));
  const coverage = (ctx.params.coverage ?? 80) / 100;
  const shadowing = (ctx.params.shadowing ?? 50) / 100;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const ci = Math.floor(x / tw);
      const cj = Math.floor(y / th);
      const fu = (x / tw) - ci;
      const fv = (y / th) - cj;

      const inH = Math.abs(fv - 0.5) < coverage * 0.5;
      const inV = Math.abs(fu - 0.5) < coverage * 0.5;
      const hTop = ((ci + cj) % (2 * overlaps) + 2 * overlaps) % (2 * overlaps) < overlaps;

      let horizontal = false;
      if (inH && inV) horizontal = hTop;
      else if (inH) horizontal = true;
      else if (inV) horizontal = false;
      else {
        // Gap
        continue;
      }

      const across = horizontal
        ? (fv - 0.5) / (coverage * 0.5)
        : (fu - 0.5) / (coverage * 0.5);
      const profile = Math.sqrt(Math.max(0, 1.0 - across * across));
      const shade = 1.0 - shadowing * (1.0 - profile) * 0.8;

      const idx = rowOffset + x * 4;
      outData[idx] = Math.round(data[idx] * shade);
      outData[idx + 1] = Math.round(data[idx + 1] * shade);
      outData[idx + 2] = Math.round(data[idx + 2] * shade);
      outData[idx + 3] = data[idx + 3];
    }
  }

  return out;
}

// 10. Audio Spectrum (ec.generate.audiospectrum)
export function fxAudioSpectrum(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  if (ctx.params.compositeOnOriginal) {
    c2d.putImageData(input, 0, 0);
  }

  const pStart = ctx.params.startPoint || [0.1, 0.5];
  const pEnd = ctx.params.endPoint || [0.9, 0.5];
  const x0 = pStart[0] * width;
  const y0 = pStart[1] * height;
  const x1 = pEnd[0] * width;
  const y1 = pEnd[1] * height;

  const bands = Math.max(4, ctx.params.frequencyBands ?? 64);
  const maxH = ctx.params.maximumHeight ?? 50;
  const thickness = ctx.params.thickness ?? 3;
  const colInside = ctx.params.insideColor || [1, 1, 1, 1];
  const colOutside = ctx.params.outsideColor || [0.2, 0.4, 1.0, 1];
  const side = ctx.params.sideOptions ?? 0; // 0: Side A, 1: Side B, 2: Both

  // Get audio samples if available
  let mags = new Float64Array(bands);
  if (ctx.params.audioLayer && ctx.env.getAudioSamples) {
    const raw = ctx.env.getAudioSamples(ctx.params.audioLayer, ctx.env.compTime, 2048, 48000);
    if (raw && raw.length > 0) {
      const mono = new Float64Array(raw.length / 2);
      for (let i = 0; i < mono.length; i++) {
        mono[i] = (raw[i * 2] + raw[i * 2 + 1]) * 0.5;
      }
      const fftRes = computeFftMagnitudes(mono, 48000);
      for (let b = 0; b < bands; b++) {
        const bin = Math.min(fftRes.mags.length - 1, Math.floor((b / bands) * (fftRes.mags.length * 0.4)));
        mags[b] = fftRes.mags[bin];
      }
    }
  } else {
    // Generate synthetic gentle ambient wave pattern when previewing without live audio track
    for (let b = 0; b < bands; b++) {
      const freq = b / bands;
      mags[b] = Math.max(0.05, Math.sin(freq * Math.PI * 3 + ctx.env.compTime * 4) * 0.4 + 0.4);
    }
  }

  c2d.lineWidth = thickness;
  c2d.lineCap = 'round';

  const dx = (x1 - x0) / bands;
  const dy = (y1 - y0) / bands;
  const nx = -dy;
  const ny = dx;
  const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
  const unx = nx / nLen;
  const uny = ny / nLen;

  for (let b = 0; b < bands; b++) {
    const bx = x0 + dx * b;
    const by = y0 + dy * b;
    const hgt = Math.min(maxH, mags[b] * maxH);

    const grad = c2d.createLinearGradient(bx, by, bx + unx * hgt, by + uny * hgt);
    grad.addColorStop(0, `rgba(${Math.round(colInside[0] * 255)}, ${Math.round(colInside[1] * 255)}, ${Math.round(colInside[2] * 255)}, ${colInside[3] ?? 1})`);
    grad.addColorStop(1, `rgba(${Math.round(colOutside[0] * 255)}, ${Math.round(colOutside[1] * 255)}, ${Math.round(colOutside[2] * 255)}, ${colOutside[3] ?? 1})`);
    c2d.strokeStyle = grad;

    c2d.beginPath();
    if (side === 0 || side === 2) {
      c2d.moveTo(bx, by);
      c2d.lineTo(bx + unx * hgt, by + uny * hgt);
    }
    if (side === 1 || side === 2) {
      c2d.moveTo(bx, by);
      c2d.lineTo(bx - unx * hgt, by - uny * hgt);
    }
    c2d.stroke();
  }

  return c2d.getImageData(0, 0, width, height);
}

// 11. Audio Waveform (ec.generate.audiowaveform)
export function fxAudioWaveform(ctx: EffectCtx, input: ImageData): ImageData {
  const { width, height } = input;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c2d = canvas.getContext('2d')!;

  if (ctx.params.compositeOnOriginal) {
    c2d.putImageData(input, 0, 0);
  }

  const pStart = ctx.params.startPoint || [0.1, 0.5];
  const pEnd = ctx.params.endPoint || [0.9, 0.5];
  const x0 = pStart[0] * width;
  const y0 = pStart[1] * height;
  const x1 = pEnd[0] * width;
  const y1 = pEnd[1] * height;

  const count = Math.max(10, Math.min(1000, ctx.params.displayedSamples ?? 200));
  const maxH = ctx.params.maximumHeight ?? 100;
  const thickness = ctx.params.thickness ?? 2;
  const colInside = ctx.params.insideColor || [1, 1, 1, 1];
  const colOutside = ctx.params.outsideColor || [0.2, 0.4, 1.0, 1];

  let samples = new Float64Array(count);
  if (ctx.params.audioLayer && ctx.env.getAudioSamples) {
    const raw = ctx.env.getAudioSamples(ctx.params.audioLayer, ctx.env.compTime, count * 2, 48000);
    if (raw && raw.length > 0) {
      for (let i = 0; i < count; i++) {
        samples[i] = raw[i * 2];
      }
    }
  } else {
    // Ambient sine wave default
    for (let i = 0; i < count; i++) {
      samples[i] = Math.sin((i / count) * Math.PI * 6 + ctx.env.compTime * 5) * 0.5;
    }
  }

  c2d.lineWidth = thickness;
  c2d.strokeStyle = `rgba(${Math.round(colOutside[0] * 255)}, ${Math.round(colOutside[1] * 255)}, ${Math.round(colOutside[2] * 255)}, ${colOutside[3] ?? 1})`;
  c2d.lineJoin = 'round';
  c2d.lineCap = 'round';

  const dx = (x1 - x0) / (count - 1);
  const dy = (y1 - y0) / (count - 1);
  const nx = -dy;
  const ny = dx;
  const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
  const unx = nx / nLen;
  const uny = ny / nLen;

  c2d.beginPath();
  for (let i = 0; i < count; i++) {
    const bx = x0 + dx * i;
    const by = y0 + dy * i;
    const v = samples[i] * maxH;
    const px = bx + unx * v;
    const py = by + uny * v;

    if (i === 0) c2d.moveTo(px, py);
    else c2d.lineTo(px, py);
  }
  c2d.stroke();

  return c2d.getImageData(0, 0, width, height);
}
