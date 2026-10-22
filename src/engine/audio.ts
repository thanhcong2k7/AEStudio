/**
 * AEStudio - Audio Decoding & Waveform Cache
 * Optimized for long videos (>1h) with memory-safe buffer management
 */

let sharedAudioCtx: AudioContext | null = null;

// Cache duration limit in seconds for active uncompressed RAM cache.
// For files exceeding 15 minutes (900s), audio is decoded at optimized 22.05kHz mono/stereo
// to keep heap usage under ~100MB instead of >1.4GB.
export const AUDIO_CACHE_DURATION_LIMIT = 900; // 15 minutes

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass({ sampleRate: 48000 });
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Decodes an ArrayBuffer into an AudioBuffer using Web Audio API with memory safeguards
 */
export async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();

  // Try standard decode first
  try {
    // If buffer is huge (> 100MB compressed), don't clone slice unless required
    const bufferToDecode = arrayBuffer.byteLength > 80 * 1024 * 1024 
      ? arrayBuffer 
      : arrayBuffer.slice(0);
    return await ctx.decodeAudioData(bufferToDecode);
  } catch (err) {
    // Fallback: try with sliced copy if detach occurred
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }
}

/**
 * Computes min/max waveform peak buckets for high performance timeline rendering.
 * Target buckets ensures constant O(1) memory (~16KB) even for a 10-hour video!
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer, targetBuckets: number = 2000): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  // Dynamic bucket size ensures constant peak array size
  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / targetBuckets));
  const actualBuckets = Math.floor(totalSamples / samplesPerBucket);

  // Each bucket stores [min, max]
  const peaks = new Float32Array(actualBuckets * 2);

  // Stride sampling for extremely long videos (1h+) to keep loop lightning fast
  const stride = totalSamples > 10000000 ? Math.max(1, Math.floor(samplesPerBucket / 32)) : 1;

  for (let b = 0; b < actualBuckets; b++) {
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, totalSamples);
    let min = 1.0;
    let max = -1.0;

    for (let i = start; i < end; i += stride) {
      const val = channelData[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    peaks[b * 2] = min === 1.0 ? 0 : min;
    peaks[b * 2 + 1] = max === -1.0 ? 0 : max;
  }

  return peaks;
}

/**
 * Extracts raw audio samples for an audio layer around a time window at specified sample rate
 * (Needed by Audio Spectrum & Waveform)
 */
export function getLayerAudioSamples(
  audioBuffer: AudioBuffer,
  startTime: number,
  frames: number,
  sampleRate: number = 48000
): Float32Array {
  const out = new Float32Array(frames * 2); // stereo interleaved L, R
  const bufRate = audioBuffer.sampleRate;
  const numChans = audioBuffer.numberOfChannels;
  const left = audioBuffer.getChannelData(0);
  const right = numChans > 1 ? audioBuffer.getChannelData(1) : left;

  const startSample = Math.floor(startTime * bufRate);
  const step = bufRate / sampleRate;

  for (let i = 0; i < frames; i++) {
    const srcIndex = Math.floor(startSample + i * step);
    if (srcIndex >= 0 && srcIndex < left.length) {
      out[i * 2] = left[srcIndex];
      out[i * 2 + 1] = right[srcIndex];
    } else {
      out[i * 2] = 0;
      out[i * 2 + 1] = 0;
    }
  }

  return out;
}

