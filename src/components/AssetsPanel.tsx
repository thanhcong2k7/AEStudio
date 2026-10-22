/**
 * AEStudio - Assets & Effects Library Panel
 */

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Music,
  Type,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Layers,
  Wand2,
} from 'lucide-react';
import { store, EditorState } from '../engine/state';
import { EFFECT_REGISTRY } from '../engine/registry';
import { Asset, EffectSpec } from '../engine/types';

interface AssetsPanelProps {
  state: EditorState;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'media' | 'effects'>('media');
  const [effectSearch, setEffectSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const filteredEffects = EFFECT_REGISTRY.filter((fx) => {
    const matchesCat = selectedCategory === 'All' || fx.category === selectedCategory;
    const matchesSearch =
      fx.name.toLowerCase().includes(effectSearch.toLowerCase()) ||
      fx.id.toLowerCase().includes(effectSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const [notice, setNotice] = useState<string | null>(null);

  const handleAddEffect = (spec: EffectSpec) => {
    if (state.selectedLayerIds.length === 0) {
      if (state.project.layers.length > 0) {
        const topLayer = state.project.layers[0];
        store.selectLayer(topLayer.id);
        store.addEffectToSelected(spec.id);
      } else {
        setNotice('Create or select a layer to apply effects.');
        setTimeout(() => setNotice(null), 2500);
      }
      return;
    }
    store.addEffectToSelected(spec.id);
  };

  const handleAssetDoubleClick = (asset: Asset) => {
    if (asset.type === 'font') return;
    const layerType = asset.type === 'audio' ? 'audio' : asset.type === 'video' ? 'video' : 'image';
    const comp = state.project.comp;
    const w = asset.width || comp.width;
    const h = asset.height || comp.height;

    const naturalDur = asset.duration || (layerType === 'image' ? Math.min(comp.duration, 30) : 10);

    store.addLayer(layerType, {
      name: asset.name,
      assetId: asset.id,
      width: w,
      height: h,
      duration: naturalDur,
      inPoint: 0,
      outPoint: naturalDur,
      anchor: { value: [w / 2, h / 2], keyframes: [], animated: false },
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      store.importFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    store.removeAsset(assetId);
  };

  return (
    <div
      className="h-full w-full bg-[#18191c] border-r border-[#26282e] flex flex-col select-none text-xs"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Tab Switcher */}
      <div className="flex border-b border-[#26282e] bg-[#141518]">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 font-medium transition-colors border-b-2 ${
            activeTab === 'media'
              ? 'border-[#2d62ea] text-white bg-[#1b1c20]'
              : 'border-transparent text-[#8a8e9b] hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Project Media ({state.project.assets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('effects')}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 font-medium transition-colors border-b-2 ${
            activeTab === 'effects'
              ? 'border-[#2d62ea] text-white bg-[#1b1c20]'
              : 'border-transparent text-[#8a8e9b] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Effects ({EFFECT_REGISTRY.length})</span>
        </button>
      </div>

      {/* Tab Content: Media */}
      {activeTab === 'media' && (
        <div className="flex-1 flex flex-col overflow-hidden p-2">
          {/* Header & Drop Banner */}
          <div
            className={`border border-dashed rounded-lg p-3 text-center transition-colors mb-2 cursor-pointer ${
              isDraggingOver
                ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                : 'border-[#2c2f37] hover:border-slate-500 bg-[#141518] text-slate-400'
            }`}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/*,video/*,audio/*,.ttf,.otf';
              input.onchange = (e: any) => {
                if (e.target.files) store.importFiles(e.target.files);
              };
              input.click();
            }}
          >
            <Plus className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <p className="text-[11px] font-medium text-slate-300">Drop files here or click to import</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Images, Videos, Audio & TTF/OTF fonts</p>
          </div>

          {/* Assets List */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {state.project.assets.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Layers className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p>No media files imported</p>
              </div>
            ) : (
              state.project.assets.map((asset) => (
                <div
                  key={asset.id}
                  onDoubleClick={() => handleAssetDoubleClick(asset)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-ae-asset', asset.id);
                    e.dataTransfer.setData('application/json', JSON.stringify({ assetId: asset.id }));
                  }}
                  className="flex items-center gap-2 p-1.5 rounded bg-[#1f2025] hover:bg-[#272930] border border-[#272930] hover:border-slate-600 transition-colors group cursor-grab active:cursor-grabbing"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-8 h-8 rounded bg-[#141518] flex items-center justify-center shrink-0 overflow-hidden border border-[#2b2e36]">
                    {asset.type === 'image' ? (
                      <img src={asset.url} alt="" className="w-full h-full object-cover" />
                    ) : asset.type === 'video' ? (
                      <Video className="w-4 h-4 text-purple-400" />
                    ) : asset.type === 'audio' ? (
                      <Music className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Type className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  {/* Asset Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-200 truncate">{asset.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="capitalize">{asset.type}</span>
                      {asset.duration && (
                        <>
                          <span>·</span>
                          <span>{asset.duration.toFixed(1)}s</span>
                        </>
                      )}
                      {asset.width && asset.height && (
                        <>
                          <span>·</span>
                          <span>{asset.width}×{asset.height}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add to Timeline Button */}
                  <button
                    onClick={() => handleAssetDoubleClick(asset)}
                    className="p-1 hover:bg-[#2d62ea] hover:text-white rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Add to timeline at playhead"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Effects */}
      {activeTab === 'effects' && (
        <div className="flex-1 flex flex-col overflow-hidden p-2">
          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${EFFECT_REGISTRY.length} effects & styles...`}
              value={effectSearch}
              onChange={(e) => setEffectSearch(e.target.value)}
              className="w-full bg-[#121316] border border-[#2b2e36] focus:border-[#2d62ea] rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
            {['All', 'Channel', 'Distort', 'Generate', 'Layer Styles'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#2d62ea] text-white shadow-sm'
                    : 'bg-[#1e2026] text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Effects List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {filteredEffects.map((spec) => (
              <div
                key={spec.id}
                className="flex items-center justify-between p-2 rounded bg-[#1f2025] hover:bg-[#25272e] border border-[#272930] transition-colors group"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-slate-200 truncate">{spec.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span className="text-blue-400 font-medium">{spec.category}</span>
                    <span>·</span>
                    <span>{spec.params.length} parameters</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAddEffect(spec)}
                  className="px-2.5 py-1 bg-[#22252c] hover:bg-[#2d62ea] text-slate-200 hover:text-white rounded border border-[#2d3039] hover:border-transparent flex items-center gap-1 transition-all shrink-0 font-medium shadow-sm"
                  title={`Apply ${spec.name} to selected layer(s)`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
