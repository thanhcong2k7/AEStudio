/**
 * AEStudio - Central State Store & Command History (Undo/Redo)
 */

import {
  Project,
  Layer,
  Asset,
  CompSettings,
  PreviewQuality,
  LayerType,
  EffectSpec,
  EffectInstance,
  AnimatableProp,
  Keyframe,
  KeyframeInterpolation,
} from './types';
import { createDefaultProject } from './projectIo';
import { instantiateEffect, findEffectSpec } from './registry';
import { decodeAudioData, computeWaveformPeaks, getAudioContext } from './audio';

export interface EditorState {
  project: Project;
  currentTime: number; // in seconds
  isPlaying: boolean;
  isLooping: boolean;
  selectedLayerIds: string[];
  selectedKeyframeIds: string[];
  activeTool: 'select' | 'razor';
  snappingEnabled: boolean;
  previewQuality: PreviewQuality;
  viewportZoom: number; // 0 for 'fit'
  timelineZoom: number; // pixels per second
  timelineScrollX: number;
}

type StateListener = (state: EditorState) => void;

class StateStore {
  private state: EditorState;
  private listeners: Set<StateListener> = new Set();

  // History stack for Undo / Redo
  private undoStack: string[] = []; // JSON snapshots of project
  private redoStack: string[] = [];
  private readonly maxHistory = 120;
  private isContinuousAction = false;
  private continuousActionInitialSnapshot: string | null = null;

  // Media Element Cache for Canvas rendering
  public mediaCache: Map<string, HTMLImageElement | HTMLVideoElement> = new Map();
  public audioBufferCache: Map<string, AudioBuffer> = new Map();
  public waveformPeaksCache: Map<string, Float32Array> = new Map();
  private activeAudioNodes: AudioBufferSourceNode[] = [];
  private playbackAnimId: number | null = null;
  private playbackLastT: number = 0;

  constructor() {
    this.state = {
      project: createDefaultProject(),
      currentTime: 0,
      isPlaying: false,
      isLooping: true,
      selectedLayerIds: ['layer_title'],
      selectedKeyframeIds: [],
      activeTool: 'select',
      snappingEnabled: true,
      previewQuality: 'full',
      viewportZoom: 0, // 'fit'
      timelineZoom: 120, // 120px per second default
      timelineScrollX: 0,
    };
  }

  public getState(): EditorState {
    this.autoHealTruncatedMediaLayers();
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // --- Snapshot & Undo / Redo ---
  private pushSnapshot() {
    if (this.isContinuousAction) return;
    const snap = JSON.stringify(this.state.project);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // clear redo on new change
  }

  public beginContinuousAction() {
    if (!this.isContinuousAction) {
      this.isContinuousAction = true;
      this.continuousActionInitialSnapshot = JSON.stringify(this.state.project);
    }
  }

  public commitContinuousAction() {
    if (this.isContinuousAction) {
      this.isContinuousAction = false;
      if (this.continuousActionInitialSnapshot) {
        this.undoStack.push(this.continuousActionInitialSnapshot);
        if (this.undoStack.length > this.maxHistory) {
          this.undoStack.shift();
        }
        this.redoStack = [];
      }
      this.continuousActionInitialSnapshot = null;
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Re-attaches native AudioBuffer and Float32Array peaks from memory cache after JSON snapshot deserialization
   */
  public rehydrateProjectAssets(project: Project) {
    if (!project || !project.assets) return;
    for (const asset of project.assets) {
      if (this.audioBufferCache.has(asset.id)) {
        asset.audioBuffer = this.audioBufferCache.get(asset.id);
      }
      if (this.waveformPeaksCache.has(asset.id)) {
        asset.waveformPeaks = this.waveformPeaksCache.get(asset.id);
      } else if (asset.waveformPeaks && !(asset.waveformPeaks instanceof Float32Array)) {
        try {
          const raw = asset.waveformPeaks as any;
          const vals = Object.values(raw).map(Number);
          const arr = new Float32Array(vals);
          asset.waveformPeaks = arr;
          this.waveformPeaksCache.set(asset.id, arr);
        } catch (e) {
          console.warn('Failed to rehydrate waveform peaks:', e);
        }
      }
    }
  }

  public undo() {
    if (this.undoStack.length === 0) return;
    const currentSnap = JSON.stringify(this.state.project);
    this.redoStack.push(currentSnap);
    const prevSnap = this.undoStack.pop()!;
    this.state.project = JSON.parse(prevSnap);
    this.rehydrateProjectAssets(this.state.project);
    this.autoHealTruncatedMediaLayers();
    if (this.state.isPlaying) {
      this.syncAudioPlayback();
    }
    this.notify();
  }

  public redo() {
    if (this.redoStack.length === 0) return;
    const currentSnap = JSON.stringify(this.state.project);
    this.undoStack.push(currentSnap);
    const nextSnap = this.redoStack.pop()!;
    this.state.project = JSON.parse(nextSnap);
    this.rehydrateProjectAssets(this.state.project);
    this.autoHealTruncatedMediaLayers();
    if (this.state.isPlaying) {
      this.syncAudioPlayback();
    }
    this.notify();
  }

  // --- Transport & Playback ---
  public setCurrentTime(t: number) {
    const clamped = Math.max(0, Math.min(this.state.project.comp.duration, t));
    const changed = Math.abs(this.state.currentTime - clamped) > 1e-5;
    this.state.currentTime = clamped;
    if (this.state.isPlaying) {
      this.playbackLastT = performance.now();
      if (changed) {
        this.syncAudioPlayback();
      }
    }
    this.notify();
  }

  public setIsPlaying(playing: boolean) {
    if (this.state.isPlaying === playing) return;
    this.state.isPlaying = playing;
    if (playing) {
      this.syncAudioPlayback();
      this.startPlaybackLoop();
    } else {
      this.stopPlaybackLoop();
      this.stopAudioPlayback();
    }
    this.notify();
  }

  private startPlaybackLoop() {
    this.stopPlaybackLoop();
    this.playbackLastT = performance.now();

    const tick = (now: number) => {
      if (!this.state.isPlaying) {
        this.playbackAnimId = null;
        return;
      }

      // Delta in seconds, clamped to max 0.1s to prevent skips on lag/tab unfocus
      const delta = Math.min(0.1, Math.max(0, (now - this.playbackLastT) / 1000));
      this.playbackLastT = now;

      let nextTime = this.state.currentTime + delta;
      const duration = this.state.project.comp.duration;

      if (nextTime >= duration) {
        if (this.state.isLooping) {
          nextTime = 0;
          this.state.currentTime = 0;
          this.syncAudioPlayback();
        } else {
          nextTime = duration;
          this.state.currentTime = nextTime;
          this.setIsPlaying(false);
          this.notify();
          return;
        }
      }

      this.state.currentTime = nextTime;
      this.notify();

      this.playbackAnimId = requestAnimationFrame(tick);
    };

    this.playbackAnimId = requestAnimationFrame(tick);
  }

  private stopPlaybackLoop() {
    if (this.playbackAnimId !== null) {
      cancelAnimationFrame(this.playbackAnimId);
      this.playbackAnimId = null;
    }
  }

  public syncAudioPlayback() {
    this.stopAudioPlayback();
    if (!this.state.isPlaying) return;

    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const curTime = this.state.currentTime;

      for (const layer of this.state.project.layers) {
        if (!layer.visible || layer.mute) continue;
        if (layer.type !== 'audio' && layer.type !== 'video') continue;
        if (!layer.assetId) continue;

        const asset = this.state.project.assets.find((a) => a.id === layer.assetId);
        const buffer = asset?.audioBuffer || this.audioBufferCache.get(layer.assetId);
        if (!buffer) continue;

        const layerTime = curTime - layer.startTime;

        // Check if current playhead falls within active trimmed layer bounds
        if (layerTime < layer.inPoint || layerTime >= layer.outPoint) continue;

        const mediaTime = layerTime;
        if (mediaTime < 0 || mediaTime >= buffer.duration) continue;

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);

        const duration = Math.max(0, Math.min(layer.outPoint - mediaTime, buffer.duration - mediaTime));
        if (duration <= 0) continue;

        source.start(0, mediaTime, duration);
        this.activeAudioNodes.push(source);
      }
    } catch (err) {
      console.warn('Audio sync error:', err);
    }
  }

  public stopAudioPlayback() {
    for (const node of this.activeAudioNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {}
    }
    this.activeAudioNodes = [];
  }

  public togglePlay() {
    this.setIsPlaying(!this.state.isPlaying);
  }

  public toggleLoop() {
    this.state.isLooping = !this.state.isLooping;
    this.notify();
  }

  public setQuality(quality: PreviewQuality) {
    this.state.previewQuality = quality;
    this.notify();
  }

  public setTool(tool: 'select' | 'razor') {
    this.state.activeTool = tool;
    this.notify();
  }

  public setSnapping(enabled: boolean) {
    this.state.snappingEnabled = enabled;
    this.notify();
  }

  public toggleSnapping() {
    this.setSnapping(!this.state.snappingEnabled);
  }

  public setTimelineZoom(zoom: number) {
    this.state.timelineZoom = Math.max(0.5, Math.min(1000, zoom));
    this.notify();
  }

  public setTimelineScrollX(scrollX: number) {
    this.state.timelineScrollX = Math.max(0, scrollX);
    this.notify();
  }

  public setViewportZoom(zoom: number) {
    this.state.viewportZoom = zoom;
    this.notify();
  }

  // --- Selection ---
  public selectLayer(id: string, multi: boolean = false) {
    if (multi) {
      if (this.state.selectedLayerIds.includes(id)) {
        this.state.selectedLayerIds = this.state.selectedLayerIds.filter((lid) => lid !== id);
      } else {
        this.state.selectedLayerIds = [...this.state.selectedLayerIds, id];
      }
    } else {
      this.state.selectedLayerIds = [id];
    }
    this.notify();
  }

  public selectLayersRange(id: string) {
    const layers = this.state.project.layers;
    const targetIdx = layers.findIndex((l) => l.id === id);
    if (targetIdx === -1 || this.state.selectedLayerIds.length === 0) {
      this.selectLayer(id);
      return;
    }
    const lastSelectedId = this.state.selectedLayerIds[this.state.selectedLayerIds.length - 1];
    const lastIdx = layers.findIndex((l) => l.id === lastSelectedId);
    if (lastIdx === -1) {
      this.selectLayer(id);
      return;
    }
    const start = Math.min(targetIdx, lastIdx);
    const end = Math.max(targetIdx, lastIdx);
    const rangeIds = layers.slice(start, end + 1).map((l) => l.id);
    this.state.selectedLayerIds = Array.from(new Set([...this.state.selectedLayerIds, ...rangeIds]));
    this.notify();
  }

  public clearSelection() {
    this.state.selectedLayerIds = [];
    this.notify();
  }

  // --- Composition Settings ---
  public updateCompSettings(settings: Partial<CompSettings>) {
    this.pushSnapshot();
    this.state.project.comp = { ...this.state.project.comp, ...settings };
    this.notify();
  }

  // --- Layer Management ---
  public addLayer(
    type: LayerType,
    overrides?: Partial<Layer>
  ): Layer {
    this.pushSnapshot();
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const comp = this.state.project.comp;
    const playhead = this.state.currentTime;

    const defaultNames: Record<LayerType, string> = {
      text: 'Text Layer',
      solid: 'Solid',
      shape: 'Shape Layer',
      image: 'Image Layer',
      video: 'Video Layer',
      audio: 'Audio Layer',
      adjustment: 'Adjustment Layer',
    };

    // Determine natural duration from asset or overrides
    let naturalDuration = overrides?.duration;
    if (!naturalDuration && overrides?.assetId) {
      const asset = this.state.project.assets.find((a) => a.id === overrides.assetId);
      if (asset?.duration) {
        naturalDuration = asset.duration;
      }
    }
    if (!naturalDuration) {
      naturalDuration =
        type === 'image' || type === 'solid' || type === 'shape' || type === 'text' || type === 'adjustment'
          ? Math.max(comp.duration, 30.0)
          : 10.0;
    }

    const inPoint = overrides?.inPoint !== undefined ? overrides.inPoint : 0;
    const outPoint =
      overrides?.outPoint !== undefined
        ? overrides.outPoint
        : naturalDuration;

    const newLayer: Layer = {
      id,
      name: overrides?.name || defaultNames[type] || 'New Layer',
      type,
      inPoint,
      outPoint,
      startTime: overrides?.startTime !== undefined ? overrides.startTime : playhead,
      duration: naturalDuration,
      visible: true,
      locked: false,
      solo: false,
      mute: false,
      blendMode: overrides?.blendMode || 'normal',
      width: overrides?.width || comp.width,
      height: overrides?.height || comp.height,
      position: overrides?.position || {
        value: [comp.width / 2, comp.height / 2],
        keyframes: [],
        animated: false,
      },
      scale: overrides?.scale || {
        value: [100, 100],
        keyframes: [],
        animated: false,
      },
      rotation: overrides?.rotation || {
        value: 0,
        keyframes: [],
        animated: false,
      },
      anchor: overrides?.anchor || {
        value: [(overrides?.width || comp.width) / 2, (overrides?.height || comp.height) / 2],
        keyframes: [],
        animated: false,
      },
      opacity: overrides?.opacity || {
        value: 100,
        keyframes: [],
        animated: false,
      },
      masks: [],
      effects: [],
      ...overrides,
    };

    if (type === 'solid' && !newLayer.solidColor) {
      newLayer.solidColor = '#3b82f6';
    }

    if (type === 'shape' && !newLayer.shapeData) {
      newLayer.width = 400;
      newLayer.height = 400;
      newLayer.anchor = { value: [200, 200], keyframes: [], animated: false };
      newLayer.shapeData = {
        shapeType: 'rectangle',
        fillColor: '#3b82f6',
        strokeColor: '#60a5fa',
        strokeWidth: 4,
        cornerRadius: 16,
      };
    }

    if (type === 'text' && !newLayer.textData) {
      newLayer.width = 600;
      newLayer.height = 120;
      newLayer.anchor = { value: [300, 60], keyframes: [], animated: false };
      newLayer.textData = {
        text: 'New Text',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 52,
        fillColor: '#ffffff',
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: 0,
      };
    }

    // Add on top (index 0)
    this.state.project.layers = [newLayer, ...this.state.project.layers];
    this.state.selectedLayerIds = [id];
    this.notify();
    return newLayer;
  }

  public deleteSelectedLayers() {
    if (this.state.selectedLayerIds.length === 0) return;
    this.pushSnapshot();
    const toDelete = new Set(this.state.selectedLayerIds);
    this.state.project.layers = this.state.project.layers.filter((l) => !toDelete.has(l.id));
    this.state.selectedLayerIds = [];
    this.notify();
  }

  public duplicateSelectedLayers() {
    if (this.state.selectedLayerIds.length === 0) return;
    this.pushSnapshot();
    const newLayers: Layer[] = [];
    const newSelected: string[] = [];

    for (const layer of this.state.project.layers) {
      newLayers.push(layer);
      if (this.state.selectedLayerIds.includes(layer.id)) {
        const dup: Layer = JSON.parse(JSON.stringify(layer));
        dup.id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        dup.name = `${layer.name} Copy`;
        newLayers.push(dup);
        newSelected.push(dup.id);
      }
    }

    this.state.project.layers = newLayers;
    this.state.selectedLayerIds = newSelected;
    this.notify();
  }

  public reorderLayer(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    this.pushSnapshot();
    const layers = [...this.state.project.layers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    this.state.project.layers = layers;
    this.notify();
  }

  public splitLayerAtPlayhead(layerId: string) {
    const layer = this.state.project.layers.find((l) => l.id === layerId);
    if (!layer) return;

    const t = this.state.currentTime;
    const relT = t - layer.startTime;
    if (relT <= layer.inPoint || relT >= layer.outPoint) {
      return; // Cannot split outside layer bounds
    }

    this.pushSnapshot();

    // First part: adjust outPoint to relT
    const oldOut = layer.outPoint;
    layer.outPoint = relT;

    // Second part: duplicate and adjust inPoint and outPoint
    const secondPart: Layer = JSON.parse(JSON.stringify(layer));
    secondPart.id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    secondPart.name = `${layer.name} (Split)`;
    secondPart.inPoint = relT;
    secondPart.outPoint = oldOut;

    // Insert directly adjacent
    const idx = this.state.project.layers.findIndex((l) => l.id === layerId);
    this.state.project.layers.splice(idx + 1, 0, secondPart);
    if (this.state.isPlaying) {
      this.syncAudioPlayback();
    }
    this.notify();
  }

  public updateLayer(id: string, updates: Partial<Layer>) {
    this.pushSnapshot();
    this.state.project.layers = this.state.project.layers.map((l) => {
      if (l.id === id) {
        return { ...l, ...updates };
      }
      return l;
    });
    this.notify();
  }

  public updateLayerTransient(id: string, updates: Partial<Layer>) {
    // For smooth continuous updates without snapshotting
    this.beginContinuousAction();
    this.state.project.layers = this.state.project.layers.map((l) => {
      if (l.id === id) {
        return { ...l, ...updates };
      }
      return l;
    });
    this.notify();
  }

  // Multi-trim: shifts duration / inPoint / outPoint across all selected layers together
  public multiTrimLayers(
    edge: 'start' | 'end',
    deltaSec: number
  ) {
    this.beginContinuousAction();
    const selSet = new Set(this.state.selectedLayerIds);
    const compDuration = this.state.project.comp.duration;

    this.state.project.layers = this.state.project.layers.map((layer) => {
      if (!selSet.has(layer.id)) return layer;

      const isMedia = layer.type === 'audio' || layer.type === 'video';
      const asset = layer.assetId ? this.state.project.assets.find((a) => a.id === layer.assetId) : null;
      const mediaSourceDuration = asset?.duration || layer.duration;

      if (edge === 'start') {
        if (isMedia) {
          const newIn = Math.max(0, Math.min(layer.outPoint - 0.05, layer.inPoint + deltaSec));
          return { ...layer, inPoint: newIn, duration: mediaSourceDuration };
        } else {
          const targetIn = layer.inPoint + deltaSec;
          if (targetIn < 0) {
            const shift = targetIn;
            const newStart = layer.startTime + shift;
            const newOut = layer.outPoint - shift;
            return {
              ...layer,
              startTime: newStart,
              inPoint: 0,
              outPoint: newOut,
              duration: Math.max(layer.duration, newOut),
            };
          } else {
            const newIn = Math.min(layer.outPoint - 0.05, targetIn);
            return { ...layer, inPoint: newIn };
          }
        }
      } else {
        if (isMedia) {
          const maxOut = mediaSourceDuration;
          const newOut = Math.min(maxOut, Math.max(layer.inPoint + 0.05, layer.outPoint + deltaSec));
          return { ...layer, outPoint: newOut, duration: mediaSourceDuration };
        } else {
          const newOut = Math.max(layer.inPoint + 0.05, layer.outPoint + deltaSec);
          return {
            ...layer,
            outPoint: newOut,
            duration: Math.max(layer.duration, newOut, compDuration),
          };
        }
      }
    });

    this.notify();
  }

  public setLayersStartTime(initialStarts: Map<string, number>, deltaSec: number) {
    this.beginContinuousAction();
    this.state.project.layers = this.state.project.layers.map((layer) => {
      const orig = initialStarts.get(layer.id);
      if (orig === undefined) return layer;
      const newStart = Math.max(-layer.duration, orig + deltaSec);
      return { ...layer, startTime: newStart };
    });
    this.notify();
  }

  public setLayersTrim(
    edge: 'start' | 'end',
    initialPoints: Map<string, number>,
    deltaSec: number
  ) {
    this.beginContinuousAction();
    const compDuration = this.state.project.comp.duration;

    this.state.project.layers = this.state.project.layers.map((layer) => {
      const orig = initialPoints.get(layer.id);
      if (orig === undefined) return layer;

      const isMedia = layer.type === 'audio' || layer.type === 'video';
      const asset = layer.assetId ? this.state.project.assets.find((a) => a.id === layer.assetId) : null;
      const mediaSourceDuration = asset?.duration || layer.duration;

      if (edge === 'start') {
        if (isMedia) {
          const newIn = Math.max(0, Math.min(layer.outPoint - 0.05, orig + deltaSec));
          return { ...layer, inPoint: newIn, duration: mediaSourceDuration };
        } else {
          const targetIn = orig + deltaSec;
          if (targetIn < 0) {
            const shift = targetIn;
            const newStart = layer.startTime + shift;
            const newOut = layer.outPoint - shift;
            return {
              ...layer,
              startTime: newStart,
              inPoint: 0,
              outPoint: newOut,
              duration: Math.max(layer.duration, newOut),
            };
          } else {
            const newIn = Math.min(layer.outPoint - 0.05, targetIn);
            return { ...layer, inPoint: newIn };
          }
        }
      } else {
        if (isMedia) {
          const maxOut = mediaSourceDuration;
          const newOut = Math.min(maxOut, Math.max(layer.inPoint + 0.05, orig + deltaSec));
          return { ...layer, outPoint: newOut, duration: mediaSourceDuration };
        } else {
          const newOut = Math.max(layer.inPoint + 0.05, orig + deltaSec);
          return {
            ...layer,
            outPoint: newOut,
            duration: Math.max(layer.duration, newOut, compDuration),
          };
        }
      }
    });
    this.notify();
  }

  public multiMoveLayers(deltaSec: number) {
    this.beginContinuousAction();
    const selSet = new Set(this.state.selectedLayerIds);

    this.state.project.layers = this.state.project.layers.map((layer) => {
      if (!selSet.has(layer.id)) return layer;
      const newStart = Math.max(-layer.duration, layer.startTime + deltaSec);
      return { ...layer, startTime: newStart };
    });

    this.notify();
  }

  // --- Keyframe & Property Editing ---
  public setPropValue<T>(
    layerId: string,
    propPath: string, // 'position' | 'scale' | 'rotation' | 'opacity' | 'anchor' | 'effects.<id>.<param>'
    val: T
  ) {
    this.pushSnapshot();
    this.applyPropUpdate(layerId, propPath, (prop) => {
      prop.value = val;
      if (prop.animated) {
        // Auto-keyframe at current playhead if animated
        this.addOrUpdateKeyframe(prop, this.state.currentTime - this.getLayerStartTime(layerId), val);
      }
    });
    this.notify();
  }

  public togglePropStopwatch(layerId: string, propPath: string) {
    this.pushSnapshot();
    const layerTime = this.state.currentTime - this.getLayerStartTime(layerId);
    this.applyPropUpdate(layerId, propPath, (prop) => {
      prop.animated = !prop.animated;
      if (prop.animated) {
        // Add first keyframe at current value
        prop.keyframes = [
          {
            id: `kf_${Date.now()}`,
            time: layerTime,
            value: prop.value,
            interpolation: 'linear',
          },
        ];
      } else {
        prop.keyframes = [];
      }
    });
    this.notify();
  }

  public addKeyframeAtPlayhead(layerId: string, propPath: string) {
    this.pushSnapshot();
    const layerTime = this.state.currentTime - this.getLayerStartTime(layerId);
    this.applyPropUpdate(layerId, propPath, (prop) => {
      prop.animated = true;
      this.addOrUpdateKeyframe(prop, layerTime, prop.value);
    });
    this.notify();
  }

  public removeKeyframe(layerId: string, propPath: string, kfId: string) {
    this.pushSnapshot();
    this.applyPropUpdate(layerId, propPath, (prop) => {
      prop.keyframes = prop.keyframes.filter((kf) => kf.id !== kfId);
      if (prop.keyframes.length === 0) {
        prop.animated = false;
      }
    });
    this.notify();
  }

  public updateKeyframeInterpolation(
    layerId: string,
    propPath: string,
    kfId: string,
    interpolation: KeyframeInterpolation
  ) {
    this.pushSnapshot();
    this.applyPropUpdate(layerId, propPath, (prop) => {
      const kf = prop.keyframes.find((k) => k.id === kfId);
      if (kf) {
        kf.interpolation = interpolation;
      }
    });
    this.notify();
  }

  public setPropWiggle(
    layerId: string,
    propPath: string,
    wiggleSettings: Partial<NonNullable<AnimatableProp['wiggle']>>
  ) {
    this.pushSnapshot();
    this.applyPropUpdate(layerId, propPath, (prop) => {
      prop.wiggle = {
        enabled: true,
        freq: 2,
        amp: 50,
        octaves: 1,
        amp_mult: 0.5,
        ...prop.wiggle,
        ...wiggleSettings,
      };
    });
    this.notify();
  }

  private addOrUpdateKeyframe<T>(prop: AnimatableProp<T>, time: number, value: T) {
    const existing = prop.keyframes.find((k) => Math.abs(k.time - time) < 0.02);
    if (existing) {
      existing.value = value;
    } else {
      prop.keyframes.push({
        id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time,
        value,
        interpolation: 'linear',
      });
      prop.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  private getLayerStartTime(layerId: string): number {
    return this.state.project.layers.find((l) => l.id === layerId)?.startTime || 0;
  }

  private applyPropUpdate(
    layerId: string,
    propPath: string,
    fn: (prop: AnimatableProp<any>) => void
  ) {
    const layer = this.state.project.layers.find((l) => l.id === layerId);
    if (!layer) return;

    if (propPath === 'position' || propPath === 'scale' || propPath === 'rotation' || propPath === 'anchor' || propPath === 'opacity') {
      fn(layer[propPath]);
    } else if (propPath.startsWith('effects.')) {
      const rest = propPath.slice(8);
      const dotIdx = rest.indexOf('.');
      if (dotIdx !== -1) {
        const fxId = rest.slice(0, dotIdx);
        const paramId = rest.slice(dotIdx + 1);
        const fx = layer.effects.find((e) => e.id === fxId);
        if (fx && fx.params[paramId]) {
          fn(fx.params[paramId]);
        }
      }
    }
  }

  // --- Effects Management ---
  public addEffectToSelected(effectId: string) {
    const spec = findEffectSpec(effectId);
    if (!spec || this.state.selectedLayerIds.length === 0) return;

    this.pushSnapshot();
    const selSet = new Set(this.state.selectedLayerIds);

    this.state.project.layers = this.state.project.layers.map((layer) => {
      if (!selSet.has(layer.id)) return layer;
      const inst = instantiateEffect(spec);
      return {
        ...layer,
        effects: [...layer.effects, inst],
      };
    });

    this.notify();
  }

  public removeEffect(layerId: string, effectInstanceId: string) {
    this.pushSnapshot();
    this.state.project.layers = this.state.project.layers.map((l) => {
      if (l.id !== layerId) return l;
      return {
        ...l,
        effects: l.effects.filter((e) => e.id !== effectInstanceId),
      };
    });
    this.notify();
  }

  public toggleEffect(layerId: string, effectInstanceId: string) {
    this.pushSnapshot();
    this.state.project.layers = this.state.project.layers.map((l) => {
      if (l.id !== layerId) return l;
      return {
        ...l,
        effects: l.effects.map((e) => (e.id === effectInstanceId ? { ...e, enabled: !e.enabled } : e)),
      };
    });
    this.notify();
  }

  public reorderEffect(layerId: string, fromIndex: number, toIndex: number) {
    this.pushSnapshot();
    this.state.project.layers = this.state.project.layers.map((l) => {
      if (l.id !== layerId) return l;
      const fx = [...l.effects];
      const [moved] = fx.splice(fromIndex, 1);
      fx.splice(toIndex, 0, moved);
      return { ...l, effects: fx };
    });
    this.notify();
  }

  // --- Asset Management Flow ---
  public async importFiles(files: FileList | File[]) {
    this.pushSnapshot();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const fileName = file.name;
      const fileType = file.type;

      let type: Asset['type'] = 'image';
      if (fileType.startsWith('video/')) type = 'video';
      else if (fileType.startsWith('audio/')) type = 'audio';
      else if (fileName.endsWith('.ttf') || fileName.endsWith('.otf')) type = 'font';

      // Read as Data URL
      const dataBase64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const asset: Asset = {
        id: assetId,
        name: fileName,
        type,
        url: dataBase64,
        dataBase64,
      };

      if (type === 'font') {
        const fontName = fileName.replace(/\.[^/.]+$/, '');
        try {
          const fontFace = new FontFace(fontName, `url(${dataBase64})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          this.state.project.customFonts.push({
            family: fontName,
            url: dataBase64,
            dataBase64,
          });
        } catch (err) {
          console.warn('Failed loading font:', err);
        }
      } else if (type === 'image') {
        // Load image dimensions
        const img = new Image();
        img.src = dataBase64;
        await new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        });
        asset.width = img.naturalWidth || 1920;
        asset.height = img.naturalHeight || 1080;
        this.mediaCache.set(assetId, img);
      } else if (type === 'audio' || type === 'video') {
        // Decode audio for waveforms
        const arrayBuf = await file.arrayBuffer();
        try {
          const audioBuf = await decodeAudioData(arrayBuf);
          asset.audioBuffer = audioBuf;
          asset.duration = audioBuf.duration;
          asset.waveformPeaks = computeWaveformPeaks(audioBuf, 2000);
          this.audioBufferCache.set(assetId, audioBuf);
          this.waveformPeaksCache.set(assetId, asset.waveformPeaks);
        } catch {
          // If pure video without audio track
        }

        if (type === 'video') {
          const video = document.createElement('video');
          video.src = dataBase64;
          video.muted = true;
          video.playsInline = true;
          video.preload = 'auto';
          this.mediaCache.set(assetId, video);
          asset.width = 1920;
          asset.height = 1080;
        }
      }

      // Add to Assets
      this.state.project.assets.push(asset);

      // Auto-add to timeline as new layer at current playhead on top
      if (type !== 'font') {
        const layerType: LayerType = type === 'audio' ? 'audio' : type === 'video' ? 'video' : 'image';
        const layerW = asset.width || this.state.project.comp.width;
        const layerH = asset.height || this.state.project.comp.height;
        const naturalDur = asset.duration || (type === 'image' ? Math.min(this.state.project.comp.duration, 30.0) : 10.0);

        this.addLayer(layerType, {
          name: asset.name,
          assetId: asset.id,
          width: layerW,
          height: layerH,
          duration: naturalDur,
          inPoint: 0,
          outPoint: naturalDur,
          anchor: { value: [layerW / 2, layerH / 2], keyframes: [], animated: false },
        });
      }
    }

    this.autoHealTruncatedMediaLayers();
    this.notify();
  }

  public autoHealTruncatedMediaLayers() {
    for (const layer of this.state.project.layers) {
      if ((layer.type === 'audio' || layer.type === 'video') && layer.assetId) {
        const asset = this.state.project.assets.find((a) => a.id === layer.assetId);
        if (asset?.duration && asset.duration > 10.5 && layer.outPoint <= 10.05 && layer.duration <= 10.05) {
          layer.duration = asset.duration;
          layer.outPoint = asset.duration;
        }
      }
    }
  }

  public removeAsset(assetId: string) {
    this.pushSnapshot();
    this.state.project.assets = this.state.project.assets.filter((a) => a.id !== assetId);
    this.mediaCache.delete(assetId);
    this.audioBufferCache.delete(assetId);
    this.waveformPeaksCache.delete(assetId);
    this.notify();
  }

  public loadProject(newProject: Project) {
    this.pushSnapshot();
    this.state.project = newProject;
    this.rehydrateProjectAssets(this.state.project);
    this.state.currentTime = 0;
    this.state.selectedLayerIds = newProject.layers[0] ? [newProject.layers[0].id] : [];
    this.autoHealTruncatedMediaLayers();
    this.notify();
  }
}

export const store = new StateStore();
