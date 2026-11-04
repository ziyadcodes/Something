import React, { useState } from 'react';
import { AgentId, WeaponId } from '../types/game';
import { WEAPONS } from '../game/weapons';
import {
  ActiveModuleId,
  ACTIVE_MODULES,
  canEquipModuleInSlot,
  MAX_RIG_ENERGY,
  OPERATOR_CHASSIS_CATALOG,
  OperatorRigBuild,
  PassiveModuleId,
  PASSIVE_MODULES,
  RigModuleCategory,
  validateRigBuild,
} from '../game/rigSystem';
import {
  Shield,
  Zap,
  Radio,
  Ghost,
  Wind,
  Target,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Sliders,
  Layers,
} from 'lucide-react';

interface RigWorkshopProps {
  currentBuild: OperatorRigBuild;
  savedPresets: OperatorRigBuild[];
  onUpdateBuild: (build: OperatorRigBuild) => void;
  onSavePresets: (presets: OperatorRigBuild[]) => void;
  onDeploy: () => void;
}

const CATEGORIES: ('ALL' | RigModuleCategory)[] = [
  'ALL',
  'RECON',
  'DEFENCE',
  'DECEPTION',
  'MOBILITY',
  'CONTROL',
  'SUPPORT',
];

export const RigWorkshop: React.FC<RigWorkshopProps> = ({
  currentBuild,
  savedPresets,
  onUpdateBuild,
  onSavePresets,
  onDeploy,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | RigModuleCategory>('ALL');
  const [inspectedModuleId, setInspectedModuleId] = useState<ActiveModuleId>(
    currentBuild.activeSlot1
  );
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [buildNameInput, setBuildNameInput] = useState<string>(currentBuild.name);

  const validation = validateRigBuild(currentBuild);
  const chassis =
    OPERATOR_CHASSIS_CATALOG[currentBuild.chassisId] || OPERATOR_CHASSIS_CATALOG.jett;
  const activePassive =
    PASSIVE_MODULES[currentBuild.passiveSlot] || PASSIVE_MODULES.energy_recovery;

  const currentSlotModuleId =
    selectedSlot === 1 ? currentBuild.activeSlot1 : currentBuild.activeSlot2;
  const currentSlotModule = ACTIVE_MODULES[currentSlotModuleId];
  const inspectedModule = ACTIVE_MODULES[inspectedModuleId] || currentSlotModule;

  const getModuleIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Radio':
        return <Radio className={className} />;
      case 'Shield':
        return <Shield className={className} />;
      case 'Ghost':
        return <Ghost className={className} />;
      case 'Wind':
        return <Wind className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Target':
        return <Target className={className} />;
      case 'Eye':
        return <Eye className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  const handleEquipModule = (moduleId: ActiveModuleId, targetSlot: 1 | 2 = selectedSlot) => {
    setInspectedModuleId(moduleId);
    const check = canEquipModuleInSlot(currentBuild, targetSlot, moduleId);
    if (!check.allowed) {
      setValidationAlert(check.reason || 'Rig Energy capacity exceeded.');
      return;
    }
    setValidationAlert(null);
    const next: OperatorRigBuild = {
      ...currentBuild,
      activeSlot1: targetSlot === 1 ? moduleId : currentBuild.activeSlot1,
      activeSlot2: targetSlot === 2 ? moduleId : currentBuild.activeSlot2,
    };
    onUpdateBuild(next);
  };

  const handleSelectPassive = (passiveId: PassiveModuleId) => {
    setValidationAlert(null);
    onUpdateBuild({
      ...currentBuild,
      passiveSlot: passiveId,
    });
  };

  const handleSelectChassis = (chassisId: AgentId) => {
    const info = OPERATOR_CHASSIS_CATALOG[chassisId];
    onUpdateBuild({
      ...currentBuild,
      chassisId,
      visorColor: info.defaultAccent,
    });
  };

  const handleSaveCurrentBuild = () => {
    const trimmedName = buildNameInput.trim().toUpperCase() || 'CUSTOM RIG';
    const updatedBuild: OperatorRigBuild = {
      ...currentBuild,
      id: currentBuild.id.startsWith('custom_') ? currentBuild.id : `custom_${Date.now()}`,
      name: trimmedName,
    };
    const existingIdx = savedPresets.findIndex((p) => p.id === updatedBuild.id);
    const nextPresets =
      existingIdx >= 0
        ? savedPresets.map((p, i) => (i === existingIdx ? updatedBuild : p))
        : [...savedPresets, updatedBuild];
    onUpdateBuild(updatedBuild);
    onSavePresets(nextPresets);
    setValidationAlert(null);
  };

  const handleDeleteBuild = (id: string) => {
    if (savedPresets.length <= 1) return;
    const nextPresets = savedPresets.filter((p) => p.id !== id);
    onSavePresets(nextPresets);
    if (currentBuild.id === id && nextPresets[0]) {
      onUpdateBuild(nextPresets[0]);
      setBuildNameInput(nextPresets[0].name);
    }
  };

  const moduleList = (Object.keys(ACTIVE_MODULES) as ActiveModuleId[]).filter((id) =>
    categoryFilter === 'ALL' ? true : ACTIVE_MODULES[id].category === categoryFilter
  );

  // Passive-adjusted telemetry for inspected module
  const effectiveCooldown = Number(
    (inspectedModule.cooldown / activePassive.cooldownRateMultiplier).toFixed(1)
  );
  const effectiveDeviceHp = Math.round(
    inspectedModule.deviceHp * activePassive.deployableHpMultiplier
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pointer-events-auto">
      {/* LEFT COLUMN (4 COLS): CHASSIS APPEARANCE, COMBAT RIG SLOTS & 7-ENERGY BAR */}
      <div className="lg:col-span-4 flex flex-col gap-3 bg-[#0c1017]/95 border border-slate-800/90 p-4 rounded shadow-2xl">
        {/* Header & Philosophy */}
        <div className="border-b border-slate-800 pb-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 uppercase">
              MODULAR OPERATOR ARCHITECTURE
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              CAP: {validation.totalEnergy}/{MAX_RIG_ENERGY} PTS
            </span>
          </div>
          <h2 className="font-valorant text-2xl sm:text-3xl font-bold text-white tracking-wider leading-none mt-0.5">
            THE RIG WORKSHOP
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            You don&apos;t choose a hero—you engineer your own operator.
          </p>
        </div>

        {/* 7-Point Rig Energy Capacity Meter */}
        <div className="bg-slate-950/90 border border-slate-800 p-3 rounded">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              RIG ENERGY CAPACITY
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                validation.valid ? 'text-cyan-400' : 'text-red-400'
              }`}
            >
              {validation.totalEnergy} / {MAX_RIG_ENERGY} ENERGY
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: MAX_RIG_ENERGY }).map((_, idx) => {
              const slot1Cost = ACTIVE_MODULES[currentBuild.activeSlot1]?.energyCost || 0;
              const isSlot1Seg = idx < slot1Cost;
              const isSlot2Seg = idx >= slot1Cost && idx < validation.totalEnergy;
              return (
                <div
                  key={idx}
                  className={`h-2.5 rounded-xs transition-all ${
                    isSlot1Seg
                      ? 'bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.45)]'
                      : isSlot2Seg
                      ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]'
                      : 'bg-slate-800/80'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
            <span>
              SLOT 1 [Q]: <strong className="text-cyan-300">{ACTIVE_MODULES[currentBuild.activeSlot1].energyCost} PTS</strong>
            </span>
            <span>
              SLOT 2 [E]: <strong className="text-blue-300">{ACTIVE_MODULES[currentBuild.activeSlot2].energyCost} PTS</strong>
            </span>
            <span>
              FREE: <strong className="text-slate-200">{validation.remainingEnergy} PTS</strong>
            </span>
          </div>
        </div>

        {/* Validation Warning Banner */}
        {validationAlert && (
          <div className="flex items-start gap-2 bg-red-950/60 border border-red-500/70 px-3 py-2 rounded text-[11px] text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{validationAlert}</span>
          </div>
        )}

        {/* B. COMBAT RIG SLOTS (2 ACTIVE + 1 PASSIVE) */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            1. COMBAT RIG MODULES (2 ACTIVE + 1 PASSIVE)
          </span>

          <div className="grid grid-cols-2 gap-2">
            {([1, 2] as const).map((slotNum) => {
              const modId =
                slotNum === 1 ? currentBuild.activeSlot1 : currentBuild.activeSlot2;
              const mod = ACTIVE_MODULES[modId];
              const isSelected = selectedSlot === slotNum;
              return (
                <button
                  key={slotNum}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slotNum);
                    setInspectedModuleId(modId);
                  }}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 text-white'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-400 mb-1">
                    <span>ACTIVE SLOT {slotNum} [{slotNum === 1 ? 'Q' : 'E'}]</span>
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-mono">
                      {mod.energyCost}⚡
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                      {getModuleIcon(mod.iconName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-valorant text-lg font-bold leading-none truncate">
                        {mod.name}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase mt-0.5">
                        {mod.category} · {mod.cooldown}s CD
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Passive Modification Selector (3 Passives) */}
          <div className="bg-slate-950/80 border border-slate-800/90 p-2.5 rounded">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-400 mb-1.5">
              <span>PASSIVE MODIFICATION SLOT</span>
              <span className="text-emerald-400">{activePassive.codeName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(PASSIVE_MODULES) as PassiveModuleId[]).map((pId) => {
                const pas = PASSIVE_MODULES[pId];
                const isEquipped = currentBuild.passiveSlot === pId;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => handleSelectPassive(pId)}
                    className={`p-2 rounded border text-left transition-all cursor-pointer ${
                      isEquipped
                        ? 'border-emerald-400 bg-emerald-950/30 text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-valorant text-sm font-bold leading-none truncate">
                      {pas.name}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                      {pId === 'signal_dampener'
                        ? '-45% Recon Duration'
                        : pId === 'reinforced_systems'
                        ? '+30% Device HP'
                        : '+18% Cooldown Rate'}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              {activePassive.description}
            </p>
          </div>
        </div>

        {/* A. OPERATOR CHASSIS APPEARANCE (Cosmetic Only — Independent of Gameplay Powers) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            <span>2. OPERATOR CHASSIS (COSMETIC SILHOUETTE)</span>
            <span className="text-cyan-400">{chassis.callsign.split('//')[1]}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(OPERATOR_CHASSIS_CATALOG) as AgentId[]).map((cId) => {
              const item = OPERATOR_CHASSIS_CATALOG[cId];
              const active = currentBuild.chassisId === cId;
              return (
                <button
                  key={cId}
                  type="button"
                  onClick={() => handleSelectChassis(cId)}
                  className={`py-1.5 px-2 rounded border text-center cursor-pointer transition-all ${
                    active
                      ? 'border-cyan-400 bg-cyan-500/20 text-white font-bold'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-valorant text-sm tracking-wide leading-none">
                    {item.callsign.split('// ')[1]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* C. WEAPON LOADOUT (Independent of Chassis & Modules) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
          <div>
            <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">
              PRIMARY WEAPON
            </label>
            <select
              aria-label="Primary Weapon"
              value={currentBuild.primaryWeapon}
              onChange={(e) =>
                onUpdateBuild({
                  ...currentBuild,
                  primaryWeapon: e.target.value as WeaponId,
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs font-bold text-white"
            >
              {(['vandal', 'phantom', 'spectre', 'judge', 'odin', 'operator'] as WeaponId[]).map(
                (wId) => (
                  <option key={wId} value={wId}>
                    {WEAPONS[wId].name} (${WEAPONS[wId].cost})
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">
              SECONDARY SIDEARM
            </label>
            <select
              aria-label="Secondary Weapon"
              value={currentBuild.secondaryWeapon}
              onChange={(e) =>
                onUpdateBuild({
                  ...currentBuild,
                  secondaryWeapon: e.target.value as WeaponId,
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs font-bold text-white"
            >
              {(['classic', 'ghost', 'sheriff'] as WeaponId[]).map((wId) => (
                <option key={wId} value={wId}>
                  {WEAPONS[wId].name} (${WEAPONS[wId].cost})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN (3 COLS): OPEN VIEWPORT FOR LIVE 3D OPERATOR PREVIEW + BUILD PRESET MANAGER */}
      <div className="lg:col-span-3 flex flex-col justify-between pointer-events-none">
        <div className="bg-[#0c1017]/85 border border-slate-800/80 px-3 py-2 rounded self-center text-center pointer-events-auto">
          <div className="text-[9px] font-bold tracking-[0.2em] text-cyan-400 uppercase">
            {chassis.frameClass}
          </div>
          <div className="font-valorant text-xl font-bold text-white tracking-wider">
            {currentBuild.name}
          </div>
        </div>

        {/* Bottom Build Saving / Loading Bar */}
        <div className="bg-[#0c1017]/95 border border-slate-800 p-3 rounded pointer-events-auto shadow-xl mt-48 lg:mt-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            SAVED RIG CONFIGURATIONS ({savedPresets.length})
          </div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto mb-2">
            {savedPresets.map((preset) => {
              const isCurrent = preset.id === currentBuild.id;
              const energy =
                (ACTIVE_MODULES[preset.activeSlot1]?.energyCost || 0) +
                (ACTIVE_MODULES[preset.activeSlot2]?.energyCost || 0);
              return (
                <div
                  key={preset.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${
                    isCurrent
                      ? 'border-cyan-400 bg-cyan-950/35 text-white'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateBuild(preset);
                      setBuildNameInput(preset.name);
                      setValidationAlert(null);
                    }}
                    className="flex-1 text-left cursor-pointer truncate"
                  >
                    <div className="font-bold text-[11px] truncate">{preset.name}</div>
                    <div className="text-[9px] text-slate-400">
                      {ACTIVE_MODULES[preset.activeSlot1]?.name} +{' '}
                      {ACTIVE_MODULES[preset.activeSlot2]?.name} ({energy}/7⚡)
                    </div>
                  </button>
                  {savedPresets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteBuild(preset.id)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      title="Delete Saved Rig Build"
                      aria-label={`Delete ${preset.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              aria-label="Rig Build Name"
              value={buildNameInput}
              maxLength={22}
              onChange={(e) => setBuildNameInput(e.target.value)}
              placeholder="Build name..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold uppercase"
            />
            <button
              type="button"
              onClick={handleSaveCurrentBuild}
              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>SAVE</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN (5 COLS): MODULE LIBRARY, CATEGORY FILTERS & ENGINEERING DOSSIER */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-[#0c1017]/95 border border-slate-800/90 p-4 rounded shadow-2xl">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 block">
                ASSIGNING TO ACTIVE SLOT {selectedSlot} [{selectedSlot === 1 ? 'Q' : 'E'}]
              </span>
              <h3 className="font-valorant text-2xl font-bold text-white tracking-wider leading-none">
                RIG MODULE LIBRARY (6 CATEGORIES)
              </h3>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSelectedSlot(1)}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                  selectedSlot === 1
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                SLOT 1 [Q]
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlot(2)}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                  selectedSlot === 2
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                SLOT 2 [E]
              </button>
            </div>
          </div>

          {/* Category Filter Strip */}
          <div className="flex flex-wrap gap-1 mb-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                  categoryFilter === cat
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Module Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {moduleList.map((modId) => {
              const mod = ACTIVE_MODULES[modId];
              const isEquippedIn1 = currentBuild.activeSlot1 === modId;
              const isEquippedIn2 = currentBuild.activeSlot2 === modId;
              const isInspected = inspectedModuleId === modId;
              const check = canEquipModuleInSlot(currentBuild, selectedSlot, modId);

              return (
                <button
                  key={modId}
                  type="button"
                  onClick={() => handleEquipModule(modId, selectedSlot)}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isEquippedIn1 || isEquippedIn2
                      ? 'border-cyan-400 bg-cyan-950/35 text-white'
                      : isInspected
                      ? 'border-slate-500 bg-slate-900 text-white'
                      : check.allowed
                      ? 'border-slate-800 bg-slate-950/90 text-slate-200 hover:border-slate-700'
                      : 'border-red-900/50 bg-slate-950/50 text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                      <span className="text-slate-400">{mod.category}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono ${
                          check.allowed || isEquippedIn1 || isEquippedIn2
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {mod.energyCost} PTS
                      </span>
                    </div>
                    <div className="font-valorant text-lg font-bold leading-none">
                      {mod.name}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/80 text-[9px]">
                    <span className="text-slate-400">{mod.cooldown}s CD</span>
                    {isEquippedIn1 ? (
                      <span className="text-cyan-400 font-bold">SLOT 1 [Q]</span>
                    ) : isEquippedIn2 ? (
                      <span className="text-blue-400 font-bold">SLOT 2 [E]</span>
                    ) : check.allowed ? (
                      <span className="text-emerald-400 font-bold">EQUIP</span>
                    ) : (
                      <span className="text-red-400 font-bold">OVER CAP</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Module Engineering Dossier & Comparison */}
        <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  {getModuleIcon(inspectedModule.iconName, 'w-4 h-4')}
                </div>
                <div>
                  <span className="text-[9px] font-bold text-cyan-400 uppercase block">
                    {inspectedModule.codeName} · {inspectedModule.category}
                  </span>
                  <h4 className="font-valorant text-2xl font-bold text-white leading-none">
                    {inspectedModule.name}
                  </h4>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 bg-cyan-950 border border-cyan-500/40 rounded">
                  ENERGY COST: {inspectedModule.energyCost} / {MAX_RIG_ENERGY}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5">
              {inspectedModule.description}
            </p>

            {/* Telemetry Grid (Showing Passive-Boosted Values + Comparison vs Slot) */}
            <div className="grid grid-cols-4 gap-1.5 text-center mb-2.5">
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                <div className="text-[8px] text-slate-400 uppercase font-bold">COOLDOWN</div>
                <div className="text-xs font-mono font-bold text-white">
                  {effectiveCooldown}s
                </div>
              </div>
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                <div className="text-[8px] text-slate-400 uppercase font-bold">CHARGES</div>
                <div className="text-xs font-mono font-bold text-white">
                  {inspectedModule.maxCharges}
                </div>
              </div>
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                <div className="text-[8px] text-slate-400 uppercase font-bold">DURATION</div>
                <div className="text-xs font-mono font-bold text-white">
                  {inspectedModule.duration}s
                </div>
              </div>
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                <div className="text-[8px] text-slate-400 uppercase font-bold">DEVICE HP</div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {effectiveDeviceHp > 0 ? `${effectiveDeviceHp} HP` : 'INSTANT'}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 bg-slate-900/70 p-2 rounded border border-slate-800/80 mb-3">
              <strong className="text-slate-200 uppercase">COUNTERPLAY: </strong>
              {inspectedModule.counterplay}
            </div>
          </div>

          <button
            type="button"
            onClick={onDeploy}
            disabled={!validation.valid}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-valorant text-xl font-bold tracking-widest rounded cursor-pointer flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>LOCK IN RIG CONFIGURATION & DEPLOY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
