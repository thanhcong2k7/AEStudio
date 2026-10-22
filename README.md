# Remix AEStudio

A browser-based motion graphics, visual effects, and video compositing suite inspired by professional desktop NLEs and motion software.

## Features

- **Multi-Track Timeline**: Layer ordering, track controls (mute, solo, lock, hide), in/out trimming, keyframe interpolation, and property twirling.
- **29-Effect Compositing Engine**:
  - **Color & Channel**: Curves, Levels, Hue/Saturation, Color Balance, Invert, Tint, Posterize, Threshold.
  - **Distort & Geometry**: Corner Pin, Bulge, Ripple, Twirl, Wave Warp, Polar Coordinates, Mirror, Displace.
  - **Generate & Stylize**: Linear/Radial Gradients, Noise, Vignette, Grid, Checkerboard, Stroke, Drop Shadow, Glow.
  - **Audio & Procedural**: FFT Audio Spectrum / Waveform visualization, procedural wiggle / jitter evaluators.
- **Interactive Canvas Viewport**: Real-time rendering, interactive transform gizmos, rotation handles, aspect-ratio scaling, snapping guidelines, and live real-time FPS counter.
- **Inspector Panel**: Layer transform properties (position, scale, rotation, opacity, anchor point), blending modes, effect parameter controls, and per-property keyframe toggles.
- **Media Ingestion & Asset Library**: Drag-and-drop local images, video clips, and audio files with auto-waveform extraction and memory-safe streaming for long media (1h+).
- **Exporting & Serialization**:
  - Portable `.aes` ZIP project container packaging `project.json` and bundled media assets with zero base64 bloat.
  - Video rendering to MP4/WebM via canvas capture stream and Web Audio destination.
  - Single-frame high-resolution PNG export.
  - Full project import/export via structured `.ae.json`.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Plus Jakarta Sans & JetBrains Mono typography
- **Icons & Motion**: Lucide React + Motion

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
