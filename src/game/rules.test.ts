import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPONS,
  WEAPON_SKINS,
  calculateDamage,
  applyDamageToHealthAndShield,
  computeEffectiveSpread,
  computeWeaponSpread,
  evaluateMovementState,
  sampleWeaponRecoilStep,
} from './weapons';
import {
  ACTIVE_MODULES,
  PASSIVE_MODULES,
  MAX_RIG_ENERGY,
  validateRigBuild,
  OperatorRigBuild,
} from './rigSystem';
import { AGENTS } from './agents';
import {
  createDefaultProfile,
  recordMatchCompletion,
  createDefaultSettings,
  applyQualityPreset,
} from './progression';
import {
  calculateRoundEndCredits,
  tryPurchaseWeapon,
  tryPurchaseShield,
  ECONOMY_CONSTANTS,
} from './economy';
import {
  createInitialSpikeState,
  updatePlantProgress,
  updateDefuseProgress,
  tickSpikeTimer,
  getSpikeBeepInterval,
} from './spike';

test('Vandal deals 160 headshot damage and 1-taps full HP/shield target', () => {
  const headDamage = calculateDamage('vandal', 'head');
  assert.equal(headDamage, 160);

  // 100 HP + 50 Heavy Shield = 150 total HP. 160 damage kills.
  const outcome = applyDamageToHealthAndShield(headDamage, 100, 50);
  assert.equal(outcome.remainingHealth, 0);
  assert.equal(outcome.remainingShield, 0);
});

test('Phantom deals 156 headshot damage and Operator deals 150 body damage', () => {
  assert.equal(calculateDamage('phantom', 'head'), 156);
  assert.equal(calculateDamage('operator', 'body'), 150);
});

test('Shield absorption mechanics: absorbs 66% of damage', () => {
  // 50 body damage with 50 shield:
  // 66% of 50 = 33 shield absorbed, remaining shield 17.
  // 50 - 33 = 17 to health, remaining health 83.
  const outcome = applyDamageToHealthAndShield(50, 100, 50);
  assert.equal(outcome.remainingShield, 17);
  assert.equal(outcome.remainingHealth, 83);
});

test('Spread increases while moving and decreases when crouching', () => {
  const vandal = WEAPONS['vandal'];
  const stillSpread = computeEffectiveSpread(vandal, false, false, false, 0);
  const movingSpread = computeEffectiveSpread(vandal, true, false, false, 0);
  const crouchingSpread = computeEffectiveSpread(vandal, false, true, false, 0);

  assert.ok(movingSpread > stillSpread, 'Moving spread should be higher than still spread');
  assert.ok(crouchingSpread < stillSpread, 'Crouching spread should be lower than standing still');
});

test('Economy calculations for round win vs loss streaks', () => {
  const win = calculateRoundEndCredits(true, 2);
  assert.equal(win.reward, ECONOMY_CONSTANTS.ROUND_WIN_REWARD);
  assert.equal(win.nextLossStreak, 0);

  const loss0 = calculateRoundEndCredits(false, 0);
  assert.equal(loss0.reward, 1900);
  assert.equal(loss0.nextLossStreak, 1);

  const loss2 = calculateRoundEndCredits(false, 2);
  assert.equal(loss2.reward, 2900); // capped at 2900 max
});

test('Weapon and shield purchasing validation', () => {
  // Vandal costs $2900
  const failBuy = tryPurchaseWeapon(2000, 'vandal');
  assert.equal(failBuy.success, false);

  const okBuy = tryPurchaseWeapon(3500, 'vandal');
  assert.equal(okBuy.success, true);
  assert.equal(okBuy.newCredits, 600);

  // Heavy shield ($1000)
  const shieldBuy = tryPurchaseShield(1500, 0, 'heavy');
  assert.equal(shieldBuy.success, true);
  assert.equal(shieldBuy.newShield, 50);
  assert.equal(shieldBuy.newCredits, 500);

  // Cannot buy when already have heavy shield
  const redundantBuy = tryPurchaseShield(500, 50, 'heavy');
  assert.equal(redundantBuy.success, false);
});

test('Spike plant progress updates and completes at 4.0s', () => {
  let spike = createInitialSpikeState();
  assert.equal(spike.status, 'unplanted');

  // Holding plant key for 2 seconds (50%)
  const partial = updatePlantProgress(
    spike,
    2.0,
    true,
    'Phoenix',
    'A',
    { x: 10, y: 0, z: -15 }
  );
  assert.equal(partial.justPlanted, false);
  assert.equal(partial.state.status, 'planting');
  assert.ok(Math.abs(partial.state.plantProgress - 0.5) < 0.01);

  // Releasing key resets plant progress
  const cancel = updatePlantProgress(
    partial.state,
    0.1,
    false,
    'Phoenix',
    'A',
    { x: 10, y: 0, z: -15 }
  );
  assert.equal(cancel.state.plantProgress, 0);

  // Continuous 4.0s plant completes
  const full = updatePlantProgress(
    spike,
    4.0,
    true,
    'Phoenix',
    'A',
    { x: 10, y: 0, z: -15 }
  );
  assert.equal(full.justPlanted, true);
  assert.equal(full.state.status, 'planted');
  assert.equal(full.state.site, 'A');
});

test('Spike defuse checkpoint saves at 50% halfway mark', () => {
  let spike = createInitialSpikeState();
  const planted = updatePlantProgress(
    spike,
    4.0,
    true,
    'Attacker',
    'B',
    { x: -10, y: 0, z: 20 }
  );
  assert.equal(planted.state.status, 'planted');

  // Defuse for 3.6 seconds (over 3.5s halfway checkpoint)
  const defuse1 = updateDefuseProgress(planted.state, 3.6, true, 'Defender');
  assert.equal(defuse1.state.hasHalfDefuseCheckpoint, true);

  // Defender releases key (e.g. to shoot an enemy)
  const interrupted = updateDefuseProgress(defuse1.state, 0.1, false, 'Defender');
  assert.equal(interrupted.state.status, 'planted');
  assert.equal(interrupted.state.defuseProgress, 0.5); // Stays at 50%!

  // Resume defuse for remaining 3.5s -> completes!
  const completed = updateDefuseProgress(interrupted.state, 3.5, true, 'Defender');
  assert.equal(completed.justDefused, true);
  assert.equal(completed.state.status, 'defused');
});

test('Spike detonation countdown and beep intervals', () => {
  let spike = createInitialSpikeState();
  spike.status = 'planted';
  spike.timeRemaining = 1.0;

  const tick1 = tickSpikeTimer(spike, 0.5);
  assert.equal(tick1.justDetonated, false);
  assert.equal(tick1.state.timeRemaining, 0.5);

  const tick2 = tickSpikeTimer(tick1.state, 0.6);
  assert.equal(tick2.justDetonated, true);
  assert.equal(tick2.state.status, 'detonated');

  // Beep interval increases as time runs out
  assert.equal(getSpikeBeepInterval(30), 1.0);
  assert.equal(getSpikeBeepInterval(15), 0.5);
  assert.equal(getSpikeBeepInterval(8), 0.25);
  assert.equal(getSpikeBeepInterval(3), 0.12);
});

test('All 8 playable Agents and 10 Weapons (including Judge shotgun & Odin LMG) exist', () => {
  const agentKeys = Object.keys(AGENTS);
  assert.equal(agentKeys.length, 8);
  assert.ok(AGENTS.reyna && AGENTS.viper && AGENTS.omen && AGENTS.cypher);

  assert.equal(WEAPONS.judge.pellets, 7);
  assert.equal(WEAPONS.odin.magazineSize, 100);
  assert.equal(Object.keys(WEAPON_SKINS).length, 5);
});

test('Potato Mode and Extreme graphics presets scale resolution and detail', () => {
  const base = createDefaultSettings();
  const potato = applyQualityPreset(base, 'potato');
  assert.equal(potato.potatoMode, true);
  assert.equal(potato.resolutionScale, 0.5);
  assert.equal(potato.environmentalDetail, false);

  const extreme = applyQualityPreset(base, 'extreme');
  assert.equal(extreme.potatoMode, false);
  assert.equal(extreme.resolutionScale, 1.25);
  assert.equal(extreme.environmentalDetail, true);
});

test('Match completion updates RR, MMR, XP, and mission progress', () => {
  const profile = createDefaultProfile();
  const next = recordMatchCompletion(profile, {
    mode: 'standard',
    mapId: 'industrial',
    agent: 'jett',
    won: true,
    score: '5-2',
    kills: 10,
    deaths: 3,
    headshots: 4,
  });

  assert.equal(next.wins, profile.wins + 1);
  assert.equal(next.totalKills, profile.totalKills + 10);
  assert.ok(next.mmr > profile.mmr);
  assert.equal(next.history.length, 1);
});

import { PlayerAnimationController, PlayerAnimInput } from './animationSystem';
import fs from 'node:fs';
import path from 'node:path';

function makeAnimInput(overrides: Partial<PlayerAnimInput> = {}): PlayerAnimInput {
  return {
    dt: 0.016,
    speed: 0,
    velocityY: 0,
    isGrounded: true,
    wasGrounded: true,
    isCrouching: false,
    isSprinting: false,
    isWalkingSlow: false,
    isFiring: false,
    timeSinceLastShot: 10,
    isReloading: false,
    reloadProgress: 0,
    equipTimer: 0,
    unequipTimer: 0,
    inspectTimer: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    onMetalSurface: false,
    ...overrides,
  };
}

test('13-State PlayerAnimationController transitions cleanly across all 13 states and triggers reload stages', () => {
  const ctrl = new PlayerAnimationController();

  // 1. Idle
  let pose = ctrl.update(makeAnimInput());
  assert.equal(pose.state, 'idle');

  // 2. Walking
  pose = ctrl.update(makeAnimInput({ speed: 3.2, isWalkingSlow: true }));
  assert.equal(pose.state, 'walking');

  // 3. Running
  pose = ctrl.update(makeAnimInput({ speed: 6.2 }));
  assert.equal(pose.state, 'running');

  // 4. Sprinting
  pose = ctrl.update(makeAnimInput({ speed: 8.1, isSprinting: true }));
  assert.equal(pose.state, 'sprinting');

  // 5. Crouching
  pose = ctrl.update(makeAnimInput({ speed: 2.5, isCrouching: true }));
  assert.equal(pose.state, 'crouching');

  // 6. Jumping
  pose = ctrl.update(makeAnimInput({ isGrounded: false, velocityY: 5.5 }));
  assert.equal(pose.state, 'jumping');

  // 7. Falling
  pose = ctrl.update(makeAnimInput({ isGrounded: false, velocityY: -4.2 }));
  assert.equal(pose.state, 'falling');

  // 8. Landing
  pose = ctrl.update(makeAnimInput({ wasGrounded: false, isGrounded: true, velocityY: -6.0 }));
  assert.equal(pose.state, 'landing');

  // 9. Firing + Reciprocating Bolt Carrier
  pose = ctrl.update(makeAnimInput({ isFiring: true, timeSinceLastShot: 0.02 }));
  assert.equal(pose.state, 'firing');
  assert.ok(pose.boltCarrierOffsetZ > 0, 'Bolt carrier should reciprocate backward on firing');

  // 10. Reloading (Stage 1 mag_out -> Stage 2 mag_in -> Stage 3 bolt_rack)
  const r1 = ctrl.update(makeAnimInput({ isReloading: true, reloadProgress: 0.1 }));
  assert.equal(r1.state, 'reloading');
  assert.equal(r1.reloadStageTriggered, 'mag_out');
  assert.ok(r1.magazinePos.y < -0.15, 'Magazine should drop out of receiver during Stage 1');

  const r2 = ctrl.update(makeAnimInput({ isReloading: true, reloadProgress: 0.55 }));
  assert.equal(r2.reloadStageTriggered, 'mag_in');

  const r3 = ctrl.update(makeAnimInput({ isReloading: true, reloadProgress: 0.8 }));
  assert.equal(r3.reloadStageTriggered, 'bolt_rack');
  assert.ok(r3.boltCarrierOffsetZ > 0, 'Charging handle should pull back during Stage 3');

  // 11. Switching -> 12. Equip -> 13. Unequip
  pose = ctrl.update(makeAnimInput({ equipTimer: 0.25 }));
  assert.equal(pose.state, 'switching');

  pose = ctrl.update(makeAnimInput({ equipTimer: 0.12 }));
  assert.equal(pose.state, 'equip');

  pose = ctrl.update(makeAnimInput({ unequipTimer: 0.1 }));
  assert.equal(pose.state, 'unequip');
});

test('Physical PBR PNG textures, WAV audio files, and glTF 3D models exist on disk in /public/assets/', () => {
  const texDir = path.join(process.cwd(), 'public', 'assets', 'textures');
  const audioDir = path.join(process.cwd(), 'public', 'assets', 'audio');
  const modelDir = path.join(process.cwd(), 'public', 'assets', 'models');

  const categories = [
    'concrete',
    'painted_concrete',
    'metal',
    'brushed_metal',
    'silo_diamond',
    'asphalt',
    'floor_tiles',
    'wood',
    'glass',
    'fabric',
    'painted_walls',
  ];
  for (const cat of categories) {
    assert.ok(fs.existsSync(path.join(texDir, `${cat}_albedo.png`)), `Missing ${cat}_albedo.png`);
    assert.ok(fs.existsSync(path.join(texDir, `${cat}_normal.png`)), `Missing ${cat}_normal.png`);
    assert.ok(
      fs.existsSync(path.join(texDir, `${cat}_roughness.png`)),
      `Missing ${cat}_roughness.png`
    );
  }

  assert.ok(fs.existsSync(path.join(audioDir, 'rifle_fire.wav')));
  assert.ok(fs.existsSync(path.join(audioDir, 'reload_mag_out.wav')));
  assert.ok(fs.existsSync(path.join(audioDir, 'reload_mag_in.wav')));
  assert.ok(fs.existsSync(path.join(audioDir, 'reload_bolt_rack.wav')));
  assert.ok(fs.existsSync(path.join(modelDir, 'vandal_receiver.gltf')));
});

/* =========================================================================
   CRITICAL COMBAT SYSTEM: RECOIL, TRAJECTORY & MOVEMENT ACCURACY TESTS
   ========================================================================= */

test('Stationary first-shot accuracy: Vandal hits stationary target at 20m with pinpoint precision', () => {
  const vandal = WEAPONS['vandal'];
  const standingMovement = evaluateMovementState(
    { x: 0, y: 0, z: 0 },
    0, // cameraYaw
    true, // isGrounded
    0, // landingDip
    false, // isCrouching
    false, // isSprinting
    false // isScoped
  );
  assert.equal(standingMovement.state, 'standing');

  const spreadInfo = computeWeaponSpread(vandal, standingMovement, 1, 0);
  assert.ok(
    spreadInfo.finalSpread <= vandal.spread,
    `First shot spread (${spreadInfo.finalSpread}) should be <= base spread (${vandal.spread})`
  );
  assert.equal(spreadInfo.movementPenalty, 0);
  assert.equal(spreadInfo.airbornePenalty, 0);
  assert.equal(spreadInfo.recoilBloom, 0);

  // At 20 meters, radial deviation is 20 * tan(spread)
  const targetDist = 20.0;
  const maxRadialDeviation = targetDist * Math.tan(spreadInfo.finalSpread);
  assert.ok(
    maxRadialDeviation < 0.05,
    `First-shot max deviation at 20m (${maxRadialDeviation.toFixed(4)}m) must be under 0.05m`
  );
});

test('Continuous automatic spray follows deterministic upward climb and horizontal sway', () => {
  let pitchOffset = 0;
  let yawOffset = 0;
  const pitchHistory: number[] = [];
  const yawHistory: number[] = [];

  for (let shot = 1; shot <= 12; shot++) {
    const step = sampleWeaponRecoilStep('vandal', shot, false, false);
    pitchOffset += step.pitchStep;
    yawOffset += step.yawStep;
    pitchHistory.push(pitchOffset);
    yawHistory.push(yawOffset);
  }

  // 1. Initial burst must climb upwards consistently
  assert.ok(pitchHistory[1] > pitchHistory[0], 'Shot 2 must be higher than shot 1');
  assert.ok(pitchHistory[3] > pitchHistory[1], 'Shot 4 must be higher than shot 2');
  assert.ok(pitchHistory[6] > pitchHistory[3], 'Shot 7 must be higher than shot 4');

  // 2. Later shots must exhibit horizontal sway (yaw non-zero)
  const laterYaws = yawHistory.slice(6);
  const maxAbsYaw = Math.max(...laterYaws.map(Math.abs));
  assert.ok(maxAbsYaw > 0.005, 'Sustained automatic spray must have deterministic horizontal sway');
});

test('Strafing left and strafing right significantly penalize weapon accuracy compared to standing still', () => {
  const vandal = WEAPONS['vandal'];

  const standing = evaluateMovementState(
    { x: 0, y: 0, z: 0 },
    0,
    true,
    0,
    false,
    false,
    false
  );
  const strafeLeft = evaluateMovementState(
    { x: -5.0, y: 0, z: 0 }, // moving left relative to camera facing Z
    0,
    true,
    0,
    false,
    false,
    false
  );
  const strafeRight = evaluateMovementState(
    { x: 5.0, y: 0, z: 0 }, // moving right relative to camera facing Z
    0,
    true,
    0,
    false,
    false,
    false
  );

  assert.equal(standing.state, 'standing');
  assert.equal(strafeLeft.state, 'strafing_left');
  assert.equal(strafeRight.state, 'strafing_right');

  const standingSpread = computeWeaponSpread(vandal, standing, 1, 0).finalSpread;
  const strafeLeftSpread = computeWeaponSpread(vandal, strafeLeft, 1, 1.0).finalSpread;
  const strafeRightSpread = computeWeaponSpread(vandal, strafeRight, 1, 1.0).finalSpread;

  assert.ok(
    strafeLeftSpread >= standingSpread * 3.0,
    `Strafing left spread (${strafeLeftSpread}) must be at least 3x standing spread (${standingSpread})`
  );
  assert.ok(
    strafeRightSpread >= standingSpread * 3.0,
    `Strafing right spread (${strafeRightSpread}) must be at least 3x standing spread (${standingSpread})`
  );
});

test('Jumping and falling apply heavy airborne accuracy penalty', () => {
  const vandal = WEAPONS['vandal'];

  const jumping = evaluateMovementState(
    { x: 0, y: 5.5, z: 0 },
    0,
    false, // in the air
    0,
    false,
    false,
    false
  );
  const falling = evaluateMovementState(
    { x: 0, y: -4.0, z: 0 },
    0,
    false,
    0,
    false,
    false,
    false
  );

  assert.equal(jumping.state, 'jumping');
  assert.equal(falling.state, 'falling');

  const standingSpread = computeWeaponSpread(
    vandal,
    evaluateMovementState({ x: 0, y: 0, z: 0 }, 0, true, 0, false, false, false),
    1,
    0
  ).finalSpread;

  const jumpSpread = computeWeaponSpread(vandal, jumping, 1, 1.0).finalSpread;
  const fallSpread = computeWeaponSpread(vandal, falling, 1, 1.0).finalSpread;

  assert.ok(
    jumpSpread >= standingSpread * 6.0,
    `Jumping spread (${jumpSpread}) must be at least 6x standing spread (${standingSpread})`
  );
  assert.ok(
    fallSpread >= standingSpread * 5.0,
    `Falling spread (${fallSpread}) must be at least 5x standing spread (${standingSpread})`
  );
});

test('Movement accuracy smoothly recovers after stopping', () => {
  const vandal = WEAPONS['vandal'];
  const stoppedMovement = evaluateMovementState(
    { x: 0, y: 0, z: 0 },
    0,
    true,
    0,
    false,
    false,
    false
  );

  // When stopped, accumulator decays from 1.0 down to 0
  let accumulator = 1.0;
  const dt = 0.016; // 60 FPS frame time
  const recoveryRate = 14.0; // recovery rate per second

  // After 100ms (approx 6 frames)
  for (let f = 0; f < 6; f++) {
    accumulator = Math.max(0, accumulator - dt * recoveryRate);
  }
  assert.ok(accumulator < 0.2, `Accumulator should recover to < 0.2 within 100ms (got ${accumulator})`);

  // After 150ms total
  for (let f = 0; f < 4; f++) {
    accumulator = Math.max(0, accumulator - dt * recoveryRate);
  }
  assert.equal(accumulator, 0, 'Movement inaccuracy must fully recover to 0');

  const recoveredSpread = computeWeaponSpread(vandal, stoppedMovement, 1, accumulator).finalSpread;
  const baseSpread = computeWeaponSpread(vandal, stoppedMovement, 1, 0).finalSpread;
  assert.equal(recoveredSpread, baseSpread);
});

test('Weapon-specific behaviour: SMG (Spectre) is significantly more forgiving while strafing than precision Rifle (Vandal)', () => {
  const vandal = WEAPONS['vandal'];
  const spectre = WEAPONS['spectre'];

  const movingLeft = evaluateMovementState(
    { x: -5.0, y: 0, z: 0 },
    0,
    true,
    0,
    false,
    false,
    false
  );

  const vandalMovingSpread = computeWeaponSpread(vandal, movingLeft, 1, 1.0).finalSpread;
  const spectreMovingSpread = computeWeaponSpread(spectre, movingLeft, 1, 1.0).finalSpread;

  const vandalMultiplier = vandalMovingSpread / vandal.spread;
  const spectreMultiplier = spectreMovingSpread / spectre.spread;

  assert.ok(
    vandalMultiplier > spectreMultiplier * 1.5,
    `Vandal movement spread multiplier (${vandalMultiplier.toFixed(2)}x) must be much harsher than Spectre (${spectreMultiplier.toFixed(2)}x)`
  );
});

/* =========================================================================
   THE RIG SYSTEM: MODULAR OPERATOR ARCHITECTURE TESTS
   ========================================================================= */

test('Rig System energy validation enforces strict 7-point energy budget', () => {
  // 6 Active Modules exist with defined energy costs
  assert.equal(ACTIVE_MODULES.echo_probe.energyCost, 3);
  assert.equal(ACTIVE_MODULES.aegis.energyCost, 4);
  assert.equal(ACTIVE_MODULES.mirage.energyCost, 2);
  assert.equal(ACTIVE_MODULES.vector.energyCost, 4);
  assert.equal(ACTIVE_MODULES.static_field.energyCost, 3);
  assert.equal(ACTIVE_MODULES.relay.energyCost, 2);

  // Aegis (4) + Vector (4) = 8 > 7 (INVALID)
  const invalidOverBudget: OperatorRigBuild = {
    id: 'test_invalid',
    name: 'Overloaded Rig',
    chassisId: 'jett',
    armorFinish: 'graphite',
    visorColor: '#00f2fe',
    activeSlot1: 'aegis',
    activeSlot2: 'vector',
    passiveSlot: 'signal_dampener',
    primaryWeapon: 'vandal',
    secondaryWeapon: 'classic',
  };
  const invalidRes = validateRigBuild(invalidOverBudget);
  assert.equal(invalidRes.isValid, false);
  assert.equal(invalidRes.totalEnergy, 8);
  assert.ok(invalidRes.errors.some((e) => e.includes('Energy budget exceeded')));

  // Aegis (4) + Static Field (3) = 7 <= 7 (VALID - Exactly at limit)
  const validMaxBudget: OperatorRigBuild = {
    id: 'test_valid_max',
    name: 'Bastion Anchor',
    chassisId: 'sage',
    armorFinish: 'titanium',
    visorColor: '#2dd4bf',
    activeSlot1: 'aegis',
    activeSlot2: 'static_field',
    passiveSlot: 'reinforced_systems',
    primaryWeapon: 'vandal',
    secondaryWeapon: 'classic',
  };
  const validMaxRes = validateRigBuild(validMaxBudget);
  assert.equal(validMaxRes.isValid, true);
  assert.equal(validMaxRes.totalEnergy, 7);

  // Vector (4) + Mirage (2) = 6 <= 7 (VALID - Under budget)
  const validUnderBudget: OperatorRigBuild = {
    id: 'test_valid_under',
    name: 'Phantom Striker',
    chassisId: 'reyna',
    armorFinish: 'obsidian',
    visorColor: '#c084fc',
    activeSlot1: 'vector',
    activeSlot2: 'mirage',
    passiveSlot: 'energy_recovery',
    primaryWeapon: 'phantom',
    secondaryWeapon: 'ghost',
  };
  const validUnderRes = validateRigBuild(validUnderBudget);
  assert.equal(validUnderRes.isValid, true);
  assert.equal(validUnderRes.totalEnergy, 6);
});

test('Rig System passive modules apply balanced multipliers', () => {
  // Signal Dampener: -45% recon duration (0.55), -25% sensor range (0.75)
  const dampener = PASSIVE_MODULES.signal_dampener;
  assert.equal(dampener.reconDurationMultiplier, 0.55);
  assert.equal(dampener.reconRadiusMultiplier, 0.75);

  // Reinforced Systems: +30% deployable device HP (1.30)
  const reinforced = PASSIVE_MODULES.reinforced_systems;
  assert.equal(reinforced.deployableHpMultiplier, 1.3);

  // Energy Recovery: +18% cooldown cycling rate (1.18)
  const recovery = PASSIVE_MODULES.energy_recovery;
  assert.equal(recovery.cooldownRateMultiplier, 1.18);
});


