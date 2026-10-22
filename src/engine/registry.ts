/**
 * AEStudio - 29-Effect Registry derived 1:1 from Rust engine sources
 * (channel.rs, distort.rs, generate3.rs)
 */

import { EffectParamSpec, EffectSpec, EffectInstance, AnimatableProp } from './types';
import { STYLE_BLEND_MODES } from './effects/color';

export const LAYER_SOURCE_OPTIONS = ['Source', 'Masks', 'Effects & Masks'];

export function layerSourceId(id: string): string {
  return `${id}Source`;
}

// Helpers matching the Rust spec definitions
function slider(min: number, max: number, sliderMin: number, sliderMax: number, decimals: number): EffectParamSpec['ui'] {
  return { type: 'slider', min, max, sliderMin, sliderMax, decimals };
}

function popup(options: string[]): EffectParamSpec['ui'] {
  return { type: 'popup', options };
}

function p(id: string, name: string, defaultValue: any, ui: EffectParamSpec['ui']): EffectParamSpec {
  return { id, name, default: defaultValue, ui };
}

const SRC_NAMES = ['Red', 'Green', 'Blue', 'Alpha', 'Luminance', 'Hue', 'Lightness', 'Saturation', 'Full', 'Half', 'Off'];
const SHIFT_NAMES = ['Alpha', 'Red', 'Green', 'Blue', 'Luminance', 'Hue', 'Lightness', 'Saturation', 'Full On', 'Half On', 'Full Off'];
const COMBINER_FROM = [
  'RGB to HLS', 'HLS to RGB', 'RGB to YUV', 'YUV to RGB',
  'Red', 'Green', 'Blue', 'Alpha',
  'Lightness', 'Hue', 'Saturation', 'Luminance', 'Max RGB', 'Min RGB'
];
const COMBINER_TO = [
  'Red Only', 'Green Only', 'Blue Only', 'Alpha Only',
  'Lightness Only', 'Hue Only', 'Saturation Only', 'Grayscale', 'Saturation Multiplied'
];
const SOLID_MODE_NAMES = [
  'Normal', 'Add', 'Multiply', 'Screen', 'Overlay', 'Soft Light',
  'Hard Light', 'Darken', 'Lighten', 'Difference', 'Color', 'Luminosity'
];
const WAVE_TYPES = ['Sine', 'Square', 'Triangle', 'Sawtooth', 'Circle', 'Semicircle', 'Uncircle', 'Noise', 'Smooth Noise'];
const WAVE_PINNING = ['None', 'All Edges', 'Center', 'Left Edge', 'Top Edge', 'Right Edge', 'Bottom Edge', 'Horizontal Edges', 'Vertical Edges'];
const FRACTAL_SETS = ['Mandelbrot', 'Mandelbrot Inverse', 'Mandelbrot Over Julia', 'Mandelbrot Inverse Over Julia', 'Julia', 'Julia Inverse'];
const FRACTAL_PALETTES = ['Lightness Gradient', 'Hue Wheel', 'Black And White', 'Solid Color'];
const FRACTAL_OVERSAMPLE = ['Edge Detect-Fast-May Miss Pixels', 'Brute Force-Slow-Every Pixel'];
const END_CAPS = ['Round', 'Butt', 'Projecting'];
const JOINS = ['Round', 'Miter', 'Bevel'];

export const EFFECT_REGISTRY: EffectSpec[] = [
  // ==========================================
  // CHANNEL (8 effects from channel.rs)
  // ==========================================
  {
    id: 'ec.channel.setchannels',
    name: 'Set Channels',
    category: 'Channel',
    params: [
      p('sourceLayer1', 'Source Layer 1', null, { type: 'layer' }),
      p('sourceLayer1Source', 'Source Layer 1 Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('setRedTo', "Set Red To Source 1's", 0, popup(SRC_NAMES)),
      p('sourceLayer2', 'Source Layer 2', null, { type: 'layer' }),
      p('sourceLayer2Source', 'Source Layer 2 Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('setGreenTo', "Set Green To Source 2's", 1, popup(SRC_NAMES)),
      p('sourceLayer3', 'Source Layer 3', null, { type: 'layer' }),
      p('sourceLayer3Source', 'Source Layer 3 Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('setBlueTo', "Set Blue To Source 3's", 2, popup(SRC_NAMES)),
      p('sourceLayer4', 'Source Layer 4', null, { type: 'layer' }),
      p('sourceLayer4Source', 'Source Layer 4 Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('setAlphaTo', "Set Alpha To Source 4's", 3, popup(SRC_NAMES)),
      p('stretchLayersToFit', 'Stretch Layers to Fit', true, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.channel.shiftchannels',
    name: 'Shift Channels',
    category: 'Channel',
    params: [
      p('takeAlphaFrom', 'Take Alpha From', 0, popup(SHIFT_NAMES)),
      p('takeRedFrom', 'Take Red From', 1, popup(SHIFT_NAMES)),
      p('takeGreenFrom', 'Take Green From', 2, popup(SHIFT_NAMES)),
      p('takeBlueFrom', 'Take Blue From', 3, popup(SHIFT_NAMES)),
    ],
  },
  {
    id: 'ec.channel.combiner',
    name: 'Channel Combiner',
    category: 'Channel',
    params: [
      p('useSecondLayer', 'Use 2nd Layer', false, { type: 'checkbox' }),
      p('sourceLayer', 'Source Layer', null, { type: 'layer' }),
      p('sourceLayerSource', 'Source Layer Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('from', 'From', 8, popup(COMBINER_FROM)),
      p('to', 'To', 4, popup(COMBINER_TO)),
      p('invert', 'Invert', false, { type: 'checkbox' }),
      p('solidAlpha', 'Solid Alpha', false, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.channel.minimax',
    name: 'Minimax',
    category: 'Channel',
    params: [
      p('operation', 'Operation', 1, popup(['Minimum', 'Maximum', 'Minimum Then Maximum', 'Maximum Then Minimum'])),
      p('radius', 'Radius', 0, slider(0, 500, 0, 100, 0)),
      p('channel', 'Channel', 0, popup(['Color', 'Alpha', 'Alpha and Color', 'Red', 'Green', 'Blue'])),
      p('direction', 'Direction', 0, popup(['Horizontal & Vertical', 'Just Horizontal', 'Just Vertical'])),
      p('dontShrinkEdges', "Don't Shrink Edges", false, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.channel.arithmetic',
    name: 'Arithmetic',
    category: 'Channel',
    params: [
      p('operator', 'Operator', 3, popup([
        'And', 'Or', 'Xor', 'Add', 'Subtract', 'Difference', 'Min', 'Max',
        'Block Above', 'Block Below', 'Slice', 'Multiply', 'Screen'
      ])),
      p('redValue', 'Red Value', 0, slider(0, 255, 0, 255, 0)),
      p('greenValue', 'Green Value', 0, slider(0, 255, 0, 255, 0)),
      p('blueValue', 'Blue Value', 0, slider(0, 255, 0, 255, 0)),
      p('clip', 'Clip Result Values', true, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.channel.solidcomposite',
    name: 'Solid Composite',
    category: 'Channel',
    params: [
      p('sourceOpacity', 'Source Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('color', 'Color', [1, 1, 1, 1], { type: 'color' }),
      p('opacity', 'Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('blendingMode', 'Blending Mode', 0, popup(SOLID_MODE_NAMES)),
    ],
  },
  {
    id: 'ec.channel.removecolormatting',
    name: 'Remove Color Matting',
    category: 'Channel',
    params: [
      p('backgroundColor', 'Background Color', [0, 0, 0, 1], { type: 'color' }),
      p('clipHdr', 'Clip HDR Values', true, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.channel.setmatte',
    name: 'Set Matte',
    category: 'Channel',
    params: [
      p('takeMatteFromLayer', 'Take Matte From Layer', null, { type: 'layer' }),
      p('takeMatteFromLayerSource', 'Take Matte From Layer Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('takeMatteFrom', 'Use For Matte', 3, popup(['Red', 'Green', 'Blue', 'Alpha', 'Luminance', 'Hue', 'Lightness', 'Saturation', 'Full', 'Off'])),
      p('invertMatte', 'Invert Matte', false, { type: 'checkbox' }),
      p('stretchMatteToFit', 'Stretch Matte to Fit', true, { type: 'checkbox' }),
      p('compositeMatteWithOriginal', 'Composite Matte with Original', true, { type: 'checkbox' }),
      p('premultiplyMatteLayer', 'Premultiply Matte Layer', true, { type: 'checkbox' }),
    ],
  },

  // ==========================================
  // DISTORT (10 effects from distort.rs)
  // ==========================================
  {
    id: 'ec.distort.twirl',
    name: 'Twirl',
    category: 'Distort',
    params: [
      p('angle', 'Angle', 0, { type: 'angle' }),
      p('radius', 'Twirl Radius', 30, slider(0, 100, 0, 100, 1)),
      p('center', 'Twirl Center', [0.5, 0.5], { type: 'point' }),
    ],
  },
  {
    id: 'ec.distort.spherize',
    name: 'Spherize',
    category: 'Distort',
    params: [
      p('radius', 'Radius', 0, slider(0, 2500, 0, 2500, 1)),
      p('center', 'Center of Sphere', [0.5, 0.5], { type: 'point' }),
    ],
  },
  {
    id: 'ec.distort.bulge',
    name: 'Bulge',
    category: 'Distort',
    params: [
      p('hradius', 'Horizontal Radius', 50, slider(0, 4000, 0, 1000, 1)),
      p('vradius', 'Vertical Radius', 50, slider(0, 4000, 0, 1000, 1)),
      p('center', 'Bulge Center', [0.5, 0.5], { type: 'point' }),
      p('height', 'Bulge Height', 1.0, slider(-4, 4, -4, 4, 2)),
      p('taperRadius', 'Taper Radius', 0, slider(0, 100, 0, 100, 1)),
      p('pinAllEdges', 'Pin All Edges', false, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.distort.wavewarp',
    name: 'Wave Warp',
    category: 'Distort',
    params: [
      p('waveType', 'Wave Type', 0, popup(WAVE_TYPES)),
      p('height', 'Wave Height', 10, slider(-1000, 1000, -100, 100, 0)),
      p('width', 'Wave Width', 40, slider(1, 10000, 1, 500, 0)),
      p('direction', 'Direction', 90, { type: 'angle' }),
      p('speed', 'Wave Speed', 1, slider(-100, 100, -5, 5, 1)),
      p('pinning', 'Pinning', 0, popup(WAVE_PINNING)),
      p('phase', 'Phase', 0, { type: 'angle' }),
    ],
  },
  {
    id: 'ec.distort.ripple',
    name: 'Ripple',
    category: 'Distort',
    params: [
      p('radius', 'Radius', 50, slider(0, 100, 0, 100, 1)),
      p('center', 'Center of Ripple', [0.5, 0.5], { type: 'point' }),
      p('conversion', 'Type of Conversion', 0, popup(['Asymmetric', 'Symmetric'])),
      p('speed', 'Wave Speed', 1, slider(-15, 15, -5, 5, 1)),
      p('waveWidth', 'Wave Width', 20, slider(1, 1000, 1, 100, 1)),
      p('waveHeight', 'Wave Height', 10, slider(0, 400, 0, 100, 1)),
      p('phase', 'Ripple Phase', 0, { type: 'angle' }),
    ],
  },
  {
    id: 'ec.distort.mirror',
    name: 'Mirror',
    category: 'Distort',
    params: [
      p('center', 'Reflection Center', [0.5, 0.5], { type: 'point' }),
      p('angle', 'Reflection Angle', 0, { type: 'angle' }),
    ],
  },
  {
    id: 'ec.distort.offset',
    name: 'Offset',
    category: 'Distort',
    params: [
      p('shift', 'Shift Center To', [0.5, 0.5], { type: 'point' }),
      p('blend', 'Blend With Original', 0, slider(0, 100, 0, 100, 1)),
    ],
  },
  {
    id: 'ec.distort.polar',
    name: 'Polar Coordinates',
    category: 'Distort',
    params: [
      p('interpolation', 'Interpolation', 0, slider(0, 100, 0, 100, 1)),
      p('conversion', 'Type of Conversion', 0, popup(['Rect to Polar', 'Polar to Rect'])),
    ],
  },
  {
    id: 'ec.distort.transform',
    name: 'Transform',
    category: 'Distort',
    params: [
      p('anchor', 'Anchor Point', [0.5, 0.5], { type: 'point' }),
      p('position', 'Position', [0.5, 0.5], { type: 'point' }),
      p('uniform', 'Uniform Scale', true, { type: 'checkbox' }),
      p('scaleHeight', 'Scale Height', 100, slider(-10000, 10000, 0, 600, 1)),
      p('scaleWidth', 'Scale Width', 100, slider(-10000, 10000, 0, 600, 1)),
      p('skew', 'Skew', 0, slider(-70, 70, -70, 70, 1)),
      p('skewAxis', 'Skew Axis', 0, { type: 'angle' }),
      p('rotation', 'Rotation', 0, { type: 'angle' }),
      p('opacity', 'Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('useCompositionShutterAngle', "Use Composition's Shutter Angle", true, { type: 'checkbox' }),
      p('shutterAngle', 'Shutter Angle', 0, slider(0, 720, 0, 360, 1)),
      p('sampling', 'Sampling', 0, popup(['Bilinear', 'Bicubic'])),
    ],
  },
  {
    id: 'ec.distort.cornerpin',
    name: 'Corner Pin',
    category: 'Distort',
    params: [
      p('ul', 'Upper Left', [0.0, 0.0], { type: 'point' }),
      p('ur', 'Upper Right', [1.0, 0.0], { type: 'point' }),
      p('ll', 'Lower Left', [0.0, 1.0], { type: 'point' }),
      p('lr', 'Lower Right', [1.0, 1.0], { type: 'point' }),
    ],
  },

  // ==========================================
  // GENERATE (11 effects from generate3.rs)
  // ==========================================
  {
    id: 'ec.generate.fractal',
    name: 'Fractal',
    category: 'Generate',
    params: [
      p('setChoice', 'Set Choice', 0, popup(FRACTAL_SETS)),
      p('equation', 'Equation', 0, popup(['z = z^2 + c', 'z = z^3 + c', 'z = z^4 + c'])),
      p('mandelbrot/mandelbrotX', 'X (Real)', -0.74, slider(-2, 2, -2, 2, 4)),
      p('mandelbrot/mandelbrotY', 'Y (Imaginary)', 0.15, slider(-2, 2, -2, 2, 4)),
      p('mandelbrot/mandelbrotMagnification', 'Magnification', 0, slider(-5, 30, -5, 30, 2)),
      p('mandelbrot/mandelbrotEscapeLimit', 'Escape Limit', 4, slider(1, 1000, 1, 100, 1)),
      p('julia/juliaX', 'X (Real)', 0, slider(-2, 2, -2, 2, 4)),
      p('julia/juliaY', 'Y (Imaginary)', 0, slider(-2, 2, -2, 2, 4)),
      p('julia/juliaMagnification', 'Magnification', 0, slider(-5, 30, -5, 30, 2)),
      p('julia/juliaEscapeLimit', 'Escape Limit', 4, slider(1, 1000, 1, 100, 1)),
      p('postInversionOffset/postInversionX', 'X Offset', 0, slider(-2, 2, -2, 2, 4)),
      p('postInversionOffset/postInversionY', 'Y Offset', 0, slider(-2, 2, -2, 2, 4)),
      p('fractalColor/overlay', 'Overlay', false, { type: 'checkbox' }),
      p('fractalColor/transparency', 'Transparency', false, { type: 'checkbox' }),
      p('fractalColor/palette', 'Palette', 0, popup(FRACTAL_PALETTES)),
      p('fractalColor/hue', 'Hue', 0, { type: 'angle' }),
      p('fractalColor/cycleSteps', 'Cycle Steps', 32, slider(1, 1000, 1, 256, 0)),
      p('fractalColor/cycleOffset', 'Cycle Offset', 0, { type: 'angle' }),
      p('fractalColor/edgeHighlight', 'Edge Highlight', false, { type: 'checkbox' }),
      p('highQualitySettings/samplingMethod', 'Oversample Method', 0, popup(FRACTAL_OVERSAMPLE)),
      p('highQualitySettings/samplingFactor', 'Oversample Factor', 2, slider(1, 9, 1, 9, 0)),
    ],
  },
  {
    id: 'ec.generate.scribble',
    name: 'Scribble',
    category: 'Generate',
    params: [
      p('scribble', 'Scribble', 0, popup(['Single Mask', 'All Masks', 'All Masks Using Modes'])),
      p('mask', 'Mask', 1, { type: 'mask' }),
      p('fillType', 'Fill Type', 0, popup(['Inside', 'Centered Edge', 'Inside Edge', 'Outside Edge', 'Left Edge', 'Right Edge'])),
      p('edgeOptions/edgeWidth', 'Edge Width', 10, slider(0, 100, 0, 100, 1)),
      p('edgeOptions/endCap', 'End Cap', 0, popup(END_CAPS)),
      p('edgeOptions/join', 'Join', 0, popup(JOINS)),
      p('edgeOptions/miterLimit', 'Miter Limit', 4, slider(1, 100, 1, 20, 1)),
      p('color', 'Color', [1, 0, 0, 1], { type: 'color' }),
      p('opacity', 'Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('angle', 'Angle', 45, { type: 'angle' }),
      p('strokeWidth', 'Stroke Width', 2, slider(0.1, 50, 0.1, 50, 1)),
      p('strokeOptions/curviness', 'Curviness', 50, slider(0, 100, 0, 100, 1)),
      p('strokeOptions/curvinessVariation', 'Curviness Variation', 50, slider(0, 100, 0, 100, 1)),
      p('strokeOptions/spacing', 'Spacing', 5, slider(0.1, 100, 0.1, 50, 1)),
      p('strokeOptions/spacingVariation', 'Spacing Variation', 50, slider(0, 100, 0, 100, 1)),
      p('strokeOptions/pathOverlap', 'Path Overlap', 0, slider(-100, 100, -100, 100, 1)),
      p('strokeOptions/pathOverlapVariation', 'Path Overlap Variation', 50, slider(0, 100, 0, 100, 1)),
      p('start', 'Start', 0, slider(0, 100, 0, 100, 1)),
      p('end', 'End', 100, slider(0, 100, 0, 100, 1)),
      p('startEndApplyTo', 'Start/End Apply To', 0, popup(['All Strokes', 'Each Stroke'])),
      p('fillPathsSequentially', 'Fill Paths Sequentially', true, { type: 'checkbox' }),
      p('wiggleType', 'Wiggle Type', 1, popup(['Static', 'Jumpy', 'Smooth'])),
      p('wigglesPerSecond', 'Wiggles/Second', 5, slider(0, 100, 0, 30, 2)),
      p('randomSeed', 'Random Seed', 1, slider(0, 10000, 0, 100, 0)),
      p('composite', 'Composite', 1, popup(['On Original Image', 'On Transparent', 'Reveal Original Image'])),
    ],
  },
  {
    id: 'ec.generate.stroke',
    name: 'Stroke',
    category: 'Generate',
    params: [
      p('path', 'Path', 1, { type: 'mask' }),
      p('allMasks', 'All Masks', false, { type: 'checkbox' }),
      p('strokeSequentially', 'Stroke Sequentially', true, { type: 'checkbox' }),
      p('color', 'Color', [1, 1, 1, 1], { type: 'color' }),
      p('brushSize', 'Brush Size', 2, slider(0, 50, 0, 50, 1)),
      p('brushHardness', 'Brush Hardness', 75, slider(0, 100, 0, 100, 1)),
      p('opacity', 'Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('start', 'Start', 0, slider(0, 100, 0, 100, 1)),
      p('end', 'End', 100, slider(0, 100, 0, 100, 1)),
      p('spacing', 'Spacing', 15, slider(0, 100, 0, 100, 1)),
      p('paintStyle', 'Paint Style', 0, popup(['On Original Image', 'On Transparent', 'Reveal Original Image'])),
    ],
  },
  {
    id: 'ec.generate.vegas',
    name: 'Vegas',
    category: 'Generate',
    params: [
      p('stroke', 'Stroke', 0, popup(['Image Contours', 'Mask/Path'])),
      p('inputLayer', 'Image Contours: Input Layer', null, { type: 'layer' }),
      p('inputLayerSource', 'Image Contours: Input Layer Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('invertInput', 'Image Contours: Invert Input', false, { type: 'checkbox' }),
      p('ifLayerSizesDiffer', 'Image Contours: If Layer Sizes Differ', 0, popup(['Center', 'Stretch to Fit'])),
      p('channel', 'Image Contours: Channel', 0, popup(['Intensity', 'Red', 'Green', 'Blue', 'Alpha'])),
      p('threshold', 'Image Contours: Threshold', 50, slider(0, 100, 0, 100, 1)),
      p('preBlur', 'Image Contours: Pre-Blur', 1, slider(0, 100, 0, 20, 1)),
      p('tolerance', 'Image Contours: Tolerance', 0.01, slider(0, 1, 0, 0.1, 3)),
      p('renderMode', 'Image Contours: Render', 0, popup(['All Contours', 'Selected Contour'])),
      p('selectedContour', 'Image Contours: Selected Contour', 1, slider(1, 1000, 1, 20, 0)),
      p('shorterContoursHave', 'Image Contours: Shorter Contours Have', 0, popup(['Same Number of Segments', 'Fewer Segments'])),
      p('path', 'Mask/Path: Path', 1, { type: 'mask' }),
      p('segments', 'Segments: Segments', 32, slider(1, 1000, 1, 100, 0)),
      p('length', 'Segments: Length', 0.5, slider(0, 1, 0, 1, 3)),
      p('segmentDistribution', 'Segments: Segment Distribution', 0, popup(['Bunched', 'Even'])),
      p('rotation', 'Segments: Rotation', 0, { type: 'angle' }),
      p('randomPhase', 'Segments: Random Phase', false, { type: 'checkbox' }),
      p('randomSeed', 'Segments: Random Seed', 1, slider(1, 10000, 1, 100, 0)),
      p('blendMode', 'Rendering: Blend Mode', 1, popup(['Transparent', 'Over', 'Under', 'Stencil'])),
      p('color', 'Rendering: Color', [1, 1, 1, 1], { type: 'color' }),
      p('width', 'Rendering: Width', 2, slider(0, 100, 0, 20, 2)),
      p('hardness', 'Rendering: Hardness', 0.5, slider(0, 1, 0, 1, 3)),
      p('startOpacity', 'Rendering: Start Opacity', 1, slider(0, 1, 0, 1, 3)),
      p('midpointOpacity', 'Rendering: Mid-point Opacity', 0.5, slider(0, 1, 0, 1, 3)),
      p('midpointPosition', 'Rendering: Mid-point Position', 0.5, slider(0, 1, 0, 1, 3)),
      p('endOpacity', 'Rendering: End Opacity', 0, slider(0, 1, 0, 1, 3)),
    ],
  },
  {
    id: 'ec.generate.writeon',
    name: 'Write-on',
    category: 'Generate',
    params: [
      p('brushPosition', 'Brush Position', [0.5, 0.5], { type: 'point' }),
      p('color', 'Color', [1, 1, 1, 1], { type: 'color' }),
      p('brushSize', 'Brush Size', 6, slider(0, 50, 0, 50, 1)),
      p('brushHardness', 'Brush Hardness', 75, slider(0, 100, 0, 100, 1)),
      p('brushOpacity', 'Brush Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('strokeLength', 'Stroke Length (secs)', 0, slider(0, 30, 0, 30, 1)),
      p('brushSpacing', 'Brush Spacing (secs)', 0.001, slider(0.001, 5, 0.001, 5, 3)),
      p('paintTimeProperties', 'Paint Time Properties', 0, popup(['None', 'Opacity', 'Color'])),
      p('brushTimeProperties', 'Brush Time Properties', 0, popup(['None', 'Size', 'Hardness', 'Size & Hardness'])),
      p('paintStyle', 'Paint Style', 0, popup(['On Original Image', 'On Transparent', 'Reveal Original Image'])),
    ],
  },
  {
    id: 'ec.generate.paintbucket',
    name: 'Paint Bucket',
    category: 'Generate',
    params: [
      p('fillPoint', 'Fill Point', [0.5, 0.5], { type: 'point' }),
      p('fillSelector', 'Fill Selector', 0, popup(['Color & Alpha', 'Straight Color', 'Transparency', 'Opacity', 'Alpha Channel'])),
      p('tolerance', 'Tolerance', 10, slider(0, 255, 0, 100, 1)),
      p('viewThreshold', 'View Threshold', false, { type: 'checkbox' }),
      p('stroke', 'Stroke', 0, popup(['Antialias', 'Feather', 'Spread', 'Choke', 'Stroke'])),
      p('featherSoftness', 'Feather Softness', 10, slider(0, 100, 0, 50, 1)),
      p('spreadRadius', 'Spread Radius', 3, slider(0, 100, 0, 20, 1)),
      p('strokeWidth', 'Stroke Width', 2, slider(0, 100, 0, 20, 1)),
      p('color', 'Color', [1, 0, 0, 1], { type: 'color' }),
      p('opacity', 'Opacity', 100, slider(0, 100, 0, 100, 1)),
      p('blendingMode', 'Blending Mode', 0, popup(['Normal', 'Add', 'Multiply', 'Screen', 'Hue', 'Saturation', 'Color', 'Luminosity', 'Behind', 'Fill Only'])),
    ],
  },
  {
    id: 'ec.generate.eyedropperfill',
    name: 'Eyedropper Fill',
    category: 'Generate',
    params: [
      p('samplePoint', 'Sample Point', [0.5, 0.5], { type: 'point' }),
      p('sampleRadius', 'Sample Radius', 0, slider(0, 1000, 0, 100, 1)),
      p('averagePixelColors', 'Average Pixel Colors', 0, popup(['Skip Empty', 'All', 'All Premultiplied', 'Including Alpha'])),
      p('maintainOriginalAlpha', 'Maintain Original Alpha', false, { type: 'checkbox' }),
      p('blendWithOriginal', 'Blend With Original', 0, slider(0, 100, 0, 100, 1)),
    ],
  },
  {
    id: 'ec.generate.ccgluegun',
    name: 'CC Glue Gun',
    category: 'Generate',
    params: [
      p('brushPosition', 'Brush Position', [0.5, 0.5], { type: 'point' }),
      p('strokeWidth', 'Stroke Width', 25, slider(0, 500, 0, 100, 1)),
      p('density', 'Density', 5, slider(0, 32, 0, 32, 1)),
      p('timeSpan', 'Time Span (sec)', 1, slider(0, 60, 0, 10, 2)),
      p('reflection', 'Reflection', 45, { type: 'angle' }),
      p('strength', 'Strength', 100, slider(0, 100, 0, 100, 1)),
      p('style', 'Style', 0, popup(['Over Layer', 'Glue Only'])),
    ],
  },
  {
    id: 'ec.generate.ccthreads',
    name: 'CC Threads',
    category: 'Generate',
    params: [
      p('width', 'Width', 50, slider(1, 1000, 1, 200, 1)),
      p('height', 'Height', 50, slider(1, 1000, 1, 200, 1)),
      p('overlaps', 'Overlaps', 1, slider(1, 20, 1, 10, 0)),
      p('direction', 'Direction', 0, { type: 'angle' }),
      p('center', 'Center', [0.5, 0.5], { type: 'point' }),
      p('coverage', 'Coverage', 80, slider(0, 100, 0, 100, 1)),
      p('shadowing', 'Shadowing', 50, slider(0, 100, 0, 100, 1)),
      p('texture', 'Texture', 10, slider(0, 100, 0, 100, 1)),
    ],
  },
  {
    id: 'ec.generate.audiospectrum',
    name: 'Audio Spectrum',
    category: 'Generate',
    params: [
      p('audioLayer', 'Audio Layer', null, { type: 'layer' }),
      p('audioLayerSource', 'Audio Layer Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('startPoint', 'Start Point', [0.1, 0.5], { type: 'point' }),
      p('endPoint', 'End Point', [0.9, 0.5], { type: 'point' }),
      p('path', 'Path', 0, { type: 'mask' }),
      p('usePolarPath', 'Use Polar Path', false, { type: 'checkbox' }),
      p('startFrequency', 'Start Frequency', 20, slider(1, 20000, 1, 2000, 0)),
      p('endFrequency', 'End Frequency', 2000, slider(1, 20000, 1, 10000, 0)),
      p('frequencyBands', 'Frequency bands', 64, slider(1, 4096, 1, 256, 0)),
      p('maximumHeight', 'Maximum Height', 50, slider(0, 10000, 0, 500, 1)),
      p('audioDuration', 'Audio Duration (milliseconds)', 90, slider(1, 30000, 1, 1000, 1)),
      p('audioOffset', 'Audio Offset (milliseconds)', 0, slider(-30000, 30000, -1000, 1000, 1)),
      p('thickness', 'Thickness', 3, slider(0, 1000, 0, 50, 2)),
      p('softness', 'Softness', 50, slider(0, 100, 0, 100, 1)),
      p('insideColor', 'Inside Color', [1, 1, 1, 1], { type: 'color' }),
      p('outsideColor', 'Outside Color', [0.2, 0.4, 1.0, 1], { type: 'color' }),
      p('blendOverlappingColors', 'Blend Overlapping Colors', true, { type: 'checkbox' }),
      p('hueInterpolation', 'Hue Interpolation', 0, { type: 'angle' }),
      p('dynamicHuePhase', 'Dynamic Hue Phase', false, { type: 'checkbox' }),
      p('colorSymmetry', 'Color Symmetry', false, { type: 'checkbox' }),
      p('displayOptions', 'Display Options', 0, popup(['Digital', 'Analog lines', 'Analog dots'])),
      p('sideOptions', 'Side Options', 0, popup(['Side A', 'Side B', 'Side A & B'])),
      p('durationAveraging', 'Duration Averaging', false, { type: 'checkbox' }),
      p('compositeOnOriginal', 'Composite On Original (Keep Background Color)', false, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.generate.audiowaveform',
    name: 'Audio Waveform',
    category: 'Generate',
    params: [
      p('audioLayer', 'Audio Layer', null, { type: 'layer' }),
      p('audioLayerSource', 'Audio Layer Source', 2, { type: 'popup', options: LAYER_SOURCE_OPTIONS }),
      p('startPoint', 'Start Point', [0.1, 0.5], { type: 'point' }),
      p('endPoint', 'End Point', [0.9, 0.5], { type: 'point' }),
      p('path', 'Path', 0, { type: 'mask' }),
      p('usePolarPath', 'Use Polar Path', false, { type: 'checkbox' }),
      p('displayedSamples', 'Displayed Samples', 200, slider(2, 4096, 2, 1000, 0)),
      p('maximumHeight', 'Maximum Height', 100, slider(0, 10000, 0, 500, 1)),
      p('audioDuration', 'Audio Duration (milliseconds)', 200, slider(1, 30000, 1, 1000, 1)),
      p('audioOffset', 'Audio Offset (milliseconds)', 0, slider(-30000, 30000, -1000, 1000, 1)),
      p('thickness', 'Thickness', 2, slider(0, 1000, 0, 50, 2)),
      p('softness', 'Softness', 10, slider(0, 100, 0, 100, 1)),
      p('randomSeed', 'Random Seed (Analog)', 1, slider(1, 10000, 1, 100, 0)),
      p('insideColor', 'Inside Color', [1, 1, 1, 1], { type: 'color' }),
      p('outsideColor', 'Outside Color', [0.2, 0.4, 1.0, 1], { type: 'color' }),
      p('waveformOptions', 'Waveform Options', 0, popup(['Mono', 'Left', 'Right'])),
      p('displayOptions', 'Display Options', 1, popup(['Digital', 'Analog lines', 'Analog dots'])),
      p('compositeOnOriginal', 'Composite On Original (Keep Background Color)', false, { type: 'checkbox' }),
    ],
  },

  // ==========================================
  // LAYER STYLES (9 effects from styles.rs)
  // ==========================================
  {
    id: 'ec.style.dropshadow',
    name: 'Drop Shadow',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 3, popup(STYLE_BLEND_MODES)),
      p('color', 'Color', [0, 0, 0, 1], { type: 'color' }),
      p('opacity', 'Opacity', 75, slider(0, 100, 0, 100, 0)),
      p('useGlobalLight', 'Use Global Light', true, { type: 'checkbox' }),
      p('angle', 'Angle', 120.0, { type: 'angle' }),
      p('distance', 'Distance', 5.0, slider(0, 30000, 0, 100, 1)),
      p('spread', 'Spread', 0.0, slider(0, 100, 0, 100, 0)),
      p('size', 'Size', 5.0, slider(0, 250, 0, 250, 1)),
      p('noise', 'Noise', 0.0, slider(0, 100, 0, 100, 0)),
      p('knocksOut', 'Layer Knocks Out Drop Shadow', true, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.style.innershadow',
    name: 'Inner Shadow',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 3, popup(STYLE_BLEND_MODES)),
      p('color', 'Color', [0, 0, 0, 1], { type: 'color' }),
      p('opacity', 'Opacity', 75, slider(0, 100, 0, 100, 0)),
      p('useGlobalLight', 'Use Global Light', true, { type: 'checkbox' }),
      p('angle', 'Angle', 120.0, { type: 'angle' }),
      p('distance', 'Distance', 5.0, slider(0, 30000, 0, 100, 1)),
      p('choke', 'Choke', 0.0, slider(0, 100, 0, 100, 0)),
      p('size', 'Size', 5.0, slider(0, 250, 0, 250, 1)),
      p('noise', 'Noise', 0.0, slider(0, 100, 0, 100, 0)),
    ],
  },
  {
    id: 'ec.style.outerglow',
    name: 'Outer Glow',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 8, popup(STYLE_BLEND_MODES)),
      p('opacity', 'Opacity', 75, slider(0, 100, 0, 100, 0)),
      p('noise', 'Noise', 0, slider(0, 100, 0, 100, 0)),
      p('colorType', 'Color Type', 0, popup(['Color', 'Gradient'])),
      p('color', 'Color', [1.0, 1.0, 190 / 255, 1.0], { type: 'color' }),
      p('gradientSmoothness', 'Gradient Smoothness', 100, slider(0, 100, 0, 100, 0)),
      p('technique', 'Technique', 0, popup(['Softer', 'Precise'])),
      p('spread', 'Spread', 0, slider(0, 100, 0, 100, 0)),
      p('size', 'Size', 5.0, slider(0, 250, 0, 250, 1)),
      p('range', 'Range', 50.0, slider(1, 100, 1, 100, 0)),
      p('jitter', 'Jitter', 0, slider(0, 100, 0, 100, 0)),
    ],
  },
  {
    id: 'ec.style.innerglow',
    name: 'Inner Glow',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 8, popup(STYLE_BLEND_MODES)),
      p('opacity', 'Opacity', 75, slider(0, 100, 0, 100, 0)),
      p('noise', 'Noise', 0, slider(0, 100, 0, 100, 0)),
      p('colorType', 'Color Type', 0, popup(['Color', 'Gradient'])),
      p('color', 'Color', [1.0, 1.0, 190 / 255, 1.0], { type: 'color' }),
      p('gradientSmoothness', 'Gradient Smoothness', 100, slider(0, 100, 0, 100, 0)),
      p('technique', 'Technique', 0, popup(['Softer', 'Precise'])),
      p('source', 'Source', 1, popup(['Center', 'Edge'])),
      p('choke', 'Choke', 0, slider(0, 100, 0, 100, 0)),
      p('size', 'Size', 5.0, slider(0, 250, 0, 250, 1)),
      p('range', 'Range', 50.0, slider(1, 100, 1, 100, 0)),
      p('jitter', 'Jitter', 0, slider(0, 100, 0, 100, 0)),
    ],
  },
  {
    id: 'ec.style.bevelemboss',
    name: 'Bevel and Emboss',
    category: 'Layer Styles',
    params: [
      p('style', 'Style', 1, popup(['Outer Bevel', 'Inner Bevel', 'Emboss', 'Pillow Emboss', 'Stroke Emboss'])),
      p('technique', 'Technique', 0, popup(['Smooth', 'Chisel Hard', 'Chisel Soft'])),
      p('depth', 'Depth', 100.0, slider(1, 1000, 1, 1000, 0)),
      p('direction', 'Direction', 0, popup(['Up', 'Down'])),
      p('size', 'Size', 5.0, slider(0, 250, 0, 250, 1)),
      p('soften', 'Soften', 0.0, slider(0, 16, 0, 16, 1)),
      p('useGlobalLight', 'Use Global Light', true, { type: 'checkbox' }),
      p('angle', 'Angle', 120.0, { type: 'angle' }),
      p('altitude', 'Altitude', 30.0, { type: 'angle' }),
      p('highlightMode', 'Highlight Mode', 8, popup(STYLE_BLEND_MODES)),
      p('highlightColor', 'Highlight Color', [1, 1, 1, 1], { type: 'color' }),
      p('highlightOpacity', 'Highlight Opacity', 75.0, slider(0, 100, 0, 100, 0)),
      p('shadowMode', 'Shadow Mode', 3, popup(STYLE_BLEND_MODES)),
      p('shadowColor', 'Shadow Color', [0, 0, 0, 1], { type: 'color' }),
      p('shadowOpacity', 'Shadow Opacity', 75.0, slider(0, 100, 0, 100, 0)),
    ],
  },
  {
    id: 'ec.style.satin',
    name: 'Satin',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 3, popup(STYLE_BLEND_MODES)),
      p('color', 'Color', [0, 0, 0, 1], { type: 'color' }),
      p('opacity', 'Opacity', 50.0, slider(0, 100, 0, 100, 0)),
      p('angle', 'Angle', 19.0, { type: 'angle' }),
      p('distance', 'Distance', 11.0, slider(0, 250, 0, 250, 1)),
      p('size', 'Size', 14.0, slider(0, 250, 0, 250, 1)),
      p('invert', 'Invert', true, { type: 'checkbox' }),
    ],
  },
  {
    id: 'ec.style.coloroverlay',
    name: 'Color Overlay',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 0, popup(STYLE_BLEND_MODES)),
      p('color', 'Color', [1.0, 0.0, 0.0, 1.0], { type: 'color' }),
      p('opacity', 'Opacity', 100.0, slider(0, 100, 0, 100, 0)),
    ],
  },
  {
    id: 'ec.style.gradientoverlay',
    name: 'Gradient Overlay',
    category: 'Layer Styles',
    params: [
      p('blendMode', 'Blend Mode', 0, popup(STYLE_BLEND_MODES)),
      p('opacity', 'Opacity', 100.0, slider(0, 100, 0, 100, 0)),
      p('color1', 'Start Color', [0, 0, 0, 1], { type: 'color' }),
      p('color2', 'End Color', [1, 1, 1, 1], { type: 'color' }),
      p('gradientSmoothness', 'Gradient Smoothness', 100.0, slider(0, 100, 0, 100, 0)),
      p('angle', 'Angle', 90.0, { type: 'angle' }),
      p('style', 'Style', 0, popup(['Linear', 'Radial', 'Angle', 'Reflected', 'Diamond'])),
      p('reverse', 'Reverse', false, { type: 'checkbox' }),
      p('alignWithLayer', 'Align with Layer', true, { type: 'checkbox' }),
      p('scale', 'Scale', 100.0, slider(10, 150, 10, 150, 0)),
      p('offset', 'Offset', [0.5, 0.5], { type: 'point' }),
    ],
  },
  {
    id: 'ec.style.stroke',
    name: 'Stroke',
    category: 'Layer Styles',
    params: [
      p('color', 'Color', [1.0, 0.0, 0.0, 1.0], { type: 'color' }),
      p('blendMode', 'Blend Mode', 0, popup(STYLE_BLEND_MODES)),
      p('size', 'Size', 3.0, slider(1, 250, 1, 250, 1)),
      p('opacity', 'Opacity', 100.0, slider(0, 100, 0, 100, 0)),
      p('position', 'Position', 0, popup(['Outside', 'Inside', 'Center'])),
    ],
  },
];

export function findEffectSpec(id: string): EffectSpec | undefined {
  return EFFECT_REGISTRY.find((e) => e.id === id);
}

export function instantiateEffect(spec: EffectSpec): EffectInstance {
  const params: Record<string, AnimatableProp<any>> = {};
  for (const ps of spec.params) {
    params[ps.id] = {
      value: Array.isArray(ps.default) ? [...ps.default] : ps.default,
      keyframes: [],
      animated: false,
    };
  }
  return {
    id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    effectId: spec.id,
    name: spec.name,
    enabled: true,
    params,
  };
}
