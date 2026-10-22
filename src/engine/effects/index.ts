/**
 * AEStudio - Central Effects Dispatcher (29 Effects)
 * Derived 1:1 from Rust effectcraft registry
 */

import { EffectCtx, EffectFn } from './types';
import {
  fxSetChannels,
  fxShiftChannels,
  fxChannelCombiner,
  fxMinimax,
  fxArithmetic,
  fxSolidComposite,
  fxRemoveColorMatting,
  fxSetMatte,
} from './channelEffects';

import {
  fxTwirl,
  fxSpherize,
  fxBulge,
  fxWaveWarp,
  fxRipple,
  fxMirror,
  fxOffset,
  fxPolarCoordinates,
  fxTransform,
  fxCornerPin,
} from './distortEffects';

import {
  fxFractal,
  fxScribble,
  fxStroke,
  fxVegas,
  fxWriteOn,
  fxPaintBucket,
  fxEyedropperFill,
  fxCCGlueGun,
  fxCCThreads,
  fxAudioSpectrum,
  fxAudioWaveform,
} from './generateEffects';

const EFFECT_RUNNERS: Record<string, EffectFn> = {
  // Channel (8)
  'ec.channel.setchannels': fxSetChannels,
  'ec.channel.shiftchannels': fxShiftChannels,
  'ec.channel.combiner': fxChannelCombiner,
  'ec.channel.minimax': fxMinimax,
  'ec.channel.arithmetic': fxArithmetic,
  'ec.channel.solidcomposite': fxSolidComposite,
  'ec.channel.removecolormatting': fxRemoveColorMatting,
  'ec.channel.setmatte': fxSetMatte,

  // Distort (10)
  'ec.distort.twirl': fxTwirl,
  'ec.distort.spherize': fxSpherize,
  'ec.distort.bulge': fxBulge,
  'ec.distort.wavewarp': fxWaveWarp,
  'ec.distort.ripple': fxRipple,
  'ec.distort.mirror': fxMirror,
  'ec.distort.offset': fxOffset,
  'ec.distort.polar': fxPolarCoordinates,
  'ec.distort.transform': fxTransform,
  'ec.distort.cornerpin': fxCornerPin,

  // Generate (11)
  'ec.generate.fractal': fxFractal,
  'ec.generate.scribble': fxScribble,
  'ec.generate.stroke': fxStroke,
  'ec.generate.vegas': fxVegas,
  'ec.generate.writeon': fxWriteOn,
  'ec.generate.paintbucket': fxPaintBucket,
  'ec.generate.eyedropperfill': fxEyedropperFill,
  'ec.generate.ccgluegun': fxCCGlueGun,
  'ec.generate.ccthreads': fxCCThreads,
  'ec.generate.audiospectrum': fxAudioSpectrum,
  'ec.generate.audiowaveform': fxAudioWaveform,
};

export function applyEffect(
  effectId: string,
  ctx: EffectCtx,
  input: ImageData
): ImageData {
  const runner = EFFECT_RUNNERS[effectId];
  if (!runner) {
    return input;
  }
  try {
    return runner(ctx, input);
  } catch (err) {
    console.warn(`Effect ${effectId} render failed:`, err);
    return input;
  }
}

export * from './types';
