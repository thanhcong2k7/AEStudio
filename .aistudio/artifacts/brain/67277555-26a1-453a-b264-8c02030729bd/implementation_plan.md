# AEStudio — Motion Graphics & Video Editor (Phase 1)

AEStudio is a browser-based, After Effects-grade motion-graphics and video compositor. Phase 1 establishes the production workstation foundation: reactive state management with command history (undo/redo), asset ingestion, multi-layer canvas composition with geometric snapping, full keyframing and deterministic wiggle engine, multi-track timeline with zoom/razor/multi-trim, and the complete 29-effect registry derived 1:1 from the attached Rust engine sources.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed in Phase 1 interactive clarification:
> - **Delivery Scope**: Delivering **Phase 1** completely (App Shell, State + Undo/Redo, Assets Flow, Layers, Canvas Editing + Snapping, Blend Modes, Keyframes + Wiggle, Timeline with Razor & Waveforms, Project Save/Load, Preview Quality, and the complete 29-Effect Parameter Table & Registry with Inspector Stack UI).
> - **Architecture**: Hybrid architecture combining modular React 19 + TypeScript UI in `src/` with pure standalone JavaScript engine modules in `public/js/` (enabling both rich web app development and standalone zero-build disk execution).
> - **Visual Theme**: Professional After Effects dark theme (`#18191c` panels, `#23252a` headers, `#0d0e11` canvas well, `#2d62ea` accent) with compact controls, tabular metrics, and crisp spatial math.

---

## 1. Overview & Core Concept

- **What It Does**: AEStudio provides a professional timeline and canvas composition environment in the browser. Users import footage (video, audio, images, fonts), construct layered composites (Text, Solid, Image, Video, Audio, Shape, Adjustment Layers), keyframe spatial and temporal properties with easing and mathematical wiggle expressions, and inspect/stack effect modules with exact After Effects parameter models.
- **Target Audience**: Motion designers, video editors, visual effects artists, and web creators requiring precise keyframe timing, mathematical effect stacking, and professional compositing without native software bloat.
- **Key Value**: 1:1 behavioral alignment with industry-standard motion graphics software, instantaneous local rendering, zero telemetry, and non-destructive JSON project persistence.

---

## 2. Complete 29-Effect Parameter Specification Table

The table below catalogs all 29 effects across `channel.rs` (8), `distort.rs` (10), and `generate3.rs` (11), recording exact effect IDs, parameter IDs, types, hard/soft ranges, defaults, option arrays, and dependency reads.

| Effect ID | Display Name | Param ID | Param Display Name | Type | Range (Hard Min/Max, Soft Min/Max, Decimals) | Default | Dropdown Options (Exact Order) | Reads |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ec.channel.setchannels` | Set Channels | `sourceLayer1` | Source Layer 1 | Layer | N/A | None | Project Layers | layer |
| `ec.channel.setchannels` | Set Channels | `sourceLayer1Source` | Source Layer 1 Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.setchannels` | Set Channels | `setRedTo` | Set Red To Source 1's | Popup | N/A | 0 | `["Red", "Green", "Blue", "Alpha", "Luminance", "Hue", "Lightness", "Saturation", "Full", "Half", "Off"]` | — |
| `ec.channel.setchannels` | Set Channels | `sourceLayer2` | Source Layer 2 | Layer | N/A | None | Project Layers | layer |
| `ec.channel.setchannels` | Set Channels | `sourceLayer2Source` | Source Layer 2 Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.setchannels` | Set Channels | `setGreenTo` | Set Green To Source 2's | Popup | N/A | 1 | `["Red", "Green", "Blue", "Alpha", "Luminance", "Hue", "Lightness", "Saturation", "Full", "Half", "Off"]` | — |
| `ec.channel.setchannels` | Set Channels | `sourceLayer3` | Source Layer 3 | Layer | N/A | None | Project Layers | layer |
| `ec.channel.setchannels` | Set Channels | `sourceLayer3Source` | Source Layer 3 Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.setchannels` | Set Channels | `setBlueTo` | Set Blue To Source 3's | Popup | N/A | 2 | `["Red", "Green", "Blue", "Alpha", "Luminance", "Hue", "Lightness", "Saturation", "Full", "Half", "Off"]` | — |
| `ec.channel.setchannels` | Set Channels | `sourceLayer4` | Source Layer 4 | Layer | N/A | None | Project Layers | layer |
| `ec.channel.setchannels` | Set Channels | `sourceLayer4Source` | Source Layer 4 Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.setchannels` | Set Channels | `setAlphaTo` | Set Alpha To Source 4's | Popup | N/A | 3 | `["Red", "Green", "Blue", "Alpha", "Luminance", "Hue", "Lightness", "Saturation", "Full", "Half", "Off"]` | — |
| `ec.channel.setchannels` | Set Channels | `stretchLayersToFit` | Stretch Layers to Fit | Bool | N/A | true | N/A | — |
| `ec.channel.shiftchannels` | Shift Channels | `takeAlphaFrom` | Take Alpha From | Popup | N/A | 0 | `["Alpha", "Red", "Green", "Blue", "Luminance", "Hue", "Lightness", "Saturation", "Full On", "Half On", "Full Off"]` | — |
| `ec.channel.shiftchannels` | Shift Channels | `takeRedFrom` | Take Red From | Popup | N/A | 1 | `["Alpha", "Red", "Green", "Blue", "Luminance", "Hue", "Lightness", "Saturation", "Full On", "Half On", "Full Off"]` | — |
| `ec.channel.shiftchannels` | Shift Channels | `takeGreenFrom` | Take Green From | Popup | N/A | 2 | `["Alpha", "Red", "Green", "Blue", "Luminance", "Hue", "Lightness", "Saturation", "Full On", "Half On", "Full Off"]` | — |
| `ec.channel.shiftchannels` | Shift Channels | `takeBlueFrom` | Take Blue From | Popup | N/A | 3 | `["Alpha", "Red", "Green", "Blue", "Luminance", "Hue", "Lightness", "Saturation", "Full On", "Half On", "Full Off"]` | — |
| `ec.channel.combiner` | Channel Combiner | `useSecondLayer` | Use 2nd Layer | Bool | N/A | false | N/A | — |
| `ec.channel.combiner` | Channel Combiner | `sourceLayer` | Source Layer | Layer | N/A | None | Project Layers | layer |
| `ec.channel.combiner` | Channel Combiner | `sourceLayerSource` | Source Layer Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.combiner` | Channel Combiner | `from` | From | Popup | N/A | 8 | `["RGB to HLS", "HLS to RGB", "RGB to YUV", "YUV to RGB", "Red", "Green", "Blue", "Alpha", "Lightness", "Hue", "Saturation", "Luminance", "Max RGB", "Min RGB"]` | — |
| `ec.channel.combiner` | Channel Combiner | `to` | To | Popup | N/A | 4 | `["Red Only", "Green Only", "Blue Only", "Alpha Only", "Lightness Only", "Hue Only", "Saturation Only", "Grayscale", "Saturation Multiplied"]` | — |
| `ec.channel.combiner` | Channel Combiner | `invert` | Invert | Bool | N/A | false | N/A | — |
| `ec.channel.combiner` | Channel Combiner | `solidAlpha` | Solid Alpha | Bool | N/A | false | N/A | — |
| `ec.channel.minimax` | Minimax | `operation` | Operation | Popup | N/A | 1 | `["Minimum", "Maximum", "Minimum Then Maximum", "Maximum Then Minimum"]` | — |
| `ec.channel.minimax` | Minimax | `radius` | Radius | Num | [0, 500, 0, 100, 0] | 0 | N/A | — |
| `ec.channel.minimax` | Minimax | `channel` | Channel | Popup | N/A | 0 | `["Color", "Alpha", "Alpha and Color", "Red", "Green", "Blue"]` | — |
| `ec.channel.minimax` | Minimax | `direction` | Direction | Popup | N/A | 0 | `["Horizontal & Vertical", "Just Horizontal", "Just Vertical"]` | — |
| `ec.channel.minimax` | Minimax | `dontShrinkEdges` | Don't Shrink Edges | Bool | N/A | false | N/A | — |
| `ec.channel.arithmetic` | Arithmetic | `operator` | Operator | Popup | N/A | 3 | `["And", "Or", "Xor", "Add", "Subtract", "Difference", "Min", "Max", "Block Above", "Block Below", "Slice", "Multiply", "Screen"]` | — |
| `ec.channel.arithmetic` | Arithmetic | `redValue` | Red Value | Num | [0, 255, 0, 255, 0] | 0 | N/A | — |
| `ec.channel.arithmetic` | Arithmetic | `greenValue` | Green Value | Num | [0, 255, 0, 255, 0] | 0 | N/A | — |
| `ec.channel.arithmetic` | Arithmetic | `blueValue` | Blue Value | Num | [0, 255, 0, 255, 0] | 0 | N/A | — |
| `ec.channel.arithmetic` | Arithmetic | `clip` | Clip Result Values | Bool | N/A | true | N/A | — |
| `ec.channel.solidcomposite` | Solid Composite | `sourceOpacity` | Source Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.channel.solidcomposite` | Solid Composite | `color` | Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.channel.solidcomposite` | Solid Composite | `opacity` | Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.channel.solidcomposite` | Solid Composite | `blendingMode` | Blending Mode | Popup | N/A | 0 | `["Normal", "Add", "Multiply", "Screen", "Overlay", "Soft Light", "Hard Light", "Darken", "Lighten", "Difference", "Color", "Luminosity"]` | — |
| `ec.channel.removecolormatting` | Remove Color Matting | `backgroundColor` | Background Color | Color | N/A | [0, 0, 0, 1] | N/A | — |
| `ec.channel.removecolormatting` | Remove Color Matting | `clipHdr` | Clip HDR Values | Bool | N/A | true | N/A | — |
| `ec.channel.setmatte` | Set Matte | `takeMatteFromLayer` | Take Matte From Layer | Layer | N/A | None | Project Layers | layer |
| `ec.channel.setmatte` | Set Matte | `takeMatteFromLayerSource` | Take Matte From Layer Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.channel.setmatte` | Set Matte | `takeMatteFrom` | Use For Matte | Popup | N/A | 3 | `["Red", "Green", "Blue", "Alpha", "Luminance", "Hue", "Lightness", "Saturation", "Full", "Off"]` | — |
| `ec.channel.setmatte` | Set Matte | `invertMatte` | Invert Matte | Bool | N/A | false | N/A | — |
| `ec.channel.setmatte` | Set Matte | `stretchMatteToFit` | Stretch Matte to Fit | Bool | N/A | true | N/A | — |
| `ec.channel.setmatte` | Set Matte | `compositeMatteWithOriginal` | Composite Matte with Original | Bool | N/A | true | N/A | — |
| `ec.channel.setmatte` | Set Matte | `premultiplyMatteLayer` | Premultiply Matte Layer | Bool | N/A | true | N/A | — |
| `ec.distort.twirl` | Twirl | `angle` | Angle | Angle | [-Infinity, Infinity, -720, 720, 1] | 0 | N/A | — |
| `ec.distort.twirl` | Twirl | `radius` | Twirl Radius | Num | [0, 100, 0, 100, 1] | 30 | N/A | — |
| `ec.distort.twirl` | Twirl | `center` | Twirl Center | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.spherize` | Spherize | `radius` | Radius | Num | [0, 2500, 0, 2500, 1] | 0 | N/A | — |
| `ec.distort.spherize` | Spherize | `center` | Center of Sphere | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.bulge` | Bulge | `hradius` | Horizontal Radius | Num | [0, 4000, 0, 1000, 1] | 50 | N/A | — |
| `ec.distort.bulge` | Bulge | `vradius` | Vertical Radius | Num | [0, 4000, 0, 1000, 1] | 50 | N/A | — |
| `ec.distort.bulge` | Bulge | `center` | Bulge Center | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.bulge` | Bulge | `height` | Bulge Height | Num | [-4, 4, -4, 4, 2] | 1.0 | N/A | — |
| `ec.distort.bulge` | Bulge | `taperRadius` | Taper Radius | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.distort.bulge` | Bulge | `pinAllEdges` | Pin All Edges | Bool | N/A | false | N/A | — |
| `ec.distort.wavewarp` | Wave Warp | `waveType` | Wave Type | Popup | N/A | 0 | `["Sine", "Square", "Triangle", "Sawtooth", "Circle", "Semicircle", "Uncircle", "Noise", "Smooth Noise"]` | — |
| `ec.distort.wavewarp` | Wave Warp | `height` | Wave Height | Num | [-1000, 1000, -100, 100, 0] | 10 | N/A | — |
| `ec.distort.wavewarp` | Wave Warp | `width` | Wave Width | Num | [1, 10000, 1, 500, 0] | 40 | N/A | — |
| `ec.distort.wavewarp` | Wave Warp | `direction` | Direction | Angle | [-Infinity, Infinity, 0, 360, 1] | 90 | N/A | — |
| `ec.distort.wavewarp` | Wave Warp | `speed` | Wave Speed | Num | [-100, 100, -5, 5, 1] | 1 | N/A | time |
| `ec.distort.wavewarp` | Wave Warp | `pinning` | Pinning | Popup | N/A | 0 | `["None", "All Edges", "Center", "Left Edge", "Top Edge", "Right Edge", "Bottom Edge", "Horizontal Edges", "Vertical Edges"]` | — |
| `ec.distort.wavewarp` | Wave Warp | `phase` | Phase | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | time |
| `ec.distort.ripple` | Ripple | `radius` | Radius | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.distort.ripple` | Ripple | `center` | Center of Ripple | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.ripple` | Ripple | `conversion` | Type of Conversion | Popup | N/A | 0 | `["Asymmetric", "Symmetric"]` | — |
| `ec.distort.ripple` | Ripple | `speed` | Wave Speed | Num | [-15, 15, -5, 5, 1] | 1 | N/A | time |
| `ec.distort.ripple` | Ripple | `waveWidth` | Wave Width | Num | [1, 1000, 1, 100, 1] | 20 | N/A | — |
| `ec.distort.ripple` | Ripple | `waveHeight` | Wave Height | Num | [0, 400, 0, 100, 1] | 10 | N/A | — |
| `ec.distort.ripple` | Ripple | `phase` | Ripple Phase | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | time |
| `ec.distort.mirror` | Mirror | `center` | Reflection Center | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.mirror` | Mirror | `angle` | Reflection Angle | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.distort.offset` | Offset | `shift` | Shift Center To | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.offset` | Offset | `blend` | Blend With Original | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.distort.polar` | Polar Coordinates | `interpolation` | Interpolation | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.distort.polar` | Polar Coordinates | `conversion` | Type of Conversion | Popup | N/A | 0 | `["Rect to Polar", "Polar to Rect"]` | — |
| `ec.distort.transform` | Transform | `anchor` | Anchor Point | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.transform` | Transform | `position` | Position | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.distort.transform` | Transform | `uniform` | Uniform Scale | Bool | N/A | true | N/A | — |
| `ec.distort.transform` | Transform | `scaleHeight` | Scale Height | Num | [-10000, 10000, 0, 600, 1] | 100 | N/A | — |
| `ec.distort.transform` | Transform | `scaleWidth` | Scale Width | Num | [-10000, 10000, 0, 600, 1] | 100 | N/A | — |
| `ec.distort.transform` | Transform | `skew` | Skew | Num | [-70, 70, -70, 70, 1] | 0 | N/A | — |
| `ec.distort.transform` | Transform | `skewAxis` | Skew Axis | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.distort.transform` | Transform | `rotation` | Rotation | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.distort.transform` | Transform | `opacity` | Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.distort.transform` | Transform | `useCompositionShutterAngle` | Use Composition's Shutter Angle | Bool | N/A | true | N/A | env.shutter |
| `ec.distort.transform` | Transform | `shutterAngle` | Shutter Angle | Num | [0, 720, 0, 360, 1] | 0 | N/A | params_at, time |
| `ec.distort.transform` | Transform | `sampling` | Sampling | Popup | N/A | 0 | `["Bilinear", "Bicubic"]` | — |
| `ec.distort.cornerpin` | Corner Pin | `ul` | Upper Left | Point | [0, 1, 0, 1, 3] | [0.0, 0.0] | N/A | — |
| `ec.distort.cornerpin` | Corner Pin | `ur` | Upper Right | Point | [0, 1, 0, 1, 3] | [1.0, 0.0] | N/A | — |
| `ec.distort.cornerpin` | Corner Pin | `ll` | Lower Left | Point | [0, 1, 0, 1, 3] | [0.0, 1.0] | N/A | — |
| `ec.distort.cornerpin` | Corner Pin | `lr` | Lower Right | Point | [0, 1, 0, 1, 3] | [1.0, 1.0] | N/A | — |
| `ec.generate.fractal` | Fractal | `setChoice` | Set Choice | Popup | N/A | 0 | `["Mandelbrot", "Mandelbrot Inverse", "Mandelbrot Over Julia", "Mandelbrot Inverse Over Julia", "Julia", "Julia Inverse"]` | — |
| `ec.generate.fractal` | Fractal | `equation` | Equation | Popup | N/A | 0 | `["z = z^2 + c", "z = z^3 + c", "z = z^4 + c"]` | — |
| `ec.generate.fractal` | Fractal | `mandelbrot/mandelbrotX` | X (Real) | Num | [-2, 2, -2, 2, 4] | -0.74 | N/A | — |
| `ec.generate.fractal` | Fractal | `mandelbrot/mandelbrotY` | Y (Imaginary) | Num | [-2, 2, -2, 2, 4] | 0.15 | N/A | — |
| `ec.generate.fractal` | Fractal | `mandelbrot/mandelbrotMagnification` | Magnification | Num | [-5, 30, -5, 30, 2] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `mandelbrot/mandelbrotEscapeLimit` | Escape Limit | Num | [1, 1000, 1, 100, 1] | 4 | N/A | — |
| `ec.generate.fractal` | Fractal | `julia/juliaX` | X (Real) | Num | [-2, 2, -2, 2, 4] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `julia/juliaY` | Y (Imaginary) | Num | [-2, 2, -2, 2, 4] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `julia/juliaMagnification` | Magnification | Num | [-5, 30, -5, 30, 2] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `julia/juliaEscapeLimit` | Escape Limit | Num | [1, 1000, 1, 100, 1] | 4 | N/A | — |
| `ec.generate.fractal` | Fractal | `postInversionOffset/postInversionX` | X Offset | Num | [-2, 2, -2, 2, 4] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `postInversionOffset/postInversionY` | Y Offset | Num | [-2, 2, -2, 2, 4] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/overlay` | Overlay | Bool | N/A | false | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/transparency` | Transparency | Bool | N/A | false | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/palette` | Palette | Popup | N/A | 0 | `["Lightness Gradient", "Hue Wheel", "Black And White", "Solid Color"]` | — |
| `ec.generate.fractal` | Fractal | `fractalColor/hue` | Hue | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/cycleSteps` | Cycle Steps | Num | [1, 1000, 1, 256, 0] | 32 | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/cycleOffset` | Cycle Offset | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.generate.fractal` | Fractal | `fractalColor/edgeHighlight` | Edge Highlight | Bool | N/A | false | N/A | — |
| `ec.generate.fractal` | Fractal | `highQualitySettings/samplingMethod` | Oversample Method | Popup | N/A | 0 | `["Edge Detect-Fast-May Miss Pixels", "Brute Force-Slow-Every Pixel"]` | — |
| `ec.generate.fractal` | Fractal | `highQualitySettings/samplingFactor` | Oversample Factor | Num | [1, 9, 1, 9, 0] | 2 | N/A | — |
| `ec.generate.scribble` | Scribble | `scribble` | Scribble | Popup | N/A | 0 | `["Single Mask", "All Masks", "All Masks Using Modes"]` | mask |
| `ec.generate.scribble` | Scribble | `mask` | Mask | Mask | [1, 100, 1, 20, 0] | 1 | N/A | mask |
| `ec.generate.scribble` | Scribble | `fillType` | Fill Type | Popup | N/A | 0 | `["Inside", "Centered Edge", "Inside Edge", "Outside Edge", "Left Edge", "Right Edge"]` | — |
| `ec.generate.scribble` | Scribble | `edgeOptions/edgeWidth` | Edge Width | Num | [0, 100, 0, 100, 1] | 10 | N/A | — |
| `ec.generate.scribble` | Scribble | `edgeOptions/endCap` | End Cap | Popup | N/A | 0 | `["Round", "Butt", "Projecting"]` | — |
| `ec.generate.scribble` | Scribble | `edgeOptions/join` | Join | Popup | N/A | 0 | `["Round", "Miter", "Bevel"]` | — |
| `ec.generate.scribble` | Scribble | `edgeOptions/miterLimit` | Miter Limit | Num | [1, 100, 1, 20, 1] | 4 | N/A | — |
| `ec.generate.scribble` | Scribble | `color` | Color | Color | N/A | [1, 0, 0, 1] | N/A | — |
| `ec.generate.scribble` | Scribble | `opacity` | Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.scribble` | Scribble | `angle` | Angle | Angle | [-Infinity, Infinity, 0, 360, 1] | 45 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeWidth` | Stroke Width | Num | [0.1, 50, 0.1, 50, 1] | 2 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/curviness` | Curviness | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/curvinessVariation` | Curviness Variation | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/spacing` | Spacing | Num | [0.1, 100, 0.1, 50, 1] | 5 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/spacingVariation` | Spacing Variation | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/pathOverlap` | Path Overlap | Num | [-100, 100, -100, 100, 1] | 0 | N/A | — |
| `ec.generate.scribble` | Scribble | `strokeOptions/pathOverlapVariation` | Path Overlap Variation | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.scribble` | Scribble | `start` | Start | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.generate.scribble` | Scribble | `end` | End | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.scribble` | Scribble | `startEndApplyTo` | Start/End Apply To | Popup | N/A | 0 | `["All Strokes", "Each Stroke"]` | — |
| `ec.generate.scribble` | Scribble | `fillPathsSequentially` | Fill Paths Sequentially | Bool | N/A | true | N/A | — |
| `ec.generate.scribble` | Scribble | `wiggleType` | Wiggle Type | Popup | N/A | 1 | `["Static", "Jumpy", "Smooth"]` | — |
| `ec.generate.scribble` | Scribble | `wigglesPerSecond` | Wiggles/Second | Num | [0, 100, 0, 30, 2] | 5 | N/A | time |
| `ec.generate.scribble` | Scribble | `randomSeed` | Random Seed | Num | [0, 10000, 0, 100, 0] | 1 | N/A | — |
| `ec.generate.scribble` | Scribble | `composite` | Composite | Popup | N/A | 1 | `["On Original Image", "On Transparent", "Reveal Original Image"]` | — |
| `ec.generate.stroke` | Stroke | `path` | Path | Mask | [1, 100, 1, 20, 0] | 1 | N/A | mask |
| `ec.generate.stroke` | Stroke | `allMasks` | All Masks | Bool | N/A | false | N/A | mask |
| `ec.generate.stroke` | Stroke | `strokeSequentially` | Stroke Sequentially | Bool | N/A | true | N/A | — |
| `ec.generate.stroke` | Stroke | `color` | Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.generate.stroke` | Stroke | `brushSize` | Brush Size | Num | [0, 50, 0, 50, 1] | 2 | N/A | — |
| `ec.generate.stroke` | Stroke | `brushHardness` | Brush Hardness | Num | [0, 100, 0, 100, 1] | 75 | N/A | — |
| `ec.generate.stroke` | Stroke | `opacity` | Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.stroke` | Stroke | `start` | Start | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.generate.stroke` | Stroke | `end` | End | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.stroke` | Stroke | `spacing` | Spacing | Num | [0, 100, 0, 100, 1] | 15 | N/A | — |
| `ec.generate.stroke` | Stroke | `paintStyle` | Paint Style | Popup | N/A | 0 | `["On Original Image", "On Transparent", "Reveal Original Image"]` | — |
| `ec.generate.vegas` | Vegas | `stroke` | Stroke | Popup | N/A | 0 | `["Image Contours", "Mask/Path"]` | layer, mask |
| `ec.generate.vegas` | Vegas | `inputLayer` | Image Contours: Input Layer | Layer | N/A | None | Project Layers | layer |
| `ec.generate.vegas` | Vegas | `inputLayerSource` | Image Contours: Input Layer Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.generate.vegas` | Vegas | `invertInput` | Image Contours: Invert Input | Bool | N/A | false | N/A | — |
| `ec.generate.vegas` | Vegas | `ifLayerSizesDiffer` | Image Contours: If Layer Sizes Differ | Popup | N/A | 0 | `["Center", "Stretch to Fit"]` | — |
| `ec.generate.vegas` | Vegas | `channel` | Image Contours: Channel | Popup | N/A | 0 | `["Intensity", "Red", "Green", "Blue", "Alpha"]` | — |
| `ec.generate.vegas` | Vegas | `threshold` | Image Contours: Threshold | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.vegas` | Vegas | `preBlur` | Image Contours: Pre-Blur | Num | [0, 100, 0, 20, 1] | 1 | N/A | — |
| `ec.generate.vegas` | Vegas | `tolerance` | Image Contours: Tolerance | Num | [0, 1, 0, 0.1, 3] | 0.01 | N/A | — |
| `ec.generate.vegas` | Vegas | `renderMode` | Image Contours: Render | Popup | N/A | 0 | `["All Contours", "Selected Contour"]` | — |
| `ec.generate.vegas` | Vegas | `selectedContour` | Image Contours: Selected Contour | Num | [1, 1000, 1, 20, 0] | 1 | N/A | — |
| `ec.generate.vegas` | Vegas | `shorterContoursHave` | Image Contours: Shorter Contours Have | Popup | N/A | 0 | `["Same Number of Segments", "Fewer Segments"]` | — |
| `ec.generate.vegas` | Vegas | `path` | Mask/Path: Path | Mask | [1, 100, 1, 20, 0] | 1 | N/A | mask |
| `ec.generate.vegas` | Vegas | `segments` | Segments: Segments | Num | [1, 1000, 1, 100, 0] | 32 | N/A | — |
| `ec.generate.vegas` | Vegas | `length` | Segments: Length | Num | [0, 1, 0, 1, 3] | 0.5 | N/A | — |
| `ec.generate.vegas` | Vegas | `segmentDistribution` | Segments: Segment Distribution | Popup | N/A | 0 | `["Bunched", "Even"]` | — |
| `ec.generate.vegas` | Vegas | `rotation` | Segments: Rotation | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.generate.vegas` | Vegas | `randomPhase` | Segments: Random Phase | Bool | N/A | false | N/A | — |
| `ec.generate.vegas` | Vegas | `randomSeed` | Segments: Random Seed | Num | [1, 10000, 1, 100, 0] | 1 | N/A | — |
| `ec.generate.vegas` | Vegas | `blendMode` | Rendering: Blend Mode | Popup | N/A | 1 | `["Transparent", "Over", "Under", "Stencil"]` | — |
| `ec.generate.vegas` | Vegas | `color` | Rendering: Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.generate.vegas` | Vegas | `width` | Rendering: Width | Num | [0, 100, 0, 20, 2] | 2 | N/A | — |
| `ec.generate.vegas` | Vegas | `hardness` | Rendering: Hardness | Num | [0, 1, 0, 1, 3] | 0.5 | N/A | — |
| `ec.generate.vegas` | Vegas | `startOpacity` | Rendering: Start Opacity | Num | [0, 1, 0, 1, 3] | 1 | N/A | — |
| `ec.generate.vegas` | Vegas | `midpointOpacity` | Rendering: Mid-point Opacity | Num | [0, 1, 0, 1, 3] | 0.5 | N/A | — |
| `ec.generate.vegas` | Vegas | `midpointPosition` | Rendering: Mid-point Position | Num | [0, 1, 0, 1, 3] | 0.5 | N/A | — |
| `ec.generate.vegas` | Vegas | `endOpacity` | Rendering: End Opacity | Num | [0, 1, 0, 1, 3] | 0 | N/A | — |
| `ec.generate.writeon` | Write-on | `brushPosition` | Brush Position | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | params_at, time |
| `ec.generate.writeon` | Write-on | `color` | Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.generate.writeon` | Write-on | `brushSize` | Brush Size | Num | [0, 50, 0, 50, 1] | 6 | N/A | params_at, time |
| `ec.generate.writeon` | Write-on | `brushHardness` | Brush Hardness | Num | [0, 100, 0, 100, 1] | 75 | N/A | — |
| `ec.generate.writeon` | Write-on | `brushOpacity` | Brush Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | params_at, time |
| `ec.generate.writeon` | Write-on | `strokeLength` | Stroke Length (secs) | Num | [0, 30, 0, 30, 1] | 0 | N/A | time |
| `ec.generate.writeon` | Write-on | `brushSpacing` | Brush Spacing (secs) | Num | [0.001, 5, 0.001, 5, 3] | 0.001 | N/A | time |
| `ec.generate.writeon` | Write-on | `paintTimeProperties` | Paint Time Properties | Popup | N/A | 0 | `["None", "Opacity", "Color"]` | — |
| `ec.generate.writeon` | Write-on | `brushTimeProperties` | Brush Time Properties | Popup | N/A | 0 | `["None", "Size", "Hardness", "Size & Hardness"]` | — |
| `ec.generate.writeon` | Write-on | `paintStyle` | Paint Style | Popup | N/A | 0 | `["On Original Image", "On Transparent", "Reveal Original Image"]` | — |
| `ec.generate.paintbucket` | Paint Bucket | `fillPoint` | Fill Point | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `fillSelector` | Fill Selector | Popup | N/A | 0 | `["Color & Alpha", "Straight Color", "Transparency", "Opacity", "Alpha Channel"]` | — |
| `ec.generate.paintbucket` | Paint Bucket | `tolerance` | Tolerance | Num | [0, 255, 0, 100, 1] | 10 | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `viewThreshold` | View Threshold | Bool | N/A | false | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `stroke` | Stroke | Popup | N/A | 0 | `["Antialias", "Feather", "Spread", "Choke", "Stroke"]` | — |
| `ec.generate.paintbucket` | Paint Bucket | `featherSoftness` | Feather Softness | Num | [0, 100, 0, 50, 1] | 10 | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `spreadRadius` | Spread Radius | Num | [0, 100, 0, 20, 1] | 3 | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `strokeWidth` | Stroke Width | Num | [0, 100, 0, 20, 1] | 2 | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `color` | Color | Color | N/A | [1, 0, 0, 1] | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `opacity` | Opacity | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.paintbucket` | Paint Bucket | `blendingMode` | Blending Mode | Popup | N/A | 0 | `["Normal", "Add", "Multiply", "Screen", "Hue", "Saturation", "Color", "Luminosity", "Behind", "Fill Only"]` | — |
| `ec.generate.eyedropperfill` | Eyedropper Fill | `samplePoint` | Sample Point | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.generate.eyedropperfill` | Eyedropper Fill | `sampleRadius` | Sample Radius | Num | [0, 1000, 0, 100, 1] | 0 | N/A | — |
| `ec.generate.eyedropperfill` | Eyedropper Fill | `averagePixelColors` | Average Pixel Colors | Popup | N/A | 0 | `["Skip Empty", "All", "All Premultiplied", "Including Alpha"]` | — |
| `ec.generate.eyedropperfill` | Eyedropper Fill | `maintainOriginalAlpha` | Maintain Original Alpha | Bool | N/A | false | N/A | — |
| `ec.generate.eyedropperfill` | Eyedropper Fill | `blendWithOriginal` | Blend With Original | Num | [0, 100, 0, 100, 1] | 0 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `brushPosition` | Brush Position | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `strokeWidth` | Stroke Width | Num | [0, 500, 0, 100, 1] | 25 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `density` | Density | Num | [0, 32, 0, 32, 1] | 5 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `timeSpan` | Time Span (sec) | Num | [0, 60, 0, 10, 2] | 1 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `reflection` | Reflection | Angle | [-Infinity, Infinity, 0, 360, 1] | 45 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `strength` | Strength | Num | [0, 100, 0, 100, 1] | 100 | N/A | — |
| `ec.generate.ccgluegun` | CC Glue Gun | `style` | Style | Popup | N/A | 0 | `["Over Layer", "Glue Only"]` | — |
| `ec.generate.ccthreads` | CC Threads | `width` | Width | Num | [1, 1000, 1, 200, 1] | 50 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `height` | Height | Num | [1, 1000, 1, 200, 1] | 50 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `overlaps` | Overlaps | Num | [1, 20, 1, 10, 0] | 1 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `direction` | Direction | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `center` | Center | Point | [0, 1, 0, 1, 3] | [0.5, 0.5] | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `coverage` | Coverage | Num | [0, 100, 0, 100, 1] | 80 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `shadowing` | Shadowing | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.ccthreads` | CC Threads | `texture` | Texture | Num | [0, 100, 0, 100, 1] | 10 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `audioLayer` | Audio Layer | Layer | N/A | None | Project Audio Layers | audio, time |
| `ec.generate.audiospectrum` | Audio Spectrum | `audioLayerSource` | Audio Layer Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `startPoint` | Start Point | Point | [0, 1, 0, 1, 3] | [0.1, 0.5] | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `endPoint` | End Point | Point | [0, 1, 0, 1, 3] | [0.9, 0.5] | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `path` | Path | Mask | [0, 100, 0, 20, 0] | 0 | N/A | mask |
| `ec.generate.audiospectrum` | Audio Spectrum | `usePolarPath` | Use Polar Path | Bool | N/A | false | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `startFrequency` | Start Frequency | Num | [1, 20000, 1, 2000, 0] | 20 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `endFrequency` | End Frequency | Num | [1, 20000, 1, 10000, 0] | 2000 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `frequencyBands` | Frequency bands | Num | [1, 4096, 1, 256, 0] | 64 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `maximumHeight` | Maximum Height | Num | [0, 10000, 0, 500, 1] | 50 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `audioDuration` | Audio Duration (milliseconds) | Num | [1, 30000, 1, 1000, 1] | 90 | N/A | audio, time |
| `ec.generate.audiospectrum` | Audio Spectrum | `audioOffset` | Audio Offset (milliseconds) | Num | [-30000, 30000, -1000, 1000, 1] | 0 | N/A | audio, time |
| `ec.generate.audiospectrum` | Audio Spectrum | `thickness` | Thickness | Num | [0, 1000, 0, 50, 2] | 3 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `softness` | Softness | Num | [0, 100, 0, 100, 1] | 50 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `insideColor` | Inside Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `outsideColor` | Outside Color | Color | N/A | [0.2, 0.4, 1.0, 1] | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `blendOverlappingColors` | Blend Overlapping Colors | Bool | N/A | true | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `hueInterpolation` | Hue Interpolation | Angle | [-Infinity, Infinity, 0, 360, 1] | 0 | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `dynamicHuePhase` | Dynamic Hue Phase | Bool | N/A | false | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `colorSymmetry` | Color Symmetry | Bool | N/A | false | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `displayOptions` | Display Options | Popup | N/A | 0 | `["Digital", "Analog lines", "Analog dots"]` | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `sideOptions` | Side Options | Popup | N/A | 0 | `["Side A", "Side B", "Side A & B"]` | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `durationAveraging` | Duration Averaging | Bool | N/A | false | N/A | — |
| `ec.generate.audiospectrum` | Audio Spectrum | `compositeOnOriginal` | Composite On Original | Bool | N/A | false | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `audioLayer` | Audio Layer | Layer | N/A | None | Project Audio Layers | audio, time |
| `ec.generate.audiowaveform` | Audio Waveform | `audioLayerSource` | Audio Layer Source | Popup | N/A | 2 | `["Source", "Masks", "Effects & Masks"]` | — |
| `ec.generate.audiowaveform` | Audio Waveform | `startPoint` | Start Point | Point | [0, 1, 0, 1, 3] | [0.1, 0.5] | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `endPoint` | End Point | Point | [0, 1, 0, 1, 3] | [0.9, 0.5] | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `path` | Path | Mask | [0, 100, 0, 20, 0] | 0 | N/A | mask |
| `ec.generate.audiowaveform` | Audio Waveform | `usePolarPath` | Use Polar Path | Bool | N/A | false | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `displayedSamples` | Displayed Samples | Num | [2, 4096, 2, 1000, 0] | 200 | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `maximumHeight` | Maximum Height | Num | [0, 10000, 0, 500, 1] | 100 | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `audioDuration` | Audio Duration (milliseconds) | Num | [1, 30000, 1, 1000, 1] | 200 | N/A | audio, time |
| `ec.generate.audiowaveform` | Audio Waveform | `audioOffset` | Audio Offset (milliseconds) | Num | [-30000, 30000, -1000, 1000, 1] | 0 | N/A | audio, time |
| `ec.generate.audiowaveform` | Audio Waveform | `thickness` | Thickness | Num | [0, 1000, 0, 50, 2] | 2 | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `softness` | Softness | Num | [0, 100, 0, 100, 1] | 10 | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `randomSeed` | Random Seed (Analog) | Num | [1, 10000, 1, 100, 0] | 1 | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `insideColor` | Inside Color | Color | N/A | [1, 1, 1, 1] | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `outsideColor` | Outside Color | Color | N/A | [0.2, 0.4, 1.0, 1] | N/A | — |
| `ec.generate.audiowaveform` | Audio Waveform | `waveformOptions` | Waveform Options | Popup | N/A | 0 | `["Mono", "Left", "Right"]` | — |
| `ec.generate.audiowaveform` | Audio Waveform | `displayOptions` | Display Options | Popup | N/A | 1 | `["Digital", "Analog lines", "Analog dots"]` | — |
| `ec.generate.audiowaveform` | Audio Waveform | `compositeOnOriginal` | Composite On Original | Bool | N/A | false | N/A | — |

---

## 3. User Experience & Visual Design

### Key User Flows
1. **Asset Drop & Auto-Layering**: User drags audio/video/image/font files into the window. Media lands in Assets > Media and immediately creates a corresponding layer at the playhead on top of the composition stack.
2. **Canvas Manipulation & Snapping**: Selecting layers on the canvas renders interactive transform handles (bounding box + corner/side resize handles + rotation handle + anchor point). Snapping guides (cyan 1px lines) appear when edges or centers align with canvas bounds or other layers within a ~6px threshold.
3. **Multi-Track Timeline**:
   - Razor tool (`C` hotkey) cuts any layer at the playhead; Selection tool (`V`) restores normal select/drag mode.
   - Trimming multiple selected layers synchronously adjusts durations.
   - Audio layers decode waveforms in-memory and render dual-channel cached waveforms that rescale on Alt+wheel zoom.
   - Property twirl-downs expose Transform, Masks, and Effects with stopwatch toggle buttons and keyframe diamonds.
4. **Effect Application & Inspection**:
   - Assets > Effects lists all 29 categorized effects. Selecting layers and clicking `+ Add` pushes the effect into each selected layer's stack.
   - Inspector displays grouped properties (e.g. `fractalColor/hue`, `edgeOptions/endCap`), numeric sliders with soft/hard bounds, angle dials, color pickers, and normalized layer-coordinate point pickers.
5. **Project Persistence**: Full JSON export and drag-and-drop import restoring layers, keyframes, wiggle arguments, effect parameters, and embedded base64 media.

### Visual Styling & Theme Tokens
- **Theme**: Compact After Effects dark theme.
  - Surface Canvas: `#121316`
  - Panel Backgrounds: `#1b1c20`
  - Active Selection / Playhead: `#2d62ea`
  - Playhead Scrubber Line: `#e03b3b`
  - Snapping Guides: `#00e5ff`
  - Keyframe Diamonds: `#e2a03f` (yellow-gold)
  - Typography: `Plus Jakarta Sans` for UI labels; `JetBrains Mono` / `tabular-nums` for timecodes, frame counters, and numeric fields.

---

## 4. Technical Architecture & Data Strategy

### System Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Bar (Menu & Controls)                       │
│  File · Edit · Composition · Settings  │  Timecode  │  Quality Preview │
└──────────────┬─────────────────────────┴─────────────┬─────────────────┘
               │                                       │
┌──────────────▼──────────────┐         ┌──────────────▼─────────────────┐
│     Assets & Library        │         │       Inspector (Properties)   │
│  ┌───────────────────────┐  │         │  ┌───────────────────────────┐ │
│  │ Media Tab (Files)     │  │         │  │ Transform & Blend Mode    │ │
│  │ Effects Tab (29 FX)   │  │         │  │ Effect Stack & Groups     │ │
│  └───────────────────────┘  │         │  │ Wiggle & Stopwatches      │ │
└──────────────┬──────────────┘         │  └───────────────────────────┘ │
               │                        └──────────────▲─────────────────┘
               │                                       │
┌──────────────▼───────────────────────────────────────┴─────────────────┐
│              Composition Viewport (Canvas + Snapping Handles)          │
│              Full / Half / Third / Quarter Buffer Pipeline             │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼─────────────────────────────────┐
│                     Timeline (Multi-track Editor)                      │
│   Ruler (Adaptive Zoom) · Playhead · Layer Rows · Waveform · Keyframes │
└────────────────────────────────────────────────────────────────────────┘
```

### State & Engine Modules
- `src/engine/types.ts`: Layer models, Property, Keyframe, Project, Comp Settings, EffectSpec, and ParamSpec types.
- `src/engine/registry.ts`: 1:1 derived registry of all 29 effects with typed schema and metadata.
- `src/engine/state.ts`: Central immutable state with reactive subscriptions, Command History (Undo/Redo with $\ge 100$ actions and interaction coalescing).
- `src/engine/wiggle.ts`: Deterministic seeded noise function `wiggle(freq, amp, octaves, amp_mult, t)` based on `(layerId + propId)`.
- `src/engine/renderer.ts`: Multi-layer compositor evaluating keyframes, wiggle, blend modes (all standard 38 modes + 12 Solid Composite modes), adjustment layer stack isolation, and preview resolution scaling (`1.0`, `0.5`, `0.333`, `0.25`).
- `src/engine/projectIo.ts`: JSON serializer/deserializer with base64 asset embedding, schema versioning, and validation.

---

## 5. Verification & Acceptance Plan

- [ ] Complete parameter table matches all 29 effects 1:1 in ids, names, defaults, ranges, and option arrays.
- [ ] Drop media into window $\rightarrow$ creates media asset and adds new layer at playhead.
- [ ] Canvas editing supports move, resize (Shift = lock ratio, Alt = from center), rotate, and snapping guides within 6px threshold.
- [ ] Timeline provides razor split (`C`), selection (`V`), Alt+wheel zoom anchored at cursor down to single-frame resolution, and cached audio waveforms.
- [ ] Undo/Redo ($\ge 100$ steps) tracks layer manipulations, keyframes, effects, and comp settings with drag coalescing.
- [ ] Project Save/Load round-trips with zero data loss.
- [ ] Effects can be added to any selected layer via "+ Add" with proper grouped twirl-down controls in the inspector.
