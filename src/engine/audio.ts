/**
 * AEStudio - Audio Decoding & Waveform Cache
 */

let sharedAudioCtx: AudioContext | null = null;

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
 * Decodes an ArrayBuffer or Blob into an AudioBuffer using Web Audio API
 */
export async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Computes min/max waveform peak buckets for high performance timeline rendering
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer, targetBuckets: number = 2000): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / targetBuckets));
  const actualBuckets = Math.floor(totalSamples / samplesPerBucket);

  // Each bucket stores [min, max]
  const peaks = new Float32Array(actualBuckets * 2);

  for (let b = 0; b < actualBuckets; b++) {
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, totalSamples);
    let min = 1.0;
    let max = -1.0;

    for (let i = start; i < end; i++) {
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
