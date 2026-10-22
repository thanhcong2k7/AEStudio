/**
 * AEStudio - Transport Bar (Playback Controls & Viewport Zoom)
 */

import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  ZoomIn,
} from 'lucide-react';
import { store, EditorState } from '../engine/state';

interface TransportBarProps {
  state: EditorState;
}

export const TransportBar: React.FC<TransportBarProps> = ({ state }) => {
  const { isPlaying, isLooping, currentTime, project, viewportZoom } = state;
  const { comp } = project;

  // Global hotkeys for playback & stepping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 10 / comp.fps : 1 / comp.fps;
        store.setCurrentTime(Math.max(0, currentTime - step));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 / comp.fps : 1 / comp.fps;
        store.setCurrentTime(Math.min(comp.duration, currentTime + step));
      } else if (e.code === 'Home') {
        e.preventDefault();
        store.setCurrentTime(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        store.setCurrentTime(comp.duration);
      } else if (e.code === 'KeyV') {
        store.setTool('select');
      } else if (e.code === 'KeyC') {
        store.setTool('razor');
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyD') {
        e.preventDefault();
        store.duplicateSelectedLayers();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        store.deleteSelectedLayers();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyY') {
        e.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, comp]);

  const stepFrames = (frames: number) => {
    const next = currentTime + frames / comp.fps;
    store.setCurrentTime(Math.max(0, Math.min(comp.duration, next)));
  };

  return (
    <div className="h-9 bg-[#17181c] border-t border-[#26282e] flex items-center justify-between px-3 select-none text-xs">
      {/* Left: Playhead position */}
      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
        <span>{(currentTime).toFixed(2)}s</span>
        <span>/</span>
        <span>{comp.duration.toFixed(2)}s</span>
      </div>

      {/* Center: Transport Buttons */}
      <div className="flex items-center gap-1">
        {/* Go to Start */}
        <button
          onClick={() => store.setCurrentTime(0)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors"
          title="Go to Start (Home)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Step -10 frames */}
        <button
          onClick={() => stepFrames(-10)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors text-[10px] font-mono"
          title="Back 10 frames (Shift+Left)"
        >
          -10f
        </button>

        {/* Step -1 frame */}
        <button
          onClick={() => stepFrames(-1)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors"
          title="Previous frame (Left Arrow)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Play / Pause Primary Button */}
        <button
          onClick={() => store.togglePlay()}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all mx-1 shadow-sm ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-black'
              : 'bg-[#2d62ea] hover:bg-[#3d72fa] text-white'
          }`}
          title="Play / Pause (Spacebar)"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
        </button>

        {/* Step +1 frame */}
        <button
          onClick={() => stepFrames(1)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors"
          title="Next frame (Right Arrow)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Step +10 frames */}
        <button
          onClick={() => stepFrames(10)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors text-[10px] font-mono"
          title="Forward 10 frames (Shift+Right)"
        >
          +10f
        </button>

        {/* Go to End */}
        <button
          onClick={() => store.setCurrentTime(comp.duration)}
          className="p-1.5 hover:bg-[#252830] text-slate-400 hover:text-white rounded transition-colors"
          title="Go to End (End)"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={() => store.toggleLoop()}
          className={`p-1.5 rounded transition-colors ml-2 ${
            isLooping
              ? 'bg-[#1b253b] text-blue-400'
              : 'hover:bg-[#252830] text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Loop Playback"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Viewport Zoom Presets */}
      <div className="flex items-center gap-1.5">
        <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={viewportZoom}
          onChange={(e) => store.setViewportZoom(parseFloat(e.target.value))}
          className="bg-[#121316] border border-[#2b2e36] text-slate-300 text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-slate-500"
        >
          <option value={0}>Fit</option>
          <option value={0.25}>25%</option>
          <option value={0.5}>50%</option>
          <option value={0.75}>75%</option>
          <option value={1.0}>100%</option>
          <option value={2.0}>200%</option>
        </select>
      </div>
    </div>
  );
};
