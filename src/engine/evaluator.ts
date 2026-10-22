/**
 * AEStudio - Keyframe & Wiggle Evaluator
 */

import { AnimatableProp, Keyframe } from './types';
import { wiggle, wiggle2D } from './wiggle';

// Cubic Bezier 1D solver for ease handles
function solveCubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  // Simple Newton-Raphson approximation for cubic bezier
  let u = t;
  for (let i = 0; i < 5; i++) {
    const currentX = 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u;
    const dx = currentX - t;
    if (Math.abs(dx) < 1e-4) break;
    const derivative = 3 * (1 - u) * (1 - u) * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
    if (Math.abs(derivative) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - dx / derivative));
  }
  return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u;
}

export function evaluateProp<T>(
  prop: AnimatableProp<T>,
  time: number,
  layerId: string = 'layer',
  propId: string = 'prop'
): T {
  let baseVal: T = prop.value;

  if (prop.animated && prop.keyframes && prop.keyframes.length > 0) {
    const kfs = [...prop.keyframes].sort((a, b) => a.time - b.time);

    if (time <= kfs[0].time) {
      baseVal = kfs[0].value;
    } else if (time >= kfs[kfs.length - 1].time) {
      baseVal = kfs[kfs.length - 1].value;
    } else {
      // Find pair
      let k0: Keyframe<T> = kfs[0];
      let k1: Keyframe<T> = kfs[1];
      for (let i = 0; i < kfs.length - 1; i++) {
        if (time >= kfs[i].time && time <= kfs[i + 1].time) {
          k0 = kfs[i];
          k1 = kfs[i + 1];
          break;
        }
      }

      const duration = k1.time - k0.time;
      if (duration <= 0.00001 || k0.interpolation === 'hold') {
        baseVal = k0.value;
      } else {
        const linearRatio = (time - k0.time) / duration;
        let ratio = linearRatio;

        if (k0.interpolation === 'ease') {
          ratio = 0.5 - 0.5 * Math.cos(linearRatio * Math.PI);
        } else if (k0.interpolation === 'bezier') {
          const p1x = k0.outHandle ? k0.outHandle[0] / duration : 0.33;
          const p1y = k0.outHandle ? k0.outHandle[1] : 0.33;
          const p2x = k1.inHandle ? 1 - Math.abs(k1.inHandle[0]) / duration : 0.67;
          const p2y = k1.inHandle ? 1 - k1.inHandle[1] : 0.67;
          ratio = solveCubicBezier(linearRatio, p1x, p1y, p2x, p2y);
        }

        // Interpolate value
        if (typeof k0.value === 'number' && typeof k1.value === 'number') {
          baseVal = (k0.value + (k1.value - k0.value) * ratio) as unknown as T;
        } else if (Array.isArray(k0.value) && Array.isArray(k1.value)) {
          const arr0 = k0.value as number[];
          const arr1 = k1.value as number[];
          const res = arr0.map((v, i) => v + (arr1[i] - v) * ratio);
          baseVal = res as unknown as T;
        } else {
          // Non-interpolatable (boolean, enum, string, layer) -> hold
          baseVal = k0.value;
        }
      }
    }
  }

  // Wiggle on top
  if (prop.wiggle?.enabled && prop.wiggle.freq > 0 && prop.wiggle.amp !== 0) {
    const seed = `${layerId}_${propId}`;
    if (typeof baseVal === 'number') {
      const w = wiggle(
        prop.wiggle.freq,
        prop.wiggle.amp,
        prop.wiggle.octaves ?? 1,
        prop.wiggle.amp_mult ?? 0.5,
        time,
        seed
      );
      baseVal = (baseVal + w) as unknown as T;
    } else if (Array.isArray(baseVal) && baseVal.length === 2 && typeof baseVal[0] === 'number') {
      const [wx, wy] = wiggle2D(
        prop.wiggle.freq,
        prop.wiggle.amp,
        prop.wiggle.octaves ?? 1,
        prop.wiggle.amp_mult ?? 0.5,
        time,
        seed
      );
      baseVal = [baseVal[0] + wx, baseVal[1] + wy] as unknown as T;
    }
  }

  return baseVal;
}
