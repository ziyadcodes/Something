import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  ArrowUp,
  RotateCcw,
  ShieldAlert,
  Eye,
  Zap,
  ChevronsUp,
  Sliders,
  ArrowLeftRight,
  RotateCw,
  X,
} from 'lucide-react';
import { WeaponId } from '../types/game';

export interface CustomMobileLayout {
  leftHanded: boolean;
  scale: number;
  joySens: number;
  joyOffsetX: number;
  joyOffsetY: number;
  actionOffsetX: number;
  actionOffsetY: number;
}

const STORAGE_KEY = 'valorant_mobile_hud_layout_v2';

function loadMobileLayout(defaultScale: number, defaultSens: number): CustomMobileLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        leftHanded: Boolean(parsed.leftHanded),
        scale: typeof parsed.scale === 'number' ? parsed.scale : defaultScale,
        joySens: typeof parsed.joySens === 'number' ? parsed.joySens : defaultSens,
        joyOffsetX: typeof parsed.joyOffsetX === 'number' ? parsed.joyOffsetX : 0,
        joyOffsetY: typeof parsed.joyOffsetY === 'number' ? parsed.joyOffsetY : 0,
        actionOffsetX: typeof parsed.actionOffsetX === 'number' ? parsed.actionOffsetX : 0,
        actionOffsetY: typeof parsed.actionOffsetY === 'number' ? parsed.actionOffsetY : 0,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    leftHanded: false,
    scale: defaultScale,
    joySens: defaultSens,
    joyOffsetX: 0,
    joyOffsetY: 0,
    actionOffsetX: 0,
    actionOffsetY: 0,
  };
}

interface MobileControlsProps {
  buttonScale: number;
  joystickSens: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isScoped: boolean;
  canPlantOrDefuse: boolean;
  activeSlot: 'primary' | 'secondary' | 'melee';
  primaryWeaponId?: WeaponId;
  secondaryWeaponId: WeaponId;
  onMove: (x: number, y: number) => void;
  onLook: (dx: number, dy: number) => void;
  onFireChange: (down: boolean) => void;
  onToggleScope: () => void;
  onJump: () => void;
  onToggleCrouch: () => void;
  onToggleSprint: () => void;
  onReload: () => void;
  onInspect: () => void;
  onPlantDefuseChange: (held: boolean) => void;
  onSwitchWeapon: (slot: 'primary' | 'secondary' | 'melee') => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  buttonScale,
  joystickSens,
  isCrouching,
  isSprinting,
  isScoped,
  canPlantOrDefuse,
  activeSlot,
  onMove,
  onLook,
  onFireChange,
  onToggleScope,
  onJump,
  onToggleCrouch,
  onToggleSprint,
  onReload,
  onInspect,
  onPlantDefuseChange,
  onSwitchWeapon,
}) => {
  const [layout, setLayout] = useState<CustomMobileLayout>(() =>
    loadMobileLayout(buttonScale, joystickSens)
  );
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const joyTouchId = useRef<number | null>(null);
  const joyOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fireTouchId = useRef<number | null>(null);
  const lastFirePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // ignore
    }
  }, [layout]);

  const effectiveScale = layout.scale || buttonScale;
  const effectiveSens = layout.joySens || joystickSens;
  const maxRadius = 44 * effectiveScale;

  // Multi-Touch Virtual Thumbstick
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch) return;
    joyTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnobOffset({ x: 0, y: 0 });
        onMove(0, 0);
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joyOrigin.current.x;
    const dy = clientY - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnobOffset({ x: kx, y: ky });

    const normX = (kx / maxRadius) * effectiveSens;
    const normY = (-ky / maxRadius) * effectiveSens;
    onMove(normX, normY);
  };

  // Multi-Touch Camera Look Pad
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        onLook(dx * 2.2 * effectiveSens, dy * 2.2 * effectiveSens);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  // Dedicated Fire Trigger (Hold to Spray + Drag to Aim simultaneously)
  const handleFireTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (touch) {
      fireTouchId.current = touch.identifier;
      lastFirePos.current = { x: touch.clientX, y: touch.clientY };
    }
    onFireChange(true);
  };

  const handleFireTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireTouchId.current) {
        const dx = t.clientX - lastFirePos.current.x;
        const dy = t.clientY - lastFirePos.current.y;
        lastFirePos.current = { x: t.clientX, y: t.clientY };
        onLook(dx * 1.8 * effectiveSens, dy * 1.8 * effectiveSens);
        break;
      }
    }
  };

  const handleFireTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fireTouchId.current = null;
    onFireChange(false);
  };

  const sz = (basePx: number) => `${Math.round(basePx * effectiveScale)}px`;
  const isLeftHanded = layout.leftHanded;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none touch-none">
      {/* CAMERA LOOK REGION (Swaps side in Left-Handed Mode) */}
      <div
        className={`absolute top-12 bottom-0 w-3/5 pointer-events-auto ${
          isLeftHanded ? 'left-0' : 'right-0'
        }`}
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* COMPACT WEAPON SWITCH & HUD LAYOUT BAR (Centered cleanly under top score bar) */}
      <div className="absolute top-[52px] left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto bg-slate-950/85 backdrop-blur-sm border border-slate-700/80 px-1.5 py-1 rounded-lg shadow-md">
        {(['primary', 'secondary', 'melee'] as const).map((slot, idx) => (
          <button
            key={slot}
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onSwitchWeapon(slot);
            }}
            onClick={() => onSwitchWeapon(slot)}
            className={`min-h-[36px] px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              activeSlot === slot
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            {idx + 1} {slot === 'primary' ? 'RIFLE' : slot === 'secondary' ? 'PISTOL' : 'KNIFE'}
          </button>
        ))}
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          onClick={onInspect}
          title="Inspect Weapon"
          className="min-h-[36px] min-w-[36px] rounded border border-slate-800 bg-slate-900/90 text-cyan-400 flex items-center justify-center"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            setShowCustomizer((s) => !s);
          }}
          onClick={() => setShowCustomizer((s) => !s)}
          title="Customize Mobile HUD & Left-Handed Mode"
          className={`min-h-[36px] px-2 rounded border text-[10px] font-bold flex items-center gap-1 whitespace-nowrap ${
            showCustomizer
              ? 'bg-cyan-500 text-slate-950 border-white'
              : 'bg-slate-900/90 text-slate-200 border-slate-700'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span>HUD</span>
        </button>
      </div>

      {/* MOVEMENT THUMBSTICK CLUSTER (Left by default, Right when Left-Handed) */}
      <div
        style={{
          transform: `translate(${layout.joyOffsetX}px, ${layout.joyOffsetY}px)`,
        }}
        className={`absolute bottom-[106px] sm:bottom-20 ${
          isLeftHanded ? 'right-4 sm:right-8' : 'left-4 sm:left-8'
        } flex flex-col items-center gap-2 pointer-events-none`}
      >
        {/* SPRINT LOCK BUTTON */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            onToggleSprint();
          }}
          onClick={onToggleSprint}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-full border text-[10px] font-bold tracking-wider flex items-center gap-1 pointer-events-auto shadow-md ${
            isSprinting
              ? 'bg-amber-500 text-slate-950 border-white'
              : 'bg-slate-950/85 text-slate-200 border-slate-600'
          }`}
        >
          <ChevronsUp className="w-3.5 h-3.5" />
          <span>SPRINT</span>
        </button>

        {/* VIRTUAL THUMBSTICK RING */}
        <div
          className="rounded-full bg-slate-950/70 border-2 border-slate-500/70 flex items-center justify-center pointer-events-auto shadow-xl"
          style={{ width: sz(98), height: sz(98) }}
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
        >
          <div
            className="rounded-full bg-amber-500/90 border-2 border-white shadow-md"
            style={{
              width: sz(40),
              height: sz(40),
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* COMBAT ACTION CLUSTER (Right by default, Left when Left-Handed) */}
      <div
        style={{
          transform: `translate(${layout.actionOffsetX}px, ${layout.actionOffsetY}px)`,
        }}
        className={`absolute bottom-[106px] sm:bottom-20 ${
          isLeftHanded
            ? 'left-4 sm:left-8 items-start'
            : 'right-4 sm:right-8 items-end'
        } flex flex-col gap-2 pointer-events-none`}
      >
        {/* Plant / Defuse Context Trigger */}
        {canPlantOrDefuse && (
          <button
            type="button"
            className="min-h-[44px] px-4 py-2 rounded-full bg-red-600 border-2 border-white text-white font-bold text-xs tracking-wider uppercase shadow-lg flex items-center gap-1.5 pointer-events-auto"
            onTouchStart={(e) => {
              e.stopPropagation();
              onPlantDefuseChange(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onPlantDefuseChange(false);
            }}
            onMouseDown={() => onPlantDefuseChange(true)}
            onMouseUp={() => onPlantDefuseChange(false)}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>HOLD SPIKE</span>
          </button>
        )}

        {/* Upper Action Arc: ADS, RELOAD, JUMP */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            style={{ width: sz(48), height: sz(48) }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onToggleScope();
            }}
            onClick={onToggleScope}
            className={`min-w-[44px] min-h-[44px] rounded-full border-2 flex flex-col items-center justify-center text-[9px] font-bold shadow-md ${
              isScoped
                ? 'bg-cyan-500 text-slate-950 border-white'
                : 'bg-slate-950/85 text-white border-slate-500'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>ADS</span>
          </button>

          <button
            type="button"
            style={{ width: sz(48), height: sz(48) }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onReload();
            }}
            onClick={onReload}
            className="min-w-[44px] min-h-[44px] rounded-full bg-slate-950/85 border-2 border-slate-500 text-white flex flex-col items-center justify-center text-[9px] font-bold active:bg-slate-800 shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>RLD</span>
          </button>

          <button
            type="button"
            style={{ width: sz(48), height: sz(48) }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onJump();
            }}
            onClick={onJump}
            className="min-w-[44px] min-h-[44px] rounded-full bg-slate-950/85 border-2 border-slate-500 text-white flex flex-col items-center justify-center text-[9px] font-bold active:bg-slate-800 shadow-md"
          >
            <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>JUMP</span>
          </button>
        </div>

        {/* Lower Action Row: CROUCH + PRIMARY FIRE TRIGGER */}
        <div
          className={`flex items-center gap-2.5 pointer-events-auto ${
            isLeftHanded ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <button
            type="button"
            style={{ width: sz(48), height: sz(48) }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onToggleCrouch();
            }}
            onClick={onToggleCrouch}
            className={`min-w-[44px] min-h-[44px] rounded-full border-2 flex flex-col items-center justify-center text-[9px] font-bold shadow-md ${
              isCrouching
                ? 'bg-amber-500 text-slate-950 border-white'
                : 'bg-slate-950/85 text-white border-slate-500'
            }`}
          >
            <span>CROUCH</span>
          </button>

          <button
            type="button"
            style={{ width: sz(78), height: sz(78) }}
            onTouchStart={handleFireTouchStart}
            onTouchMove={handleFireTouchMove}
            onTouchEnd={handleFireTouchEnd}
            onTouchCancel={handleFireTouchEnd}
            onMouseDown={() => onFireChange(true)}
            onMouseUp={() => onFireChange(false)}
            className="min-w-[64px] min-h-[64px] rounded-full bg-red-600/95 active:bg-red-500 border-2 border-white text-white font-valorant text-xl font-bold tracking-wider flex flex-col items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.55)]"
          >
            <Zap className="w-5 h-5 fill-white" />
            <span className="text-[11px] leading-none mt-0.5">FIRE</span>
          </button>
        </div>
      </div>

      {/* MOBILE HUD CUSTOMIZER DRAWER (Left-Handed Mode, Button Scale, Sensitivity, Offset Tuning) */}
      {showCustomizer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold tracking-wider uppercase text-cyan-400">
                  Mobile Control & Ergonomics Customizer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Adjust button scale, joystick sensitivity, and left-handed flip
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Left-Handed Layout Toggle */}
              <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-bold text-slate-100">Left-Handed Layout</div>
                    <div className="text-[10px] text-slate-400">
                      Swaps movement thumbstick and fire/action cluster
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLayout((prev) => ({ ...prev, leftHanded: !prev.leftHanded }))
                  }
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-bold text-xs ${
                    layout.leftHanded
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {layout.leftHanded ? 'LEFT-HANDED' : 'RIGHT-HANDED'}
                </button>
              </div>

              {/* Control Size Slider */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-200">Control Button Scale</span>
                  <span className="font-mono text-cyan-400">
                    {Math.round(layout.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.35}
                  step={0.05}
                  value={layout.scale}
                  onChange={(e) =>
                    setLayout((prev) => ({ ...prev, scale: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Joystick & Touch-Look Sensitivity */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-200">
                    Touch & Joystick Sensitivity
                  </span>
                  <span className="font-mono text-amber-400">
                    {Math.round(layout.joySens * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={layout.joySens}
                  onChange={(e) =>
                    setLayout((prev) => ({ ...prev, joySens: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Vertical Offset Fine-Tuning */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-200">
                    Thumb Zone Vertical Height Offset
                  </span>
                  <span className="font-mono text-emerald-400">
                    {layout.actionOffsetY}px
                  </span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={40}
                  step={5}
                  value={layout.actionOffsetY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setLayout((prev) => ({
                      ...prev,
                      joyOffsetY: val,
                      actionOffsetY: val,
                    }));
                  }}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-4">
              <button
                type="button"
                onClick={() =>
                  setLayout({
                    leftHanded: false,
                    scale: 1.0,
                    joySens: 1.0,
                    joyOffsetX: 0,
                    joyOffsetY: 0,
                    actionOffsetX: 0,
                    actionOffsetY: 0,
                  })
                }
                className="min-h-[42px] px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                className="min-h-[42px] px-5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold"
              >
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
