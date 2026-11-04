import { AgentId, WeaponId } from '../types/game';

export const MAX_RIG_ENERGY = 7;

export type RigModuleCategory =
  | 'RECON'
  | 'DEFENCE'
  | 'DECEPTION'
  | 'MOBILITY'
  | 'CONTROL'
  | 'SUPPORT';

export type ActiveModuleId =
  | 'echo_probe'
  | 'aegis'
  | 'mirage'
  | 'vector'
  | 'static_field'
  | 'relay';

export type PassiveModuleId =
  | 'signal_dampener'
  | 'reinforced_systems'
  | 'energy_recovery';

export type ActivationMethod = 'throw_deploy' | 'instant_burst' | 'ground_anchor';

export interface RigModuleDefinition {
  id: ActiveModuleId;
  name: string;
  codeName: string;
  category: RigModuleCategory;
  energyCost: number;
  creditCost: number;
  activationMethod: ActivationMethod;
  cooldown: number; // seconds
  maxCharges: number;
  duration: number; // seconds
  range: number; // meters
  deviceHp: number; // 0 if non-deployable
  description: string;
  gameplayEffect: string;
  counterplay: string;
  visualSpec: string;
  iconName: string;
  accentColor: string;
}

export interface PassiveModuleDefinition {
  id: PassiveModuleId;
  name: string;
  codeName: string;
  description: string;
  balanceConstraint: string;
  reconDurationMultiplier: number; // e.g., 0.55 for Signal Dampener
  reconRadiusMultiplier: number; // e.g., 0.75 for Signal Dampener
  deployableHpMultiplier: number; // e.g., 1.30 for Reinforced Systems
  cooldownRateMultiplier: number; // e.g., 1.18 for Energy Recovery
  iconName: string;
  accentColor: string;
}

export interface OperatorChassisAppearance {
  chassisId: AgentId;
  callsign: string;
  frameClass: string;
  silhouetteDesc: string;
  defaultAccent: string;
}

export interface OperatorRigBuild {
  id: string;
  name: string;
  chassisId: AgentId;
  armorFinish: 'graphite' | 'titanium' | 'cobalt' | 'obsidian';
  visorColor: string;
  activeSlot1: ActiveModuleId;
  activeSlot2: ActiveModuleId;
  passiveSlot: PassiveModuleId;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
}

export interface RigValidationResult {
  valid: boolean;
  totalEnergy: number;
  maxEnergy: number;
  remainingEnergy: number;
  errors: string[];
}

export interface RuntimeModuleSlotState {
  moduleId: ActiveModuleId;
  charges: number;
  maxCharges: number;
  cooldownRemaining: number;
  cooldownMax: number;
  activeDurationRemaining: number;
}

export const OPERATOR_CHASSIS_CATALOG: Record<AgentId, OperatorChassisAppearance> = {
  jett: {
    chassisId: 'jett',
    callsign: 'CHASSIS-01 // KESTREL',
    frameClass: 'LIGHT RECON EXO-FRAME',
    silhouetteDesc: 'Streamlined carbon-weave reconnaissance frame with low-profile shoulderusters.',
    defaultAccent: '#38bdf8',
  },
  phoenix: {
    chassisId: 'phoenix',
    callsign: 'CHASSIS-02 // PYRE',
    frameClass: 'THERMAL ASSAULT RIG',
    silhouetteDesc: 'Insulated ceramic-plated breach chassis with high-visibility tactical visor.',
    defaultAccent: '#f97316',
  },
  reyna: {
    chassisId: 'reyna',
    callsign: 'CHASSIS-03 // VESPER',
    frameClass: 'STEALTH INFILTRATOR',
    silhouetteDesc: 'Angular radar-absorbent composite suit engineered for close-quarters lethality.',
    defaultAccent: '#c084fc',
  },
  sova: {
    chassisId: 'sova',
    callsign: 'CHASSIS-04 // FALCON',
    frameClass: 'LONG-RANGE TELEMETRY',
    silhouetteDesc: 'All-weather ballistic coat with integrated optical rangefinder and shoulder antenna.',
    defaultAccent: '#60a5fa',
  },
  viper: {
    chassisId: 'viper',
    callsign: 'CHASSIS-05 // MIASMA',
    frameClass: 'HAZMAT CONTAINMENT',
    silhouetteDesc: 'Hermetically sealed NBC combat armor with pressurized dorsal filtration pack.',
    defaultAccent: '#10b981',
  },
  omen: {
    chassisId: 'omen',
    callsign: 'CHASSIS-06 // WRAITH',
    frameClass: 'SPEC-OPS PHANTOM',
    silhouetteDesc: 'Hooded ballistic shroud with matte acoustic-damping chest plates.',
    defaultAccent: '#6366f1',
  },
  sage: {
    chassisId: 'sage',
    callsign: 'CHASSIS-07 // AEGIS',
    frameClass: 'FORTIFICATION ENGINEER',
    silhouetteDesc: 'Heavy articulated bastion armor with modular hardpoints for field generators.',
    defaultAccent: '#2dd4bf',
  },
  cypher: {
    chassisId: 'cypher',
    callsign: 'CHASSIS-08 // CIPHER-9',
    frameClass: 'NETWORK SURVEILLANCE',
    silhouetteDesc: 'Multi-spectrum neural visor chassis with encrypted comms array.',
    defaultAccent: '#f59e0b',
  },
};

export const ACTIVE_MODULES: Record<ActiveModuleId, RigModuleDefinition> = {
  echo_probe: {
    id: 'echo_probe',
    name: 'ECHO PROBE',
    codeName: 'RCN-01 // SONAR PULSE',
    category: 'RECON',
    energyCost: 3,
    creditCost: 200,
    activationMethod: 'throw_deploy',
    cooldown: 16,
    maxCharges: 2,
    duration: 5.5,
    range: 24,
    deviceHp: 80,
    description:
      'Deploy a destructible acoustic scanning node that emits two temporary detection pulses, briefly highlighting non-occluded hostiles within 24m.',
    gameplayEffect: 'Reveals nearby enemies for 3.5s per pulse and warns affected opponents.',
    counterplay:
      'Emits a visible cyan sonar ring and directional audio ping; node has 80 HP and can be shot to cancel the scan.',
    visualSpec: 'Compact tripod transponder with expanding cyan ground wave.',
    iconName: 'Radio',
    accentColor: '#38bdf8',
  },
  aegis: {
    id: 'aegis',
    name: 'AEGIS',
    codeName: 'DEF-04 // HARD-LIGHT BARRIER',
    category: 'DEFENCE',
    energyCost: 4,
    creditCost: 300,
    activationMethod: 'ground_anchor',
    cooldown: 22,
    maxCharges: 1,
    duration: 18.0,
    range: 4.0,
    deviceHp: 400,
    description:
      'Project a 4-segment ballistic energy barrier anchored in front of the operator. Blocks incoming gunfire and movement until destroyed or expired.',
    gameplayEffect: '4 independent 400 HP destructible barrier panels with real AABB collision.',
    counterplay:
      'Panels display real-time fracture tinting as they absorb weapon damage and shatter at 0 HP.',
    visualSpec: 'Segmented teal-cyan hard-light ballistic wall with metallic emitter base.',
    iconName: 'Shield',
    accentColor: '#2dd4bf',
  },
  mirage: {
    id: 'mirage',
    name: 'MIRAGE',
    codeName: 'DEC-02 // HOLO-DECOY',
    category: 'DECEPTION',
    energyCost: 2,
    creditCost: 150,
    activationMethod: 'throw_deploy',
    cooldown: 14,
    maxCharges: 2,
    duration: 7.5,
    range: 18,
    deviceHp: 65,
    description:
      'Project a mobile holographic operator decoy that sprints forward along your aim vector, drawing enemy gunfire and briefly pinging anyone who shoots it.',
    gameplayEffect: 'Spawns an animated moving decoy (65 HP) that cannot deal damage.',
    counterplay:
      'Subtle holographic scanline flicker and electronic hum distinguish it from a real operator; shatters into digital sparks when shot.',
    visualSpec: 'Full-scale operator hologram with subtle cyan scanline shimmer.',
    iconName: 'Ghost',
    accentColor: '#a855f7',
  },
  vector: {
    id: 'vector',
    name: 'VECTOR',
    codeName: 'MOB-05 // THRUST BURST',
    category: 'MOBILITY',
    energyCost: 4,
    creditCost: 250,
    activationMethod: 'instant_burst',
    cooldown: 14,
    maxCharges: 1,
    duration: 0.85,
    range: 9.5,
    deviceHp: 0,
    description:
      'Fire micro-thrusters to execute a rapid directional movement burst along your current input vector while respecting full environmental collision.',
    gameplayEffect: 'Instant horizontal impulse integrated into the existing physics controller.',
    counterplay:
      'Audible turbine discharge and brief 0.22s weapon ready-recovery window after dashing.',
    visualSpec: 'First-person FOV surge and kinetic slipstream trail.',
    iconName: 'Wind',
    accentColor: '#00f2fe',
  },
  static_field: {
    id: 'static_field',
    name: 'STATIC FIELD',
    codeName: 'CTL-03 // EMP DISRUPTOR',
    category: 'CONTROL',
    energyCost: 3,
    creditCost: 200,
    activationMethod: 'throw_deploy',
    cooldown: 17,
    maxCharges: 2,
    duration: 7.0,
    range: 4.2,
    deviceHp: 90,
    description:
      'Deploy a localized electromagnetic containment emitter that slows enemy movement by 45% inside its 4.2m radius and disables hostile deployable devices.',
    gameplayEffect: 'Slows enemies inside zone and damages/disrupts enemy probes & decoys.',
    counterplay:
      'Clearly demarcated perimeter ring; central emitter pylon (90 HP) can be destroyed to terminate the field early.',
    visualSpec: 'Low-profile graphite emitter projecting a pulsing cobalt-blue electromagnetic grid.',
    iconName: 'Zap',
    accentColor: '#60a5fa',
  },
  relay: {
    id: 'relay',
    name: 'RELAY',
    codeName: 'SUP-06 // TACTICAL UPLINK',
    category: 'SUPPORT',
    energyCost: 2,
    creditCost: 150,
    activationMethod: 'ground_anchor',
    cooldown: 15,
    maxCharges: 2,
    duration: 12.0,
    range: 16.0,
    deviceHp: 100,
    description:
      'Anchor a squad telemetry relay that links nearby teammates within 16m, sharing live minimap threat data and granting +20 overshield regeneration.',
    gameplayEffect: 'Restores +20 Shield to operator/allies in range and shares local threat telemetry.',
    counterplay:
      'Visible uplink antenna with soft directional pulse; only allies within 16m receive telemetry.',
    visualSpec: 'Armored communications mast with rotating telemetry dish.',
    iconName: 'Target',
    accentColor: '#34d399',
  },
};

export const PASSIVE_MODULES: Record<PassiveModuleId, PassiveModuleDefinition> = {
  signal_dampener: {
    id: 'signal_dampener',
    name: 'SIGNAL DAMPENER',
    codeName: 'PAS-01 // LOW-OBSERVABLE COATING',
    description:
      'Reduces enemy Echo Probe and recon detection duration on your operator by 45% and shrinks hostile sensor lock range by 25%.',
    balanceConstraint: 'Does not grant invisibility to direct line-of-sight or completely immunity to initial ping.',
    reconDurationMultiplier: 0.55,
    reconRadiusMultiplier: 0.75,
    deployableHpMultiplier: 1.0,
    cooldownRateMultiplier: 1.0,
    iconName: 'Eye',
    accentColor: '#38bdf8',
  },
  reinforced_systems: {
    id: 'reinforced_systems',
    name: 'REINFORCED SYSTEMS',
    codeName: 'PAS-02 // HARDENED COMPOSITE',
    description:
      'Increases structural integrity of all deployed Rig devices (Aegis barriers, Echo Probes, Static Emitters, Relays, and Mirages) by +30%.',
    balanceConstraint: 'Applies strictly to deployed equipment health (e.g. Aegis 400 -> 520 HP), never player health.',
    reconDurationMultiplier: 1.0,
    reconRadiusMultiplier: 1.0,
    deployableHpMultiplier: 1.3,
    cooldownRateMultiplier: 1.0,
    iconName: 'Shield',
    accentColor: '#2dd4bf',
  },
  energy_recovery: {
    id: 'energy_recovery',
    name: 'ENERGY RECOVERY',
    codeName: 'PAS-03 // CAPACITOR FLUX',
    description:
      'Optimizes Rig capacitor cycling, accelerating active module cooldown recovery speed by +18%.',
    balanceConstraint: 'Capped at +18% cooldown recovery rate; never exceeds max charge limits.',
    reconDurationMultiplier: 1.0,
    reconRadiusMultiplier: 1.0,
    deployableHpMultiplier: 1.0,
    cooldownRateMultiplier: 1.18,
    iconName: 'Zap',
    accentColor: '#60a5fa',
  },
};

export function calculateRigEnergy(slot1: ActiveModuleId, slot2: ActiveModuleId): number {
  const m1 = ACTIVE_MODULES[slot1];
  const m2 = ACTIVE_MODULES[slot2];
  return (m1 ? m1.energyCost : 0) + (m2 ? m2.energyCost : 0);
}

export function validateRigBuild(build: Partial<OperatorRigBuild>): RigValidationResult {
  const errors: string[] = [];

  const slot1 = build.activeSlot1;
  const slot2 = build.activeSlot2;
  const passive = build.passiveSlot;

  if (!slot1 || !ACTIVE_MODULES[slot1]) {
    errors.push('Active Slot 1 must have a valid Rig module equipped.');
  }
  if (!slot2 || !ACTIVE_MODULES[slot2]) {
    errors.push('Active Slot 2 must have a valid Rig module equipped.');
  }
  if (slot1 && slot2 && slot1 === slot2) {
    errors.push('Active Slot 1 and Active Slot 2 cannot equip duplicate modules.');
  }
  if (!passive || !PASSIVE_MODULES[passive]) {
    errors.push('Passive Slot must have a valid Passive modification equipped.');
  }

  const totalEnergy =
    slot1 && slot2 && ACTIVE_MODULES[slot1] && ACTIVE_MODULES[slot2]
      ? calculateRigEnergy(slot1, slot2)
      : 0;

  if (totalEnergy > MAX_RIG_ENERGY) {
    errors.push(
      `Rig Energy Overload: ${totalEnergy}/${MAX_RIG_ENERGY} pts (${
        ACTIVE_MODULES[slot1!]?.name
      } [${ACTIVE_MODULES[slot1!]?.energyCost}] + ${ACTIVE_MODULES[slot2!]?.name} [${
        ACTIVE_MODULES[slot2!]?.energyCost
      }] exceeds 7 capacity).`
    );
  }

  return {
    valid: errors.length === 0,
    totalEnergy,
    maxEnergy: MAX_RIG_ENERGY,
    remainingEnergy: Math.max(0, MAX_RIG_ENERGY - totalEnergy),
    errors,
  };
}

export function canEquipModuleInSlot(
  currentBuild: OperatorRigBuild,
  targetSlot: 1 | 2,
  candidateId: ActiveModuleId
): { allowed: boolean; projectedEnergy: number; reason?: string } {
  const otherSlotId = targetSlot === 1 ? currentBuild.activeSlot2 : currentBuild.activeSlot1;
  if (candidateId === otherSlotId) {
    return {
      allowed: false,
      projectedEnergy: calculateRigEnergy(currentBuild.activeSlot1, currentBuild.activeSlot2),
      reason: `${ACTIVE_MODULES[candidateId].name} is already installed in Slot ${
        targetSlot === 1 ? 2 : 1
      }.`,
    };
  }

  const projectedEnergy =
    targetSlot === 1
      ? calculateRigEnergy(candidateId, currentBuild.activeSlot2)
      : calculateRigEnergy(currentBuild.activeSlot1, candidateId);

  if (projectedEnergy > MAX_RIG_ENERGY) {
    return {
      allowed: false,
      projectedEnergy,
      reason: `Exceeds ${MAX_RIG_ENERGY} Rig Energy capacity (${projectedEnergy}/${MAX_RIG_ENERGY}). Reduce the other slot's cost first.`,
    };
  }

  return { allowed: true, projectedEnergy };
}

export const DEFAULT_RIG_PRESETS: OperatorRigBuild[] = [
  {
    id: 'preset_breach',
    name: 'VANGUARD BREACHER',
    chassisId: 'jett',
    armorFinish: 'graphite',
    visorColor: '#38bdf8',
    activeSlot1: 'vector', // 4 Energy
    activeSlot2: 'echo_probe', // 3 Energy (Total 7/7)
    passiveSlot: 'energy_recovery',
    primaryWeapon: 'vandal',
    secondaryWeapon: 'classic',
  },
  {
    id: 'preset_bastion',
    name: 'CITADEL SENTINEL',
    chassisId: 'sage',
    armorFinish: 'titanium',
    visorColor: '#2dd4bf',
    activeSlot1: 'aegis', // 4 Energy
    activeSlot2: 'static_field', // 3 Energy (Total 7/7)
    passiveSlot: 'reinforced_systems',
    primaryWeapon: 'phantom',
    secondaryWeapon: 'ghost',
  },
  {
    id: 'preset_phantom',
    name: 'GHOST INFILTRATOR',
    chassisId: 'omen',
    armorFinish: 'obsidian',
    visorColor: '#a855f7',
    activeSlot1: 'vector', // 4 Energy
    activeSlot2: 'mirage', // 2 Energy (Total 6/7)
    passiveSlot: 'signal_dampener',
    primaryWeapon: 'phantom',
    secondaryWeapon: 'sheriff',
  },
  {
    id: 'preset_overwatch',
    name: 'TACTICAL OVERWATCH',
    chassisId: 'sova',
    armorFinish: 'cobalt',
    visorColor: '#60a5fa',
    activeSlot1: 'echo_probe', // 3 Energy
    activeSlot2: 'relay', // 2 Energy (Total 5/7)
    passiveSlot: 'energy_recovery',
    primaryWeapon: 'operator',
    secondaryWeapon: 'ghost',
  },
];

const RIG_STORAGE_KEY = 'radiant_rig_workshop_v1';

export interface SavedRigWorkshopState {
  activeBuild: OperatorRigBuild;
  savedPresets: OperatorRigBuild[];
}

export function loadSavedRigState(): SavedRigWorkshopState {
  try {
    const raw = localStorage.getItem(RIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedRigWorkshopState;
      if (parsed && parsed.activeBuild && validateRigBuild(parsed.activeBuild).valid) {
        return {
          activeBuild: parsed.activeBuild,
          savedPresets:
            Array.isArray(parsed.savedPresets) && parsed.savedPresets.length > 0
              ? parsed.savedPresets
              : DEFAULT_RIG_PRESETS,
        };
      }
    }
  } catch {
    // Fallback to default
  }
  return {
    activeBuild: { ...DEFAULT_RIG_PRESETS[0] },
    savedPresets: [...DEFAULT_RIG_PRESETS],
  };
}

export function saveRigState(state: SavedRigWorkshopState): void {
  try {
    localStorage.setItem(RIG_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Generates a valid, role-appropriate modular Rig configuration for AI Bots.
 */
export function generateBotRigBuild(
  archetype: 'rusher' | 'anchor' | 'flanker',
  chassisId: AgentId,
  weapon: WeaponId
): OperatorRigBuild {
  if (archetype === 'rusher') {
    return {
      id: `bot_rig_${chassisId}_rusher`,
      name: 'AI BREACH RIG',
      chassisId,
      armorFinish: 'graphite',
      visorColor: '#38bdf8',
      activeSlot1: 'vector', // 4
      activeSlot2: 'mirage', // 2 (6/7)
      passiveSlot: 'energy_recovery',
      primaryWeapon: weapon,
      secondaryWeapon: 'classic',
    };
  }
  if (archetype === 'anchor') {
    return {
      id: `bot_rig_${chassisId}_anchor`,
      name: 'AI BASTION RIG',
      chassisId,
      armorFinish: 'titanium',
      visorColor: '#2dd4bf',
      activeSlot1: 'aegis', // 4
      activeSlot2: 'static_field', // 3 (7/7)
      passiveSlot: 'reinforced_systems',
      primaryWeapon: weapon,
      secondaryWeapon: 'classic',
    };
  }
  return {
    id: `bot_rig_${chassisId}_flanker`,
    name: 'AI RECON RIG',
    chassisId,
    armorFinish: 'obsidian',
    visorColor: '#60a5fa',
    activeSlot1: 'echo_probe', // 3
    activeSlot2: 'relay', // 2 (5/7)
    passiveSlot: 'signal_dampener',
    primaryWeapon: weapon,
    secondaryWeapon: 'ghost',
  };
}
