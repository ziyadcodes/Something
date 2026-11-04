import React, { useState } from 'react';
import { CrosshairConfig, GameSettings } from '../types/game';
import { applyQualityPreset, detectHardwareProfile } from '../game/progression';
import { BenchmarkResult } from '../game/engine';
import {
  X,
  Sliders,
  Monitor,
  Volume2,
  Smartphone,
  Crosshair,
  Gauge,
  Maximize2,
  RotateCcw,
  Cpu,
} from 'lucide-react';

interface CrosshairSettingsProps {
  isOpen: boolean;
  crosshair: CrosshairConfig;
  settings: GameSettings;
  benchmarkResult: BenchmarkResult | null;
  onClose: () => void;
  onUpdateCrosshair: (config: CrosshairConfig) => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onRunBenchmark: () => void;
}

export const CrosshairSettings: React.FC<CrosshairSettingsProps> = ({
  isOpen,
  crosshair,
  settings,
  benchmarkResult,
  onClose,
  onUpdateCrosshair,
  onUpdateSettings,
  onRunBenchmark,
}) => {
  const [activeTab, setActiveTab] = useState<
    'graphics' | 'audio' | 'controls' | 'mobile' | 'crosshair'
  >('graphics');

  if (!isOpen) return null;

  const hw = detectHardwareProfile();
  const colors = [
    { name: 'Cyan', hex: '#00f2fe' },
    { name: 'Green', hex: '#00ff66' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Magenta', hex: '#ff007f' },
    { name: 'White', hex: '#ffffff' },
  ];

  const presets: { id: GameSettings['quality']; label: string; sub: string }[] = [
    { id: 'potato', label: 'POTATO', sub: 'UHD 620 / Max FPS' },
    { id: 'low', label: 'LOW', sub: 'Integrated GPU' },
    { id: 'medium', label: 'MEDIUM', sub: 'Balanced 60 FPS' },
    { id: 'high', label: 'HIGH', sub: 'PBR + Dynamic Lights' },
    { id: 'ultra', label: 'ULTRA', sub: '110% Res + Shadows' },
    { id: 'extreme', label: 'EXTREME / RTX', sub: '125% Super-Sampled' },
  ];

  const effectiveWidth = Math.round(window.innerWidth * settings.resolutionScale);
  const effectiveHeight = Math.round(window.innerHeight * settings.resolutionScale);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch {
      // Ignore iframe restriction
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 md:p-6 font-tech select-none overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/90 p-4 md:p-6 clip-val-card shadow-2xl my-auto">
        {/* TOP HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-valorant text-2xl md:text-3xl font-bold text-white tracking-wider leading-none">
                SYSTEM CONFIGURATION // SETTINGS
              </h2>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                DETECTED GPU: {hw.gpuRenderer.slice(0, 48)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CATEGORY TABS */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3 mb-4">
          {[
            { id: 'graphics', label: 'GRAPHICS & POTATO', icon: <Monitor className="w-3.5 h-3.5" /> },
            { id: 'audio', label: 'AUDIO MIXER', icon: <Volume2 className="w-3.5 h-3.5" /> },
            { id: 'controls', label: 'CONTROLS & AI', icon: <Cpu className="w-3.5 h-3.5" /> },
            { id: 'mobile', label: 'MOBILE TOUCH HUD', icon: <Smartphone className="w-3.5 h-3.5" /> },
            { id: 'crosshair', label: 'RETICLE', icon: <Crosshair className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: GRAPHICS, POTATO MODE, RESOLUTION & GPU BENCHMARK */}
        {activeTab === 'graphics' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* 1-Click Potato Mode Callout Banner */}
            <div className="flex items-center justify-between p-3 bg-amber-950/30 border border-amber-500/50 rounded clip-val-corner">
              <div>
                <div className="font-valorant text-xl font-bold text-amber-400 tracking-wide">
                  POTATO MODE // ULTRA LOW-SPEC BOOSTER
                </div>
                <div className="text-[11px] text-slate-300">
                  Disables PBR textures, point lights, ceiling pipe geometry, and lowers render resolution for Intel UHD 620 & budget phones.
                </div>
              </div>
              <button
                onClick={() => {
                  const nextPotato = !settings.potatoMode;
                  onUpdateSettings(
                    applyQualityPreset(settings, nextPotato ? 'potato' : 'high')
                  );
                }}
                className={`px-4 py-2 rounded font-bold text-xs cursor-pointer shrink-0 ${
                  settings.potatoMode
                    ? 'bg-amber-400 text-slate-950 shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {settings.potatoMode ? 'POTATO MODE: ON' : 'ENABLE POTATO MODE'}
              </button>
            </div>

            {/* 6 Hardware Presets */}
            <div>
              <label className="block text-slate-400 font-bold mb-1.5 uppercase">
                GRAPHICS QUALITY PRESET
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onUpdateSettings(applyQualityPreset(settings, p.id))}
                    className={`p-2 rounded border text-left cursor-pointer transition-all ${
                      settings.quality === p.id
                        ? 'border-amber-400 bg-amber-500/15 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-valorant text-base font-bold leading-none">{p.label}</div>
                    <div className="text-[9px] text-slate-400 mt-1">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Scale Slider & Quick Buttons */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-200 uppercase">
                  RENDER RESOLUTION SCALE ({Math.round(settings.resolutionScale * 100)}%)
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {effectiveWidth} × {effectiveHeight} px
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="1.25"
                step="0.05"
                value={settings.resolutionScale}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    resolutionScale: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer mb-2"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { scale: 0.35, label: '360p (35%)' },
                  { scale: 0.5, label: '540p (50%)' },
                  { scale: 0.75, label: '720p (75%)' },
                  { scale: 1.0, label: '1080p (100%)' },
                  { scale: 1.25, label: 'Ultra (125%)' },
                ].map((r) => (
                  <button
                    key={r.scale}
                    onClick={() =>
                      onUpdateSettings({ ...settings, resolutionScale: r.scale })
                    }
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      Math.abs(settings.resolutionScale - r.scale) < 0.03
                        ? 'border-amber-400 bg-slate-800 text-amber-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Granular Graphics Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* FPS Cap */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                <span className="font-bold text-slate-300">FRAME RATE LIMIT</span>
                <select
                  value={settings.fpsLimit}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, fpsLimit: Number(e.target.value) })
                  }
                  className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-xs font-bold"
                >
                  <option value={0}>UNLIMITED</option>
                  <option value={30}>30 FPS (Battery Saver)</option>
                  <option value={45}>45 FPS</option>
                  <option value={60}>60 FPS</option>
                  <option value={120}>120 FPS</option>
                  <option value={144}>144 FPS</option>
                  <option value={240}>240 FPS</option>
                </select>
              </div>

              {/* Shadow Quality */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                <span className="font-bold text-slate-300">SHADOW QUALITY</span>
                <select
                  value={settings.shadowQuality}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      shadowQuality: e.target.value as GameSettings['shadowQuality'],
                    })
                  }
                  className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-xs font-bold"
                >
                  <option value="off">OFF (Fastest)</option>
                  <option value="low">LOW (512px)</option>
                  <option value="high">HIGH (1024px)</option>
                  <option value="ultra">ULTRA (2048px)</option>
                </select>
              </div>

              {/* Environmental Detail Props */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                <span className="font-bold text-slate-300">INDUSTRIAL DETAIL PROPS</span>
                <button
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      environmentalDetail: !settings.environmentalDetail,
                    })
                  }
                  className={`px-3 py-1 rounded font-bold cursor-pointer ${
                    settings.environmentalDetail
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings.environmentalDetail ? 'HIGH DETAIL' : 'MINIMAL'}
                </button>
              </div>

              {/* Volumetric Light Cones */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                <span className="font-bold text-slate-300">VOLUMETRIC LIGHT SHAFTS</span>
                <button
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      volumetricLighting: !settings.volumetricLighting,
                    })
                  }
                  className={`px-3 py-1 rounded font-bold cursor-pointer ${
                    settings.volumetricLighting
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings.volumetricLighting ? 'ENABLED' : 'OFF'}
                </button>
              </div>

              {/* Field of View */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="flex justify-between font-bold text-slate-300 mb-1">
                  <span>FIELD OF VIEW (FOV)</span>
                  <span className="text-amber-400 font-mono">{settings.fov}°</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="105"
                  value={settings.fov}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, fov: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Performance Overlay & Fullscreen */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between gap-2">
                <button
                  onClick={() =>
                    onUpdateSettings({ ...settings, showFps: !settings.showFps })
                  }
                  className={`flex-1 py-1.5 rounded font-bold cursor-pointer ${
                    settings.showFps
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  FPS OVERLAY: {settings.showFps ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>FULLSCREEN</span>
                </button>
              </div>
            </div>

            {/* Built-In GPU Benchmark Tool */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-bold text-white uppercase">
                    BUILT-IN HARDWARE BENCHMARK
                  </div>
                  {benchmarkResult ? (
                    <div className="text-[11px] text-emerald-400 font-mono">
                      AVG: {benchmarkResult.avgFps} FPS · 1% LOW: {benchmarkResult.onePercentLowFps}{' '}
                      FPS · {benchmarkResult.avgFrameTimeMs}ms ({benchmarkResult.renderResolution}) ·
                      RECOMMENDED: {benchmarkResult.recommendedPreset.toUpperCase()}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Measure real-time frame times and get an optimal preset recommendation.
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onRunBenchmark}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded cursor-pointer"
              >
                RUN BENCHMARK
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIO MIXER */}
        {activeTab === 'audio' && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between font-bold text-slate-200 mb-1">
                <span>MASTER VOLUME</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, masterVolume: Number(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between font-bold text-slate-200 mb-1">
                <span>COMBAT & WEAPON SFX VOLUME</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(settings.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, sfxVolume: Number(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between font-bold text-slate-200 mb-1">
                <span>ENVIRONMENTAL AMBIENCE & MUSIC</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, musicVolume: Number(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 3: CONTROLS & AI DIFFICULTY */}
        {activeTab === 'controls' && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between text-slate-200 font-bold mb-1">
                <span>CAMERA AIM SENSITIVITY</span>
                <span className="text-amber-400 font-mono">
                  {(settings.sensitivity * 1000).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="5.5"
                step="0.1"
                value={(settings.sensitivity * 1000).toFixed(1)}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    sensitivity: Number(e.target.value) / 1000,
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <label className="block text-slate-300 font-bold mb-2 uppercase">
                ENEMY BOT AI DIFFICULTY
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => onUpdateSettings({ ...settings, botDifficulty: diff })}
                    className={`py-2 rounded border font-bold uppercase cursor-pointer ${
                      settings.botDifficulty === diff
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <label className="block text-slate-300 font-bold mb-2 uppercase">
                PLATFORM INPUT SCHEME (PC / PHONE)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'auto', label: 'AUTO-DETECT' },
                  { id: 'touch', label: 'MOBILE TOUCH HUD' },
                  { id: 'pc', label: 'PC KEYBOARD + MOUSE' },
                ].map((cm) => (
                  <button
                    key={cm.id}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        controlMode: cm.id as GameSettings['controlMode'],
                      })
                    }
                    className={`py-2 rounded border font-bold cursor-pointer ${
                      settings.controlMode === cm.id
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {cm.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MOBILE TOUCH HUD CUSTOMIZATION */}
        {activeTab === 'mobile' && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between font-bold text-slate-200 mb-1">
                <span>TOUCH BUTTON SIZE SCALE</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(settings.touchButtonScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={settings.touchButtonScale}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    touchButtonScale: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="flex justify-between font-bold text-slate-200 mb-1">
                <span>VIRTUAL JOYSTICK SENSITIVITY</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(settings.touchJoystickSens * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={settings.touchJoystickSens}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    touchJoystickSens: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <button
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  touchButtonScale: 1.0,
                  touchJoystickSens: 1.0,
                  controlMode: 'touch',
                })
              }
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ENABLE & RESET MOBILE TOUCH LAYOUT</span>
            </button>
          </div>
        )}

        {/* TAB 5: CROSSHAIR RETICLE EDITOR */}
        {activeTab === 'crosshair' && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="relative w-full h-28 bg-slate-950 border border-slate-800 rounded-sm flex items-center justify-center overflow-hidden">
              <div className="text-[10px] text-slate-600 font-bold tracking-widest absolute top-2 left-2">
                LIVE RETICLE PREVIEW
              </div>
              <div className="relative">
                {crosshair.centerDot && (
                  <div
                    className="absolute w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: crosshair.color }}
                  />
                )}
                <div
                  className="absolute -translate-x-1/2"
                  style={{
                    width: `${crosshair.innerWidth}px`,
                    height: `${crosshair.innerLength}px`,
                    backgroundColor: crosshair.color,
                    bottom: `${crosshair.innerOffset}px`,
                  }}
                />
                <div
                  className="absolute -translate-x-1/2"
                  style={{
                    width: `${crosshair.innerWidth}px`,
                    height: `${crosshair.innerLength}px`,
                    backgroundColor: crosshair.color,
                    top: `${crosshair.innerOffset}px`,
                  }}
                />
                <div
                  className="absolute -translate-y-1/2"
                  style={{
                    height: `${crosshair.innerWidth}px`,
                    width: `${crosshair.innerLength}px`,
                    backgroundColor: crosshair.color,
                    right: `${crosshair.innerOffset}px`,
                  }}
                />
                <div
                  className="absolute -translate-y-1/2"
                  style={{
                    height: `${crosshair.innerWidth}px`,
                    width: `${crosshair.innerLength}px`,
                    backgroundColor: crosshair.color,
                    left: `${crosshair.innerOffset}px`,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => onUpdateCrosshair({ ...crosshair, color: c.hex })}
                  className={`flex-1 py-1.5 rounded font-bold border cursor-pointer flex items-center justify-center gap-1 ${
                    crosshair.color === c.hex
                      ? 'border-white bg-slate-800'
                      : 'border-slate-800 bg-slate-950'
                  }`}
                  style={{ color: c.hex }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between text-slate-300 font-bold mb-1">
                  <span>LENGTH</span>
                  <span>{crosshair.innerLength}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="14"
                  value={crosshair.innerLength}
                  onChange={(e) =>
                    onUpdateCrosshair({
                      ...crosshair,
                      innerLength: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-bold mb-1">
                  <span>THICKNESS</span>
                  <span>{crosshair.innerWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={crosshair.innerWidth}
                  onChange={(e) =>
                    onUpdateCrosshair({
                      ...crosshair,
                      innerWidth: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-bold mb-1">
                  <span>GAP OFFSET</span>
                  <span>{crosshair.innerOffset}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={crosshair.innerOffset}
                  onChange={(e) =>
                    onUpdateCrosshair({
                      ...crosshair,
                      innerOffset: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* FOOTER BUTTON */}
        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-valorant text-2xl font-bold tracking-wider rounded cursor-pointer transition-colors"
        >
          APPLY & SAVE SETTINGS
        </button>
      </div>
    </div>
  );
};
