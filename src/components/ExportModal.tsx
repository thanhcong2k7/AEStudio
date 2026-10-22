/**
 * AEStudio - Professional Export Center
 * 
 * Supports rendering full compositions to MP4 / WebM video with mixed audio,
 * instantaneous high-res PNG / JPEG frame captures, and project JSON serialization.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Film,
  Image as ImageIcon,
  FileJson,
  Download,
  Check,
  AlertCircle,
  Clock,
  Play,
  Copy,
  Loader2,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EditorState, store } from '../engine/state';
import { renderComposition } from '../engine/renderer';
import { exportProjectToJson, exportProjectToAes } from '../engine/projectIo';
import { Project } from '../engine/types';

interface ExportModalProps {
  state: EditorState;
  onClose: () => void;
  defaultTab?: 'video' | 'frame' | 'json';
}

type ExportTab = 'video' | 'frame' | 'json';

// Detect best supported mime type
function getSupportedVideoMimeType(preferMp4: boolean): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', ext: 'webm' };
  }

  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];

  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  if (preferMp4) {
    for (const t of mp4Types) {
      if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, ext: 'mp4' };
    }
  }

  for (const t of webmTypes) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, ext: 'webm' };
  }

  for (const t of mp4Types) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, ext: 'mp4' };
  }

  return { mimeType: 'video/webm', ext: 'webm' };
}

// Mix project audio layers into an AudioBuffer using OfflineAudioContext
async function mixProjectAudio(
  project: Project,
  startTime: number,
  duration: number,
  sampleRate: number = 44100
): Promise<AudioBuffer | null> {
  const audioLayers = project.layers.filter(
    (l) => l.visible && !l.mute && (l.type === 'audio' || l.type === 'video') && l.assetId
  );

  if (audioLayers.length === 0) return null;

  try {
    const offlineCtx = new OfflineAudioContext(
      2,
      Math.max(1, Math.ceil(duration * sampleRate)),
      sampleRate
    );
    let hasAudio = false;

    for (const layer of audioLayers) {
      const asset = project.assets.find((a) => a.id === layer.assetId);
      const buffer = asset?.audioBuffer || store.audioBufferCache.get(layer.assetId!);
      if (!buffer) continue;

      const layerGlobalStart = layer.startTime + layer.inPoint;
      const layerGlobalEnd = layer.startTime + layer.outPoint;

      const rangeStart = Math.max(startTime, layerGlobalStart);
      const rangeEnd = Math.min(startTime + duration, layerGlobalEnd);

      if (rangeEnd <= rangeStart) continue;

      const targetWhen = rangeStart - startTime;
      const sourceOffset = (rangeStart - layer.startTime);
      const playDuration = rangeEnd - rangeStart;

      if (playDuration > 0 && sourceOffset >= 0 && sourceOffset < buffer.duration) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(offlineCtx.destination);
        src.start(
          Math.max(0, targetWhen),
          sourceOffset,
          Math.min(playDuration, buffer.duration - sourceOffset)
        );
        hasAudio = true;
      }
    }

    if (!hasAudio) return null;
    return await offlineCtx.startRendering();
  } catch (err) {
    console.warn('Audio export mix error:', err);
    return null;
  }
}

export const ExportModal: React.FC<ExportModalProps> = ({
  state,
  onClose,
  defaultTab = 'video',
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>(defaultTab);

  const comp = state.project.comp;

  // Video Export Settings
  const [resolutionPreset, setResolutionPreset] = useState<'comp' | '1080p' | '720p' | '540p'>('comp');
  const [formatOption, setFormatOption] = useState<'webm' | 'mp4'>('webm');
  const [customFps, setCustomFps] = useState<number>(comp.fps);
  const [videoBitrateMbps, setVideoBitrateMbps] = useState<number>(8);
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'full' | 'custom'>('full');
  const [rangeStart, setRangeStart] = useState<number>(0);
  const [rangeEnd, setRangeEnd] = useState<number>(comp.duration);

  // Video Rendering Progress State
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0); // 0 to 100
  const [currentFrameNum, setCurrentFrameNum] = useState(0);
  const [totalFramesNum, setTotalFramesNum] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportCompleteUrl, setExportCompleteUrl] = useState<string | null>(null);
  const [exportCompleteSize, setExportCompleteSize] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>('');

  const cancelExportRef = useRef(false);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Frame Export Settings
  const [frameFormat, setFrameFormat] = useState<'png' | 'jpeg'>('png');
  const [frameQuality, setFrameQuality] = useState<number>(0.95);
  const [copiedFrameSuccess, setCopiedFrameSuccess] = useState(false);
  const frameSnapshotCanvasRef = useRef<HTMLCanvasElement>(null);

  // Determine export dimensions
  let exportWidth = comp.width;
  let exportHeight = comp.height;
  if (resolutionPreset === '1080p') {
    exportWidth = 1920;
    exportHeight = 1080;
  } else if (resolutionPreset === '720p') {
    exportWidth = 1280;
    exportHeight = 720;
  } else if (resolutionPreset === '540p') {
    exportWidth = 960;
    exportHeight = 540;
  }

  const exportDuration = timeRange === 'full' ? comp.duration : Math.max(0.1, rangeEnd - rangeStart);
  const exportStartTime = timeRange === 'full' ? 0 : Math.max(0, rangeStart);

  // Bitrate and estimated file size calculation
  const estAudioBitrateBps = includeAudio ? 128_000 : 0;
  const estVideoBitrateBps = videoBitrateMbps * 1_000_000;
  const estTotalBytes = ((estVideoBitrateBps + estAudioBitrateBps) * exportDuration) / 8;
  const estSizeMb = (estTotalBytes / (1024 * 1024)).toFixed(1);

  // Render frame snapshot whenever modal opens or frame tab is active
  useEffect(() => {
    if (activeTab === 'frame' && frameSnapshotCanvasRef.current) {
      const canvas = frameSnapshotCanvasRef.current;
      renderComposition(canvas, {
        comp,
        layers: state.project.layers,
        assets: state.project.assets,
        time: state.currentTime,
        quality: 'full',
        selectedLayerIds: [],
        mediaElements: store.mediaCache,
        isPlaying: false,
      });
    }
  }, [activeTab, state.currentTime, comp, state.project]);

  // Video Export Execution
  const handleStartVideoExport = async () => {
    setIsExportingVideo(true);
    setExportProgress(0);
    setExportError(null);
    setExportCompleteUrl(null);
    setExportCompleteSize(null);
    cancelExportRef.current = false;

    const fps = customFps || 30;
    const totalFrames = Math.max(1, Math.round(exportDuration * fps));
    setTotalFramesNum(totalFrames);
    setCurrentFrameNum(0);

    const { mimeType, ext } = getSupportedVideoMimeType(formatOption === 'mp4');
    const safeProjectName = state.project.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AEStudio_Comp';
    const filename = `${safeProjectName}_${exportWidth}x${exportHeight}_${fps}fps_${videoBitrateMbps}Mbps.${ext}`;
    setExportFilename(filename);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = exportWidth;
    offscreenCanvas.height = exportHeight;

    let mediaRecorder: MediaRecorder | null = null;
    let audioSourceNode: AudioBufferSourceNode | null = null;
    let exportAudioCtx: AudioContext | null = null;

    try {
      // 1. Prepare Audio Track
      let audioTrack: MediaStreamTrack | null = null;
      if (includeAudio) {
        const audioBuffer = await mixProjectAudio(
          state.project,
          exportStartTime,
          exportDuration,
          44100
        );
        if (audioBuffer) {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          exportAudioCtx = new AudioCtxClass({ sampleRate: audioBuffer.sampleRate });
          const dest = exportAudioCtx.createMediaStreamDestination();
          audioSourceNode = exportAudioCtx.createBufferSource();
          audioSourceNode.buffer = audioBuffer;
          audioSourceNode.connect(dest);
          audioTrack = dest.stream.getAudioTracks()[0] || null;
        }
      }

      // 2. Prepare MediaStream from Canvas + Audio
      const canvasStream = offscreenCanvas.captureStream(fps);
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((vt) => combinedStream.addTrack(vt));
      if (audioTrack) {
        combinedStream.addTrack(audioTrack);
      }

      // 3. Setup MediaRecorder with user-defined bitrate
      const recordedChunks: Blob[] = [];
      const targetBitrateBps = Math.max(500_000, Math.round(videoBitrateMbps * 1_000_000));
      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: targetBitrateBps,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      const renderPromise = new Promise<Blob>((resolve, reject) => {
        if (!mediaRecorder) return reject(new Error('Recorder init failed'));

        mediaRecorder.onstop = () => {
          const finalBlob = new Blob(recordedChunks, { type: mimeType });
          resolve(finalBlob);
        };
        mediaRecorder.onerror = (ev: any) => reject(ev.error || new Error('Recorder error'));
      });

      // Start recording
      mediaRecorder.start(100);
      if (audioSourceNode) {
        audioSourceNode.start(0);
      }

      // 4. Render Frame-by-Frame Loop with Pacing
      const frameDelayMs = 1000 / fps;
      const previewCanvas = livePreviewCanvasRef.current;
      const previewCtx = previewCanvas?.getContext('2d');

      for (let i = 0; i < totalFrames; i++) {
        if (cancelExportRef.current) {
          mediaRecorder.stop();
          throw new Error('Export cancelled by user.');
        }

        const t = exportStartTime + i / fps;

        // Render to offscreen canvas
        renderComposition(offscreenCanvas, {
          comp: { ...comp, width: exportWidth, height: exportHeight },
          layers: state.project.layers,
          assets: state.project.assets,
          time: t,
          quality: 'full',
          selectedLayerIds: [],
          mediaElements: store.mediaCache,
          isPlaying: false,
        });

        // Blit to live preview canvas in modal
        if (previewCanvas && previewCtx) {
          previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          previewCtx.drawImage(
            offscreenCanvas,
            0,
            0,
            previewCanvas.width,
            previewCanvas.height
          );
        }

        setCurrentFrameNum(i + 1);
        setExportProgress(Math.round(((i + 1) / totalFrames) * 100));

        // Yield to browser event loop & allow MediaRecorder to encode frame
        await new Promise((res) => setTimeout(res, frameDelayMs));
      }

      // Stop recorder and finish
      mediaRecorder.stop();
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch {}
      }
      if (exportAudioCtx) {
        try {
          exportAudioCtx.close();
        } catch {}
      }

      const blob = await renderPromise;
      const url = URL.createObjectURL(blob);
      setExportCompleteUrl(url);

      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      setExportCompleteSize(`${sizeMb} MB`);

      // Trigger automatic file download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setIsExportingVideo(false);
    } catch (err: any) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch {}
      }
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch {}
      }
      if (exportAudioCtx) {
        try {
          exportAudioCtx.close();
        } catch {}
      }
      setIsExportingVideo(false);
      setExportError(err.message || 'Export failed');
    }
  };

  const handleCancelExport = () => {
    cancelExportRef.current = true;
    setIsExportingVideo(false);
    setExportError('Export cancelled.');
  };

  // Frame Export Execution
  const handleDownloadFrame = () => {
    if (!frameSnapshotCanvasRef.current) return;
    const canvas = frameSnapshotCanvasRef.current;
    const mime = frameFormat === 'png' ? 'image/png' : 'image/jpeg';
    const ext = frameFormat;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = state.project.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AEStudio';
        const tc = state.currentTime.toFixed(2).replace('.', '_');
        a.href = url;
        a.download = `${safeName}_frame_${tc}s.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      mime,
      frameQuality
    );
  };

  const handleCopyFrameToClipboard = () => {
    if (!frameSnapshotCanvasRef.current) return;
    const canvas = frameSnapshotCanvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      try {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedFrameSuccess(true);
        setTimeout(() => setCopiedFrameSuccess(false), 2500);
      } catch (err) {
        console.warn('Clipboard copy error:', err);
      }
    }, 'image/png');
  };

  const [isExportingAes, setIsExportingAes] = useState(false);

  // Project .aes Package Export (ZIP Container)
  const handleExportAes = async () => {
    try {
      setIsExportingAes(true);
      const blob = await exportProjectToAes(state.project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = state.project.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AEStudio_Project';
      a.href = url;
      a.download = `${safeName}.aes`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      alert('Failed to package .aes container: ' + (err.message || err));
    } finally {
      setIsExportingAes(false);
    }
  };

  // Project JSON Export
  const handleExportJson = (embedMedia: boolean) => {
    const jsonStr = exportProjectToJson(state.project, embedMedia);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = state.project.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AEStudio_Project';
    a.href = url;
    a.download = `${safeName}${embedMedia ? '' : '_no_media'}.ae.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#181a20] border border-[#2f333e] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden text-[#e2e4e9]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292c36] bg-[#14151a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Export Center</h2>
              <p className="text-xs text-slate-400">
                Render video compositions, save frame snapshots, or export project bundles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#252833] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#292c36] bg-[#16181f] px-6 gap-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'video'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Render Video (MP4 / WebM)</span>
          </button>

          <button
            onClick={() => setActiveTab('frame')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'frame'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Current Frame Snapshot (PNG)</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'json'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>Project Package (.aes / .json)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: VIDEO EXPORT */}
          {activeTab === 'video' && (
            <div className="space-y-6">
              {!isExportingVideo && !exportCompleteUrl && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Resolution & Quality
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'comp', label: `Comp (${comp.width}×${comp.height})` },
                          { id: '1080p', label: '1080p (1920×1080)' },
                          { id: '720p', label: '720p (1280×720)' },
                          { id: '540p', label: '540p Fast (960×540)' },
                        ].map((res) => (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => setResolutionPreset(res.id as any)}
                            className={`px-3 py-2 text-left rounded-lg text-xs font-medium border transition-colors ${
                              resolutionPreset === res.id
                                ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                                : 'bg-[#1e2029] border-[#2f333e] text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {res.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Output Container
                        </label>
                        <select
                          value={formatOption}
                          onChange={(e) => setFormatOption(e.target.value as any)}
                          className="w-full bg-[#1e2029] border border-[#2f333e] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="webm">WebM Video (VP9/VP8, Recommended)</option>
                          <option value="mp4">MP4 Video (H.264 / AAC)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Frame Rate
                        </label>
                        <select
                          value={customFps}
                          onChange={(e) => setCustomFps(Number(e.target.value))}
                          className="w-full bg-[#1e2029] border border-[#2f333e] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value={comp.fps}>Composition FPS ({comp.fps} fps)</option>
                          <option value={60}>60 fps (Smooth)</option>
                          <option value={30}>30 fps (Standard)</option>
                          <option value={24}>24 fps (Film)</option>
                        </select>
                      </div>
                    </div>

                    {/* Video Bitrate Customization */}
                    <div className="bg-[#161820] border border-[#262934] rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-blue-400" />
                          <span>Video Bitrate</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0.5}
                            max={60}
                            step={0.5}
                            value={videoBitrateMbps}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setVideoBitrateMbps(Math.max(0.5, Math.min(60, val)));
                            }}
                            className="w-16 bg-[#1e2029] border border-[#343846] rounded px-2 py-0.5 text-xs text-right font-mono text-blue-400 focus:outline-none focus:border-blue-500 font-semibold"
                          />
                          <span className="text-xs text-slate-400 font-medium">Mbps</span>
                        </div>
                      </div>

                      {/* Preset Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Draft', mbps: 2.5, tip: '2.5M' },
                          { label: 'Standard', mbps: 6, tip: '6.0M' },
                          { label: 'High', mbps: 12, tip: '12.0M' },
                          { label: 'Ultra', mbps: 24, tip: '24.0M' },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setVideoBitrateMbps(preset.mbps)}
                            className={`py-1.5 px-2 rounded-lg text-center border transition-all ${
                              videoBitrateMbps === preset.mbps
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium shadow-sm'
                                : 'bg-[#1e2029] border-[#2b2e3a] text-slate-400 hover:text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            <div className="text-[11px] font-medium leading-tight">{preset.label}</div>
                            <div className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">{preset.tip}</div>
                          </button>
                        ))}
                      </div>

                      {/* Slider Control */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">1M</span>
                          <input
                            type="range"
                            min={1}
                            max={40}
                            step={0.5}
                            value={videoBitrateMbps}
                            onChange={(e) => setVideoBitrateMbps(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-[#252833] rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">40M</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Smaller file</span>
                          <span>Higher visual fidelity</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Time Span
                      </label>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setTimeRange('full')}
                          className={`flex-1 py-1.5 px-3 rounded text-xs font-medium border ${
                            timeRange === 'full'
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                              : 'bg-[#1e2029] border-[#2f333e] text-slate-400'
                          }`}
                        >
                          Entire Duration ({comp.duration.toFixed(1)}s)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeRange('custom')}
                          className={`flex-1 py-1.5 px-3 rounded text-xs font-medium border ${
                            timeRange === 'custom'
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                              : 'bg-[#1e2029] border-[#2f333e] text-slate-400'
                          }`}
                        >
                          Custom In/Out
                        </button>
                      </div>

                      {timeRange === 'custom' && (
                        <div className="flex items-center gap-3 bg-[#16181f] p-2.5 rounded-lg border border-[#292c36]">
                          <div className="flex-1">
                            <span className="text-[11px] text-slate-400 block mb-0.5">Start (s)</span>
                            <input
                              type="number"
                              min={0}
                              max={rangeEnd - 0.1}
                              step={0.1}
                              value={rangeStart}
                              onChange={(e) => setRangeStart(Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-full bg-[#1e2029] border border-[#2f333e] rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-[11px] text-slate-400 block mb-0.5">End (s)</span>
                            <input
                              type="number"
                              min={rangeStart + 0.1}
                              max={comp.duration}
                              step={0.1}
                              value={rangeEnd}
                              onChange={(e) => setRangeEnd(Math.min(comp.duration, parseFloat(e.target.value) || comp.duration))}
                              className="w-full bg-[#1e2029] border border-[#2f333e] rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={includeAudio}
                          onChange={(e) => setIncludeAudio(e.target.checked)}
                          className="rounded border-[#2f333e] bg-[#1e2029] text-blue-600 focus:ring-0"
                        />
                        <span className="flex items-center gap-1.5">
                          {includeAudio ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                          Include Audio Tracks & Sound Effects
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Right Column: Output Summary & Specs */}
                  <div className="bg-[#14151b] border border-[#262832] rounded-xl p-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
                        Render Summary
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Dimensions:</span>
                          <span className="font-mono text-slate-200">{exportWidth} × {exportHeight} px</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Duration:</span>
                          <span className="font-mono text-slate-200">{exportDuration.toFixed(2)}s</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Total Frames:</span>
                          <span className="font-mono text-slate-200">
                            {Math.round(exportDuration * customFps)} frames @ {customFps} fps
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Audio Pipeline:</span>
                          <span className={includeAudio ? "text-emerald-400 font-medium" : "text-slate-500"}>
                            {includeAudio ? 'Multi-track mixed (44.1 kHz stereo)' : 'Video only (muted)'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Video Bitrate:</span>
                          <span className="font-mono text-blue-400 font-medium">
                            {videoBitrateMbps} Mbps ({(videoBitrateMbps * 1000).toLocaleString()} kbps)
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#21232c]">
                          <span className="text-slate-400">Est. File Size:</span>
                          <span className="font-mono text-emerald-400 font-medium">~{estSizeMb} MB</span>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg text-[11px] text-blue-300">
                        ⚡ Client-side rendering: Media is synthesized directly inside your browser and immediately saved as a video file without cloud uploads.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartVideoExport}
                      className="mt-6 w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                    >
                      <Film className="w-4 h-4" />
                      <span>Start Video Render & Download</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Progress State During Video Export */}
              {isExportingVideo && (
                <div className="space-y-5 py-4">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-semibold text-white flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      Rendering Video: {currentFrameNum} / {totalFramesNum} frames
                    </h3>
                    <p className="text-xs text-slate-400">
                      Encoding {exportWidth}×{exportHeight} at {customFps} fps • {exportProgress}% complete
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#121316] rounded-full h-3 p-0.5 border border-[#2b2e38] overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-100 ease-out"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>

                  {/* Live Rendering Preview Canvas */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Live Encoding Monitor
                    </span>
                    <div className="rounded-lg border border-[#2e313c] overflow-hidden bg-black shadow-lg">
                      <canvas
                        ref={livePreviewCanvasRef}
                        width={320}
                        height={180}
                        className="w-80 h-[180px] object-contain block"
                      />
                    </div>
                  </div>

                  {/* Cancel Button */}
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={handleCancelExport}
                      className="px-4 py-1.5 bg-[#252833] hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-[#353846] hover:border-rose-700/50 rounded-lg text-xs transition-colors"
                    >
                      Cancel Export
                    </button>
                  </div>
                </div>
              )}

              {/* Export Complete State */}
              {exportCompleteUrl && (
                <div className="p-6 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">Video Successfully Exported!</h3>
                    <p className="text-xs text-slate-300">
                      Downloaded as <span className="font-mono text-emerald-400">{exportFilename}</span> ({exportCompleteSize})
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <a
                      href={exportCompleteUrl}
                      download={exportFilename}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Again</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setExportCompleteUrl(null);
                        setExportProgress(0);
                      }}
                      className="px-4 py-2 bg-[#252833] hover:bg-[#2e3240] text-slate-200 rounded-lg text-xs font-medium border border-[#353846] transition-colors"
                    >
                      Render Another Video
                    </button>
                  </div>
                </div>
              )}

              {/* Export Error State */}
              {exportError && (
                <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-xl flex items-center gap-3 text-xs text-rose-300">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CURRENT FRAME SNAPSHOT */}
          {activeTab === 'frame' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Snapshot Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      Current Playhead Frame ({state.currentTime.toFixed(2)}s)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {comp.width} × {comp.height} px
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#2f333e] bg-black overflow-hidden shadow-inner flex items-center justify-center p-1">
                    <canvas
                      ref={frameSnapshotCanvasRef}
                      width={comp.width}
                      height={comp.height}
                      className="max-h-56 max-w-full object-contain block rounded"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Captures full resolution pixel-perfect rasterization including all layer blend modes, masks, and effects.
                  </p>
                </div>

                {/* Frame Options */}
                <div className="space-y-4 bg-[#14151b] border border-[#262832] rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                    Image Export Settings
                  </h3>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Image Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFrameFormat('png')}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                          frameFormat === 'png'
                            ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                            : 'bg-[#1e2029] border-[#2f333e] text-slate-300'
                        }`}
                      >
                        PNG (Lossless & Alpha)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameFormat('jpeg')}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                          frameFormat === 'jpeg'
                            ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                            : 'bg-[#1e2029] border-[#2f333e] text-slate-300'
                        }`}
                      >
                        JPEG (Compressed)
                      </button>
                    </div>
                  </div>

                  {frameFormat === 'jpeg' && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span>JPEG Quality</span>
                        <span className="font-mono">{Math.round(frameQuality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="1"
                        step="0.05"
                        value={frameQuality}
                        onChange={(e) => setFrameQuality(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleDownloadFrame}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Frame ({frameFormat.toUpperCase()})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyFrameToClipboard}
                      className="w-full py-2 px-4 bg-[#20222b] hover:bg-[#2b2e3a] text-slate-200 border border-[#2f333e] font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      {copiedFrameSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Frame to Clipboard</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROJECT PACKAGE / JSON EXPORT */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              {/* Primary Recommended: .aes ZIP Archive */}
              <div className="bg-[#14151b] border-2 border-emerald-500/40 rounded-xl p-5 relative overflow-hidden shadow-xl">
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold tracking-wider uppercase border border-emerald-500/30">
                  Recommended
                </div>
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Portable .aes Project Package</span>
                      <span className="text-[11px] text-emerald-400 font-normal">(ZIP Container)</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Packages the composition state alongside <strong>original raw binary video, audio, image, and font files</strong> inside a compressed archive.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 text-[11px] text-slate-300 border-y border-[#262834] my-3">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>No Base64 Bloat (Fast Save)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Bundles {state.project.assets.length} Media Files</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>100% Cross-Browser Portable</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isExportingAes}
                  onClick={handleExportAes}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingAes ? 'Packaging .aes Container...' : 'Download .aes Project Package'}</span>
                </button>
              </div>

              {/* Secondary Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Project File (.ae.json) */}
                <div className="bg-[#14151b] border border-[#262832] rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                        <FileJson className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white">Full JSON Bundle (.ae.json)</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Serializes all comp settings and embedded base64 media data into a single text JSON file.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportJson(true)}
                    className="mt-4 w-full py-2 px-3 bg-[#20222b] hover:bg-[#2b2e3b] text-slate-200 border border-[#323544] font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Full JSON</span>
                  </button>
                </div>

                {/* Lightweight Project File (.ae.json) */}
                <div className="bg-[#14151b] border border-[#262832] rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-500/20 text-slate-400 flex items-center justify-center border border-slate-500/30">
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white">Lightweight JSON (.ae.json)</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Exports project timeline tracks, keyframes, and effect parameters without heavy binary media data.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportJson(false)}
                    className="mt-4 w-full py-2 px-3 bg-[#20222b] hover:bg-[#2b2e3b] text-slate-200 border border-[#323544] font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Lightweight JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#292c36] bg-[#14151a] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <span>Project: {state.project.name}</span>
            <span>•</span>
            <span>Duration: {comp.duration.toFixed(1)}s</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#20222a] hover:bg-[#292c36] text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
