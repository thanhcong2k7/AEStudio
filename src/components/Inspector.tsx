/**
 * AEStudio - Inspector Panel (Layer Properties & Applied Effect Stack)
 */

import React, { useState } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Unlock,
  Timer,
  Activity,
  ArrowUp,
  ArrowDown,
  Palette,
  Type,
  Square,
  Sparkles,
} from 'lucide-react';
import { store, EditorState } from '../engine/state';
import { EFFECT_REGISTRY } from '../engine/registry';
import {
  Layer,
  BlendMode,
  EffectInstance,
  EffectParamSpec,
  AnimatableProp,
} from '../engine/types';
import { evaluateProp } from '../engine/evaluator';
import { TypedNumberInput } from './TypedNumberInput';

interface InspectorProps {
  state: EditorState;
}

export const Inspector: React.FC<InspectorProps> = ({ state }) => {
  const { selectedLayerIds, currentTime, project } = state;
  const { layers } = project;
  const selectedLayer = layers.find((l: Layer) => selectedLayerIds.includes(l.id));

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    transform: true,
    shape: true,
    text: true,
  });

  const [expandedEffectGroups, setExpandedEffectGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEffectGroup = (fxId: string, groupName: string) => {
    const key = `${fxId}_${groupName}`;
    setExpandedEffectGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!selectedLayer) {
    return (
      <div className="h-full w-full bg-[#18191c] border-l border-[#26282e] p-4 flex flex-col items-center justify-center text-slate-500 text-center select-none text-xs">
        <Sliders className="w-8 h-8 mb-2 opacity-30" />
        <p className="font-medium text-slate-400">No Layer Selected</p>
        <p className="text-[11px] text-slate-600 mt-1">Select a layer in the timeline or canvas to inspect its properties and effects.</p>
      </div>
    );
  }

  const blendModes: BlendMode[] = [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'difference',
    'add',
    'darken',
    'lighten',
  ];

  return (
    <div className="h-full w-full bg-[#18191c] border-l border-[#26282e] flex flex-col select-none text-xs overflow-hidden">
      {/* Inspector Header */}
      <div className="p-3 border-b border-[#26282e] bg-[#141518]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <input
            type="text"
            value={selectedLayer.name}
            onChange={(e) => store.updateLayer(selectedLayer.id, { name: e.target.value })}
            className="font-bold text-slate-200 bg-transparent border-b border-transparent hover:border-[#2f333c] focus:border-[#2d62ea] px-1 py-0.5 outline-none text-sm w-full truncate"
          />
          <span className="px-1.5 py-0.5 rounded bg-[#23252c] text-blue-400 font-mono text-[10px] uppercase shrink-0">
            {selectedLayer.type}
          </span>
        </div>

        {/* Visibility, Lock & Blend Mode */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => store.updateLayer(selectedLayer.id, { visible: !selectedLayer.visible })}
            className={`p-1 rounded ${selectedLayer.visible ? 'text-slate-300 hover:text-white' : 'text-slate-600'}`}
            title="Toggle Visibility"
          >
            {selectedLayer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => store.updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
            className={`p-1 rounded ${selectedLayer.locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`}
            title="Toggle Lock"
          >
            {selectedLayer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-slate-500">Mode:</span>
            <select
              value={selectedLayer.blendMode}
              onChange={(e) => store.updateLayer(selectedLayer.id, { blendMode: e.target.value as BlendMode })}
              className="bg-[#1b1c20] border border-[#2c2f37] text-slate-300 rounded px-1.5 py-0.5 text-[11px] outline-none"
            >
              {blendModes.map((bm) => (
                <option key={bm} value={bm} className="capitalize">
                  {bm}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inspector Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Transform Properties Group */}
        <div className="border border-[#26282e] rounded-lg overflow-hidden bg-[#16171b]">
          <button
            onClick={() => toggleGroup('transform')}
            className="w-full px-2.5 py-2 bg-[#1b1c21] flex items-center justify-between text-slate-300 font-semibold text-[11px] hover:text-white"
          >
            <span>Transform</span>
            {expandedGroups.transform ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {expandedGroups.transform && (
            <div className="p-2.5 space-y-2 text-slate-300">
              {/* Position */}
              <PropRow2D
                label="Position"
                prop={selectedLayer.position}
                currentTime={currentTime}
                layerId={selectedLayer.id}
                propPath="position"
                decimals={0}
              />

              {/* Scale */}
              <PropRow2D
                label="Scale"
                prop={selectedLayer.scale}
                currentTime={currentTime}
                layerId={selectedLayer.id}
                propPath="scale"
                unit="%"
                decimals={1}
              />

              {/* Rotation */}
              <PropRow1D
                label="Rotation"
                prop={selectedLayer.rotation}
                currentTime={currentTime}
                layerId={selectedLayer.id}
                propPath="rotation"
                unit="°"
                decimals={1}
              />

              {/* Anchor Point */}
              <PropRow2D
                label="Anchor Point"
                prop={selectedLayer.anchor}
                currentTime={currentTime}
                layerId={selectedLayer.id}
                propPath="anchor"
                decimals={0}
              />

              {/* Opacity */}
              <PropRow1D
                label="Opacity"
                prop={selectedLayer.opacity}
                currentTime={currentTime}
                layerId={selectedLayer.id}
                propPath="opacity"
                min={0}
                max={100}
                unit="%"
                decimals={1}
              />
            </div>
          )}
        </div>

        {/* Type Specific: Text Controls */}
        {selectedLayer.type === 'text' && selectedLayer.textData && (
          <div className="border border-[#26282e] rounded-lg overflow-hidden bg-[#16171b]">
            <button
              onClick={() => toggleGroup('text')}
              className="w-full px-2.5 py-2 bg-[#1b1c21] flex items-center justify-between text-slate-300 font-semibold text-[11px] hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-blue-400" /> Text Content & Font
              </span>
              {expandedGroups.text ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {expandedGroups.text && (
              <div className="p-2.5 space-y-2.5">
                <div>
                  <textarea
                    value={selectedLayer.textData.text}
                    onChange={(e) =>
                      store.updateLayer(selectedLayer.id, {
                        textData: { ...selectedLayer.textData!, text: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full bg-[#121316] border border-[#2b2e36] rounded p-2 text-slate-200 outline-none focus:border-[#2d62ea] text-xs resize-none"
                    placeholder="Enter text..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Font Family</label>
                    <select
                      value={selectedLayer.textData.fontFamily}
                      onChange={(e) =>
                        store.updateLayer(selectedLayer.id, {
                          textData: { ...selectedLayer.textData!, fontFamily: e.target.value },
                        })
                      }
                      className="w-full bg-[#121316] border border-[#2b2e36] text-slate-200 rounded px-1.5 py-1 text-xs outline-none"
                    >
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      {project.customFonts.map((cf) => (
                        <option key={cf.family} value={cf.family}>
                          {cf.family} (Imported)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Font Size (px)</label>
                    <TypedNumberInput
                      value={selectedLayer.textData.fontSize}
                      onChange={(newSize) =>
                        store.updateLayer(selectedLayer.id, {
                          textData: { ...selectedLayer.textData!, fontSize: newSize },
                        })
                      }
                      min={1}
                      max={1000}
                      decimals={0}
                      widthClass="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fill Color</span>
                  <input
                    type="color"
                    value={selectedLayer.textData.fillColor}
                    onChange={(e) =>
                      store.updateLayer(selectedLayer.id, {
                        textData: { ...selectedLayer.textData!, fillColor: e.target.value },
                      })
                    }
                    className="w-8 h-6 bg-transparent cursor-pointer rounded overflow-hidden"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Alignment</span>
                  <div className="flex bg-[#121316] p-0.5 rounded border border-[#2b2e36]">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() =>
                          store.updateLayer(selectedLayer.id, {
                            textData: { ...selectedLayer.textData!, textAlign: align },
                          })
                        }
                        className={`px-2 py-0.5 text-[10px] capitalize rounded ${
                          selectedLayer.textData?.textAlign === align
                            ? 'bg-[#2d62ea] text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Type Specific: Shape Controls */}
        {selectedLayer.type === 'shape' && selectedLayer.shapeData && (
          <div className="border border-[#26282e] rounded-lg overflow-hidden bg-[#16171b]">
            <button
              onClick={() => toggleGroup('shape')}
              className="w-full px-2.5 py-2 bg-[#1b1c21] flex items-center justify-between text-slate-300 font-semibold text-[11px] hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <Square className="w-3.5 h-3.5 text-emerald-400" /> Shape Geometry & Fill
              </span>
              {expandedGroups.shape ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {expandedGroups.shape && (
              <div className="p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shape Type</span>
                  <select
                    value={selectedLayer.shapeData.shapeType}
                    onChange={(e) =>
                      store.updateLayer(selectedLayer.id, {
                        shapeData: { ...selectedLayer.shapeData!, shapeType: e.target.value as any },
                      })
                    }
                    className="bg-[#121316] border border-[#2b2e36] text-slate-200 rounded px-2 py-0.5 text-xs outline-none capitalize"
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="ellipse">Ellipse</option>
                    <option value="star">Star</option>
                    <option value="polygon">Polygon</option>
                    <option value="line">Line</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fill Color</span>
                  <input
                    type="color"
                    value={selectedLayer.shapeData.fillColor}
                    onChange={(e) =>
                      store.updateLayer(selectedLayer.id, {
                        shapeData: { ...selectedLayer.shapeData!, fillColor: e.target.value },
                      })
                    }
                    className="w-8 h-6 bg-transparent cursor-pointer rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Stroke Color</span>
                  <input
                    type="color"
                    value={selectedLayer.shapeData.strokeColor}
                    onChange={(e) =>
                      store.updateLayer(selectedLayer.id, {
                        shapeData: { ...selectedLayer.shapeData!, strokeColor: e.target.value },
                      })
                    }
                    className="w-8 h-6 bg-transparent cursor-pointer rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Stroke Width</span>
                  <TypedNumberInput
                    value={selectedLayer.shapeData.strokeWidth}
                    onChange={(newVal) =>
                      store.updateLayer(selectedLayer.id, {
                        shapeData: { ...selectedLayer.shapeData!, strokeWidth: newVal },
                      })
                    }
                    min={0}
                    max={500}
                    decimals={0}
                    unit="px"
                    widthClass="w-16"
                  />
                </div>

                {selectedLayer.shapeData.shapeType === 'rectangle' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Corner Radius</span>
                    <TypedNumberInput
                      value={selectedLayer.shapeData.cornerRadius}
                      onChange={(newVal) =>
                        store.updateLayer(selectedLayer.id, {
                          shapeData: { ...selectedLayer.shapeData!, cornerRadius: newVal },
                        })
                      }
                      min={0}
                      max={500}
                      decimals={0}
                      unit="px"
                      widthClass="w-16"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Type Specific: Solid Color */}
        {selectedLayer.type === 'solid' && (
          <div className="border border-[#26282e] rounded-lg p-2.5 bg-[#16171b] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-slate-300 font-medium">Solid Color</span>
              {selectedLayer.solidColor === 'transparent' && (
                <span className="text-[10px] text-emerald-400">Transparent (Background Removed)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedLayer.solidColor === 'transparent' ? '#000000' : (selectedLayer.solidColor || '#ffffff')}
                onChange={(e) => store.updateLayer(selectedLayer.id, { solidColor: e.target.value })}
                className="w-8 h-6 bg-transparent cursor-pointer rounded"
                title="Choose solid color"
              />
              <button
                type="button"
                onClick={() =>
                  store.updateLayer(selectedLayer.id, {
                    solidColor: selectedLayer.solidColor === 'transparent' ? '#1f2937' : 'transparent',
                  })
                }
                className="text-[10px] px-2 py-0.5 rounded bg-[#22242b] hover:bg-[#2b2e37] text-slate-300 hover:text-white border border-[#2e313b]"
                title="Toggle transparent background"
              >
                {selectedLayer.solidColor === 'transparent' ? 'Restore Color' : 'Remove BG'}
              </button>
            </div>
          </div>
        )}

        {/* Applied Effects Stack */}
        <div className="space-y-2 pt-2 border-t border-[#26282e]">
          <div className="flex items-center justify-between px-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Applied Effects ({selectedLayer.effects.length})</span>
            </span>
          </div>

          {selectedLayer.effects.length === 0 ? (
            <div className="text-center py-4 bg-[#141518] rounded-lg border border-[#23252a] text-slate-500 text-[11px]">
              No effects applied to this layer.
              <br />
              <span className="text-slate-600">Select an effect in Assets &gt; Effects to add.</span>
            </div>
          ) : (
            selectedLayer.effects.map((fx: EffectInstance, fxIndex: number) => (
              <EffectCard
                key={fx.id}
                fx={fx}
                fxIndex={fxIndex}
                layer={selectedLayer}
                currentTime={currentTime}
                layers={layers}
                expandedGroups={expandedEffectGroups}
                onToggleGroup={(groupName) => toggleEffectGroup(fx.id, groupName)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Single Applied Effect Card ---
// --- Single Applied Effect Card ---
const EffectCard: React.FC<{
  fx: EffectInstance;
  fxIndex: number;
  layer: Layer;
  currentTime: number;
  layers: Layer[];
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (group: string) => void;
}> = ({ fx, fxIndex, layer, currentTime, layers, expandedGroups, onToggleGroup }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  const spec = EFFECT_REGISTRY.find((s) => s.id === fx.effectId);
  if (!spec) return null;

  // Group parameters by slash prefix
  const groups: Record<string, EffectParamSpec[]> = {};
  const ungrouped: EffectParamSpec[] = [];

  for (const ps of spec.params) {
    if (ps.id.includes('/')) {
      const [gname] = ps.id.split('/');
      if (!groups[gname]) groups[gname] = [];
      groups[gname].push(ps);
    } else {
      ungrouped.push(ps);
    }
  }

  return (
    <div className="border border-[#2a2d36] rounded-lg overflow-hidden bg-[#16171b]">
      {/* Effect Header */}
      <div className="p-2 bg-[#1d1f25] border-b border-[#252830] flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <span className="font-semibold text-slate-200 truncate">{fx.name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Sliders toggle: default is off to prioritize typed values */}
          <button
            onClick={() => setShowSliders(!showSliders)}
            className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] transition-colors ${
              showSliders
                ? 'bg-[#2d62ea]/20 text-blue-400 border border-[#2d62ea]/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={showSliders ? 'Hide Sliders (Prioritize Typed Values)' : 'Show Sliders (Compact Inline)'}
          >
            <Sliders className="w-3 h-3" />
            <span className="text-[9px] font-mono hidden sm:inline">{showSliders ? 'Sliders' : 'Typed'}</span>
          </button>

          <button
            onClick={() => store.toggleEffect(layer.id, fx.id)}
            className={`p-1 rounded ${fx.enabled ? 'text-blue-400 hover:text-white' : 'text-slate-600'}`}
            title="Enable/Disable Effect"
          >
            {fx.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>

          {fxIndex > 0 && (
            <button
              onClick={() => store.reorderEffect(layer.id, fxIndex, fxIndex - 1)}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Move Up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
          )}

          {fxIndex < layer.effects.length - 1 && (
            <button
              onClick={() => store.reorderEffect(layer.id, fxIndex, fxIndex + 1)}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Move Down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => store.removeEffect(layer.id, fx.id)}
            className="p-1 text-slate-500 hover:text-red-400 rounded"
            title="Remove Effect"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Effect Parameters Body */}
      {!collapsed && (
        <div className="p-2.5 space-y-1.5 text-slate-300">
          {/* Ungrouped Parameters */}
          {ungrouped.map((ps) => (
            <ParamControl
              key={ps.id}
              ps={ps}
              layer={layer}
              fx={fx}
              currentTime={currentTime}
              layers={layers}
              showSliders={showSliders}
            />
          ))}

          {/* Grouped Parameters (Collapsible UI Groups) */}
          {Object.entries(groups).map(([gname, gparams]) => {
            const isExp = expandedGroups[`${fx.id}_${gname}`] ?? true;
            return (
              <div key={gname} className="border border-[#26282e] rounded bg-[#121316] overflow-hidden my-1">
                <button
                  onClick={() => onToggleGroup(gname)}
                  className="w-full px-2 py-1.5 bg-[#1a1b20] flex items-center justify-between text-slate-300 font-medium text-[10px] hover:text-white uppercase tracking-wider"
                >
                  <span>{gname}</span>
                  {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {isExp && (
                  <div className="p-2 space-y-1.5">
                    {gparams.map((ps) => (
                      <ParamControl
                        key={ps.id}
                        ps={ps}
                        layer={layer}
                        fx={fx}
                        currentTime={currentTime}
                        layers={layers}
                        showSliders={showSliders}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Single Parameter Control (Prioritizes Typed Value, Optional Compact Inline Slider) ---
const ParamControl: React.FC<{
  ps: EffectParamSpec;
  layer: Layer;
  fx: EffectInstance;
  currentTime: number;
  layers: Layer[];
  showSliders?: boolean;
}> = ({ ps, layer, fx, currentTime, layers, showSliders = false }) => {
  const prop = fx.params[ps.id];
  if (!prop) return null;

  const evaluatedValue = evaluateProp(prop, currentTime, layer.id, ps.id);
  const propPath = `effects.${fx.id}.${ps.id}`;
  const displayName = ps.name.includes('/') ? ps.name.split('/').pop()! : ps.name;

  // Detect unit
  let unit: string | undefined = undefined;
  if (ps.ui.type === 'angle') {
    unit = '°';
  } else if (
    ps.id.toLowerCase().includes('opacity') ||
    ps.name.toLowerCase().includes('opacity')
  ) {
    unit = '%';
  }

  return (
    <div className="flex items-center justify-between text-[11px] py-1 gap-2 min-h-[28px]">
      {/* Parameter Label & Stopwatch */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <button
          onClick={() => store.togglePropStopwatch(layer.id, propPath)}
          className={`p-0.5 rounded transition-colors shrink-0 ${
            prop.animated ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'
          }`}
          title="Toggle Stopwatch Animation"
        >
          <Timer className="w-3 h-3" />
        </button>
        <span className="text-slate-300 truncate font-medium text-[11px]" title={ps.name}>
          {displayName}
        </span>
      </div>

      {/* Input Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {ps.ui.type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={Boolean(evaluatedValue)}
            onChange={(e) => store.setPropValue(layer.id, propPath, e.target.checked)}
            className="accent-blue-500 rounded cursor-pointer w-4 h-4"
          />
        ) : ps.ui.type === 'color' ? (
          <input
            type="color"
            value={
              Array.isArray(evaluatedValue)
                ? rgbToHex(evaluatedValue[0], evaluatedValue[1], evaluatedValue[2])
                : '#ffffff'
            }
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              store.setPropValue(layer.id, propPath, [rgb[0], rgb[1], rgb[2], 1.0]);
            }}
            className="w-8 h-6 bg-transparent rounded cursor-pointer border border-[#2c2f37]"
          />
        ) : ps.ui.type === 'popup' ? (
          <select
            value={evaluatedValue ?? 0}
            onChange={(e) => store.setPropValue(layer.id, propPath, Number(e.target.value))}
            className="bg-[#121316] border border-[#2b2e36] text-slate-200 rounded px-1.5 py-0.5 text-[11px] outline-none max-w-[130px] truncate"
          >
            {ps.ui.options?.map((opt, i) => (
              <option key={opt} value={i}>
                {opt}
              </option>
            ))}
          </select>
        ) : ps.ui.type === 'layer' ? (
          <select
            value={evaluatedValue ?? ''}
            onChange={(e) => store.setPropValue(layer.id, propPath, e.target.value || null)}
            className="bg-[#121316] border border-[#2b2e36] text-slate-200 rounded px-1.5 py-0.5 text-[11px] outline-none max-w-[130px] truncate"
          >
            <option value="">None</option>
            {layers
              .filter((l) => l.id !== layer.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        ) : ps.ui.type === 'point' ? (
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <TypedNumberInput
              prefix="X:"
              value={Number(Array.isArray(evaluatedValue) ? evaluatedValue[0] : 0)}
              onChange={(newX) => {
                const yVal = Array.isArray(evaluatedValue) ? evaluatedValue[1] : 0.5;
                store.setPropValue(layer.id, propPath, [newX, yVal]);
              }}
              step={0.01}
              decimals={2}
              widthClass="w-16"
            />
            <TypedNumberInput
              prefix="Y:"
              value={Number(Array.isArray(evaluatedValue) ? evaluatedValue[1] : 0)}
              onChange={(newY) => {
                const xVal = Array.isArray(evaluatedValue) ? evaluatedValue[0] : 0.5;
                store.setPropValue(layer.id, propPath, [xVal, newY]);
              }}
              step={0.01}
              decimals={2}
              widthClass="w-16"
            />
          </div>
        ) : (
          /* Numeric / Slider / Angle Property: PRIORITIZE TYPED VALUE */
          <div className="flex items-center gap-1.5">
            {showSliders && (
              <input
                type="range"
                min={ps.ui.sliderMin ?? ps.ui.min ?? 0}
                max={ps.ui.sliderMax ?? ps.ui.max ?? 100}
                step={ps.ui.decimals ? Math.pow(10, -ps.ui.decimals) : 1}
                value={Number(evaluatedValue ?? 0)}
                onChange={(e) => store.setPropValue(layer.id, propPath, Number(e.target.value))}
                className="w-16 h-1 bg-[#262830] rounded cursor-pointer accent-[#2d62ea]"
                title="Slider adjustment"
              />
            )}

            <TypedNumberInput
              value={Number(evaluatedValue ?? 0)}
              onChange={(newVal) => store.setPropValue(layer.id, propPath, newVal)}
              min={ps.ui.min}
              max={ps.ui.max}
              step={ps.ui.decimals ? Math.pow(10, -ps.ui.decimals) : 1}
              decimals={ps.ui.decimals ?? (ps.ui.type === 'angle' ? 1 : 0)}
              unit={unit}
              widthClass="w-20"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Reusable 1D Property Row ---
const PropRow1D: React.FC<{
  label: string;
  prop: AnimatableProp<number>;
  currentTime: number;
  layerId: string;
  propPath: string;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
}> = ({ label, prop, currentTime, layerId, propPath, min, max, unit, decimals = 0 }) => {
  const val = evaluateProp(prop, currentTime, layerId, propPath);

  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => store.togglePropStopwatch(layerId, propPath)}
          className={`p-0.5 rounded transition-colors ${
            prop.animated ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'
          }`}
          title="Toggle Stopwatch"
        >
          <Timer className="w-3 h-3" />
        </button>
        <span className="text-slate-400">{label}</span>
      </div>

      <TypedNumberInput
        value={Number(val)}
        onChange={(newVal) => store.setPropValue(layerId, propPath, newVal)}
        min={min}
        max={max}
        unit={unit}
        decimals={decimals}
        step={decimals > 0 ? Math.pow(10, -decimals) : 1}
        widthClass="w-20"
      />
    </div>
  );
};

// --- Reusable 2D Property Row ---
const PropRow2D: React.FC<{
  label: string;
  prop: AnimatableProp<[number, number]>;
  currentTime: number;
  layerId: string;
  propPath: string;
  unit?: string;
  decimals?: number;
}> = ({ label, prop, currentTime, layerId, propPath, unit, decimals = 0 }) => {
  const val = evaluateProp(prop, currentTime, layerId, propPath);

  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => store.togglePropStopwatch(layerId, propPath)}
          className={`p-0.5 rounded transition-colors ${
            prop.animated ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'
          }`}
          title="Toggle Stopwatch"
        >
          <Timer className="w-3 h-3" />
        </button>
        <span className="text-slate-400">{label}</span>
      </div>

      <div className="flex items-center gap-1 font-mono text-[10px]">
        <TypedNumberInput
          prefix="X:"
          value={Number(val[0])}
          onChange={(newX) => store.setPropValue(layerId, propPath, [newX, val[1]])}
          unit={unit}
          decimals={decimals}
          step={decimals > 0 ? Math.pow(10, -decimals) : 1}
          widthClass="w-16"
        />
        <TypedNumberInput
          prefix="Y:"
          value={Number(val[1])}
          onChange={(newY) => store.setPropValue(layerId, propPath, [val[0], newY])}
          unit={unit}
          decimals={decimals}
          step={decimals > 0 ? Math.pow(10, -decimals) : 1}
          widthClass="w-16"
        />
      </div>
    </div>
  );
};

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r || 0, g || 0, b || 0];
}
