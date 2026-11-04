import React, { useState, useEffect } from 'react';
import {
  AgentId,
  BotDifficulty,
  GameMode,
  GameSettings,
  MapId,
  PlayerProfile,
  RoomSummary,
  SkinId,
  TeamSide,
  WeaponId,
} from '../types/game';
import { AGENTS } from '../game/agents';
import { WEAPONS, WEAPON_SKINS } from '../game/weapons';
import { MAPS } from '../game/mapBuilder';
import { RANK_COLORS, applyQualityPreset } from '../game/progression';
import {
  Play,
  Shield,
  Users,
  Crosshair,
  Award,
  Sliders,
  Globe,
  RefreshCw,
  Cpu,
  Layers,
  Zap,
  MapPin,
  CheckCircle2,
  Swords,
} from 'lucide-react';

interface TitleScreenProps {
  selectedAgent: AgentId;
  selectedMode: GameMode;
  selectedMap: MapId;
  playerTeam: TeamSide;
  profile: PlayerProfile;
  settings: GameSettings;
  isMultiplayerConnected: boolean;
  currentRoomId: string;
  onSelectAgent: (agent: AgentId) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (mapId: MapId) => void;
  onSelectTeam: (team: TeamSide) => void;
  onUpdateProfile: (profile: PlayerProfile) => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onJoinMultiplayerRoom: (
    roomId: string,
    mode: GameMode,
    mapId: MapId,
    fillWithBots: boolean
  ) => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
}

type NavTab =
  | 'home'
  | 'singleplayer'
  | 'multiplayer'
  | 'agents'
  | 'weapons'
  | 'collection'
  | 'career'
  | 'training';

const CAMPAIGN_OPERATIONS: {
  id: string;
  code: string;
  title: string;
  mapId: MapId;
  mode: GameMode;
  difficulty: BotDifficulty;
  briefing: string;
  objective: string;
}[] = [
  {
    id: 'op_blackout',
    code: 'OP-01 // SUBTERRANEAN CORE',
    title: 'SECTOR 04: REACTOR CONTAINMENT',
    mapId: 'industrial',
    mode: 'standard',
    difficulty: 'medium',
    briefing:
      'Infiltrate the subterranean reactor bunker, secure the elevated steel catwalks, and detonate or defuse the Radianite Spike beside the twin pressure silos.',
    objective: 'Win 5 Rounds in Sector 04 Reactor Bunker',
  },
  {
    id: 'op_glacier',
    code: 'OP-02 // ARCTIC BLACKBOX',
    title: 'CRYO-GENICS LAB BREACH',
    mapId: 'research',
    mode: 'tdm',
    difficulty: 'medium',
    briefing:
      'Engage hostile strike teams inside the high-tech Arctic research facility. Hold sightlines across the sterile containment chambers.',
    objective: 'Reach 30 Team Eliminations in Research Lab',
  },
  {
    id: 'op_mirage',
    code: 'OP-03 // DUNE CITADEL',
    title: 'OPERATION SCORCHED HORIZON',
    mapId: 'desert',
    mode: 'spikerush',
    difficulty: 'hard',
    briefing:
      'High-intensity close-quarters assault across arid sandstone ruins and forward military supply depots against elite AI operatives.',
    objective: 'Win 3 Rapid Spike Rush Rounds on Hard AI',
  },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedAgent,
  selectedMode,
  selectedMap,
  playerTeam,
  profile,
  settings,
  isMultiplayerConnected,
  currentRoomId,
  onSelectAgent,
  onSelectMode,
  onSelectMap,
  onSelectTeam,
  onUpdateProfile,
  onUpdateSettings,
  onJoinMultiplayerRoom,
  onStartGame,
  onOpenSettings,
}) => {
  const [activeNav, setActiveNav] = useState<NavTab>('home');
  const [inspectedWeapon, setInspectedWeapon] = useState<WeaponId>('vandal');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [customRoomCode, setCustomRoomCode] = useState<string>(currentRoomId || 'GLOBAL-1');
  const [fillWithBots, setFillWithBots] = useState<boolean>(true);
  const [callsignInput, setCallsignInput] = useState<string>(profile.callsign);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('op_blackout');

  const currentAgent = AGENTS[selectedAgent] || AGENTS.jett;
  const currentMap = MAPS[selectedMap] || MAPS.industrial;
  const rankColor = RANK_COLORS[profile.rankTier] || '#facc15';

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setRooms(data.rooms);
        }
      }
    } catch {
      // Fallback if offline
    }
  };

  useEffect(() => {
    fetchRooms();
    const timer = window.setInterval(fetchRooms, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectCampaign = (op: (typeof CAMPAIGN_OPERATIONS)[number]) => {
    setSelectedCampaignId(op.id);
    onSelectMap(op.mapId);
    onSelectMode(op.mode);
    onUpdateSettings({ ...settings, botDifficulty: op.difficulty });
  };

  const totalMatches = profile.wins + profile.losses;
  const winRate = totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 100;
  const kdRatio =
    profile.totalDeaths > 0
      ? (profile.totalKills / profile.totalDeaths).toFixed(2)
      : profile.totalKills.toFixed(2);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between p-4 md:p-6 text-[#ece8e1] font-tech select-none overflow-y-auto pointer-events-none">
      {/* Subtle dark vignette around edges while leaving the live 3D Industrial Reactor Bunker clearly visible in the center */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(circle at 55% 46%, rgba(10,12,16,0.04) 0%, rgba(9,12,18,0.38) 62%, rgba(6,8,12,0.72) 100%)',
        }}
      />

      {/* TOP NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 bg-slate-950/90 px-4 py-2.5 clip-val-card pointer-events-auto shadow-xl">
        {/* Brand Emblem */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center bg-amber-500 clip-val-chamfer shadow-md">
            <svg viewBox="0 0 100 100" className="w-5 h-5 fill-slate-950">
              <polygon points="15,20 48,80 32,80 0,20" />
              <polygon points="85,20 52,80 68,80 100,20" />
            </svg>
          </div>
          <div>
            <div className="font-valorant text-2xl font-bold tracking-widest text-white leading-none">
              RADIANT PROTOCOL
            </div>
            <div className="text-[9px] tracking-widest text-amber-400 font-bold uppercase">
              SECTOR 04 // TACTICAL 3D FPS
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'home', label: 'HOME' },
              { id: 'singleplayer', label: 'SINGLE PLAYER' },
              { id: 'multiplayer', label: 'MULTIPLAYER' },
              { id: 'agents', label: 'AGENTS' },
              { id: 'weapons', label: 'WEAPONS' },
              { id: 'collection', label: 'COLLECTION' },
              { id: 'career', label: 'CAREER' },
              { id: 'training', label: 'TRAINING' },
            ] as { id: NavTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'training') {
                  onSelectMode('range');
                }
                setActiveNav(tab.id);
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeNav === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Quick Potato Mode Toggle, Player Rank Pill & Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextPotato = !settings.potatoMode;
              onUpdateSettings(applyQualityPreset(settings, nextPotato ? 'potato' : 'high'));
            }}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
              settings.potatoMode
                ? 'bg-amber-400 text-slate-950 border-white'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
            }`}
            title="1-Click Potato Mode for Intel UHD 620 & Low-End Devices"
          >
            {settings.potatoMode ? 'POTATO: ON' : 'POTATO MODE'}
          </button>

          <button
            onClick={() => setActiveNav('career')}
            className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1 rounded cursor-pointer hover:border-slate-500"
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: rankColor }}
            />
            <div className="text-left">
              <div className="text-[10px] font-bold text-white leading-none">
                {profile.callsign}
              </div>
              <div className="text-[9px] text-amber-400 font-bold">
                {profile.rankTier.toUpperCase()} · LVL {profile.level}
              </div>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* MAIN STAGE CONTENT PER TAB */}
      <div className="my-auto w-full max-w-7xl mx-auto py-3">
        {/* TAB 1: HOME (ASYMMETRIC LEFT/RIGHT FRAMING OVER LIVE 3D REACTOR BUNKER) */}
        {activeNav === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Left Column: Operation Spotlight & Experience Selector */}
            <div className="lg:col-span-5 flex flex-col gap-3 pointer-events-auto">
              <div className="bg-slate-950/90 border-l-4 border-amber-500 p-4 clip-val-card shadow-2xl">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-amber-400 uppercase mb-1">
                  <span>ACTIVE DEPLOYMENT // {currentMap.codeName}</span>
                  <span>{settings.quality.toUpperCase()} PRESET</span>
                </div>
                <h1 className="font-valorant text-4xl sm:text-5xl font-bold text-white tracking-wider leading-none">
                  {currentMap.name}
                </h1>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {currentMap.description}
                </p>

                {/* Map Quick Switcher */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800">
                  {(Object.keys(MAPS) as MapId[]).map((mId) => {
                    const m = MAPS[mId];
                    const active = selectedMap === mId;
                    return (
                      <button
                        key={mId}
                        onClick={() => onSelectMap(mId)}
                        className={`p-2 rounded border text-left cursor-pointer transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/15 text-white'
                            : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-valorant text-sm font-bold leading-none">
                          {m.name.split(' ')[0]}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                          {m.location}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dual Primary Experience Cards: Single Player vs Multiplayer */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveNav('singleplayer')}
                  className="p-3.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-700 hover:border-amber-400 clip-val-corner text-left cursor-pointer transition-all shadow-xl"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                      OFFLINE / AI
                    </span>
                  </div>
                  <div className="font-valorant text-2xl font-bold text-white tracking-wide">
                    SINGLE PLAYER
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    3 Campaign Ops, Tactical 5v5 Bots & Custom Matches
                  </div>
                </button>

                <button
                  onClick={() => setActiveNav('multiplayer')}
                  className="p-3.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-700 hover:border-cyan-400 clip-val-corner text-left cursor-pointer transition-all shadow-xl"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                      {isMultiplayerConnected ? `ROOM ${currentRoomId}` : 'LIVE WS'}
                    </span>
                  </div>
                  <div className="font-valorant text-2xl font-bold text-white tracking-wide">
                    MULTIPLAYER
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Online Rooms, Squad Comms & Real-Time PvP
                  </div>
                </button>
              </div>
            </div>

            {/* Center 3 columns kept open so the live 3D Agent & Industrial Reactor Bunker shine through */}
            <div className="hidden lg:block lg:col-span-3" />

            {/* Right Column: Active Operative, Mode Selector & Primary Start CTA */}
            <div className="lg:col-span-4 flex flex-col gap-3 pointer-events-auto">
              <div className="bg-slate-950/90 border border-slate-700/90 p-4 clip-val-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      SELECTED OPERATIVE
                    </span>
                    <span className="font-valorant text-3xl font-bold text-white tracking-wider">
                      {currentAgent.name}
                    </span>
                    <span className="ml-2 text-[10px] uppercase px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded">
                      {currentAgent.role}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveNav('agents')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300 rounded cursor-pointer"
                  >
                    SWITCH AGENT (8)
                  </button>
                </div>

                {/* Quick 8-Agent Selector Strip */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {(Object.keys(AGENTS) as AgentId[]).map((aKey) => {
                    const a = AGENTS[aKey];
                    const active = selectedAgent === aKey;
                    return (
                      <button
                        key={aKey}
                        onClick={() => onSelectAgent(aKey)}
                        className={`py-1.5 px-2 rounded border text-center cursor-pointer transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-white font-bold'
                            : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-valorant text-sm tracking-wide leading-none">
                          {a.name}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Game Mode Quick Pills */}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                  COMBAT MODE
                </span>
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {(
                    [
                      { id: 'standard', label: '5v5 DEFUSAL' },
                      { id: 'tdm', label: 'TEAM DM' },
                      { id: 'dm', label: 'FREE-FOR-ALL' },
                      { id: 'spikerush', label: 'SPIKE RUSH' },
                      { id: 'range', label: 'THE RANGE' },
                    ] as { id: GameMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onSelectMode(m.id)}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        selectedMode === m.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Primary Launch Button (data-start="true") */}
                <button
                  data-start="true"
                  onClick={onStartGame}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-valorant text-3xl font-bold tracking-widest clip-val-card transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(245,158,11,0.45)]"
                >
                  <Play className="w-6 h-6 fill-slate-950" />
                  <span>ENTER THE PROTOCOL</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SINGLE PLAYER (CAMPAIGN MISSIONS, BOT DIFFICULTY & CUSTOM MATCH) */}
        {activeNav === 'singleplayer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h2 className="font-valorant text-3xl font-bold text-white tracking-wider">
                    SINGLE PLAYER // TACTICAL OPERATIONS
                  </h2>
                  <p className="text-xs text-slate-400">
                    Deploy solo with full squad AI teammates against adaptive enemy bots—offline or solo.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {CAMPAIGN_OPERATIONS.map((op) => {
                  const isSelected = selectedCampaignId === op.id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => handleSelectCampaign(op)}
                      className={`p-3.5 border rounded text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-400 uppercase mb-0.5">
                        <span>{op.code}</span>
                        <span>AI: {op.difficulty.toUpperCase()}</span>
                      </div>
                      <div className="font-valorant text-2xl font-bold text-white">
                        {op.title}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{op.briefing}</p>
                      <div className="text-[11px] font-bold text-cyan-400 mt-2">
                        OBJECTIVE: {op.objective}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800 p-4 rounded">
              <div className="flex flex-col gap-3">
                <div className="font-valorant text-2xl font-bold text-white border-b border-slate-800 pb-2">
                  CUSTOM SKIRMISH PARAMETERS
                </div>

                {/* Map Selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    SECTOR MAP
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(MAPS) as MapId[]).map((mId) => (
                      <button
                        key={mId}
                        onClick={() => onSelectMap(mId)}
                        className={`py-2 px-2 rounded border text-xs font-bold uppercase cursor-pointer ${
                          selectedMap === mId
                            ? 'border-amber-400 bg-amber-500/20 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {mId}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bot AI Difficulty */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    BOT AI DIFFICULTY
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => onUpdateSettings({ ...settings, botDifficulty: diff })}
                        className={`py-2 rounded border text-xs font-bold uppercase cursor-pointer ${
                          settings.botDifficulty === diff
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team Side */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    STARTING FACTION
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['attackers', 'defenders'] as TeamSide[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => onSelectTeam(t)}
                        className={`py-2 rounded border text-xs font-bold uppercase cursor-pointer ${
                          playerTeam === t
                            ? 'border-red-500 bg-red-500/20 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={onStartGame}
                className="w-full mt-4 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-valorant text-2xl font-bold tracking-widest rounded cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>LAUNCH SOLO OPERATION</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MULTIPLAYER (LIVE SERVER ROOM BROWSER, ROOM CODES & SQUAD LOBBY) */}
        {activeNav === 'multiplayer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h2 className="font-valorant text-3xl font-bold text-white tracking-wider">
                    MULTIPLAYER // ONLINE SECTOR ROOMS
                  </h2>
                  <p className="text-xs text-slate-400">
                    Join an active WebSocket tactical lobby or create a private room code for your squad.
                  </p>
                </div>
                <button
                  onClick={fetchRooms}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>REFRESH</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {rooms.length === 0 ? (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400">
                    Connecting to multiplayer relay... Default lobby <strong className="text-white">GLOBAL-1</strong> is ready.
                  </div>
                ) : (
                  rooms.map((r) => (
                    <div
                      key={r.roomId}
                      className={`flex items-center justify-between p-3 border rounded ${
                        currentRoomId === r.roomId
                          ? 'border-cyan-400 bg-cyan-950/30'
                          : 'border-slate-800 bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="font-valorant text-xl font-bold text-white">
                          ROOM // {r.roomId}
                        </div>
                        <div className="text-[11px] text-slate-400 uppercase">
                          MAP: {r.mapId} · MODE: {r.mode} · BOTS: {r.fillWithBots ? 'ON' : 'OFF'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {r.playerCount} / {r.maxPlayers} ONLINE
                        </span>
                        <button
                          onClick={() => {
                            setCustomRoomCode(r.roomId);
                            onJoinMultiplayerRoom(r.roomId, r.mode, r.mapId, r.fillWithBots);
                          }}
                          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded cursor-pointer"
                        >
                          {currentRoomId === r.roomId ? 'CONNECTED' : 'JOIN'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 border border-slate-800 p-4 rounded">
              <div className="flex flex-col gap-3">
                <div className="font-valorant text-2xl font-bold text-white border-b border-slate-800 pb-2">
                  SQUAD & ROOM CONFIGURATION
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    OPERATIVE CALLSIGN
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={callsignInput}
                      maxLength={18}
                      onChange={(e) => setCallsignInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-bold"
                    />
                    <button
                      onClick={() =>
                        onUpdateProfile({
                          ...profile,
                          callsign: callsignInput.trim() || profile.callsign,
                        })
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 rounded cursor-pointer"
                    >
                      SAVE
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    ROOM CODE (CREATE OR JOIN)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customRoomCode}
                      maxLength={16}
                      onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-cyan-300 font-mono font-bold uppercase"
                    />
                    <button
                      onClick={() =>
                        onJoinMultiplayerRoom(
                          customRoomCode || 'GLOBAL-1',
                          selectedMode,
                          selectedMap,
                          fillWithBots
                        )
                      }
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded cursor-pointer"
                    >
                      SYNC ROOM
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded text-xs">
                  <span className="font-bold text-slate-300">FILL EMPTY SLOTS WITH AI BOTS</span>
                  <button
                    onClick={() => setFillWithBots((b) => !b)}
                    className={`px-3 py-1 rounded font-bold cursor-pointer ${
                      fillWithBots
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {fillWithBots ? 'ENABLED' : 'PVP ONLY'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  onJoinMultiplayerRoom(
                    customRoomCode || 'GLOBAL-1',
                    selectedMode,
                    selectedMap,
                    fillWithBots
                  );
                  onStartGame();
                }}
                className="w-full mt-4 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-valorant text-2xl font-bold tracking-widest rounded cursor-pointer flex items-center justify-center gap-2"
              >
                <Globe className="w-5 h-5" />
                <span>DEPLOY TO ONLINE MATCH</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: AGENTS (ALL 8 PLAYABLE AGENTS & ABILITY DOSSIERS) */}
        {activeNav === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="lg:col-span-5 flex flex-col gap-3">
              <h2 className="font-valorant text-3xl font-bold text-white tracking-wider">
                OPERATIVE ROSTER // 8 AGENTS
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(AGENTS) as AgentId[]).map((aId) => {
                  const a = AGENTS[aId];
                  const active = selectedAgent === aId;
                  return (
                    <button
                      key={aId}
                      onClick={() => onSelectAgent(aId)}
                      className={`p-3 rounded border text-left cursor-pointer transition-all ${
                        active
                          ? 'border-amber-400 bg-amber-500/20'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-valorant text-2xl font-bold text-white">
                          {a.name}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: a.accentColor }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {a.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 border border-slate-800 p-5 rounded">
              <div>
                <div className="flex items-baseline justify-between border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <span className="font-valorant text-4xl font-bold text-white tracking-wider">
                      {currentAgent.name}
                    </span>
                    <span className="ml-3 text-xs font-bold uppercase px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                      {currentAgent.role}
                    </span>
                  </div>
                  <span className="text-xs italic text-slate-400">
                    "{currentAgent.voiceLine}"
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {currentAgent.bio}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['c', 'q', 'e', 'x'] as const).map((key) => {
                    const ab = currentAgent.abilities[key];
                    return (
                      <div
                        key={key}
                        className="p-3 bg-slate-950 border border-slate-800 rounded"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
                          <span>
                            [{key.toUpperCase()}] {ab.name}
                          </span>
                          <span>
                            {ab.isUltimate
                              ? `${ab.ultPointsRequired} ULT PTS`
                              : ab.cost === 0
                              ? 'SIGNATURE'
                              : `$${ab.cost}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">{ab.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={onStartGame}
                className="w-full mt-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-valorant text-2xl font-bold tracking-widest rounded cursor-pointer"
              >
                LOCK IN {currentAgent.name} & DEPLOY
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: WEAPONS (ARMORY BALLISTICS & DAMAGE STATS) */}
        {activeNav === 'weapons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(WEAPONS) as WeaponId[]).map((wId) => {
                const w = WEAPONS[wId];
                const active = inspectedWeapon === wId;
                return (
                  <button
                    key={wId}
                    onClick={() => setInspectedWeapon(wId)}
                    className={`p-3 rounded border text-left cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-valorant text-xl font-bold">{w.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{w.category}</div>
                    <div className="text-xs font-mono text-amber-400 font-bold mt-1">
                      {w.cost === 0 ? 'FREE' : `$${w.cost}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-5 rounded flex flex-col justify-between">
              {(() => {
                const w = WEAPONS[inspectedWeapon];
                return (
                  <div>
                    <div className="flex items-baseline justify-between border-b border-slate-800 pb-3 mb-4">
                      <div>
                        <span className="font-valorant text-4xl font-bold text-white">
                          {w.name}
                        </span>
                        <span className="ml-3 text-xs uppercase text-amber-400 font-bold">
                          {w.category}
                        </span>
                      </div>
                      <span className="font-mono text-xl font-bold text-amber-400">
                        {w.cost === 0 ? 'FREE' : `$${w.cost}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center">
                        <div className="text-[10px] text-slate-400 font-bold">HEAD DAMAGE</div>
                        <div className="font-valorant text-3xl font-bold text-red-400">
                          {w.damage.head}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center">
                        <div className="text-[10px] text-slate-400 font-bold">BODY DAMAGE</div>
                        <div className="font-valorant text-3xl font-bold text-white">
                          {w.damage.body}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center">
                        <div className="text-[10px] text-slate-400 font-bold">LEG DAMAGE</div>
                        <div className="font-valorant text-3xl font-bold text-slate-300">
                          {w.damage.leg}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>FIRE RATE:</span>
                        <span className="font-bold text-white">{w.fireRate} rds/sec</span>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>MAGAZINE:</span>
                        <span className="font-bold text-white">
                          {w.magazineSize} / {w.maxReserve}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>RELOAD SPEED:</span>
                        <span className="font-bold text-white">{w.reloadTime}s</span>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>FIRE MODE:</span>
                        <span className="font-bold text-white">
                          {w.pellets
                            ? `${w.pellets}-PELLET BUCKSHOT`
                            : w.isAutomatic
                            ? 'FULL-AUTO'
                            : 'SEMI-AUTO'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 6: COLLECTION (WEAPON SKINS & FINISHES) */}
        {activeNav === 'collection' && (
          <div className="bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h2 className="font-valorant text-3xl font-bold text-white tracking-wider">
                  WEAPON SKIN COLLECTION // COSMETIC FINISHES
                </h2>
                <p className="text-xs text-slate-400">
                  Select your active weapon finish. Default Tactical Standard uses authentic blued-steel & polymer matching Sector 04.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(Object.keys(WEAPON_SKINS) as SkinId[]).map((sId) => {
                const skin = WEAPON_SKINS[sId];
                const isEquipped = settings.equippedSkin === sId;
                return (
                  <button
                    key={sId}
                    onClick={() => onUpdateSettings({ ...settings, equippedSkin: sId })}
                    className={`p-4 rounded border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isEquipped
                        ? 'border-amber-400 bg-amber-500/15'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-5 h-5 rounded-full border border-white/40"
                          style={{
                            backgroundColor: `#${skin.primaryColor.toString(16).padStart(6, '0')}`,
                          }}
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-white/40"
                          style={{
                            backgroundColor: `#${skin.accentColor.toString(16).padStart(6, '0')}`,
                          }}
                        />
                      </div>
                      <div className="font-valorant text-2xl font-bold text-white">
                        {skin.name}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold">
                      <span className={isEquipped ? 'text-amber-400' : 'text-slate-400'}>
                        {isEquipped ? 'EQUIPPED' : 'CLICK TO EQUIP'}
                      </span>
                      {isEquipped && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: CAREER (COMPETITIVE RANK, MISSIONS & MATCH HISTORY) */}
        {activeNav === 'career' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/95 border border-slate-700 p-5 clip-val-card pointer-events-auto shadow-2xl">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-2 shrink-0"
                  style={{
                    borderColor: rankColor,
                    backgroundColor: 'rgba(15,23,42,0.9)',
                  }}
                >
                  <Award className="w-9 h-9" style={{ color: rankColor }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    COMPETITIVE RATING
                  </div>
                  <div
                    className="font-valorant text-3xl font-bold tracking-wider"
                    style={{ color: rankColor }}
                  >
                    {profile.rankTier.toUpperCase()} — {profile.rankRR} RR
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded overflow-hidden mt-1">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${profile.rankRR}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    ACCOUNT LEVEL {profile.level} ({profile.xp}/1000 XP) · MMR {profile.mmr}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400 font-bold">WIN RATE</div>
                  <div className="font-valorant text-2xl font-bold text-emerald-400">
                    {winRate}%
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400 font-bold">K/D RATIO</div>
                  <div className="font-valorant text-2xl font-bold text-amber-400">
                    {kdRatio}
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400 font-bold">HEADSHOTS</div>
                  <div className="font-valorant text-2xl font-bold text-red-400">
                    {profile.totalHeadshots}
                  </div>
                </div>
              </div>

              {/* Active Daily & Weekly Missions */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded flex flex-col gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase">
                  ACTIVE COMBAT CONTRACTS
                </span>
                {profile.missions.map((m) => (
                  <div key={m.id} className="text-xs">
                    <div className="flex justify-between text-slate-200 font-semibold">
                      <span>{m.title}</span>
                      <span className="font-mono text-amber-400">
                        {m.current}/{m.target} (+{m.xpReward} XP)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden mt-1">
                      <div
                        className="h-full bg-cyan-400"
                        style={{
                          width: `${Math.min(100, (m.current / m.target) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-4 rounded flex flex-col">
              <div className="font-valorant text-2xl font-bold text-white border-b border-slate-800 pb-2 mb-3">
                RECENT MATCH LOG
              </div>
              {profile.history.length === 0 ? (
                <div className="my-auto text-center text-xs text-slate-400 py-12">
                  Complete a match to record your competitive telemetry and RR progression.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {profile.history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-valorant text-lg font-bold px-2 py-0.5 rounded ${
                            item.result === 'VICTORY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {item.result}
                        </span>
                        <div>
                          <div className="font-bold text-white uppercase">
                            {item.mapId} · {item.mode} ({item.agent})
                          </div>
                          <div className="text-[10px] text-slate-400">SCORE: {item.score}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-white font-bold">
                          {item.kills}K / {item.deaths}D ({item.headshots} HS)
                        </div>
                        <div
                          className={
                            item.rrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {item.rrDelta >= 0 ? `+${item.rrDelta}` : item.rrDelta} RR
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: TRAINING (THE RANGE) */}
        {activeNav === 'training' && (
          <div className="max-w-2xl mx-auto bg-slate-950/95 border border-slate-700 p-6 clip-val-card pointer-events-auto text-center shadow-2xl">
            <Crosshair className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h2 className="font-valorant text-4xl font-bold text-white tracking-wider">
              THE RANGE // BALLISTICS & ABILITY LAB
            </h2>
            <p className="text-xs text-slate-300 mt-2 mb-5 leading-relaxed">
              Enter Sector 04 with $9,000 unlimited practice credits, responsive strafing target bots, recoil calibration, and full Agent ability lineups.
            </p>
            <button
              onClick={() => {
                onSelectMode('range');
                onStartGame();
              }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-valorant text-3xl font-bold tracking-widest rounded cursor-pointer"
            >
              ENTER FIRING RANGE NOW
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM SAFE MARGIN: FLAT INLINE CONTROL HINT */}
      <div className="border-t border-slate-800/80 bg-slate-950/85 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400 pointer-events-auto">
        <span>
          WASD Move · Shift Sprint · Space Jump · Ctrl Crouch · LMB Fire · RMB ADS · R Reload · Y Inspect · B Armory · C/Q/E/X Abilities · Tab Scoreboard · Esc Pause
        </span>
        <span className="text-amber-400 font-bold">
          SINGLE PLAYER + ONLINE MULTIPLAYER READY
        </span>
      </div>
    </div>
  );
};
