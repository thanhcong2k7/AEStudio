/**
 * AEStudio - Top Bar Navigation & Workspace Controls
 */

import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Save,
  Plus,
  Undo2,
  Redo2,
  Settings2,
  Magnet,
  Layers,
  Sparkles,
  Download,
  Film,
  Image as ImageIcon,
  FileJson,
} from 'lucide-react';
import { store, EditorState } from '../engine/state';
import {
  exportProjectToJson,
  loadProjectFromJson,
  exportProjectToAes,
  loadProjectFromAes,
} from '../engine/projectIo';
import { PreviewQuality } from '../engine/types';

interface TopBarProps {
  state: EditorState;
  onOpenCompSettings: () => void;
  onOpenExport: (tab?: 'video' | 'frame' | 'json') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ state, onOpenCompSettings, onOpenExport }) => {
  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'layer' | null>(null);
  const [isPackagingAes, setIsPackagingAes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const formatTimecode = (sec: number, fps: number) => {
    const totalFrames = Math.floor(sec * fps);
    const f = totalFrames % fps;
    const s = Math.floor(sec) % 60;
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  const handleOpenProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.aes')) {
        const loaded = await loadProjectFromAes(file);
        store.loadProject(loaded);
      } else {
        const text = await file.text();
        const loaded = loadProjectFromJson(text);
        store.loadProject(loaded);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open project file');
    }
    e.target.value = '';
  };

  const handleSaveProjectAes = async () => {
    try {
      setIsPackagingAes(true);
      const blob = await exportProjectToAes(state.project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.project.name.toLowerCase().replace(/\s+/g, '_') || 'aestudio_project'}.aes`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to package .aes project');
    } finally {
      setIsPackagingAes(false);
    }
  };

  const handleSaveProject = (embedMedia: boolean = true) => {
    const jsonStr = exportProjectToJson(state.project, embedMedia);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.project.name.toLowerCase().replace(/\s+/g, '_') || 'aestudio_project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMediaClick = () => {
    fileInputRef.current?.click();
  };

  const handleMediaFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      store.importFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="h-10 bg-[#17181c] border-b border-[#26282e] flex items-center justify-between px-3 text-xs select-none relative z-50">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,.ttf,.otf"
        onChange={handleMediaFilesSelected}
      />
      <input
        type="file"
        ref={projectInputRef}
        className="hidden"
        accept=".aes,.json,.ae.json"
        onChange={handleOpenProjectFile}
      />

      {/* Left: Brand & Menus */}
      <div className="flex items-center gap-4">
        {/* Brand Zone: 1-line wordmark */}
        <div className="flex items-center gap-2 font-bold tracking-tight text-white text-sm shrink-0 mr-2">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-[#2d62ea] to-[#4f8bff] flex items-center justify-center text-white text-[10px] font-black shadow-sm">
            AE
          </div>
          <span className="font-semibold tracking-wider text-slate-100">AEStudio</span>
        </div>

        {/* Menu Items */}
        <div className="flex items-center gap-1 text-[#b5b8c2]">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className={`px-2 py-1 rounded transition-colors ${activeMenu === 'file' ? 'bg-[#292c34] text-white' : 'hover:bg-[#202227] hover:text-white'}`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div
                className="absolute top-full left-0 mt-1 w-48 bg-[#1f2127] border border-[#2f333c] rounded-md shadow-2xl py-1 z-50 text-slate-200"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    store.loadProject({ ...state.project, layers: [] });
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> New Project
                </button>
                <button
                  onClick={() => {
                    projectInputRef.current?.click();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" /> Open Project (.aes / .json)...
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+O</span>
                </button>
                <button
                  disabled={isPackagingAes}
                  onClick={() => {
                    handleSaveProjectAes();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between text-emerald-300 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    {isPackagingAes ? 'Bundling .aes...' : 'Save Project (.aes Package)'}
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Recommended</span>
                </button>
                <button
                  onClick={() => {
                    handleSaveProject(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between text-slate-300"
                >
                  <span className="flex items-center gap-2">
                    <FileJson className="w-3.5 h-3.5 text-slate-400" /> Save Project (.json)
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+S</span>
                </button>
                <div className="my-1 border-t border-[#2d3038]"></div>
                <button
                  onClick={() => {
                    onOpenExport('video');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between text-blue-300 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-blue-400" /> Export Video (MP4/WebM)...
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+M</span>
                </button>
                <button
                  onClick={() => {
                    onOpenExport('frame');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> Export Current Frame (PNG)...
                </button>
                <button
                  onClick={() => {
                    onOpenExport('json');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" /> Export Project File (.ae.json)...
                </button>
                <div className="my-1 border-t border-[#2d3038]"></div>
                <button
                  onClick={() => {
                    handleImportMediaClick();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white"
                >
                  Import Media / Font...
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
              className={`px-2 py-1 rounded transition-colors ${activeMenu === 'edit' ? 'bg-[#292c34] text-white' : 'hover:bg-[#202227] hover:text-white'}`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div
                className="absolute top-full left-0 mt-1 w-48 bg-[#1f2127] border border-[#2f333c] rounded-md shadow-2xl py-1 z-50 text-slate-200"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  disabled={!store.canUndo()}
                  onClick={() => {
                    store.undo();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="flex items-center gap-2">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+Z</span>
                </button>
                <button
                  disabled={!store.canRedo()}
                  onClick={() => {
                    store.redo();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="flex items-center gap-2">
                    <Redo2 className="w-3.5 h-3.5" /> Redo
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+Y</span>
                </button>
                <div className="my-1 border-t border-[#2d3038]"></div>
                <button
                  onClick={() => {
                    store.duplicateSelectedLayers();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between"
                >
                  <span>Duplicate Layer</span>
                  <span className="text-[10px] text-slate-400">Ctrl+D</span>
                </button>
                <button
                  onClick={() => {
                    store.deleteSelectedLayers();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white flex items-center justify-between"
                >
                  <span>Delete Selected</span>
                  <span className="text-[10px] text-slate-400">Del</span>
                </button>
              </div>
            )}
          </div>

          {/* Layer Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'layer' ? null : 'layer')}
              className={`px-2 py-1 rounded transition-colors ${activeMenu === 'layer' ? 'bg-[#292c34] text-white' : 'hover:bg-[#202227] hover:text-white'}`}
            >
              Layer
            </button>
            {activeMenu === 'layer' && (
              <div
                className="absolute top-full left-0 mt-1 w-48 bg-[#1f2127] border border-[#2f333c] rounded-md shadow-2xl py-1 z-50 text-slate-200"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    store.addLayer('text');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white"
                >
                  New Text Layer
                </button>
                <button
                  onClick={() => {
                    store.addLayer('solid');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white"
                >
                  New Solid / Empty Layer
                </button>
                <button
                  onClick={() => {
                    store.addLayer('shape');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white"
                >
                  New Shape Layer
                </button>
                <button
                  onClick={() => {
                    store.addLayer('adjustment');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2d62ea] hover:text-white"
                >
                  New Adjustment Layer
                </button>
              </div>
            )}
          </div>

          {/* Composition Settings button */}
          <button
            onClick={onOpenCompSettings}
            className="px-2 py-1 rounded hover:bg-[#202227] hover:text-white flex items-center gap-1.5"
            title="Composition Settings (Ctrl+K)"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Composition</span>
          </button>
        </div>
      </div>

      {/* Center: Timecode & Transport Summary */}
      <div className="flex items-center gap-3">
        {/* Timecode display */}
        <div
          className="bg-[#0e0f12] px-2.5 py-1 rounded border border-[#242730] font-mono font-medium text-emerald-400 text-xs tracking-wider cursor-pointer hover:border-emerald-500/50"
          title="Current Timecode (HH:MM:SS:FF)"
          onClick={() => {
            const input = prompt('Jump to time (in seconds):', String(state.currentTime.toFixed(2)));
            if (input !== null) {
              const parsed = parseFloat(input);
              if (!isNaN(parsed)) store.setCurrentTime(parsed);
            }
          }}
        >
          {formatTimecode(state.currentTime, state.project.comp.fps)}
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-1 bg-[#121316] p-0.5 rounded border border-[#242730]">
          {(['full', 'half', 'third', 'quarter'] as PreviewQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => store.setQuality(q)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase transition-colors ${
                state.previewQuality === q
                  ? 'bg-[#2d62ea] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Snapping Toggle */}
        <button
          onClick={() => store.toggleSnapping()}
          className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors border ${
            state.snappingEnabled
              ? 'bg-[#16274a] text-cyan-400 border-cyan-500/40 shadow-sm'
              : 'bg-[#181a1f] text-slate-400 border-[#26282e] hover:text-slate-200'
          }`}
          title="Toggle Canvas Snapping"
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="text-[11px]">Snap</span>
        </button>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleImportMediaClick}
          className="px-2.5 py-1 bg-[#22242c] hover:bg-[#2b2e38] text-slate-200 border border-[#2f333c] rounded flex items-center gap-1.5 transition-colors"
          title="Import media assets or fonts"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>Import</span>
        </button>

        <button
          onClick={() => onOpenExport('video')}
          className="px-3.5 py-1 bg-gradient-to-r from-[#2d62ea] to-[#427dff] hover:from-[#356cf5] hover:to-[#528bff] text-white font-medium rounded flex items-center gap-1.5 transition-all shadow-sm active:scale-95 text-xs shadow-blue-900/30"
          title="Export Video, Frame Snapshot, or Project (Ctrl+M)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
