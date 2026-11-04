import React from 'react';
import { AgentId, WeaponId } from '../types/game';
import { WEAPONS } from '../game/weapons';
import { AGENTS } from '../game/agents';
import { Shield, X, DollarSign, Crosshair, Zap } from 'lucide-react';

interface BuyMenuProps {
  isOpen: boolean;
  credits: number;
  currentShield: number;
  activeWeaponId: WeaponId;
  selectedAgent: AgentId;
  onClose: () => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onBuyShield: (type: 'light' | 'heavy') => void;
  onBuyAbility: (key: 'c' | 'q') => void;
}

export const BuyMenu: React.FC<BuyMenuProps> = ({
  isOpen,
  credits,
  currentShield,
  activeWeaponId,
  selectedAgent,
  onClose,
  onBuyWeapon,
  onBuyShield,
  onBuyAbility,
}) => {
  if (!isOpen) return null;

  const agent = AGENTS[selectedAgent] || AGENTS.jett;

  const sidearms: WeaponId[] = ['classic', 'ghost', 'sheriff'];
  const smgsAndShotguns: WeaponId[] = ['spectre', 'judge'];
  const rifles: WeaponId[] = ['phantom', 'vandal'];
  const heavyAndSnipers: WeaponId[] = ['odin', 'operator'];

  const renderWeaponCard = (wId: WeaponId) => {
    const w = WEAPONS[wId];
    const isEquipped = activeWeaponId === wId;
    const canAfford = credits >= w.cost;

    return (
      <button
        key={wId}
        onClick={() => onBuyWeapon(wId)}
        disabled={!canAfford && !isEquipped}
        className={`flex flex-col justify-between p-3 text-left border transition-all clip-val-corner cursor-pointer ${
          isEquipped
            ? 'bg-emerald-950/50 border-emerald-400 text-white'
            : canAfford
            ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 hover:border-amber-400 text-slate-100'
            : 'bg-slate-950/50 border-slate-800/60 text-slate-600 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="font-valorant text-xl font-bold tracking-wide">{w.name}</span>
          {isEquipped ? (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
              EQUIPPED
            </span>
          ) : (
            <span className="text-xs font-mono font-bold text-amber-400">
              {w.cost === 0 ? 'FREE' : `$${w.cost}`}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-1">
          <div>
            HEAD: <span className="text-slate-200 font-bold">{w.damage.head}</span>
          </div>
          <div>
            BODY: <span className="text-slate-200 font-bold">{w.damage.body}</span>
          </div>
          <div>
            MAG: <span className="text-slate-200 font-bold">{w.magazineSize}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 font-tech select-none overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/90 p-5 md:p-6 clip-val-card shadow-2xl my-auto">
        {/* TOP HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <Crosshair className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="font-valorant text-3xl font-bold text-white tracking-wider leading-none">
                TACTICAL ARSENAL // ARMORY SHOP
              </h2>
              <span className="text-xs text-slate-400 uppercase tracking-widest">
                EQUIP WEAPONS, ARMOR SHIELDS & AGENT CHARGES
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-amber-500/50 px-4 py-1.5 clip-val-corner">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-400 uppercase font-bold mr-1">CREDITS</span>
              <span className="font-valorant text-3xl font-bold text-amber-400 tabular-nums">
                {credits}
              </span>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>CLOSE [B / ESC]</span>
            </button>
          </div>
        </div>

        {/* 4-COLUMN ARSENAL GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Column 1: Sidearms */}
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1">
              SIDEARMS (PISTOLS)
            </div>
            {sidearms.map(renderWeaponCard)}
          </div>

          {/* Column 2: SMGs & Shotguns */}
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1">
              SMGS & SHOTGUNS
            </div>
            {smgsAndShotguns.map(renderWeaponCard)}

            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1 mt-2">
              HEAVY & SNIPERS
            </div>
            {heavyAndSnipers.map(renderWeaponCard)}
          </div>

          {/* Column 3: Assault Rifles */}
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1">
              ASSAULT RIFLES
            </div>
            {rifles.map(renderWeaponCard)}
          </div>

          {/* Column 4: Armor Shields & Agent Abilities */}
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1">
              ARMOR SHIELDS
            </div>

            <button
              onClick={() => onBuyShield('light')}
              disabled={credits < 400 || currentShield >= 25}
              className={`flex items-center justify-between p-3 border clip-val-corner cursor-pointer ${
                currentShield === 25
                  ? 'bg-cyan-950/50 border-cyan-400 text-white'
                  : credits >= 400 && currentShield < 25
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-950/50 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-cyan-400" />
                <div className="text-left">
                  <div className="font-valorant text-lg font-bold">LIGHT SHIELDS</div>
                  <div className="text-[10px] text-slate-400">+25 Armor Absorption</div>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400">$400</span>
            </button>

            <button
              onClick={() => onBuyShield('heavy')}
              disabled={credits < 1000 || currentShield >= 50}
              className={`flex items-center justify-between p-3 border clip-val-corner cursor-pointer ${
                currentShield === 50
                  ? 'bg-cyan-950/50 border-cyan-400 text-white'
                  : credits >= 1000 && currentShield < 50
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-950/50 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-cyan-300 fill-cyan-400/30" />
                <div className="text-left">
                  <div className="font-valorant text-lg font-bold">HEAVY SHIELDS</div>
                  <div className="text-[10px] text-slate-400">+50 Max Armor Absorption</div>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400">$1000</span>
            </button>

            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1 mt-2">
              {agent.name} TACTICAL CHARGES
            </div>

            {(['c', 'q'] as const).map((key) => {
              const ab = agent.abilities[key];
              const canAfford = credits >= ab.cost;
              return (
                <button
                  key={key}
                  onClick={() => onBuyAbility(key)}
                  disabled={!canAfford}
                  className={`flex items-center justify-between p-3 border clip-val-corner cursor-pointer ${
                    canAfford
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <div className="text-left">
                      <div className="font-valorant text-lg font-bold">
                        [{key.toUpperCase()}] {ab.name}
                      </div>
                      <div className="text-[10px] text-slate-400">Max {ab.maxCharges} charges</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-400">${ab.cost}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
