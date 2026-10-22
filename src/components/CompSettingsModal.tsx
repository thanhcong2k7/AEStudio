/**
 * AEStudio - Composition Settings Modal
 */

import React, { useState } from 'react';
import { X, Lock, Unlock } from 'lucide-react';
import { store, EditorState } from '../engine/state';
import { CompSettings } from '../engine/types';

interface CompSettingsModalProps {
  state: EditorState;
  onClose: () => void;
}

const PRESETS = [
  { label: 'HDTV 1080p (1920×1080)', w: 1920, h: 1080, fps: 30 },
  { label: 'HDTV 720p (1280×720)', w: 1280, h: 720, fps: 30 },
  { label: '4K UHD (3840×2160)', w: 3840, h: 2160, fps: 30 },
  { label: 'Social Vertical 9:16 (1080×1920)', w: 1080, h: 1920, fps: 30 },
  { label: 'Social Square 1:1 (1080×1080)', w: 1080, h: 1080, fps: 30 },
];

export const CompSettingsModal: React.FC<CompSettingsModalProps> = ({ state, onClose }) => {
  const comp = state.project.comp;

  const [width, setWidth] = useState(comp.width);
  const [height, setHeight] = useState(comp.height);
  const [fps, setFps] = useState(comp.fps);
  const [duration, setDuration] = useState(comp.duration);
  const [bgColor, setBgColor] = useState(comp.backgroundColor || '#121316');
  const [shutterAngle, setShutterAngle] = useState(comp.shutterAngle || 180);
  const [shutterSamples, setShutterSamples] = useState(comp.shutterSamples || 16);
  const [aspectLock, setAspectLock] = useState(comp.aspectRatioLocked ?? true);

  const aspectRatio = comp.width / comp.height;

  const handleWidthChange = (newW: number) => {
    setWidth(newW);
    if (aspectLock) {
      setHeight(Math.round(newW / aspectRatio));
    }
  };

  const handleHeightChange = (newH: number) => {
    setHeight(newH);
    if (aspectLock) {
      setWidth(Math.round(newH * aspectRatio));
    }
  };

  const handlePresetChange = (preset: (typeof PRESETS)[0]) => {
    setWidth(preset.w);
    setHeight(preset.h);
    setFps(preset.fps);
  };

  const handleSave = () => {
    store.updateCompSettings({
      width: Math.max(100, width),
      height: Math.max(100, height),
      fps: Math.max(1, fps),
      duration: Math.max(1, duration),
      backgroundColor: bgColor,
      shutterAngle,
      shutterSamples,
      aspectRatioLocked: aspectLock,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1c1d22] border border-[#2f323c] rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 select-none">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#151619] border-b border-[#282a32] flex items-center justify-between">
          <span className="font-bold text-sm tracking-tight text-white">Composition Settings</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5">
          {/* Preset Selector */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Presets</label>
            <select
              onChange={(e) => {
                const p = PRESETS.find((pr) => pr.label === e.target.value);
                if (p) handlePresetChange(p);
              }}
              className="w-full bg-[#121316] border border-[#2c2f37] text-slate-200 rounded px-2.5 py-1.5 outline-none"
            >
              <option value="">Custom Dimension...</option>
              {PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Width / Height with Aspect Lock */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Width (px)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="w-full bg-[#121316] border border-[#2c2f37] rounded px-2 py-1 font-mono text-slate-200 outline-none"
              />
            </div>

            <button
              onClick={() => setAspectLock(!aspectLock)}
              className={`p-2 rounded mt-5 border transition-colors ${
                aspectLock
                  ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                  : 'border-[#2c2f37] text-slate-500 hover:text-slate-300'
              }`}
              title="Lock Aspect Ratio (16:9 default)"
            >
              {aspectLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Height (px)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="w-full bg-[#121316] border border-[#2c2f37] rounded px-2 py-1 font-mono text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* Frame Rate & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Frame Rate (FPS)</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-[#121316] border border-[#2c2f37] text-slate-200 rounded px-2 py-1.5 outline-none font-mono"
              >
                <option value={24}>24 fps (Film)</option>
                <option value={25}>25 fps (PAL)</option>
                <option value={30}>30 fps (NTSC/Web)</option>
                <option value={60}>60 fps (High Motion)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Duration (Seconds)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="3600"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-[#121316] border border-[#2c2f37] rounded px-2 py-1.5 font-mono text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Background Color</span>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-10 h-6 bg-transparent cursor-pointer rounded"
            />
          </div>

          {/* Shutter Angle & Samples */}
          <div className="p-3 bg-[#141518] rounded-lg border border-[#26282e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Shutter Angle (Degrees)</span>
              <span className="font-mono text-blue-400">{shutterAngle}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={720}
              value={shutterAngle}
              onChange={(e) => setShutterAngle(Number(e.target.value))}
              className="w-full h-1 bg-[#262830] rounded cursor-pointer"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Shutter Samples</span>
              <input
                type="number"
                min={2}
                max={64}
                value={shutterSamples}
                onChange={(e) => setShutterSamples(Number(e.target.value))}
                className="w-16 bg-[#18191c] border border-[#2c2f37] rounded px-1.5 py-0.5 text-right font-mono"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#151619] border-t border-[#282a32] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded hover:bg-[#26282e] text-slate-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#2d62ea] hover:bg-[#3b70f8] text-white font-medium rounded shadow-sm"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
