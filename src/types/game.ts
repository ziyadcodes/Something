export type WeaponId =
  | 'classic'
  | 'ghost'
  | 'sheriff'
  | 'spectre'
  | 'judge'
  | 'phantom'
  | 'vandal'
  | 'odin'
  | 'operator'
  | 'knife';

export type WeaponCategory =
  | 'sidearm'
  | 'smg'
  | 'shotgun'
  | 'rifle'
  | 'sniper'
  | 'machinegun'
  | 'melee';

export type SkinId = 'prime' | 'kuronami' | 'elderflame' | 'rgx' | 'tactical';

export interface WeaponSkin {
  id: SkinId;
  name: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  glowColor: number;
  unlockLevel: number;
}

export interface WeaponData {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  cost: number;
  magazineSize: number;
  maxReserve: number;
  fireRate: number; // rounds per second
  reloadTime: number; // seconds
  pellets?: number; // e.g., 7 pellets for Judge shotgun
  damage: {
    head: number;
    body: number;
    leg: number;
  };
  spread: number; // base spread angle in radians
  firstShotSpread?: number; // pinpoint first-shot accuracy
  crouchSpreadMult: number;
  moveSpreadMult: number;
  strafeSpreadMult?: number; // penalty specifically when strafing laterally
  airborneSpreadPenalty?: number; // penalty when jumping or falling
  landingSpreadPenalty?: number; // penalty immediately upon landing impact
  recoilPitch: number; // upward kick per shot
  recoilYaw: number; // lateral horizontal drift
  recoilRecoveryRate: number; // speed at which crosshair settles back
  recoilAccumulationRate?: number; // multiplier for spray bloom accumulation
  maxContinuousRecoilPitch?: number; // ceiling for upward climb
  maxContinuousRecoilYaw?: number; // ceiling for horizontal sway
  isAutomatic: boolean;
  hasScope: boolean;
  scopeZoom: number; // e.g. 2.5x or 5.0x
}

export type AgentId =
  | 'jett'
  | 'phoenix'
  | 'reyna'
  | 'sova'
  | 'viper'
  | 'omen'
  | 'sage'
  | 'cypher';

export type AgentRole = 'Duelist' | 'Initiator' | 'Controller' | 'Sentinel';

export type AbilityKey = 'c' | 'q' | 'e' | 'x';

export interface AbilityData {
  key: AbilityKey;
  name: string;
  cost: number;
  charges: number;
  maxCharges: number;
  cooldownTimer: number; // remaining cooldown in seconds
  cooldownMax: number;
  isUltimate: boolean;
  ultPointsRequired: number;
  description: string;
  iconName: string;
}

export interface AgentData {
  id: AgentId;
  name: string;
  role: AgentRole;
  bio: string;
  voiceLine: string;
  accentColor: string;
  abilities: Record<AbilityKey, AbilityData>;
}

export type MapId = 'industrial' | 'research' | 'desert';

export interface MapInfo {
  id: MapId;
  name: string;
  codeName: string;
  location: string;
  description: string;
  skyColor: number;
  fogColor: number;
  accentHex: string;
}

export type TeamSide = 'attackers' | 'defenders';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface KillfeedEntry {
  id: string;
  killerName: string;
  killerTeam: TeamSide;
  victimName: string;
  victimTeam: TeamSide;
  weaponId: WeaponId;
  isHeadshot: boolean;
  timestamp: number;
}

export interface DamagePopup {
  id: string;
  amount: number;
  isHeadshot: boolean;
  x: number;
  y: number;
  z: number;
  lifetime: number;
}

export interface CrosshairConfig {
  color: string;
  innerLength: number;
  innerWidth: number;
  innerOffset: number;
  centerDot: boolean;
  firingError: boolean;
}

export type GraphicsQuality = 'potato' | 'low' | 'medium' | 'high' | 'ultra' | 'extreme';

export type ControlMode = 'auto' | 'touch' | 'pc';

export interface GameSettings {
  quality: GraphicsQuality;
  potatoMode: boolean;
  resolutionScale: number; // 0.25 to 1.25
  dynamicResolution: boolean;
  fpsLimit: number; // 0 = unlimited, 30, 45, 60, 90, 120, 144, 240
  shadowQuality: 'off' | 'low' | 'high' | 'ultra';
  textureQuality: 'potato' | 'low' | 'high' | 'ultra';
  environmentalDetail: boolean; // Toggles pipes, catwalk railings, consoles, volumetric cones
  volumetricLighting: boolean;
  drawDistance: number; // 65 to 220
  fov: number; // 70 to 110
  showFps: boolean;
  controlMode: ControlMode;
  botDifficulty: BotDifficulty;
  masterVolume: number; // 0 to 1
  sfxVolume: number; // 0 to 1
  musicVolume: number; // 0 to 1
  sensitivity: number; // mouse/touch sensitivity
  touchButtonScale: number; // 0.8 to 1.4
  touchJoystickSens: number; // 0.5 to 2.0
  equippedSkin: SkinId;
}

export type GameMode = 'standard' | 'tdm' | 'dm' | 'spikerush' | 'range';

export interface RoundStats {
  attackersScore: number;
  defendersScore: number;
  roundNumber: number;
  currentPhase: 'buy' | 'action' | 'roundEnd' | 'matchOver';
  phaseTimeRemaining: number;
  winnerTeam?: TeamSide;
  winReason?:
    | 'elimination'
    | 'spike_detonated'
    | 'spike_defused'
    | 'time_expired'
    | 'score_limit';
}

export interface ScoreboardEntry {
  id: string;
  name: string;
  team: TeamSide;
  agent: AgentId;
  isAlive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  credits: number;
  isPlayer?: boolean;
  isRemote?: boolean;
  ping?: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  team: TeamSide;
  agent: AgentId;
  weapon: WeaponId;
  health: number;
  shield: number;
  isAlive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  kills: number;
  deaths: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderTeam: TeamSide;
  text: string;
  timestamp: number;
}

export interface RoomSummary {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  mode: GameMode;
  mapId: MapId;
  fillWithBots: boolean;
}

export type RankTier =
  | 'Iron'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Ascendant'
  | 'Radiant';

export interface MatchHistoryItem {
  id: string;
  timestamp: number;
  mode: GameMode;
  mapId: MapId;
  agent: AgentId;
  result: 'VICTORY' | 'DEFEAT';
  score: string;
  kills: number;
  deaths: number;
  headshots: number;
  rrDelta: number;
}

export interface MissionProgress {
  id: string;
  title: string;
  target: number;
  current: number;
  xpReward: number;
  type: 'daily' | 'weekly';
}

export interface PlayerProfile {
  callsign: string;
  level: number;
  xp: number;
  rankTier: RankTier;
  rankRR: number; // 0 to 100
  mmr: number;
  wins: number;
  losses: number;
  totalKills: number;
  totalDeaths: number;
  totalHeadshots: number;
  history: MatchHistoryItem[];
  missions: MissionProgress[];
}
