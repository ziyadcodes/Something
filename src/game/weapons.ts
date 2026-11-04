import { SkinId, WeaponData, WeaponId, WeaponSkin } from '../types/game';

export const WEAPON_SKINS: Record<SkinId, WeaponSkin> = {
  prime: {
    id: 'prime',
    name: 'PRIME // 2.0',
    primaryColor: 0xf1f5f9,
    secondaryColor: 0x1e293b,
    accentColor: 0xfbbf24,
    glowColor: 0x00f2fe,
    unlockLevel: 1,
  },
  kuronami: {
    id: 'kuronami',
    name: 'KURONAMI // SHADOW',
    primaryColor: 0x1e1b4b,
    secondaryColor: 0x0f172a,
    accentColor: 0x94a3b8,
    glowColor: 0xa855f7,
    unlockLevel: 1,
  },
  elderflame: {
    id: 'elderflame',
    name: 'CRIMSON // EMBER',
    primaryColor: 0x450a0a,
    secondaryColor: 0x18181b,
    accentColor: 0xf59e0b,
    glowColor: 0xff4655,
    unlockLevel: 2,
  },
  rgx: {
    id: 'rgx',
    name: 'RGX 11Z PRO',
    primaryColor: 0x064e3b,
    secondaryColor: 0x090d16,
    accentColor: 0xfacc15,
    glowColor: 0x22c55e,
    unlockLevel: 3,
  },
  tactical: {
    id: 'tactical',
    name: 'PROTOCOL // MATTE SPEC',
    primaryColor: 0x334155,
    secondaryColor: 0x0f172a,
    accentColor: 0x64748b,
    glowColor: 0x38bdf8,
    unlockLevel: 1,
  },
};

export const WEAPONS: Record<WeaponId, WeaponData> = {
  knife: {
    id: 'knife',
    name: 'TACTICAL KNIFE',
    category: 'melee',
    cost: 0,
    magazineSize: 0,
    maxReserve: 0,
    fireRate: 1.8,
    reloadTime: 0,
    damage: { head: 100, body: 50, leg: 42 },
    spread: 0,
    crouchSpreadMult: 1,
    moveSpreadMult: 1,
    recoilPitch: 0,
    recoilYaw: 0,
    recoilRecoveryRate: 10,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1,
  },
  classic: {
    id: 'classic',
    name: 'CLASSIC',
    category: 'sidearm',
    cost: 0,
    magazineSize: 12,
    maxReserve: 36,
    fireRate: 6.75,
    reloadTime: 1.5,
    damage: { head: 78, body: 26, leg: 22 },
    spread: 0.012,
    crouchSpreadMult: 0.65,
    moveSpreadMult: 2.2,
    recoilPitch: 0.022,
    recoilYaw: 0.008,
    recoilRecoveryRate: 4.5,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1,
  },
  ghost: {
    id: 'ghost',
    name: 'GHOST',
    category: 'sidearm',
    cost: 500,
    magazineSize: 15,
    maxReserve: 45,
    fireRate: 6.75,
    reloadTime: 1.5,
    damage: { head: 105, body: 30, leg: 25 },
    spread: 0.008,
    crouchSpreadMult: 0.6,
    moveSpreadMult: 2.0,
    recoilPitch: 0.024,
    recoilYaw: 0.007,
    recoilRecoveryRate: 5.0,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1,
  },
  sheriff: {
    id: 'sheriff',
    name: 'SHERIFF',
    category: 'sidearm',
    cost: 800,
    magazineSize: 6,
    maxReserve: 24,
    fireRate: 4.0,
    reloadTime: 2.25,
    damage: { head: 160, body: 55, leg: 47 },
    spread: 0.006,
    crouchSpreadMult: 0.55,
    moveSpreadMult: 2.8,
    recoilPitch: 0.048,
    recoilYaw: 0.014,
    recoilRecoveryRate: 3.5,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1,
  },
  spectre: {
    id: 'spectre',
    name: 'SPECTRE',
    category: 'smg',
    cost: 1600,
    magazineSize: 30,
    maxReserve: 90,
    fireRate: 13.33,
    reloadTime: 2.25,
    damage: { head: 78, body: 26, leg: 22 },
    spread: 0.014,
    crouchSpreadMult: 0.7,
    moveSpreadMult: 1.6,
    recoilPitch: 0.018,
    recoilYaw: 0.012,
    recoilRecoveryRate: 5.5,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.15,
  },
  judge: {
    id: 'judge',
    name: 'JUDGE SHOTGUN',
    category: 'shotgun',
    cost: 1850,
    magazineSize: 7,
    maxReserve: 28,
    fireRate: 3.2,
    reloadTime: 2.2,
    pellets: 7,
    damage: { head: 34, body: 18, leg: 14 },
    spread: 0.065,
    crouchSpreadMult: 0.8,
    moveSpreadMult: 1.35,
    recoilPitch: 0.045,
    recoilYaw: 0.02,
    recoilRecoveryRate: 4.5,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1,
  },
  phantom: {
    id: 'phantom',
    name: 'PHANTOM',
    category: 'rifle',
    cost: 2900,
    magazineSize: 30,
    maxReserve: 90,
    fireRate: 11.0,
    reloadTime: 2.5,
    damage: { head: 156, body: 39, leg: 33 },
    spread: 0.005,
    crouchSpreadMult: 0.6,
    moveSpreadMult: 3.0,
    recoilPitch: 0.025,
    recoilYaw: 0.014,
    recoilRecoveryRate: 6.0,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.25,
  },
  vandal: {
    id: 'vandal',
    name: 'VANDAL',
    category: 'rifle',
    cost: 2900,
    magazineSize: 30,
    maxReserve: 90,
    fireRate: 9.75,
    reloadTime: 2.5,
    damage: { head: 160, body: 40, leg: 34 },
    spread: 0.004,
    crouchSpreadMult: 0.55,
    moveSpreadMult: 3.2,
    recoilPitch: 0.034,
    recoilYaw: 0.018,
    recoilRecoveryRate: 5.0,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.25,
  },
  odin: {
    id: 'odin',
    name: 'ODIN LMG',
    category: 'machinegun',
    cost: 3200,
    magazineSize: 100,
    maxReserve: 200,
    fireRate: 14.5,
    reloadTime: 4.2,
    damage: { head: 95, body: 38, leg: 32 },
    spread: 0.016,
    crouchSpreadMult: 0.5, // Laser beam when crouched!
    moveSpreadMult: 3.4,
    recoilPitch: 0.02,
    recoilYaw: 0.016,
    recoilRecoveryRate: 5.2,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.2,
  },
  operator: {
    id: 'operator',
    name: 'OPERATOR',
    category: 'sniper',
    cost: 4700,
    magazineSize: 5,
    maxReserve: 15,
    fireRate: 0.75,
    reloadTime: 3.7,
    damage: { head: 255, body: 150, leg: 120 },
    spread: 0.0008,
    crouchSpreadMult: 0.5,
    moveSpreadMult: 8.0,
    recoilPitch: 0.08,
    recoilYaw: 0.02,
    recoilRecoveryRate: 3.0,
    isAutomatic: false,
    hasScope: true,
    scopeZoom: 3.5,
  },
};

export type HitZone = 'head' | 'body' | 'leg';

export function calculateDamage(weaponId: WeaponId, zone: HitZone): number {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return 20;
  return weapon.damage[zone];
}

export function applyDamageToHealthAndShield(
  incomingDamage: number,
  currentHealth: number,
  currentShield: number
): {
  remainingHealth: number;
  remainingShield: number;
  damageDealt: number;
  absorbedByShield: number;
} {
  if (incomingDamage <= 0 || currentHealth <= 0) {
    return {
      remainingHealth: Math.max(0, currentHealth),
      remainingShield: Math.max(0, currentShield),
      damageDealt: 0,
      absorbedByShield: 0,
    };
  }

  let absorbedByShield = 0;
  let remainingShield = currentShield;
  let damageToHealth = incomingDamage;

  if (currentShield > 0) {
    const maxShieldAbsorb = incomingDamage * 0.66;
    absorbedByShield = Math.min(currentShield, maxShieldAbsorb);
    remainingShield = currentShield - absorbedByShield;
    damageToHealth = incomingDamage - absorbedByShield;
  }

  const remainingHealth = Math.max(0, currentHealth - damageToHealth);
  return {
    remainingHealth: Math.round(remainingHealth),
    remainingShield: Math.round(remainingShield),
    damageDealt: incomingDamage,
    absorbedByShield: Math.round(absorbedByShield),
  };
}

export interface WeaponRecoilStep {
  pitchStep: number;
  yawStep: number;
  viewKickZ: number;
  viewKickPitch: number;
}

interface RecoilCurveConfig {
  initialPitch: number;
  burstPitchMult: number;
  plateauShot: number;
  swayStartShot: number;
  swayFrequency: number;
  swayAmplitude: number;
  viewKickZ: number;
  viewKickPitch: number;
}

const WEAPON_RECOIL_CURVES: Record<WeaponId, RecoilCurveConfig> = {
  knife: {
    initialPitch: 0,
    burstPitchMult: 0,
    plateauShot: 1,
    swayStartShot: 1,
    swayFrequency: 0,
    swayAmplitude: 0,
    viewKickZ: 0,
    viewKickPitch: 0,
  },
  classic: {
    initialPitch: 0.018,
    burstPitchMult: 1.15,
    plateauShot: 8,
    swayStartShot: 4,
    swayFrequency: 0.85,
    swayAmplitude: 0.005,
    viewKickZ: 0.036,
    viewKickPitch: 0.055,
  },
  ghost: {
    initialPitch: 0.019,
    burstPitchMult: 1.1,
    plateauShot: 9,
    swayStartShot: 5,
    swayFrequency: 0.75,
    swayAmplitude: 0.004,
    viewKickZ: 0.034,
    viewKickPitch: 0.05,
  },
  sheriff: {
    initialPitch: 0.052,
    burstPitchMult: 1.35,
    plateauShot: 5,
    swayStartShot: 2,
    swayFrequency: 1.2,
    swayAmplitude: 0.009,
    viewKickZ: 0.072,
    viewKickPitch: 0.14,
  },
  spectre: {
    initialPitch: 0.014,
    burstPitchMult: 1.08,
    plateauShot: 11,
    swayStartShot: 5,
    swayFrequency: 0.68,
    swayAmplitude: 0.0095,
    viewKickZ: 0.032,
    viewKickPitch: 0.045,
  },
  judge: {
    initialPitch: 0.044,
    burstPitchMult: 1.22,
    plateauShot: 5,
    swayStartShot: 2,
    swayFrequency: 0.95,
    swayAmplitude: 0.012,
    viewKickZ: 0.068,
    viewKickPitch: 0.11,
  },
  phantom: {
    initialPitch: 0.021,
    burstPitchMult: 1.14,
    plateauShot: 10,
    swayStartShot: 5,
    swayFrequency: 0.58,
    swayAmplitude: 0.0105,
    viewKickZ: 0.044,
    viewKickPitch: 0.062,
  },
  vandal: {
    initialPitch: 0.029,
    burstPitchMult: 1.24,
    plateauShot: 8,
    swayStartShot: 4,
    swayFrequency: 0.62,
    swayAmplitude: 0.0145,
    viewKickZ: 0.056,
    viewKickPitch: 0.082,
  },
  odin: {
    initialPitch: 0.017,
    burstPitchMult: 0.92,
    plateauShot: 14,
    swayStartShot: 6,
    swayFrequency: 0.52,
    swayAmplitude: 0.011,
    viewKickZ: 0.048,
    viewKickPitch: 0.068,
  },
  operator: {
    initialPitch: 0.085,
    burstPitchMult: 1.4,
    plateauShot: 2,
    swayStartShot: 2,
    swayFrequency: 0.9,
    swayAmplitude: 0.012,
    viewKickZ: 0.095,
    viewKickPitch: 0.18,
  },
};

/**
 * Computes a deterministic, learnable recoil step for a given weapon and shot index (1-based).
 * Rewards tap-firing and 3-5 shot bursts while generating a predictable T/S-curve on sustained sprays.
 */
export function sampleWeaponRecoilStep(
  weaponId: WeaponId,
  shotIndex: number,
  isCrouching: boolean,
  isScoped: boolean
): WeaponRecoilStep {
  const curve = WEAPON_RECOIL_CURVES[weaponId] || WEAPON_RECOIL_CURVES.vandal;
  if (weaponId === 'knife') {
    return { pitchStep: 0, yawStep: 0, viewKickZ: 0, viewKickPitch: 0 };
  }

  const s = Math.max(1, shotIndex);
  let stanceMult = 1.0;
  if (isCrouching) {
    stanceMult *= weaponId === 'odin' ? 0.55 : 0.78;
  }
  if (isScoped) {
    stanceMult *= 0.82;
  }

  // Vertical pitch: climbs during initial burst, then plateaus into horizontal T-sway
  let pitchFactor = 1.0;
  if (s === 1) {
    pitchFactor = 0.85;
  } else if (s <= curve.plateauShot) {
    pitchFactor = curve.burstPitchMult;
  } else {
    pitchFactor = 0.28; // Vertical plateau reached (T-top)
  }

  const pitchStep = curve.initialPitch * pitchFactor * stanceMult;

  // Horizontal yaw: near-zero on shots 1..swayStartShot-1, then follows a deterministic sine wave
  let yawStep = 0;
  if (s >= curve.swayStartShot) {
    const swayPhase = (s - curve.swayStartShot + 1) * curve.swayFrequency;
    yawStep = Math.sin(swayPhase) * curve.swayAmplitude * stanceMult;
  } else if (s > 1) {
    // Tiny deterministic pull right on early burst
    yawStep = (s - 1) * 0.0012 * stanceMult;
  }

  return {
    pitchStep,
    yawStep,
    viewKickZ: curve.viewKickZ * stanceMult,
    viewKickPitch: curve.viewKickPitch * stanceMult,
  };
}

export function computeEffectiveSpread(
  weapon: WeaponData,
  isMoving: boolean,
  isCrouching: boolean,
  isScoped: boolean,
  continuousShotsFired: number
): number {
  let spread = weapon.spread;

  if (isScoped && weapon.hasScope) {
    spread *= 0.22;
  } else if (isScoped) {
    spread *= 0.72;
  }

  if (isCrouching) {
    spread *= weapon.crouchSpreadMult;
  }

  if (isMoving) {
    spread *= weapon.moveSpreadMult;
  }

  // Reward precision tap-firing: first shot has zero spray bloom
  const bloomShots = Math.max(0, continuousShotsFired - 1);
  const sprayBloom = Math.min(0.032, bloomShots * 0.0028);
  return spread + sprayBloom;
}

