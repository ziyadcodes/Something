import React, { useState, useEffect } from 'react';
import { EngineHUDState } from '../game/engine';
import { ChatMessage, CrosshairConfig, KillfeedEntry } from '../types/game';
import { AGENTS } from '../game/agents';
import { ACTIVE_MODULES, PASSIVE_MODULES } from '../game/rigSystem';
import {
  Shield,
  Heart,
  Flame,
  Sun,
  Sparkles,
  Zap,
  Cloud,
  ArrowUp,
  Wind,
  Sword,
  Eye,
  HeartPulse,
  Ghost,
  Crosshair as CrosshairIcon,
  Radio,
  Target,
  Skull,
  FastForward,
  Users,
  MessageSquare,
  Send,
  Pause,
} from 'lucide-react';

interface HUDProps {
  state: EngineHUDState;
  killfeed: KillfeedEntry[];
  crosshair: CrosshairConfig;
  showFps: boolean;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onUseAbility: (key: 'c' | 'q' | 'e' | 'x') => void;
  onInspectWeapon: () => void;
  onOpenShop: () => void;
  onOpenSettings: () => void;
  onPauseGame: () => void;
  onSkipBuyPhase: () => void;
}

export const HUD: React.FC<HUDProps> = React.memo(({
  state,
  killfeed,
  crosshair,
  showFps,
  chatMessages,
  onSendChat,
  onUseAbility,
  onInspectWeapon,
  onOpenShop,
  onOpenSettings,
  onPauseGame,
  onSkipBuyPhase,
}) => {
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const getAbilityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Shield':
        return <Shield className="w-4 h-4" />;
      case 'Sun':
        return <Sun className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'Zap':
        return <Zap className="w-4 h-4" />;
      case 'Cloud':
        return <Cloud className="w-4 h-4" />;
      case 'ArrowUp':
        return <ArrowUp className="w-4 h-4" />;
      case 'Wind':
        return <Wind className="w-4 h-4" />;
      case 'Sword':
        return <Sword className="w-4 h-4" />;
      case 'Eye':
        return <Eye className="w-4 h-4" />;
      case 'HeartPulse':
        return <HeartPulse className="w-4 h-4" />;
      case 'Ghost':
        return <Ghost className="w-4 h-4" />;
      case 'Radio':
        return <Radio className="w-4 h-4" />;
      case 'Target':
        return <Target className="w-4 h-4" />;
      default:
        return <CrosshairIcon className="w-4 h-4" />;
    }
  };

  const currentAgent = AGENTS[state.playerAgent] || AGENTS['jett'];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Map world coordinates (x: [-45, 45], z: [-55, 55]) to 140x140 radar pixels
  const worldToRadar = (wx: number, wz: number) => {
    const rx = ((wx + 45) / 90) * 140;
    const ry = ((wz + 55) / 110) * 140;
    return {
      left: `${Math.max(6, Math.min(134, rx))}px`,
      top: `${Math.max(6, Math.min(134, ry))}px`,
    };
  };

  const playerRadarPos = worldToRadar(state.playerPos.x, state.playerPos.z);
  const yawDeg = (-state.playerPos.yaw * 180) / Math.PI;

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 font-tech">
      {/* 1. DAMAGE BORDER ON HIT */}
      {state.damageVignette > 0 && (
        <div
          className="absolute inset-0 border-8 border-red-600/70 pointer-events-none"
          style={{ opacity: state.damageVignette }}
        />
      )}

      {/* 2. FLASHBANG EFFECT */}
      {state.flashAlpha > 0 && (
        <div
          className="absolute inset-0 bg-white pointer-events-none"
          style={{ opacity: state.flashAlpha }}
        />
      )}

      {/* 3. OPERATOR SNIPER SCOPE OVERLAY */}
      {state.isScoped && state.activeWeaponId === 'operator' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/55" />
          <div className="w-full h-[1px] bg-red-600/80 absolute" />
          <div className="h-full w-[1px] bg-red-600/80 absolute" />
          <div className="w-28 h-28 border border-red-500/40 rounded-full absolute" />
          <div className="w-2 h-2 bg-red-500 rounded-full absolute" />
        </div>
      )}

      {/* 4. TOP BAR: INTEGRATED MATCH SCORE & AGENT ROSTER */}
      <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-11 sm:pt-1.5">
        <div className="flex items-center bg-slate-950/90 border-b-2 border-slate-700/80 px-4 py-1.5 clip-val-tab shadow-lg">
          {/* Allied Agent Portraits */}
          <div className="hidden sm:flex items-center gap-1 mr-3">
            <div className="px-2 h-6 rounded-sm bg-cyan-600/40 border border-cyan-400 flex items-center justify-center text-[10px] font-bold text-white">
              {currentAgent.name}
            </div>
            {state.botRoster
              .filter((b) => b.team === state.playerTeam)
              .slice(0, 4)
              .map((b) => (
                <div
                  key={b.name}
                  className={`w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold border ${
                    b.isAlive
                      ? 'bg-slate-900 border-cyan-500/60 text-slate-200'
                      : 'bg-red-950/60 border-red-900/40 text-slate-500 opacity-40'
                  }`}
                  title={`${b.name} (${b.agent})`}
                >
                  {b.name.slice(0, 2)}
                </div>
              ))}
          </div>

          {/* Attackers (Red) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold">
              ATK
            </span>
            <span className="font-valorant text-2xl sm:text-3xl font-bold text-red-500 tabular-nums">
              {state.attackersScore}
            </span>
          </div>

          {/* Center Round Timer / Spike State */}
          <div className="flex flex-col items-center px-4 border-x border-slate-700/60 mx-3">
            {state.spikeState.status === 'planted' || state.spikeState.status === 'defusing' ? (
              <div className="flex items-center gap-1.5 text-red-500">
                <Target className="w-4 h-4 text-red-500" />
                <span className="font-valorant text-xl sm:text-2xl font-bold tracking-wider">
                  SPIKE {Math.ceil(state.spikeState.timeRemaining)}s
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[9px] tracking-widest text-slate-400 uppercase font-semibold">
                  {state.gameMode === 'range'
                    ? 'THE RANGE'
                    : state.gameMode === 'dm'
                    ? 'DEATHMATCH'
                    : state.gameMode === 'tdm'
                    ? 'TEAM DM'
                    : state.roundPhase === 'buy'
                    ? 'BUY PHASE'
                    : 'ROUND TIME'}
                </span>
                <span className="font-valorant text-xl sm:text-2xl font-bold text-slate-100 tabular-nums leading-none">
                  {state.gameMode === 'range' ? '∞' : formatTime(state.phaseTimer)}
                </span>
              </div>
            )}
          </div>

          {/* Defenders (Cyan) */}
          <div className="flex items-center gap-2">
            <span className="font-valorant text-2xl sm:text-3xl font-bold text-cyan-400 tabular-nums">
              {state.defendersScore}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
              DEF
            </span>
          </div>

          {/* Enemy Agent Portraits */}
          <div className="hidden sm:flex items-center gap-1 ml-3">
            {state.botRoster
              .filter((b) => b.team !== state.playerTeam)
              .slice(0, 5)
              .map((b) => (
                <div
                  key={b.name}
                  className={`w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold border ${
                    b.isAlive
                      ? 'bg-slate-900 border-red-500/60 text-slate-200'
                      : 'bg-red-950/60 border-red-900/40 text-slate-500 opacity-40'
                  }`}
                  title={`${b.name} (${b.agent})`}
                >
                  {b.name.slice(0, 2)}
                </div>
              ))}
          </div>
        </div>

        {/* Buy Phase Skip Prompt */}
        {state.roundPhase === 'buy' && state.gameMode !== 'range' && (
          <div className="mt-1.5 flex items-center gap-2 bg-slate-950/90 border border-amber-500/70 px-3.5 py-1 clip-val-corner pointer-events-auto">
            <span className="text-[11px] font-bold text-amber-300 tracking-wider">
              BARRIERS DROP IN {state.phaseTimer}s
            </span>
            <button
              onClick={onSkipBuyPhase}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
            >
              <FastForward className="w-3 h-3" />
              <span>DROP BARRIERS [ENTER]</span>
            </button>
          </div>
        )}

        {state.statusBanner && (
          <div className="mt-1.5 bg-slate-950/95 border-l-4 border-amber-500 px-4 py-1 text-xs font-bold tracking-widest text-white uppercase shadow-md">
            {state.statusBanner}
          </div>
        )}
      </div>

      {/* 5. LIVE DYNAMIC TACTICAL MINIMAP RADAR (Top Left — hidden on narrow portrait phones) */}
      <div className="hidden md:block absolute top-3 left-3 bg-slate-950/90 border border-slate-700/80 p-1.5 clip-val-corner">
        <div className="relative w-[140px] h-[140px] bg-slate-900 rounded border border-slate-800 overflow-hidden">
          <div className="absolute inset-x-3 top-2 h-2.5 bg-slate-800/70 rounded-xs" />
          <div className="absolute inset-x-3 bottom-2 h-2.5 bg-slate-800/70 rounded-xs" />
          {/* Site B Zone (West) */}
          <div className="absolute top-5 left-2.5 w-10 h-10 border border-amber-500/60 bg-amber-500/15 flex items-center justify-center">
            <span className="font-valorant text-xs font-bold text-amber-400">B</span>
          </div>
          {/* Site A Zone (East) */}
          <div className="absolute top-5 right-2.5 w-10 h-10 border border-amber-500/60 bg-amber-500/15 flex items-center justify-center">
            <span className="font-valorant text-xs font-bold text-amber-400">A</span>
          </div>
          {/* Reactor Core Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-slate-700 bg-slate-800/50 flex items-center justify-center">
            <span className="text-[8px] font-bold text-slate-400">CORE</span>
          </div>

          {/* Live Bot & Remote Player Positions */}
          {state.botRoster.map((b) => {
            if (!b.isAlive) return null;
            const pos = worldToRadar(b.x, b.z);
            const isAlly = b.team === state.playerTeam;
            return (
              <div
                key={b.name}
                style={pos}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border ${
                  isAlly ? 'bg-cyan-400 border-white' : 'bg-red-500 border-amber-200'
                }`}
              />
            );
          })}

          {/* Live Player Position + Facing Cone */}
          <div
            style={{
              ...playerRadarPos,
              transform: `translate(-50%, -50%) rotate(${yawDeg}deg)`,
            }}
            className="absolute flex flex-col items-center"
          >
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-emerald-400 -mb-0.5" />
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white" />
          </div>

          {/* Planted Spike Indicator */}
          {state.spikeState.status === 'planted' && state.spikeState.position && (
            <div
              style={worldToRadar(state.spikeState.position.x, state.spikeState.position.z)}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-red-600"
            />
          )}
        </div>
        <div className="flex justify-between items-center text-[9px] text-slate-400 px-1 pt-1 font-bold">
          <span>SECTOR // {state.mapId.toUpperCase()}</span>
          <span className="text-emerald-400">ROOM: {state.roomId}</span>
        </div>
      </div>

      {/* 6. OPTIONAL HARDWARE TELEMETRY BADGE (FPS / FRAME TIME / RESOLUTION) */}
      {showFps && (
        <div className="absolute top-[174px] left-3 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 flex items-center gap-2">
          <span className="text-emerald-400 font-bold">{state.fps} FPS</span>
          <span className="text-slate-500">|</span>
          <span>{state.frameTimeMs}ms</span>
          <span className="text-slate-500">|</span>
          <span className="text-amber-400">
            {state.renderWidth}×{state.renderHeight}
          </span>
        </div>
      )}

      {/* 7. TOP RIGHT: UTILITY CONTROLS & KILLFEED */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowScoreboard((s) => !s)}
            className="bg-slate-950/95 hover:bg-slate-800 text-slate-200 text-[11px] font-bold px-2.5 py-1.5 border border-slate-700 rounded flex items-center gap-1 cursor-pointer"
            title="Toggle Match Scoreboard [TAB]"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>SCORE [TAB]</span>
          </button>

          <button
            onClick={() => setShowChatDrawer((c) => !c)}
            className="bg-slate-950/95 hover:bg-slate-800 text-slate-200 text-[11px] font-bold px-2.5 py-1.5 border border-slate-700 rounded flex items-center gap-1 cursor-pointer"
            title="Toggle Team Comms & Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>COMMS</span>
          </button>

          <button
            onClick={onOpenShop}
            className="bg-slate-950/95 hover:bg-amber-500 hover:text-slate-950 text-white text-[11px] font-bold px-2.5 py-1.5 border border-amber-500/70 rounded cursor-pointer"
            title="Open Weapon Armory [B]"
          >
            <span>SHOP [B]</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="bg-slate-950/95 hover:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1.5 border border-slate-700 rounded cursor-pointer"
            title="Graphics, Potato Mode & Controls"
          >
            <span>GFX / CFG</span>
          </button>

          <button
            onClick={onPauseGame}
            className="bg-slate-950/95 hover:bg-red-600 text-white text-[11px] font-bold p-1.5 border border-slate-700 rounded cursor-pointer"
            title="Pause Match [ESC]"
            aria-label="Pause Match"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Killfeed */}
        <div className="flex flex-col gap-1 items-end max-w-xs">
          {killfeed.slice(-4).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/60 px-2.5 py-1 clip-val-chamfer text-[11px]"
            >
              <span
                className={`font-bold ${
                  entry.killerTeam === state.playerTeam ? 'text-cyan-400' : 'text-red-400'
                }`}
              >
                {entry.killerName}
              </span>
              <span className="text-slate-400 uppercase text-[9px] px-1 bg-slate-800 rounded">
                {entry.weaponId}
              </span>
              {entry.isHeadshot && <Skull className="w-3 h-3 text-red-500" />}
              <span
                className={`font-bold ${
                  entry.victimTeam === state.playerTeam ? 'text-cyan-400' : 'text-red-400'
                }`}
              >
                {entry.victimName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 8. MULTIPLAYER TEAM COMMS & RADIO CALLOUT DRAWER */}
      {showChatDrawer && (
        <div className="absolute top-14 right-3 w-72 bg-slate-950/95 border border-slate-700 p-3 rounded clip-val-corner pointer-events-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              SQUAD RADIO // ROOM {state.roomId}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">
              {state.onlinePlayerCount} IN SECTOR
            </span>
          </div>

          {/* Quick Tactical Radio Callouts */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[
              'ENEMIES AT SITE A!',
              'ROTATING TO SITE B!',
              'PLANTING THE SPIKE!',
              'NEED BACKUP MID!',
            ].map((callout) => (
              <button
                key={callout}
                onClick={() => onSendChat(callout)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[9px] font-bold text-slate-300 text-left truncate cursor-pointer"
              >
                {callout}
              </button>
            ))}
          </div>

          <div className="h-28 overflow-y-auto flex flex-col gap-1 bg-slate-900/70 p-2 rounded border border-slate-800 mb-2 text-[11px]">
            {chatMessages.length === 0 ? (
              <span className="text-slate-500 text-[10px]">
                No radio traffic yet. Send a tactical callout below.
              </span>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="leading-snug">
                  <span
                    className={`font-bold mr-1.5 ${
                      msg.senderTeam === state.playerTeam ? 'text-cyan-400' : 'text-red-400'
                    }`}
                  >
                    [{msg.senderName}]:
                  </span>
                  <span className="text-slate-200">{msg.text}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="flex gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Transmit message..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* 9. INTERACTIVE [TAB] SCOREBOARD OVERLAY */}
      {showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 pointer-events-auto z-40 p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 p-5 clip-val-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-valorant text-3xl font-bold text-white tracking-wider leading-none">
                  TACTICAL SCOREBOARD // {state.mapId.toUpperCase()}
                </h3>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                  MODE: {state.gameMode.toUpperCase()} · ROOM: {state.roomId}
                </span>
              </div>
              <button
                onClick={() => setShowScoreboard(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded cursor-pointer"
              >
                CLOSE [TAB]
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['attackers', 'defenders'] as const).map((team) => {
                const entries = state.scoreboard.filter((s) => s.team === team);
                const isAttackers = team === 'attackers';
                return (
                  <div
                    key={team}
                    className="bg-slate-950/90 border border-slate-800 rounded p-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span
                        className={`font-valorant text-xl font-bold tracking-wider ${
                          isAttackers ? 'text-red-400' : 'text-cyan-400'
                        }`}
                      >
                        {isAttackers ? 'ATTACKERS STRIKE FORCE' : 'DEFENDERS GARRISON'}
                      </span>
                      <span className="font-valorant text-2xl font-bold text-white tabular-nums">
                        {isAttackers ? state.attackersScore : state.defendersScore}
                      </span>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-800/80">
                          <th className="py-1">OPERATIVE</th>
                          <th className="py-1">AGENT</th>
                          <th className="py-1 text-center">K / D</th>
                          <th className="py-1 text-right">CREDITS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((row) => (
                          <tr
                            key={row.id}
                            className={`border-b border-slate-900 ${
                              row.isPlayer
                                ? 'bg-amber-500/15 text-amber-200 font-bold'
                                : row.isAlive
                                ? 'text-slate-200'
                                : 'text-slate-500'
                            }`}
                          >
                            <td className="py-1.5 flex items-center gap-1.5">
                              <span>{row.name}</span>
                              {row.isRemote && (
                                <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded">
                                  ONLINE
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 uppercase text-[10px] text-slate-400">
                              {row.agent}
                            </td>
                            <td className="py-1.5 text-center font-mono">
                              {row.kills} / {row.deaths}
                            </td>
                            <td className="py-1.5 text-right font-mono text-amber-400">
                              ${row.credits}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 10. CENTER RETICLE / CROSSHAIR + HITMARKER + DIRECTIONAL DAMAGE ARC */}
      {!state.isScoped && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Directional Incoming Damage Threat Arc */}
            {state.damageDirectionDeg !== null && state.damageVignette > 0 && (
              <div
                style={{
                  transform: `translate(-50%, -50%) rotate(${state.damageDirectionDeg}deg)`,
                  opacity: Math.min(1, state.damageVignette * 1.2),
                }}
                className="absolute w-32 h-32 rounded-full border-t-4 border-red-500 pointer-events-none"
              />
            )}

            {/* Hitmarker X & Floating Damage Confirmation */}
            {state.lastHitEvent && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                <div className="relative w-6 h-6">
                  <div
                    className={`absolute inset-0 rotate-45 border-t-2 border-b-2 ${
                      state.lastHitEvent.isHeadshot ? 'border-amber-400' : 'border-white'
                    }`}
                  />
                </div>
                <div
                  className={`mt-7 px-2 py-0.5 rounded bg-slate-950/85 border text-xs font-bold tracking-wider whitespace-nowrap ${
                    state.lastHitEvent.isHeadshot
                      ? 'border-amber-400 text-amber-300'
                      : 'border-cyan-500/70 text-cyan-300'
                  }`}
                >
                  -{state.lastHitEvent.damage}{' '}
                  {state.lastHitEvent.isHeadshot ? 'HEADSHOT!' : state.lastHitEvent.targetName}
                </div>
              </div>
            )}

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
      )}

      {/* 10B. RANGE 30-BOT REFLEX CHALLENGE TRACKER */}
      {state.gameMode === 'range' && (
        <div className="hidden sm:flex absolute top-20 left-1/2 -translate-x-1/2 items-center gap-3 bg-slate-950/90 border border-cyan-500/60 px-4 py-1.5 clip-val-corner">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
            REFLEX CHALLENGE [G]
          </span>
          <span className="text-xs font-mono font-bold text-white">
            {state.rangeChallenge.kills} / {state.rangeChallenge.targetKills} KILLS
          </span>
          <span className="text-xs font-mono text-amber-300">
            {state.rangeChallenge.elapsed.toFixed(1)}s
          </span>
          {state.rangeChallenge.shotsFired > 0 && (
            <span className="text-[10px] font-mono text-emerald-400">
              ACC:{' '}
              {Math.round(
                (state.rangeChallenge.shotsHit / state.rangeChallenge.shotsFired) * 100
              )}
              %
            </span>
          )}
          {state.rangeChallenge.bestTime !== null && (
            <span className="text-[10px] font-bold text-amber-400">
              BEST: {state.rangeChallenge.bestTime}s
            </span>
          )}
        </div>
      )}

      {/* 11. KILL BANNER (SKULL & MULTIKILL / ACE) */}
      {state.recentKillEvent && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <div className="relative flex items-center justify-center w-16 h-16 bg-red-950/90 border-2 border-red-500 rounded-full">
            <Skull className="w-10 h-10 text-red-500" />
            <div className="absolute -bottom-2 bg-red-600 text-white font-valorant text-xs px-2 py-0.5 rounded font-bold">
              {state.recentKillEvent.count >= 5
                ? 'ACE'
                : state.recentKillEvent.count === 4
                ? 'QUADRA'
                : state.recentKillEvent.count === 3
                ? 'TRIPLE'
                : state.recentKillEvent.count === 2
                ? 'DOUBLE'
                : 'ELIMINATED'}
            </div>
          </div>
          <span className="font-valorant text-2xl font-bold text-white mt-2 tracking-wider">
            {state.recentKillEvent.victimName}
          </span>
        </div>
      )}

      {/* 12. SPIKE INTERACTION PROMPTS & PROGRESS BAR */}
      {state.isInsidePlantZone &&
        state.playerTeam === 'attackers' &&
        state.spikeState.status === 'unplanted' && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-red-500/80 px-5 py-2 clip-val-chamfer flex items-center gap-3">
            <span className="bg-red-500 text-white font-bold text-xs px-2 py-0.5 rounded">
              HOLD [4] or [F]
            </span>
            <span className="font-valorant text-lg text-red-400 font-bold tracking-wide">
              PLANT SPIKE ON SITE {state.plantZoneSite}
            </span>
          </div>
        )}

      {state.spikeState.status === 'planting' && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-red-400 font-bold">
            PLANTING SPIKE...
          </span>
          <div className="w-60 h-2.5 bg-slate-900 border border-red-500 rounded-sm overflow-hidden">
            <div
              className="h-full bg-red-500"
              style={{ width: `${state.spikeState.plantProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {state.spikeState.status === 'defusing' && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
            DEFUSING SPIKE...
          </span>
          <div className="relative w-60 h-2.5 bg-slate-900 border border-cyan-400 rounded-sm overflow-hidden">
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white z-10" />
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${state.spikeState.defuseProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 13. BOTTOM LEFT: HEALTH & SHIELDS + SLOWED STATUS */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex items-end gap-2">
        <div className="flex flex-col bg-slate-950/90 border border-slate-700/80 px-3 py-1.5 sm:px-4 sm:py-2 clip-val-corner">
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-300 font-bold tracking-wider uppercase">
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>HP</span>
            {state.isSlowed && (
              <span className="ml-1 px-1 bg-sky-500/30 text-sky-300 rounded text-[8px]">
                SLOWED
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-valorant text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none">
              {state.health}
            </span>
            <div className="hidden sm:block w-16 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
              <div className="h-full bg-red-500" style={{ width: `${state.health}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-slate-950/90 border border-slate-700/80 px-2.5 py-1.5 sm:px-3.5 sm:py-2 clip-val-corner">
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-300 font-bold tracking-wider uppercase">
            <Shield className="w-3 h-3 text-cyan-400 fill-cyan-400" />
            <span>ARMOR</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-valorant text-2xl sm:text-3xl font-bold text-cyan-300 tabular-nums leading-none">
              {state.shield}
            </span>
          </div>
        </div>
      </div>

      {/* 13B. ACTIVE ABILITY ARCHETYPE & DURATION PROGRESS BAR */}
      {state.activeAbilityBuff && (
        <div className="absolute top-[148px] sm:top-auto sm:bottom-[82px] left-1/2 -translate-x-1/2 w-60 sm:w-64 bg-slate-950/90 border border-cyan-500/70 px-3 py-1 clip-val-corner pointer-events-none">
          <div className="flex items-center justify-between text-[9px] font-bold mb-1">
            <span className="px-1.5 py-0.2 bg-cyan-500/25 text-cyan-300 rounded">
              {state.activeAbilityBuff.archetype}
            </span>
            <span className="text-white truncate mx-1.5">
              {state.activeAbilityBuff.name}
            </span>
            <span className="text-amber-400 font-mono">
              {state.activeAbilityBuff.remaining.toFixed(1)}s
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-cyan-400"
              style={{
                width: `${Math.min(
                  100,
                  (state.activeAbilityBuff.remaining /
                    Math.max(0.1, state.activeAbilityBuff.duration)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 14. BOTTOM CENTER: CLICKABLE / TAPPABLE AGENT ABILITIES (C, Q, E, X) */}
      <div className="absolute bottom-[92px] sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
        {state.rigBuild && PASSIVE_MODULES[state.rigBuild.passiveSlot] && (
          <div className="hidden sm:flex flex-col items-center justify-center px-2 py-1.5 bg-slate-950/90 border border-slate-800 clip-val-corner text-center min-w-[58px]">
            <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">PAS MOD</span>
            <span className="text-[8px] font-bold text-amber-400 truncate max-w-[55px]">
              {PASSIVE_MODULES[state.rigBuild.passiveSlot].name.split(' ')[0]}
            </span>
          </div>
        )}

        {(['c', 'q', 'e', 'x'] as const).map((key) => {
          let abilityName = currentAgent.abilities[key].name;
          let iconName = currentAgent.abilities[key].iconName;
          let maxCharges = currentAgent.abilities[key].maxCharges;
          const isUltimate = key === 'x';

          if (state.rigBuild && key === 'q') {
            const m = ACTIVE_MODULES[state.rigBuild.activeSlot1];
            if (m) {
              abilityName = m.name;
              iconName = m.iconName;
              maxCharges = m.maxCharges;
            }
          } else if (state.rigBuild && key === 'e') {
            const m = ACTIVE_MODULES[state.rigBuild.activeSlot2];
            if (m) {
              abilityName = m.name;
              iconName = m.iconName;
              maxCharges = m.maxCharges;
            }
          }

          const charges = state.abilityCharges[key];
          const cooldown = state.abilityCooldowns[key];
          const isReady = isUltimate
            ? state.ultPoints >= state.ultMax || charges > 0
            : charges > 0 && cooldown <= 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onUseAbility(key)}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUseAbility(key);
              }}
              className={`relative flex flex-col items-center px-2 py-1 sm:px-2.5 sm:py-1.5 bg-slate-950/90 border clip-val-corner min-w-[56px] sm:min-w-[66px] cursor-pointer ${
                key === 'x'
                  ? isReady
                    ? 'border-amber-400 bg-amber-950/40 text-amber-200'
                    : 'border-slate-700 text-slate-400'
                  : isReady
                  ? 'border-cyan-500/70 text-white hover:bg-slate-900'
                  : 'border-slate-800 text-slate-500 opacity-60'
              }`}
            >
              {!isUltimate ? (
                <div className="flex gap-1 mb-0.5">
                  {Array.from({ length: maxCharges }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-1 rounded-sm ${
                        i < charges ? 'bg-cyan-400' : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-[8px] font-bold text-amber-400">
                  {isReady ? 'READY' : `${state.ultPoints}/${state.ultMax}`}
                </span>
              )}

              <div className="w-5 h-5 flex items-center justify-center">
                {getAbilityIcon(iconName)}
              </div>

              <span className="text-[8px] font-bold tracking-wider uppercase truncate max-w-[60px]">
                {abilityName}
              </span>

              <span className="text-[9px] font-bold uppercase px-1 bg-slate-800 rounded text-cyan-300">
                [{key.toUpperCase()}]
              </span>

              {cooldown > 0 && (
                <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center text-xs font-bold text-cyan-400">
                  {Math.ceil(cooldown)}s
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 15. BOTTOM RIGHT: CLEAN AMMO READOUT MATCHING REFERENCE IMAGE + CREDITS */}
      <div className="absolute bottom-4 right-5 flex items-end gap-4 pointer-events-auto">
        <button
          type="button"
          onClick={onInspectWeapon}
          className="hidden sm:flex flex-col items-end bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 px-3 py-1.5 clip-val-corner cursor-pointer"
          title="Inspect Weapon [Y]"
        >
          <span className="text-[9px] text-slate-400 uppercase font-bold">CREDITS // [Y] INSPECT</span>
          <span className="font-valorant text-2xl font-bold text-amber-400 tabular-nums">
            ${state.credits}
          </span>
        </button>

        <div className="flex flex-col items-end bg-slate-950/85 border border-slate-700/80 px-5 py-2 clip-val-card">
          <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">
            {state.activeWeaponName}
          </span>

          <div className="flex items-baseline gap-2">
            {state.isReloading ? (
              <span className="font-valorant text-2xl text-amber-400 font-bold">
                RELOADING...
              </span>
            ) : (
              <>
                <span
                  className="font-valorant text-5xl font-bold text-white tabular-nums leading-none"
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
                >
                  {state.ammoInMag}
                </span>
                <span className="text-lg text-slate-400 font-bold tabular-nums">
                  / {state.reserveAmmo}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
