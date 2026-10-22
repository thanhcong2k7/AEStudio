/**
 * AEStudio - Composition Canvas Viewport with On-Canvas Interactive Handles & Snapping
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { store, EditorState } from '../engine/state';
import {
  renderComposition,
  getLayerTransform,
  calculateSnapping,
  SnappingGuide,
  qualityToScale,
} from '../engine/renderer';
import { Layer, EffectInstance, EffectParamSpec, EffectSpec } from '../engine/types';
import { evaluateProp } from '../engine/evaluator';
import { EFFECT_REGISTRY } from '../engine/registry';

interface CanvasViewportProps {
  state: EditorState;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({ state }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);

  const [activeGuides, setActiveGuides] = useState<SnappingGuide[]>([]);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'rotate' | 'anchor' | 'effectPoint';
    layerId: string;
    handle?: string; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'
    fxId?: string;
    paramId?: string;
    startX: number;
    startY: number;
    initialPos: [number, number];
    initialScale: [number, number];
    initialRotation: number;
    initialAnchor: [number, number];
  } | null>(null);

  const { currentTime, previewQuality, selectedLayerIds, viewportZoom } = state;
  const { comp, layers } = state.project;

  // Auto-fit calculation
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute zoom scale: 0 = 'fit'
  const fitScale = Math.min(
    (containerSize.width - 48) / comp.width,
    (containerSize.height - 48) / comp.height,
    1.0
  );
  const effectiveZoom = viewportZoom > 0 ? viewportZoom : Math.max(0.05, fitScale);

  const displayWidth = Math.round(comp.width * effectiveZoom);
  const displayHeight = Math.round(comp.height * effectiveZoom);

  // Core render call using latest state
  const renderFrame = useCallback(() => {
    if (!canvasRef.current) return;
    const currentState = store.getState();
    renderComposition(canvasRef.current, {
      comp: currentState.project.comp,
      layers: currentState.project.layers,
      assets: currentState.project.assets,
      time: currentState.currentTime,
      quality: currentState.previewQuality,
      selectedLayerIds: currentState.selectedLayerIds,
      mediaElements: store.mediaCache,
      isPlaying: currentState.isPlaying,
    });
  }, []);

  // Main automatic preview render hook: schedules render on rAF whenever any change occurs
  useEffect(() => {
    let animId: number | null = null;
    const scheduleRender = () => {
      if (animId !== null) cancelAnimationFrame(animId);
      animId = requestAnimationFrame(() => {
        renderFrame();
        animId = null;
      });
    };

    // Initial render
    scheduleRender();

    // Subscribe to store notifications directly - ensures with every single change anywhere
    // (effects, layer properties, time, snapping, colors, etc.), the preview viewport automatically updates
    const unsubscribe = store.subscribe(() => {
      scheduleRender();
    });

    // Auto-update viewport whenever video frames seek or load
    const videoListeners: { video: HTMLVideoElement; handler: () => void }[] = [];
    for (const el of store.mediaCache.values()) {
      if (el instanceof HTMLVideoElement) {
        const handler = () => scheduleRender();
        el.addEventListener('seeked', handler);
        el.addEventListener('loadeddata', handler);
        videoListeners.push({ video: el, handler });
      }
    }

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      unsubscribe();
      for (const { video, handler } of videoListeners) {
        video.removeEventListener('seeked', handler);
        video.removeEventListener('loadeddata', handler);
      }
    };
  }, [renderFrame, comp, currentTime, previewQuality, selectedLayerIds, state.isPlaying, store.version]);

  // Selected layer reference
  const selectedLayer = layers.find((l) => selectedLayerIds.includes(l.id));

  // Convert comp coords to display overlay coords
  const compToOverlay = useCallback(
    (cx: number, cy: number) => ({
      x: cx * effectiveZoom,
      y: cy * effectiveZoom,
    }),
    [effectiveZoom]
  );

  // Convert client mouse coords to comp coords
  const clientToComp = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const ox = clientX - rect.left;
      const oy = clientY - rect.top;
      return {
        x: ox / effectiveZoom,
        y: oy / effectiveZoom,
      };
    },
    [effectiveZoom]
  );

  // Handle layer interaction start
  const handleStartMove = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    store.selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
    const { x, y } = clientToComp(e.clientX, e.clientY);
    const pos = evaluateProp(layer.position, currentTime, layer.id, 'position');
    const scale = evaluateProp(layer.scale, currentTime, layer.id, 'scale');
    const rot = evaluateProp(layer.rotation, currentTime, layer.id, 'rotation');
    const anchor = evaluateProp(layer.anchor, currentTime, layer.id, 'anchor');

    store.beginContinuousAction();
    setDragState({
      type: 'move',
      layerId: layer.id,
      startX: x,
      startY: y,
      initialPos: [...pos],
      initialScale: [...scale],
      initialRotation: rot,
      initialAnchor: [...anchor],
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const { x, y } = clientToComp(e.clientX, e.clientY);
    // Find top-most layer at (x, y)
    for (const layer of layers) {
      if (!layer.visible || layer.locked) continue;
      const layerTime = currentTime - layer.startTime;
      if (layerTime < layer.inPoint || layerTime > layer.outPoint) continue;

      const t = getLayerTransform(layer, currentTime);
      const cos = Math.cos(-t.rotation);
      const sin = Math.sin(-t.rotation);
      const dx = x - t.x;
      const dy = y - t.y;
      const lx = (dx * cos - dy * sin) / (t.scaleX || 1) + t.anchorX;
      const ly = (dx * sin + dy * cos) / (t.scaleY || 1) + t.anchorY;

      if (lx >= 0 && lx <= layer.width && ly >= 0 && ly <= layer.height) {
        handleStartMove(e, layer);
        return;
      }
    }
    store.clearSelection();
  };

  const handleStartResize = (e: React.MouseEvent, layer: Layer, handle: string) => {
    e.stopPropagation();
    const { x, y } = clientToComp(e.clientX, e.clientY);
    const pos = evaluateProp(layer.position, currentTime, layer.id, 'position');
    const scale = evaluateProp(layer.scale, currentTime, layer.id, 'scale');
    const rot = evaluateProp(layer.rotation, currentTime, layer.id, 'rotation');
    const anchor = evaluateProp(layer.anchor, currentTime, layer.id, 'anchor');

    store.beginContinuousAction();
    setDragState({
      type: 'resize',
      handle,
      layerId: layer.id,
      startX: x,
      startY: y,
      initialPos: [...pos],
      initialScale: [...scale],
      initialRotation: rot,
      initialAnchor: [...anchor],
    });
  };

  const handleStartRotate = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    const { x, y } = clientToComp(e.clientX, e.clientY);
    const pos = evaluateProp(layer.position, currentTime, layer.id, 'position');
    const scale = evaluateProp(layer.scale, currentTime, layer.id, 'scale');
    const rot = evaluateProp(layer.rotation, currentTime, layer.id, 'rotation');
    const anchor = evaluateProp(layer.anchor, currentTime, layer.id, 'anchor');

    store.beginContinuousAction();
    setDragState({
      type: 'rotate',
      layerId: layer.id,
      startX: x,
      startY: y,
      initialPos: [...pos],
      initialScale: [...scale],
      initialRotation: rot,
      initialAnchor: [...anchor],
    });
  };

  const handleStartEffectPoint = (e: React.MouseEvent, layer: Layer, fxId: string, paramId: string) => {
    e.stopPropagation();
    const { x, y } = clientToComp(e.clientX, e.clientY);
    store.beginContinuousAction();
    setDragState({
      type: 'effectPoint',
      layerId: layer.id,
      fxId,
      paramId,
      startX: x,
      startY: y,
      initialPos: [0, 0],
      initialScale: [100, 100],
      initialRotation: 0,
      initialAnchor: [0, 0],
    });
  };

  // Mouse move handler during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      const { x, y } = clientToComp(e.clientX, e.clientY);
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      const layer = layers.find((l) => l.id === dragState.layerId);
      if (!layer) return;

      if (dragState.type === 'move') {
        let newX = dragState.initialPos[0] + dx;
        let newY = dragState.initialPos[1] + dy;

        // Snapping calculations
        if (state.snappingEnabled) {
          const targetBox = {
            x: newX - dragState.initialAnchor[0],
            y: newY - dragState.initialAnchor[1],
            width: layer.width * (dragState.initialScale[0] / 100),
            height: layer.height * (dragState.initialScale[1] / 100),
          };
          const otherBoxes = layers
            .filter((l) => l.id !== layer.id && l.visible)
            .map((l) => {
              const t = getLayerTransform(l, currentTime);
              return {
                x: t.x - t.anchorX * t.scaleX,
                y: t.y - t.anchorY * t.scaleY,
                width: l.width * t.scaleX,
                height: l.height * t.scaleY,
              };
            });

          const snapResult = calculateSnapping(targetBox, otherBoxes, comp, 6 / effectiveZoom);
          newX = snapResult.snappedX + dragState.initialAnchor[0];
          newY = snapResult.snappedY + dragState.initialAnchor[1];
          setActiveGuides(snapResult.guides);
        } else {
          setActiveGuides([]);
        }

        store.setPropValue(layer.id, 'position', [Math.round(newX), Math.round(newY)]);
      } else if (dragState.type === 'resize') {
        const handle = dragState.handle || 'se';
        const sxSign = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
        const sySign = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;

        let scaleXDelta = (dx * sxSign) / (layer.width || 100) * 100;
        let scaleYDelta = (dy * sySign) / (layer.height || 100) * 100;

        // Shift maintains ratio
        if (e.shiftKey) {
          const maxDelta = Math.abs(scaleXDelta) > Math.abs(scaleYDelta) ? scaleXDelta : scaleYDelta;
          scaleXDelta = maxDelta;
          scaleYDelta = maxDelta;
        }

        const newScaleX = Math.max(5, dragState.initialScale[0] + scaleXDelta);
        const newScaleY = Math.max(5, dragState.initialScale[1] + scaleYDelta);

        store.setPropValue(layer.id, 'scale', [Math.round(newScaleX), Math.round(newScaleY)]);
      } else if (dragState.type === 'rotate') {
        const t = getLayerTransform(layer, currentTime);
        const centerCompX = t.x;
        const centerCompY = t.y;
        const angleRad = Math.atan2(y - centerCompY, x - centerCompX);
        let deg = (angleRad * 180) / Math.PI + 90; // offset so top handle is 0 deg
        if (e.shiftKey) {
          // Snap to 15 degree increments
          deg = Math.round(deg / 15) * 15;
        }
        store.setPropValue(layer.id, 'rotation', Math.round(deg));
      } else if (dragState.type === 'effectPoint' && dragState.fxId && dragState.paramId) {
        // Map comp point back into normalized 0..1 layer space
        const t = getLayerTransform(layer, currentTime);
        // Inverse layer transform
        const relX = (x - t.x) / t.scaleX + t.anchorX;
        const relY = (y - t.y) / t.scaleY + t.anchorY;
        const normX = Math.max(0, Math.min(1, relX / layer.width));
        const normY = Math.max(0, Math.min(1, relY / layer.height));

        store.setPropValue(layer.id, `effects.${dragState.fxId}.${dragState.paramId}`, [normX, normY]);
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        store.commitContinuousAction();
        setDragState(null);
        setActiveGuides([]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, layers, currentTime, comp, effectiveZoom, clientToComp, state.snappingEnabled]);

  // Transform info for selected layer
  const t = selectedLayer ? getLayerTransform(selectedLayer, currentTime) : null;
  const overlayBox =
    selectedLayer && t
      ? {
          x: (t.x - t.anchorX * t.scaleX) * effectiveZoom,
          y: (t.y - t.anchorY * t.scaleY) * effectiveZoom,
          width: selectedLayer.width * t.scaleX * effectiveZoom,
          height: selectedLayer.height * t.scaleY * effectiveZoom,
          rotation: (t.rotation * 180) / Math.PI,
          anchorPx: {
            x: t.x * effectiveZoom,
            y: t.y * effectiveZoom,
          },
        }
      : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full bg-[#0c0d0f] flex items-center justify-center relative overflow-hidden select-none"
      onClick={() => store.clearSelection()}
    >
      {/* Centered Canvas Container */}
      <div
        className="relative shadow-2xl bg-black border border-[#23252c]"
        style={{ width: displayWidth, height: displayHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Render Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          className="w-full h-full block cursor-default"
          style={{ imageRendering: previewQuality === 'full' ? 'auto' : 'pixelated' }}
        />

        {/* SVG Selection & Snapping Overlay */}
        <svg
          ref={overlaySvgRef}
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        >
          {/* Snapping Cyan Guides */}
          {activeGuides.map((g, idx) =>
            g.type === 'x' ? (
              <line
                key={`gx_${idx}`}
                x1={g.pos * effectiveZoom}
                y1={0}
                x2={g.pos * effectiveZoom}
                y2={displayHeight}
                stroke="#00e5ff"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            ) : (
              <line
                key={`gy_${idx}`}
                y1={g.pos * effectiveZoom}
                x1={0}
                y2={g.pos * effectiveZoom}
                x2={displayWidth}
                stroke="#00e5ff"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )
          )}

          {/* Selected Layer Bounding Box & Handles */}
          {selectedLayer && overlayBox && (
            <g
              transform={`rotate(${overlayBox.rotation}, ${overlayBox.anchorPx.x}, ${overlayBox.anchorPx.y})`}
            >
              {/* Bounding box outline */}
              <rect
                x={overlayBox.x}
                y={overlayBox.y}
                width={overlayBox.width}
                height={overlayBox.height}
                fill="rgba(0,0,0,0.001)"
                stroke="#2d62ea"
                strokeWidth={1.5}
                className="pointer-events-auto cursor-move"
                onMouseDown={(e) => handleStartMove(e, selectedLayer)}
              />

              {/* Anchor point handle */}
              <circle
                cx={overlayBox.anchorPx.x}
                cy={overlayBox.anchorPx.y}
                r={4.5}
                fill="#ffffff"
                stroke="#2d62ea"
                strokeWidth={1.5}
              />
              <line
                x1={overlayBox.anchorPx.x - 7}
                y1={overlayBox.anchorPx.y}
                x2={overlayBox.anchorPx.x + 7}
                y2={overlayBox.anchorPx.y}
                stroke="#2d62ea"
                strokeWidth={1}
              />
              <line
                x1={overlayBox.anchorPx.x}
                y1={overlayBox.anchorPx.y - 7}
                x2={overlayBox.anchorPx.x}
                y2={overlayBox.anchorPx.y + 7}
                stroke="#2d62ea"
                strokeWidth={1}
              />

              {/* Rotation Handle */}
              <line
                x1={overlayBox.x + overlayBox.width / 2}
                y1={overlayBox.y}
                x2={overlayBox.x + overlayBox.width / 2}
                y2={overlayBox.y - 24}
                stroke="#2d62ea"
                strokeWidth={1.5}
              />
              <circle
                cx={overlayBox.x + overlayBox.width / 2}
                cy={overlayBox.y - 24}
                r={5}
                fill="#2d62ea"
                stroke="#ffffff"
                strokeWidth={1.5}
                className="pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
                onMouseDown={(e) => handleStartRotate(e, selectedLayer)}
              />

              {/* Resize Corner & Edge Handles */}
              {[
                { h: 'nw', cx: overlayBox.x, cy: overlayBox.y, cursor: 'nwse-resize' },
                { h: 'ne', cx: overlayBox.x + overlayBox.width, cy: overlayBox.y, cursor: 'nesw-resize' },
                { h: 'se', cx: overlayBox.x + overlayBox.width, cy: overlayBox.y + overlayBox.height, cursor: 'nwse-resize' },
                { h: 'sw', cx: overlayBox.x, cy: overlayBox.y + overlayBox.height, cursor: 'nesw-resize' },
                { h: 'n', cx: overlayBox.x + overlayBox.width / 2, cy: overlayBox.y, cursor: 'ns-resize' },
                { h: 's', cx: overlayBox.x + overlayBox.width / 2, cy: overlayBox.y + overlayBox.height, cursor: 'ns-resize' },
                { h: 'e', cx: overlayBox.x + overlayBox.width, cy: overlayBox.y + overlayBox.height / 2, cursor: 'ew-resize' },
                { h: 'w', cx: overlayBox.x, cy: overlayBox.y + overlayBox.height / 2, cursor: 'ew-resize' },
              ].map(({ h, cx, cy, cursor }) => (
                <rect
                  key={h}
                  x={cx - 3.5}
                  y={cy - 3.5}
                  width={7}
                  height={7}
                  fill="#ffffff"
                  stroke="#2d62ea"
                  strokeWidth={1.5}
                  style={{ cursor }}
                  className="pointer-events-auto hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleStartResize(e, selectedLayer, h)}
                />
              ))}

              {/* On-Canvas Point Parameter Handles for Applied Effects */}
              {selectedLayer.effects.flatMap((fx: EffectInstance) => {
                const spec = EFFECT_REGISTRY.find((s: EffectSpec) => s.id === fx.effectId);
                if (!spec) return [];
                return spec.params
                  .filter((p: EffectParamSpec) => p.ui.type === 'point')
                  .map((p: EffectParamSpec) => {
                    const normPoint = (evaluateProp(fx.params[p.id], currentTime, selectedLayer.id, p.id) as [number, number]) || [0.5, 0.5];
                    const hx = overlayBox.x + normPoint[0] * overlayBox.width;
                    const hy = overlayBox.y + normPoint[1] * overlayBox.height;

                    return (
                      <g
                        key={`fx_pt_${fx.id}_${p.id}`}
                        className="pointer-events-auto cursor-crosshair group"
                        onMouseDown={(e) => handleStartEffectPoint(e, selectedLayer, fx.id, p.id)}
                      >
                        <circle cx={hx} cy={hy} r={6} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
                        <circle cx={hx} cy={hy} r={2} fill="#f59e0b" />
                        <line x1={hx - 8} y1={hy} x2={hx + 8} y2={hy} stroke="#f59e0b" strokeWidth={1} />
                        <line x1={hx} y1={hy - 8} x2={hx} y2={hy + 8} stroke="#f59e0b" strokeWidth={1} />
                        <text
                          x={hx + 10}
                          y={hy + 4}
                          fill="#f59e0b"
                          fontSize={9}
                          fontFamily="sans-serif"
                          className="opacity-70 group-hover:opacity-100 font-semibold"
                        >
                          {p.name}
                        </text>
                      </g>
                    );
                  });
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Floating Resolution & Zoom Indicator */}
      <div className="absolute bottom-3 left-4 bg-[#181a1f]/90 backdrop-blur border border-[#2b2e36] px-2.5 py-1 rounded text-[11px] text-slate-400 font-mono flex items-center gap-2 shadow-lg">
        <span>{comp.width}×{comp.height}</span>
        <span>·</span>
        <span>{comp.fps} fps</span>
        <span>·</span>
        <span className="text-blue-400">{Math.round(effectiveZoom * 100)}%</span>
      </div>
    </div>
  );
};
