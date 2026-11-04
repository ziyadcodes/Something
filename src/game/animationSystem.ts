export type PlayerAnimStateId =
  | 'idle'
  | 'walking'
  | 'running'
  | 'sprinting'
  | 'crouching'
  | 'jumping'
  | 'falling'
  | 'landing'
  | 'firing'
  | 'reloading'
  | 'switching'
  | 'equip'
  | 'unequip'
  | 'ability_cast';

export interface PlayerAnimInput {
  dt: number;
  speed: number;
  velocityY: number;
  isGrounded: boolean;
  wasGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isWalkingSlow: boolean;
  isFiring: boolean;
  timeSinceLastShot: number;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  equipTimer: number; // >0 while equipping
  unequipTimer: number; // >0 while unequipping
  inspectTimer: number; // >0 while inspecting
  moduleCastTimer?: number; // >0 while activating a Rig module
  lookDeltaX: number;
  lookDeltaY: number;
  onMetalSurface: boolean;
  cameraBobScale?: number; // 0..1 adjustable setting
}

export interface ArticulatedViewModelPose {
  state: PlayerAnimStateId;
  previousState: PlayerAnimStateId;
  stateBlend: number; // 0..1 smooth transition weight
  // Root weapon viewmodel offset & rotation
  weaponPos: { x: number; y: number; z: number };
  weaponRot: { x: number; y: number; z: number };
  // Articulated Left Support Arm & Hand offset/rotation (reaches for mag & charging handle)
  leftArmPos: { x: number; y: number; z: number };
  leftArmRot: { x: number; y: number; z: number };
  // Articulated Right Trigger Arm & Hand offset/rotation
  rightArmPos: { x: number; y: number; z: number };
  rightArmRot: { x: number; y: number; z: number };
  // Articulated Magazine offset/rotation during reload
  magazinePos: { x: number; y: number; z: number };
  magazineRot: { x: number; y: number; z: number };
  // Reciprocating Bolt Carrier / Charging Handle Z offset
  boltCarrierOffsetZ: number;
  // Subtle camera motion feedback
  cameraOffset: { x: number; y: number; roll: number };
  // Footstep & reload stage audio triggers
  footstepTriggered: boolean;
  footstepSurface: 'concrete' | 'metal';
  reloadStageTriggered: 'mag_out' | 'mag_in' | 'bolt_rack' | null;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export class PlayerAnimationController {
  private currentState: PlayerAnimStateId = 'idle';
  private previousState: PlayerAnimStateId = 'idle';
  private stateBlend = 1.0;
  private stateTime = 0;

  private locoPhase = 0;
  private lastStepHalfCycle = 0;
  private landingTimer = 0;
  private landingIntensity = 0;

  private swayX = 0;
  private swayY = 0;

  private smoothedPos = { x: 0.24, y: -0.2, z: -0.4 };
  private smoothedRot = { x: 0, y: 0, z: 0 };

  private lastReloadStage: 'none' | 'mag_out' | 'mag_in' | 'bolt_rack' = 'none';

  public getState(): PlayerAnimStateId {
    return this.currentState;
  }

  public getPreviousState(): PlayerAnimStateId {
    return this.previousState;
  }

  public forceWeaponSwitch(): void {
    this.transitionTo('unequip');
  }

  private transitionTo(next: PlayerAnimStateId): void {
    if (this.currentState !== next) {
      this.previousState = this.currentState;
      this.currentState = next;
      this.stateBlend = 0;
      this.stateTime = 0;
    }
  }

  public update(
    input: PlayerAnimInput,
    basePos = { x: 0.24, y: -0.2, z: -0.4 }
  ): ArticulatedViewModelPose {
    const dt = Math.min(Math.max(input.dt, 0.001), 0.1);
    const bobScale = input.cameraBobScale ?? 1.0;

    // Detect landing transition
    if (!input.wasGrounded && input.isGrounded) {
      this.landingTimer = 0.26;
      this.landingIntensity = Math.min(1.0, Math.abs(input.velocityY) / 9.5 + 0.35);
    }
    if (this.landingTimer > 0) {
      this.landingTimer = Math.max(0, this.landingTimer - dt);
    }

    // 1. Resolve Target Animation State across all 13 States
    const nextState = this.resolveState(input);
    this.transitionTo(nextState);

    this.stateTime += dt;
    this.stateBlend = Math.min(1.0, this.stateBlend + dt * 9.5);

    // 2. Smooth Mouse-Look Weapon Inertia Sway
    const targetSwayX = Math.max(-0.045, Math.min(0.045, -input.lookDeltaX * 0.0018));
    const targetSwayY = Math.max(-0.038, Math.min(0.038, input.lookDeltaY * 0.0018));
    this.swayX = damp(this.swayX, targetSwayX, 12, dt);
    this.swayY = damp(this.swayY, targetSwayY, 12, dt);

    // 3. Locomotion Cycle & Footstep Cadence Timing
    let footstepTriggered = false;
    let stepFreq = 0;
    if (input.isGrounded && input.speed > 0.4) {
      if (input.isSprinting) {
        stepFreq = 11.2;
      } else if (input.isCrouching || input.isWalkingSlow) {
        stepFreq = 5.4;
      } else {
        stepFreq = 8.4;
      }
      this.locoPhase += dt * stepFreq;
      const currentHalfCycle = Math.floor(this.locoPhase / Math.PI);
      if (currentHalfCycle > this.lastStepHalfCycle && !input.isWalkingSlow) {
        this.lastStepHalfCycle = currentHalfCycle;
        footstepTriggered = true;
      }
    } else {
      this.locoPhase = damp(this.locoPhase, Math.round(this.locoPhase / Math.PI) * Math.PI, 6, dt);
    }

    // 4. Compute Target Weapon Pose per State
    let targetX = basePos.x + this.swayX;
    let targetY = basePos.y + this.swayY;
    let targetZ = basePos.z;
    let rotX = this.swayY * 1.6;
    let rotY = this.swayX * 2.1;
    let rotZ = -this.swayX * 1.8;

    // Default articulated sub-part poses
    const leftArmPos = { x: -0.028, y: -0.042, z: -0.26 };
    const leftArmRot = { x: 0.12, y: 0.22, z: -0.18 };
    const rightArmPos = { x: 0.015, y: -0.088, z: 0.16 };
    const rightArmRot = { x: 0.18, y: -0.05, z: 0.05 };
    const magazinePos = { x: 0, y: -0.14, z: -0.06 };
    const magazineRot = { x: -0.28, y: 0, z: 0 };
    let boltCarrierOffsetZ = 0;

    let camOffsetX = 0;
    let camOffsetY = 0;
    let camRoll = 0;

    switch (this.currentState) {
      case 'idle': {
        // Subtle respiratory breathing wave
        const breath = Math.sin(this.stateTime * 2.1);
        targetY += breath * 0.0035;
        rotX += Math.cos(this.stateTime * 2.1) * 0.008;
        break;
      }
      case 'walking': {
        const bx = Math.cos(this.locoPhase) * 0.007 * bobScale;
        const by = Math.abs(Math.sin(this.locoPhase)) * -0.008 * bobScale;
        targetX += bx;
        targetY += by;
        camOffsetY = by * 0.9;
        break;
      }
      case 'running': {
        const bx = Math.cos(this.locoPhase) * 0.013 * bobScale;
        const by = Math.abs(Math.sin(this.locoPhase)) * -0.015 * bobScale;
        targetX += bx;
        targetY += by;
        rotZ += Math.cos(this.locoPhase) * 0.035 * bobScale;
        camOffsetX = bx * 0.5;
        camOffsetY = by * 1.1;
        break;
      }
      case 'sprinting': {
        // Tactical diagonal high-port / low-ready sprint carry with rhythmic figure-8 stride
        const bx = Math.cos(this.locoPhase) * 0.024 * bobScale;
        const by = Math.abs(Math.sin(this.locoPhase)) * -0.026 * bobScale;
        targetX += -0.06 + bx;
        targetY += -0.035 + by;
        targetZ += 0.04;
        rotX += -0.22 + Math.sin(this.locoPhase * 2) * 0.05;
        rotY += 0.48 + Math.cos(this.locoPhase) * 0.08;
        rotZ += 0.28;
        camOffsetX = bx * 0.7;
        camOffsetY = by * 1.35;
        camRoll = Math.cos(this.locoPhase) * 0.012 * bobScale;
        break;
      }
      case 'crouching': {
        // Compact canted tactical brace stance (tighter hip-to-shoulder tuck)
        const bx = input.speed > 0.3 ? Math.cos(this.locoPhase) * 0.005 * bobScale : 0;
        const by = input.speed > 0.3 ? Math.abs(Math.sin(this.locoPhase)) * -0.006 * bobScale : 0;
        targetX += -0.028 + bx;
        targetY += 0.016 + by;
        targetZ += 0.025;
        rotZ += -0.14;
        break;
      }
      case 'jumping': {
        // Upward takeoff inertia lag: weapon dips slightly and pitches up
        targetY += -0.038;
        targetZ += 0.02;
        rotX += 0.14;
        rotZ += -0.06;
        break;
      }
      case 'falling': {
        // Airborne weightlessness: weapon rises slightly with subtle wind tremor
        const airLift = Math.min(0.045, Math.abs(input.velocityY) * 0.005);
        targetY += airLift;
        rotX += -0.11;
        rotZ += 0.05;
        break;
      }
      case 'landing': {
        // Heavy knee/shoulder shock absorption dip
        const dip = Math.sin((this.landingTimer / 0.26) * Math.PI) * this.landingIntensity;
        targetY += -dip * 0.065;
        rotX += -dip * 0.22;
        rotZ += dip * 0.09;
        camOffsetY = -dip * 0.14 * bobScale;
        break;
      }
      case 'firing': {
        // Crisp axial recoil kickback + bolt carrier reciprocation
        const shotPhase = Math.max(0, 1 - input.timeSinceLastShot / 0.11);
        targetZ += shotPhase * 0.048;
        targetY += shotPhase * 0.014;
        rotX += shotPhase * 0.13;
        boltCarrierOffsetZ = shotPhase * 0.095;
        break;
      }
      case 'reloading': {
        const p = Math.max(0, Math.min(1, input.reloadProgress));
        if (p < 0.32) {
          // Stage 1: Tilt rifle right, left hand grabs magazine and pulls it down out of receiver
          const s = p / 0.32;
          targetX += -0.03 * s;
          targetY += -0.04 * s;
          rotX += 0.18 * s;
          rotZ += -0.42 * s;
          rotY += 0.22 * s;
          leftArmPos.x = -0.01;
          leftArmPos.y = -0.12 - s * 0.18;
          leftArmPos.z = -0.06 + s * 0.04;
          magazinePos.y = -0.14 - s * 0.22;
          magazinePos.z = -0.06 + s * 0.05;
          magazineRot.x = -0.28 + s * 0.45;
        } else if (p < 0.68) {
          // Stage 2: Left hand brings fresh magazine up from rig and seats it firmly into magwell
          const s = (p - 0.32) / 0.36;
          const seatImpact = s > 0.8 ? Math.sin(((s - 0.8) / 0.2) * Math.PI) * 0.025 : 0;
          targetX += -0.03;
          targetY += -0.04 + seatImpact;
          rotX += 0.18 - seatImpact * 2.5;
          rotZ += -0.42;
          rotY += 0.22;
          leftArmPos.x = -0.01;
          leftArmPos.y = -0.3 + s * 0.18;
          leftArmPos.z = -0.02 - s * 0.04;
          magazinePos.y = -0.36 + s * 0.22;
          magazinePos.z = -0.01 - s * 0.05;
          magazineRot.x = 0.17 - s * 0.45;
        } else {
          // Stage 3: Left hand reaches over receiver to rack the charging handle back & release
          const s = (p - 0.68) / 0.32;
          const rackPull = s < 0.5 ? s * 2 : (1 - s) * 2;
          targetX += -0.03 * (1 - s);
          targetY += -0.02 * (1 - s);
          rotX += -0.12 * rackPull;
          rotZ += 0.24 * rackPull;
          leftArmPos.x = 0.035 * rackPull + -0.028 * (1 - rackPull);
          leftArmPos.y = 0.025 * rackPull + -0.042 * (1 - rackPull);
          leftArmPos.z = (-0.06 + rackPull * 0.08) * rackPull + -0.26 * (1 - rackPull);
          boltCarrierOffsetZ = rackPull * 0.11;
        }
        break;
      }
      case 'unequip': {
        // Holster downward and pitch down before swapping active mesh
        const s = Math.min(1, this.stateTime / 0.16);
        targetY += -0.26 * s;
        targetZ += 0.08 * s;
        rotX += -0.65 * s;
        rotZ += 0.32 * s;
        break;
      }
      case 'equip':
      case 'switching': {
        // Draw weapon upward from holster with bolt check settle
        const e = Math.max(0, Math.min(1, input.equipTimer / 0.35));
        targetY += -0.24 * e;
        rotX += -0.52 * e;
        rotY += 0.28 * e;
        rotZ += -0.25 * e;
        boltCarrierOffsetZ = e > 0.4 ? Math.sin(((e - 0.4) / 0.6) * Math.PI) * 0.06 : 0;
        break;
      }
      case 'ability_cast': {
        // Tactical Rig module deployment: right hand cants weapon down, left arm projects forward
        const c = Math.sin(Math.min(1, (input.moduleCastTimer || 0) / 0.32) * Math.PI);
        targetX += 0.045 * c;
        targetY += -0.075 * c;
        rotX += -0.28 * c;
        rotZ += -0.36 * c;
        leftArmPos.x = -0.14 * c + -0.028 * (1 - c);
        leftArmPos.y = 0.045 * c + -0.042 * (1 - c);
        leftArmPos.z = -0.38 * c + -0.26 * (1 - c);
        break;
      }
    }

    // 5. Inspect flourish overlay (when player presses [Y] while idle/moving)
    if (input.inspectTimer > 0 && !input.isReloading && !input.isFiring) {
      const w = Math.sin(input.inspectTimer * Math.PI * 0.85);
      rotY += w * 0.58;
      rotZ += w * 0.34;
      rotX += Math.cos(input.inspectTimer * Math.PI * 0.85) * 0.12;
      leftArmPos.y -= Math.abs(w) * 0.06;
    }

    // 6. Reload Stage Audio Triggers (mag_out -> mag_in -> bolt_rack)
    let reloadStageTriggered: 'mag_out' | 'mag_in' | 'bolt_rack' | null = null;
    if (input.isReloading) {
      if (input.reloadProgress >= 0.05 && this.lastReloadStage === 'none') {
        this.lastReloadStage = 'mag_out';
        reloadStageTriggered = 'mag_out';
      } else if (input.reloadProgress >= 0.52 && this.lastReloadStage === 'mag_out') {
        this.lastReloadStage = 'mag_in';
        reloadStageTriggered = 'mag_in';
      } else if (input.reloadProgress >= 0.76 && this.lastReloadStage === 'mag_in') {
        this.lastReloadStage = 'bolt_rack';
        reloadStageTriggered = 'bolt_rack';
      }
    } else {
      this.lastReloadStage = 'none';
    }

    // Smoothly damp final root weapon transform (eliminates any state-change snapping)
    const smoothSpeed = 16;
    this.smoothedPos.x = damp(this.smoothedPos.x, targetX, smoothSpeed, dt);
    this.smoothedPos.y = damp(this.smoothedPos.y, targetY, smoothSpeed, dt);
    this.smoothedPos.z = damp(this.smoothedPos.z, targetZ, smoothSpeed, dt);
    this.smoothedRot.x = damp(this.smoothedRot.x, rotX, smoothSpeed, dt);
    this.smoothedRot.y = damp(this.smoothedRot.y, rotY, smoothSpeed, dt);
    this.smoothedRot.z = damp(this.smoothedRot.z, rotZ, smoothSpeed, dt);

    return {
      state: this.currentState,
      previousState: this.previousState,
      stateBlend: this.stateBlend,
      weaponPos: { ...this.smoothedPos },
      weaponRot: { ...this.smoothedRot },
      leftArmPos,
      leftArmRot,
      rightArmPos,
      rightArmRot,
      magazinePos,
      magazineRot,
      boltCarrierOffsetZ,
      cameraOffset: { x: camOffsetX, y: camOffsetY, roll: camRoll },
      footstepTriggered,
      footstepSurface: input.onMetalSurface ? 'metal' : 'concrete',
      reloadStageTriggered,
    };
  }

  private resolveState(input: PlayerAnimInput): PlayerAnimStateId {
    if (input.unequipTimer > 0) return 'unequip';
    if ((input.moduleCastTimer ?? 0) > 0) return 'ability_cast';
    if (input.equipTimer > 0.18) return 'switching';
    if (input.equipTimer > 0) return 'equip';
    if (input.isReloading) return 'reloading';
    if (input.isFiring || input.timeSinceLastShot < 0.095) return 'firing';
    if (!input.isGrounded) {
      return input.velocityY > 0.15 ? 'jumping' : 'falling';
    }
    if (this.landingTimer > 0.04) return 'landing';
    if (input.isCrouching) return 'crouching';
    if (input.speed > 0.4) {
      if (input.isSprinting) return 'sprinting';
      if (input.isWalkingSlow || input.speed < 4.2) return 'walking';
      return 'running';
    }
    return 'idle';
  }
}
