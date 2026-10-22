/**
 * AEStudio - Main Application Shell
 *
 * Professional browser-based motion-graphics and video editor.
 */

import React, { useState, useEffect } from 'react';
import { store, EditorState } from './engine/state';
import { TopBar } from './components/TopBar';
import { AssetsPanel } from './components/AssetsPanel';
import { CanvasViewport } from './components/CanvasViewport';
import { TransportBar } from './components/TransportBar';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { CompSettingsModal } from './components/CompSettingsModal';
import { ExportModal } from './components/ExportModal';

// Helper to verify if the drag event is genuinely external OS files
function isExternalFileDrag(e: DragEvent): boolean {
  if (!e.dataTransfer) return false;
  const types = Array.from(e.dataTransfer.types || []);
  if (!types.includes('Files')) return false;
  if (
    types.includes('application/x-ae-layer-reorder') ||
    types.includes('application/x-ae-asset')
  ) {
    return false;
  }
  return true;
}

export default function App() {
  const [editorState, setEditorState] = useState<EditorState>(store.getState());
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<'video' | 'frame' | 'json'>('video');
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  const handleOpenExport = (tab: 'video' | 'frame' | 'json' = 'video') => {
    setExportModalTab(tab);
    setIsExportModalOpen(true);
  };

  // Keyboard shortcut listener for Ctrl+M (Export) and Ctrl+K (Composition Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyM') {
        e.preventDefault();
        handleOpenExport('video');
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault();
        setIsCompModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Subscribe to central state changes
  useEffect(() => {
    return store.subscribe((newState) => {
      setEditorState({ ...newState });
    });
  }, []);

  // Window-wide drag-and-drop listener for media ingestion (strictly external OS files only)
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      dragCounter++;
      setIsWindowDragOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsWindowDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!isExternalFileDrag(e)) return;
      dragCounter--;
      if (dragCounter <= 0 || e.relatedTarget === null) {
        dragCounter = 0;
        setIsWindowDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      dragCounter = 0;
      setIsWindowDragOver(false);
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        store.importFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121316] text-[#e2e4e9] overflow-hidden select-none relative">
      {/* Top Bar Navigation */}
      <TopBar
        state={editorState}
        onOpenCompSettings={() => setIsCompModalOpen(true)}
        onOpenExport={handleOpenExport}
      />

      {/* Main Workspace Split (Middle Area) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Assets & Effects Library (280px) */}
        <div className="w-72 shrink-0 h-full overflow-hidden">
          <AssetsPanel state={editorState} />
        </div>

        {/* Center: Canvas Viewport & Transport Bar */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#0c0d0f]">
          <CanvasViewport state={editorState} />
          <TransportBar state={editorState} />
        </div>

        {/* Right: Inspector Properties & Effect Stack (320px) */}
        <div className="w-80 shrink-0 h-full overflow-hidden">
          <Inspector state={editorState} />
        </div>
      </div>

      {/* Bottom Area: Multi-Track Timeline (~260px) */}
      <div className="h-64 shrink-0 overflow-hidden">
        <Timeline state={editorState} />
      </div>

      {/* Composition Settings Modal */}
      {isCompModalOpen && (
        <CompSettingsModal
          state={editorState}
          onClose={() => setIsCompModalOpen(false)}
        />
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          state={editorState}
          defaultTab={exportModalTab}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* Global Drag Overlay */}
      {isWindowDragOver && (
        <div className="absolute inset-0 bg-[#2d62ea]/20 backdrop-blur-sm border-4 border-dashed border-[#2d62ea] z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#18191c] px-6 py-4 rounded-xl border border-[#3b70f8] shadow-2xl text-center">
            <h2 className="text-lg font-bold text-white mb-1">Drop Files to Add to Project</h2>
            <p className="text-xs text-slate-400">Media will appear in Project Media and on the timeline at current playhead</p>
          </div>
        </div>
      )}
    </div>
  );
}
