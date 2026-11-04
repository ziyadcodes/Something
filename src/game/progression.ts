import {
  AgentId,
  CrosshairConfig,
  GameMode,
  GameSettings,
  MapId,
  MatchHistoryItem,
  PlayerProfile,
  RankTier,
} from '../types/game';

const PROFILE_KEY = 'valorant_radiant_profile_v2';
const SETTINGS_KEY = 'valorant_radiant_settings_v3';
const CROSSHAIR_KEY = 'valorant_radiant_crosshair_v2';

export const RANK_LADDER: RankTier[] = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Ascendant',
  'Radiant',
];

export const RANK_COLORS: Record<RankTier, string> = {
  Iron: '#94a3b8',
  Bronze: '#d97706',
  Silver: '#e2e8f0',
  Gold: '#facc15',
  Platinum: '#2dd4bf',
  Diamond: '#c084fc',
  Ascendant: '#10b981',
  Radiant: '#fef08a',
};

export function createDefaultProfile(): PlayerProfile {
  return {
    callsign: `AGENT_${Math.floor(1000 + Math.random() * 9000)}`,
    level: 3,
    xp: 450,
    rankTier: 'Gold',
    rankRR: 45,
    mmr: 1350,
    wins: 4,
    losses: 2,
    totalKills: 48,
    totalDeaths: 29,
    totalHeadshots: 19,
    history: [],
    missions: [
      {
        id: 'daily_kills',
        title: 'Eliminate 15 Opponents in Any Mode',
        target: 15,
        current: 6,
        xpReward: 500,
        type: 'daily',
      },
      {
        id: 'daily_hs',
        title: 'Land 5 Precision Headshots',
        target: 5,
        current: 2,
        xpReward: 400,
        type: 'daily',
      },
      {
        id: 'weekly_matches',
        title: 'Complete 5 Tactical Matches',
        target: 5,
        current: 1,
        xpReward: 1500,
        type: 'weekly',
      },
    ],
  };
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return createDefaultProfile();
    return { ...createDefaultProfile(), ...JSON.parse(raw) };
  } catch {
    return createDefaultProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordMatchCompletion(
  profile: PlayerProfile,
  params: {
    mode: GameMode;
    mapId: MapId;
    agent: AgentId;
    won: boolean;
    score: string;
    kills: number;
    deaths: number;
    headshots: number;
  }
): PlayerProfile {
  const updated: PlayerProfile = {
    ...profile,
    wins: profile.wins + (params.won ? 1 : 0),
    losses: profile.losses + (params.won ? 0 : 1),
    totalKills: profile.totalKills + params.kills,
    totalDeaths: profile.totalDeaths + params.deaths,
    totalHeadshots: profile.totalHeadshots + params.headshots,
  };

  // Calculate RR & MMR delta
  const performanceBonus = Math.min(12, Math.floor(params.kills * 1.5));
  const rrDelta = params.won ? 18 + performanceBonus : -Math.max(8, 18 - performanceBonus);
  updated.mmr = Math.max(400, updated.mmr + rrDelta * 4);

  let newRR = updated.rankRR + rrDelta;
  let tierIdx = RANK_LADDER.indexOf(updated.rankTier);
  if (tierIdx === -1) tierIdx = 3;

  if (newRR >= 100 && tierIdx < RANK_LADDER.length - 1) {
    tierIdx += 1;
    newRR -= 100;
  } else if (newRR < 0 && tierIdx > 0) {
    tierIdx -= 1;
    newRR = 100 + newRR;
  } else {
    newRR = Math.max(0, Math.min(100, newRR));
  }

  updated.rankTier = RANK_LADDER[tierIdx];
  updated.rankRR = newRR;

  // XP & Missions
  let xpGained = (params.won ? 350 : 200) + params.kills * 25 + params.headshots * 15;
  updated.missions = updated.missions.map((m) => {
    let nextCurr = m.current;
    if (m.id === 'daily_kills') nextCurr = Math.min(m.target, m.current + params.kills);
    if (m.id === 'daily_hs') nextCurr = Math.min(m.target, m.current + params.headshots);
    if (m.id === 'weekly_matches') nextCurr = Math.min(m.target, m.current + 1);
    if (nextCurr >= m.target && m.current < m.target) {
      xpGained += m.xpReward;
    }
    return { ...m, current: nextCurr };
  });

  updated.xp += xpGained;
  while (updated.xp >= 1000) {
    updated.xp -= 1000;
    updated.level += 1;
  }

  const entry: MatchHistoryItem = {
    id: `match_${Date.now()}`,
    timestamp: Date.now(),
    mode: params.mode,
    mapId: params.mapId,
    agent: params.agent,
    result: params.won ? 'VICTORY' : 'DEFEAT',
    score: params.score,
    kills: params.kills,
    deaths: params.deaths,
    headshots: params.headshots,
    rrDelta,
  };

  updated.history = [entry, ...updated.history.slice(0, 14)];
  savePlayerProfile(updated);
  return updated;
}

export function detectHardwareProfile(): {
  gpuRenderer: string;
  isSoftwareOrIntegrated: boolean;
  isMobileDevice: boolean;
  recommendedPreset: GameSettings['quality'];
} {
  const isMobileDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 860);
  let gpuRenderer = 'WebGL 2.0 Hardware Device';
  let isSoftwareOrIntegrated = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        gpuRenderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      } else {
        gpuRenderer = String(gl.getParameter(gl.RENDERER));
      }
      isSoftwareOrIntegrated = /SwiftShader|llvmpipe|softpipe|Software|UHD Graphics 6|HD Graphics/i.test(
        gpuRenderer
      );
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Fallback
  }

  const isHighEndDesktop = /RTX|Radeon RX 7|Radeon RX 68|Radeon RX 69|Apple M2 Max|Apple M3|Apple M4/i.test(
    gpuRenderer
  );

  const recommendedPreset: GameSettings['quality'] = isSoftwareOrIntegrated
    ? 'low'
    : isMobileDevice
    ? 'medium'
    : isHighEndDesktop
    ? 'ultra'
    : 'high';

  return {
    gpuRenderer,
    isSoftwareOrIntegrated,
    isMobileDevice,
    recommendedPreset,
  };
}

export function applyQualityPreset(
  current: GameSettings,
  preset: GameSettings['quality']
): GameSettings {
  if (preset === 'potato') {
    return {
      ...current,
      quality: 'potato',
      potatoMode: true,
      resolutionScale: 0.5,
      dynamicResolution: true,
      shadowQuality: 'off',
      textureQuality: 'potato',
      environmentalDetail: false,
      volumetricLighting: false,
      drawDistance: 75,
    };
  }
  if (preset === 'low') {
    return {
      ...current,
      quality: 'low',
      potatoMode: false,
      resolutionScale: 0.85,
      dynamicResolution: true,
      shadowQuality: 'off',
      textureQuality: 'high',
      environmentalDetail: true,
      volumetricLighting: true,
      drawDistance: 135,
    };
  }
  if (preset === 'medium') {
    return {
      ...current,
      quality: 'medium',
      potatoMode: false,
      resolutionScale: 0.9,
      dynamicResolution: false,
      shadowQuality: 'off',
      textureQuality: 'high',
      environmentalDetail: true,
      volumetricLighting: true,
      drawDistance: 150,
    };
  }
  if (preset === 'high') {
    return {
      ...current,
      quality: 'high',
      potatoMode: false,
      resolutionScale: 1.0,
      dynamicResolution: false,
      shadowQuality: 'low',
      textureQuality: 'high',
      environmentalDetail: true,
      volumetricLighting: true,
      drawDistance: 165,
    };
  }
  if (preset === 'ultra') {
    return {
      ...current,
      quality: 'ultra',
      potatoMode: false,
      resolutionScale: 1.1,
      dynamicResolution: false,
      shadowQuality: 'high',
      textureQuality: 'ultra',
      environmentalDetail: true,
      volumetricLighting: true,
      drawDistance: 195,
    };
  }
  // 'extreme' (RTX class)
  return {
    ...current,
    quality: 'extreme',
    potatoMode: false,
    resolutionScale: 1.25,
    dynamicResolution: false,
    shadowQuality: 'ultra',
    textureQuality: 'ultra',
    environmentalDetail: true,
    volumetricLighting: true,
    drawDistance: 220,
  };
}

export function createDefaultSettings(): GameSettings {
  const hw = detectHardwareProfile();
  const base: GameSettings = {
    quality: hw.recommendedPreset,
    potatoMode: false,
    resolutionScale: 1.0,
    dynamicResolution: hw.isSoftwareOrIntegrated || hw.isMobileDevice,
    fpsLimit: 0,
    shadowQuality: 'low',
    textureQuality: 'high',
    environmentalDetail: true,
    volumetricLighting: true,
    drawDistance: 165,
    fov: 78,
    showFps: false,
    controlMode: 'auto',
    botDifficulty: 'medium',
    masterVolume: 0.85,
    sfxVolume: 0.9,
    musicVolume: 0.4,
    sensitivity: 0.0022,
    touchButtonScale: 1.0,
    touchJoystickSens: 1.0,
    equippedSkin: 'tactical',
  };
  return applyQualityPreset(base, hw.recommendedPreset);
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return createDefaultSettings();
    return { ...createDefaultSettings(), ...JSON.parse(raw) };
  } catch {
    return createDefaultSettings();
  }
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage error
  }
}

export function loadCrosshairConfig(): CrosshairConfig {
  const fallback: CrosshairConfig = {
    color: '#00f2fe',
    innerLength: 6,
    innerWidth: 2,
    innerOffset: 3,
    centerDot: false,
    firingError: true,
  };
  try {
    const raw = localStorage.getItem(CROSSHAIR_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveCrosshairConfig(config: CrosshairConfig): void {
  try {
    localStorage.setItem(CROSSHAIR_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage error
  }
}
