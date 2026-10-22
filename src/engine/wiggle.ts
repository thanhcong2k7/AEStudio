/**
 * AEStudio - Deterministic Wiggle Engine
 *
 * Implements After Effects wiggle(freq, amp, octaves, amp_mult, t) with deterministic
 * seeded pseudo-random noise derived from (layerId + propertyId) so preview == export.
 */

// Simple deterministic string hash to 32-bit uint
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Deterministic 1D value noise with cubic interpolation
function noise1D(x: number, seed: number): number {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const f = x - i0;

  // Cubic Hermite smoothstep
  const t = f * f * (3 - 2 * f);

  // Hash values for integer sample points
  const v0 = hashCoord(i0, seed);
  const v1 = hashCoord(i1, seed);

  return v0 * (1 - t) + v1 * t;
}

function hashCoord(i: number, seed: number): number {
  let n = Math.imul(i, 374761393) ^ Math.imul(seed, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  // Map uint32 to [-1, 1]
  return (n / 2147483647.5) - 1.0;
}

/**
 * Standard After Effects-style wiggle function
 *
 * @param freq Oscillations / frequency per second
 * @param amp Amplitude of displacement in property units
 * @param octaves Number of noise octaves for turbulence (default 1)
 * @param amp_mult Amplitude multiplier per octave (default 0.5)
 * @param t Time in seconds
 * @param seedKey Unique deterministic seed string (e.g. `${layerId}_${propId}`)
 */
export function wiggle(
  freq: number,
  amp: number,
  octaves: number = 1,
  amp_mult: number = 0.5,
  t: number = 0,
  seedKey: string = 'ae_wiggle_seed'
): number {
  if (freq <= 0 || amp === 0) return 0;

  const baseSeed = hashString(seedKey);
  let total = 0;
  let currentAmp = amp;
  let currentFreq = freq;
  let maxPossibleAmp = 0;

  const safeOctaves = Math.max(1, Math.min(8, Math.round(octaves)));

  for (let o = 0; o < safeOctaves; o++) {
    const octaveSeed = (baseSeed + o * 1013) >>> 0;
    const n = noise1D(t * currentFreq, octaveSeed);
    total += n * currentAmp;
    maxPossibleAmp += currentAmp;
    currentAmp *= amp_mult;
    currentFreq *= 2.0;
  }

  // Normalize by amplitude scale
  if (maxPossibleAmp > 0) {
    return (total / maxPossibleAmp) * amp;
  }
  return 0;
}

/**
 * 2D Vector wiggle (e.g. for Position, Scale, Anchor Point)
 */
export function wiggle2D(
  freq: number,
  amp: number,
  octaves: number = 1,
  amp_mult: number = 0.5,
  t: number = 0,
  seedKey: string = 'ae_wiggle_seed'
): [number, number] {
  const dx = wiggle(freq, amp, octaves, amp_mult, t, `${seedKey}_x`);
  const dy = wiggle(freq, amp, octaves, amp_mult, t, `${seedKey}_y`);
  return [dx, dy];
}
