/**
 * AEStudio - Radix-2 In-Place Fast Fourier Transform (FFT)
 * Derived 1:1 from generate3.rs
 */

export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  if (n < 2) return;

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j |= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  let len = 2;
  while (len <= n) {
    const ang = (-2.0 * Math.PI) / len;
    const ws = Math.sin(ang);
    const wc = Math.cos(ang);

    for (let start = 0; start < n; start += len) {
      let cr = 1.0;
      let ci = 0.0;
      const half = len >> 1;

      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = start + k + half;

        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;

        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;

        const ncr = cr * wc - ci * ws;
        ci = cr * ws + ci * wc;
        cr = ncr;
      }
    }
    len <<= 1;
  }
}

export function computeFftMagnitudes(samples: Float64Array, sampleRate: number = 48000): {
  mags: Float64Array;
  hzPerBin: number;
} {
  const m = samples.length;
  let n = 64;
  while (n < m) n <<= 1;

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const denom = Math.max(2, m) - 1;

  for (let i = 0; i < m; i++) {
    const w = 0.5 - 0.5 * Math.cos((2.0 * Math.PI * i) / denom); // Hann window
    re[i] = samples[i] * w;
  }

  fft(re, im);

  const numBins = (n >> 1) + 1;
  const hzPerBin = sampleRate / n;
  const scale = 4.0 / Math.max(1, m);
  const mags = new Float64Array(numBins);

  for (let k = 0; k < numBins; k++) {
    const r = re[k];
    const iVal = im[k];
    mags[k] = Math.sqrt(r * r + iVal * iVal) * scale;
  }

  return { mags, hzPerBin };
}
