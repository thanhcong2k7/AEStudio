/**
 * AEStudio - Multi-Track Timeline with Adaptive Ruler, Razor, Waveforms & Keyframes
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MousePointer,
  Scissors,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  Plus,
  ZoomIn,
  ZoomOut,
  Magnet,
  Trash2,
  Copy,
  Sparkles,
} from 'lucide-react';
import { store, EditorState } from '../engine/state';
import { Layer, BlendMode, KeyframeInterpolation, AnimatableProp } from '../engine/types';
import { EFFECT_REGISTRY } from '../engine/registry';

interface TimelineProps {
  state: EditorState;
}

export const Timeline: React.FC<TimelineProps> = ({ state }) => {
  const {
    project,
    currentTime,
    selectedLayerIds,
    activeTool,
    snappingEnabled,
    timelineZoom,
    timelineScrollX,
  } = state;
  const { comp, layers } = project;

  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const [expandedLayerProps, setExpandedLayerProps] = useState<Record<string, boolean>>({});
  const [dragAction, setDragAction] = useState<{
    type: 'move' | 'trimStart' | 'trimEnd' | 'playhead' | 'keyframe';
    layerId?: string;
    propPath?: string;
    kfId?: string;
    startX: number;
    initialStarts?: Map<string, number>;
    initialPoints?: Map<string, number>;
    initialKfTime?: number;
  } | null>(null);

  // Drag reorder state for vertical layer tracks
  const [draggedLayerIdx, setDraggedLayerIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const toggleLayerExpanded = (layerId: string) => {
    setExpandedLayerProps((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // Compute adaptive ruler intervals
  const getRulerInterval = useCallback((zoom: number, fps: number) => {
    // zoom = px per second. We want label spacing >= 60px
    const minPixelSpacing = 65;
    const secondsPerUnit = minPixelSpacing / zoom;

    const intervals = [
      1 / fps, // 1 frame
      2 / fps,
      5 / fps,
      10 / fps,
      15 / fps,
      0.5, // 0.5s
      1, // 1s
      2,
      5,
      10,
      15,
      30,
      60,
      120,
      300,
      600,
      900,
      1800,
      3600,
    ];

    for (const interval of intervals) {
      if (interval >= secondsPerUnit) {
        return interval;
      }
    }
    return 3600;
  }, []);

  // Format ruler tick label
  const formatRulerLabel = (sec: number, interval: number, fps: number) => {
    if (interval < 0.5) {
      // Show frames
      const totalFrames = Math.round(sec * fps);
      const f = totalFrames % fps;
      const s = Math.floor(sec) % 60;
      const m = Math.floor(sec / 60);
      if (m > 0) return `${m}m ${s}s ${f}f`;
      return `${s}s ${f}f`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    if (m > 0) {
      return s > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
    }
    return `${s}s`;
  };

  // Draw Adaptive Ruler
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (container && container.clientWidth > 0) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 28;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#17181c';
    ctx.fillRect(0, 0, width, height);

    const interval = getRulerInterval(timelineZoom, comp.fps);
    const startTime = timelineScrollX / timelineZoom;
    const endTime = (timelineScrollX + width) / timelineZoom;

    const firstTick = Math.floor(startTime / interval) * interval;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    for (let t = firstTick; t <= endTime; t += interval) {
      const x = Math.round((t - startTime) * timelineZoom);
      if (x < 0 || x > width) continue;

      // Major tick
      ctx.strokeStyle = '#383b45';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height - 10);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#787d8d';
      ctx.fillText(formatRulerLabel(t, interval, comp.fps), x + 3, 4);

      // Minor ticks (sub-divisions)
      const subTicks = 4;
      const subInterval = interval / subTicks;
      for (let s = 1; s < subTicks; s++) {
        const subT = t + s * subInterval;
        const subX = Math.round((subT - startTime) * timelineZoom);
        if (subX >= 0 && subX <= width) {
          ctx.strokeStyle = '#282a32';
          ctx.beginPath();
          ctx.moveTo(subX + 0.5, height - 5);
          ctx.lineTo(subX + 0.5, height);
          ctx.stroke();
        }
      }
    }

    // Comp End Boundary marker
    const endX = Math.round((comp.duration - startTime) * timelineZoom);
    if (endX >= 0 && endX <= width) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(endX, 0, width - endX, height);
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(endX + 0.5, 0);
      ctx.lineTo(endX + 0.5, height);
      ctx.stroke();
    }
  }, [timelineZoom, timelineScrollX, comp.duration, comp.fps, getRulerInterval]);

  // Wheel listener: Alt+Wheel = Zoom; Shift+Wheel = Horizontal Scroll; Wheel = Vertical
  const handleWheel = (e: React.WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      const rect = trackScrollRef.current?.getBoundingClientRect();
      const mouseX = rect ? e.clientX - rect.left : 100;
      const mouseTime = (timelineScrollX + mouseX) / timelineZoom;

      const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.max(0.5, Math.min(1000, timelineZoom * zoomFactor));

      // Re-anchor scroll at mouse cursor
      const newScrollX = Math.max(0, mouseTime * newZoom - mouseX);
      store.setTimelineZoom(newZoom);
      store.setTimelineScrollX(newScrollX);
    } else if (e.shiftKey) {
      e.preventDefault();
      store.setTimelineScrollX(Math.max(0, timelineScrollX + e.deltaY));
    }
  };

  // Ruler Mouse Interactions (Seek Playhead)
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    const rect = rulerCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ox = e.clientX - rect.left;
    const t = Math.max(0, Math.min(comp.duration, (timelineScrollX + ox) / timelineZoom));
    store.setCurrentTime(t);
    setDragAction({ type: 'playhead', startX: e.clientX });
  };

  // Drag interaction handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragAction) return;

      if (dragAction.type === 'playhead') {
        const rect = rulerCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const ox = e.clientX - rect.left;
        const t = Math.max(0, Math.min(comp.duration, (timelineScrollX + ox) / timelineZoom));
        store.setCurrentTime(t);
      } else if (dragAction.type === 'move' && dragAction.initialStarts) {
        const dx = e.clientX - dragAction.startX;
        const deltaSec = dx / timelineZoom;
        store.setLayersStartTime(dragAction.initialStarts, deltaSec);
      } else if (
        (dragAction.type === 'trimStart' || dragAction.type === 'trimEnd') &&
        dragAction.initialPoints
      ) {
        const dx = e.clientX - dragAction.startX;
        const deltaSec = dx / timelineZoom;
        store.setLayersTrim(
          dragAction.type === 'trimStart' ? 'start' : 'end',
          dragAction.initialPoints,
          deltaSec
        );
      } else if (dragAction.type === 'keyframe' && dragAction.layerId && dragAction.propPath && dragAction.kfId) {
        const dx = e.clientX - dragAction.startX;
        const deltaSec = dx / timelineZoom;
        const newTime = Math.max(0, (dragAction.initialKfTime || 0) + deltaSec);

        // Update keyframe time
        const layer = layers.find((l) => l.id === dragAction.layerId);
        if (layer) {
          const prop = getPropByPath(layer, dragAction.propPath);
          if (prop) {
            const kf = prop.keyframes.find((k) => k.id === dragAction.kfId);
            if (kf) {
              kf.time = newTime;
              prop.keyframes.sort((a, b) => a.time - b.time);
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (dragAction) {
        store.commitContinuousAction();
        setDragAction(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragAction, comp.duration, timelineScrollX, timelineZoom, layers]);

  // Click on layer bar with Razor tool splits layer
  const handleLayerBarClick = (e: React.MouseEvent, layer: Layer) => {
    if (activeTool === 'razor') {
      e.stopPropagation();
      const rect = trackScrollRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ox = e.clientX - rect.left;
      const clickTime = (timelineScrollX + ox) / timelineZoom;
      store.setCurrentTime(clickTime);
      store.splitLayerAtPlayhead(layer.id);
    } else {
      store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
    }
  };

  const handleStartMoveLayerBar = (e: React.MouseEvent, layer: Layer) => {
    if (activeTool === 'razor') return;
    e.stopPropagation();
    if (!selectedLayerIds.includes(layer.id)) {
      store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
    }

    const effectiveSelected = selectedLayerIds.includes(layer.id)
      ? selectedLayerIds
      : [layer.id];
    const initialStarts = new Map<string, number>();
    for (const id of effectiveSelected) {
      const l = layers.find((x) => x.id === id);
      if (l) initialStarts.set(l.id, l.startTime);
    }

    setDragAction({
      type: 'move',
      layerId: layer.id,
      startX: e.clientX,
      initialStarts,
    });
  };

  const handleStartTrim = (e: React.MouseEvent, layer: Layer, edge: 'start' | 'end') => {
    e.stopPropagation();
    if (!selectedLayerIds.includes(layer.id)) {
      store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
    }

    const effectiveSelected = selectedLayerIds.includes(layer.id)
      ? selectedLayerIds
      : [layer.id];
    const initialPoints = new Map<string, number>();
    for (const id of effectiveSelected) {
      const l = layers.find((x) => x.id === id);
      if (l) initialPoints.set(l.id, edge === 'start' ? l.inPoint : l.outPoint);
    }

    setDragAction({
      type: edge === 'start' ? 'trimStart' : 'trimEnd',
      layerId: layer.id,
      startX: e.clientX,
      initialPoints,
    });
  };

  // Reorder drop handlers
  const handleDragTrackStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedLayerIdx(index);
    e.dataTransfer.setData('application/x-ae-layer-reorder', String(index));
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragTrackOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverIdx(index);
  };

  const handleDropTrack = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedLayerIdx !== null && draggedLayerIdx !== targetIndex) {
      store.reorderLayer(draggedLayerIdx, targetIndex);
    }
    setDraggedLayerIdx(null);
    setDragOverIdx(null);
  };

  const handleDragTrackEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLayerIdx(null);
    setDragOverIdx(null);
  };

  // Playhead position in pixels relative to track scroll area
  const playheadPixelX = (currentTime * timelineZoom) - timelineScrollX;

  return (
    <div
      ref={timelineContainerRef}
      className={`h-full w-full bg-[#18191c] border-t border-[#26282e] flex flex-col select-none text-xs ${
        activeTool === 'razor' ? 'cursor-[crosshair]' : ''
      }`}
      onWheel={handleWheel}
    >
      {/* Timeline Controls Toolbar */}
      <div className="h-8 bg-[#151619] border-b border-[#26282e] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Tool: Selection (V) */}
          <button
            onClick={() => store.setTool('select')}
            className={`p-1.5 rounded flex items-center gap-1 transition-colors ${
              activeTool === 'select'
                ? 'bg-[#2d62ea] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#202227]'
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* Tool: Razor (C) */}
          <button
            onClick={() => store.setTool('razor')}
            className={`p-1.5 rounded flex items-center gap-1 transition-colors ${
              activeTool === 'razor'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#202227]'
            }`}
            title="Razor Split Tool (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-[#2b2e36] mx-1"></div>

          {/* Snapping indicator */}
          <button
            onClick={() => store.toggleSnapping()}
            className={`p-1 rounded flex items-center gap-1 text-[11px] ${
              snappingEnabled ? 'text-cyan-400 font-medium' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Snapping"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1.5 text-slate-400">
          {/* Fit Composition Button */}
          <button
            onClick={() => {
              const containerW = trackScrollRef.current?.clientWidth || 1200;
              const targetZoom = Math.max(0.5, Math.min(800, (containerW * 0.95) / Math.max(1, comp.duration)));
              store.setTimelineZoom(targetZoom);
              store.setTimelineScrollX(0);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1d1f25] hover:bg-[#282a33] text-slate-300 hover:text-white border border-[#2c2f37] transition-colors"
            title="Fit Entire Composition to Timeline"
          >
            Fit Comp
          </button>

          <button
            onClick={() => store.setTimelineZoom(Math.max(0.5, timelineZoom / 1.3))}
            className="p-1 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((Math.log(Math.max(0.5, timelineZoom) / 0.5) / Math.log(800 / 0.5)) * 100)}
            onChange={(e) => {
              const sliderPct = Number(e.target.value) / 100;
              const calcZoom = 0.5 * Math.pow(800 / 0.5, sliderPct);
              store.setTimelineZoom(calcZoom);
            }}
            className="w-20 h-1 bg-[#262830] rounded cursor-pointer accent-[#2d62ea]"
            title={`Timeline Zoom: ${timelineZoom >= 10 ? Math.round(timelineZoom) : timelineZoom.toFixed(1)} px/s`}
          />

          <button
            onClick={() => store.setTimelineZoom(Math.min(1000, timelineZoom * 1.3))}
            className="p-1 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-mono text-slate-500 w-14 text-right select-none">
            {timelineZoom >= 10 ? `${Math.round(timelineZoom)}px/s` : `${timelineZoom.toFixed(1)}px/s`}
          </span>
        </div>
      </div>

      {/* Main Split: Left Headers vs Right Ruler & Tracks */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Layer Header Rows */}
        <div className="w-72 bg-[#17181c] border-r border-[#26282e] flex flex-col shrink-0 z-20 shadow-md">
          {/* Header Bar */}
          <div className="h-7 bg-[#141518] border-b border-[#26282e] flex items-center justify-between px-3 font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
            <span>Layers ({layers.length})</span>
            <span className="text-[9px] text-slate-500">In / Out</span>
          </div>

          {/* Track Header List */}
          <div className="flex-1 overflow-y-auto">
            {layers.map((layer, index) => {
              const isSelected = selectedLayerIds.includes(layer.id);
              const isExpanded = expandedLayerProps[layer.id];

              return (
                <div key={layer.id} className="border-b border-[#202227]">
                  {/* Layer Main Header Row */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragTrackStart(e, index)}
                    onDragOver={(e) => handleDragTrackOver(e, index)}
                    onDrop={(e) => handleDropTrack(e, index)}
                    onDragEnd={handleDragTrackEnd}
                    onClick={(e) => {
                      if (e.shiftKey) store.selectLayersRange(layer.id);
                      else store.selectLayer(layer.id, e.metaKey || e.ctrlKey);
                    }}
                    className={`h-8 flex items-center px-2 gap-1.5 transition-colors cursor-pointer relative ${
                      dragOverIdx === index ? 'border-t-2 border-blue-400' : ''
                    } ${
                      isSelected
                        ? 'bg-[#212b48] text-white'
                        : 'bg-[#18191c] text-slate-300 hover:bg-[#1e2025]'
                    }`}
                  >
                    {/* Twirl down expand */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerExpanded(layer.id);
                      }}
                      className="p-0.5 text-slate-500 hover:text-white"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {/* Visibility */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      className={`p-0.5 ${layer.visible ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
                    >
                      {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>

                    {/* Lock */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.updateLayer(layer.id, { locked: !layer.locked });
                      }}
                      className={`p-0.5 ${layer.locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`}
                    >
                      {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>

                    {/* Name */}
                    <span className="font-medium truncate flex-1 ml-0.5 text-[11px]" title={layer.name}>
                      {layer.name}
                    </span>

                    {/* Solo badge */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.updateLayer(layer.id, { solo: !layer.solo });
                      }}
                      className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                        layer.solo ? 'bg-amber-400 text-black' : 'text-slate-600 hover:text-slate-400'
                      }`}
                      title="Solo Layer"
                    >
                      S
                    </button>
                  </div>

                  {/* Expanded Property Rows (Transform, Effects) */}
                  {isExpanded && (
                    <div className="bg-[#131417] text-[10px] text-slate-400 pl-6 pr-2 py-1 space-y-1 font-mono">
                      <div className="py-0.5 text-slate-500 font-semibold uppercase">Transform</div>
                      {['position', 'scale', 'rotation', 'opacity'].map((propName) => {
                        const prop = (layer as any)[propName] as AnimatableProp<any>;
                        return (
                          <div key={propName} className="flex items-center justify-between py-0.5">
                            <span className="capitalize">{propName}</span>
                            <span className="text-[9px] text-blue-400">
                              {prop.keyframes?.length ? `${prop.keyframes.length} kfs` : 'static'}
                            </span>
                          </div>
                        );
                      })}

                      {layer.effects.length > 0 && (
                        <>
                          <div className="py-0.5 text-slate-500 font-semibold uppercase mt-1">Effects</div>
                          {layer.effects.map((fx) => (
                            <div key={fx.id} className="flex items-center justify-between py-0.5 pl-2 text-slate-300">
                              <span className="truncate">{fx.name}</span>
                              <span className="text-[9px] text-amber-400">{Object.keys(fx.params).length} params</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Timeline Ruler & Layer Track Bars */}
        <div
          ref={trackScrollRef}
          className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto relative bg-[#121316]"
        >
          {/* Top Ruler Header */}
          <div
            className="h-7 bg-[#141518] border-b border-[#26282e] shrink-0 cursor-ew-resize relative"
            onMouseDown={handleRulerMouseDown}
          >
            <canvas
              ref={rulerCanvasRef}
              width={1600}
              height={28}
              className="w-full h-full block"
            />
          </div>

          {/* Layer Bars Canvas & Tracks */}
          <div
            className="flex-1 relative"
            style={{ width: Math.max(1600, comp.duration * timelineZoom) }}
          >
            {/* Global Draggable Red Playhead Line */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
              style={{ left: playheadPixelX }}
            >
              <div className="w-3 h-3 bg-red-500 rotate-45 -mt-1.5 shadow-md"></div>
              <div className="w-[1px] flex-1 bg-red-500"></div>
            </div>

            {/* Layer Bars */}
            {layers.map((layer) => {
              const isSelected = selectedLayerIds.includes(layer.id);
              const isExpanded = expandedLayerProps[layer.id];

              const isMedia = layer.type === 'audio' || layer.type === 'video';
              const asset = layer.assetId ? project.assets.find((a) => a.id === layer.assetId) : null;
              const sourceDuration = isMedia ? (asset?.duration || layer.duration) : 0;

              const barLeft = (layer.startTime + layer.inPoint) * timelineZoom - timelineScrollX;
              const barWidth = Math.max(4, (layer.outPoint - layer.inPoint) * timelineZoom);

              // Cropped head (before inPoint) and cropped tail (after outPoint) for media layers
              const hasCroppedHead = isMedia && layer.inPoint > 0.05;
              const headLeft = layer.startTime * timelineZoom - timelineScrollX;
              const headWidth = Math.max(2, layer.inPoint * timelineZoom);

              const hasCroppedTail = isMedia && sourceDuration > 0 && layer.outPoint < sourceDuration - 0.05;
              const tailLeft = (layer.startTime + layer.outPoint) * timelineZoom - timelineScrollX;
              const tailWidth = Math.max(2, (sourceDuration - layer.outPoint) * timelineZoom);

              return (
                <div key={layer.id} className="border-b border-[#202227] relative">
                  {/* Main Track Bar Row */}
                  <div className="h-8 relative flex items-center">
                    {/* Cropped Head Ghost Bar (Media only) */}
                    {hasCroppedHead && (
                      <div
                        onClick={(e) => {
                          store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
                        }}
                        style={{
                          left: headLeft,
                          width: headWidth,
                        }}
                        className="absolute h-6 rounded-l flex items-center px-1 overflow-hidden border border-dashed border-[#3a3e4e] bg-[#14151a]/85 text-slate-500 z-0 select-none cursor-pointer group"
                        title={`Cropped Head (${layer.inPoint.toFixed(2)}s) - Drag start handle left to un-crop`}
                      >
                        {layer.type === 'audio' && asset?.waveformPeaks && (
                          <WaveformRenderer
                            peaks={asset.waveformPeaks}
                            width={headWidth}
                            height={20}
                            inPoint={0}
                            outPoint={layer.inPoint}
                            duration={sourceDuration}
                            isGhost={true}
                          />
                        )}
                        <span className="text-[9px] font-mono text-slate-500/80 truncate pointer-events-none relative z-10 pl-0.5">
                          -{layer.inPoint.toFixed(1)}s
                        </span>
                      </div>
                    )}

                    {/* Active Layer Bar Element */}
                    <div
                      onClick={(e) => handleLayerBarClick(e, layer)}
                      onMouseDown={(e) => handleStartMoveLayerBar(e, layer)}
                      style={{
                        left: barLeft,
                        width: barWidth,
                      }}
                      className={`absolute h-6 rounded flex items-center px-2 cursor-grab active:cursor-grabbing overflow-hidden shadow-sm transition-shadow z-10 ${
                        layer.type === 'audio'
                          ? 'bg-emerald-800/80 border border-emerald-500/60 text-emerald-100'
                          : layer.type === 'video'
                          ? 'bg-purple-800/80 border border-purple-500/60 text-purple-100'
                          : layer.type === 'adjustment'
                          ? 'bg-orange-800/80 border border-orange-500/60 text-orange-100'
                          : layer.type === 'shape'
                          ? 'bg-blue-800/80 border border-blue-500/60 text-blue-100'
                          : 'bg-[#29324a] border border-[#3f4f78] text-slate-200'
                      } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => handleStartTrim(e, layer, 'start')}
                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 z-20"
                        title="Trim In Point"
                      />

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => handleStartTrim(e, layer, 'end')}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 z-20"
                        title="Trim Out Point"
                      />

                      {/* Audio Waveform Canvas */}
                      {layer.type === 'audio' && asset?.waveformPeaks && (
                        <WaveformRenderer
                          peaks={asset.waveformPeaks}
                          width={barWidth}
                          height={20}
                          inPoint={layer.inPoint}
                          outPoint={layer.outPoint}
                          duration={sourceDuration || layer.duration}
                          isGhost={false}
                        />
                      )}

                      {/* Layer Bar Title */}
                      <span className="font-semibold text-[10px] truncate pointer-events-none relative z-10">
                        {layer.name}
                      </span>
                    </div>

                    {/* Cropped Tail Ghost Bar (Media only) */}
                    {hasCroppedTail && (
                      <div
                        onClick={(e) => {
                          store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
                        }}
                        style={{
                          left: tailLeft,
                          width: tailWidth,
                        }}
                        className="absolute h-6 rounded-r flex items-center px-1 overflow-hidden border border-dashed border-[#3a3e4e] bg-[#14151a]/85 text-slate-500 z-0 select-none cursor-pointer group"
                        title={`Cropped Tail (${(sourceDuration - layer.outPoint).toFixed(2)}s) - Drag end handle right to un-crop`}
                      >
                        {layer.type === 'audio' && asset?.waveformPeaks && (
                          <WaveformRenderer
                            peaks={asset.waveformPeaks}
                            width={tailWidth}
                            height={20}
                            inPoint={layer.outPoint}
                            outPoint={sourceDuration}
                            duration={sourceDuration}
                            isGhost={true}
                          />
                        )}
                        <span className="text-[9px] font-mono text-slate-500/80 truncate pointer-events-none relative z-10 pl-0.5">
                          +{(sourceDuration - layer.outPoint).toFixed(1)}s
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Property Sub-Tracks with Keyframe Diamonds */}
                  {isExpanded && (
                    <div className="bg-[#111215] space-y-1 py-1">
                      {['position', 'scale', 'rotation', 'opacity'].map((propName) => {
                        const prop = (layer as any)[propName] as AnimatableProp<any>;
                        return (
                          <div key={propName} className="h-5 relative flex items-center">
                            {prop.keyframes?.map((kf) => {
                              const kfPixelX =
                                (layer.startTime + kf.time) * timelineZoom - timelineScrollX;
                              return (
                                <div
                                  key={kf.id}
                                  style={{ left: kfPixelX - 4 }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setDragAction({
                                      type: 'keyframe',
                                      layerId: layer.id,
                                      propPath: propName,
                                      kfId: kf.id,
                                      startX: e.clientX,
                                      initialKfTime: kf.time,
                                    });
                                  }}
                                  className="absolute w-2.5 h-2.5 bg-amber-400 border border-black rotate-45 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-20"
                                  title={`Keyframe: ${kf.time.toFixed(2)}s (${kf.interpolation})`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}

                      {layer.effects.map((fx) => (
                        <div key={fx.id} className="h-5 relative flex items-center">
                          {Object.entries(fx.params).flatMap(([pid, p]) =>
                            p.keyframes?.map((kf) => {
                              const kfPixelX =
                                (layer.startTime + kf.time) * timelineZoom - timelineScrollX;
                              return (
                                <div
                                  key={`kffx_${kf.id}`}
                                  style={{ left: kfPixelX - 4 }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setDragAction({
                                      type: 'keyframe',
                                      layerId: layer.id,
                                      propPath: `effects.${fx.id}.${pid}`,
                                      kfId: kf.id,
                                      startX: e.clientX,
                                      initialKfTime: kf.time,
                                    });
                                  }}
                                  className="absolute w-2.5 h-2.5 bg-amber-400 border border-black rotate-45 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-20"
                                  title={`Effect Keyframe: ${kf.time.toFixed(2)}s`}
                                />
                              );
                            })
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Fast Canvas Waveform Sub-Component ---
const WaveformRenderer: React.FC<{
  peaks: Float32Array;
  width: number;
  height: number;
  inPoint?: number;
  outPoint?: number;
  duration?: number;
  isGhost?: boolean;
}> = ({ peaks, width, height, inPoint = 0, outPoint, duration, isGhost = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = Math.max(10, Math.round(width));
    canvas.height = Math.max(10, Math.round(height));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isGhost ? 'rgba(100, 116, 139, 0.28)' : 'rgba(52, 211, 153, 0.65)';

    // Safely get peaks whether it's Float32Array or array-like
    let rawPeaks: Float32Array;
    if (peaks instanceof Float32Array) {
      rawPeaks = peaks;
    } else if (peaks && typeof peaks === 'object') {
      try {
        rawPeaks = new Float32Array(Object.values(peaks as any).map(Number));
      } catch {
        rawPeaks = new Float32Array(0);
      }
    } else {
      rawPeaks = new Float32Array(0);
    }

    if (rawPeaks.length < 2) return;

    const totalBuckets = rawPeaks.length / 2;
    const midY = canvas.height / 2;
    const totalDuration = duration && duration > 0 ? duration : (outPoint || 10);
    const startSec = Math.max(0, inPoint);
    const endSec = outPoint !== undefined ? outPoint : totalDuration;
    const activeSpan = Math.max(0.001, endSec - startSec);

    for (let x = 0; x < canvas.width; x++) {
      const currentSec = startSec + (x / canvas.width) * activeSpan;
      const normalizedT = Math.max(0, Math.min(1, currentSec / totalDuration));
      const bIdx = Math.min(totalBuckets - 1, Math.floor(normalizedT * totalBuckets));

      const min = rawPeaks[bIdx * 2] || 0;
      const max = rawPeaks[bIdx * 2 + 1] || 0;

      const topY = midY - max * midY;
      const botY = midY - min * midY;
      ctx.fillRect(x, topY, 1, Math.max(1, botY - topY));
    }
  }, [peaks, width, height, inPoint, outPoint, duration, isGhost]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

function getPropByPath(layer: Layer, path: string): AnimatableProp<any> | null {
  if (path === 'position' || path === 'scale' || path === 'rotation' || path === 'anchor' || path === 'opacity') {
    return (layer as any)[path];
  }
  if (path.startsWith('effects.')) {
    const rest = path.slice(8);
    const dotIdx = rest.indexOf('.');
    if (dotIdx !== -1) {
      const fxId = rest.slice(0, dotIdx);
      const paramId = rest.slice(dotIdx + 1);
      const fx = layer.effects.find((e) => e.id === fxId);
      if (fx && fx.params[paramId]) {
        return fx.params[paramId];
      }
    }
  }
  return null;
}
