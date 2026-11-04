import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AgentId,
  ChatMessage,
  CrosshairConfig,
  GameMode,
  GameSettings,
  KillfeedEntry,
  MapId,
  RemotePlayerState,
  ScoreboardEntry,
  SkinId,
  TeamSide,
  WeaponId,
} from '../types/game';
import {
  WEAPONS,
  calculateDamage,
  computeEffectiveSpread,
  computeWeaponSpread,
  evaluateMovementState,
  MovementAccuracyStateId,
  sampleWeaponRecoilStep,
} from './weapons';
import { AGENTS } from './agents';
import { buildTacticalMap, FastAABB, MapData, MAPS } from './mapBuilder';
import { createWeaponViewModel, createSpikeMesh, createAgentCharacter } from './models';
import { soundSystem } from '../audio/soundSystem';
import { ParticleSystem } from './particles';
import { BotManager, BotState } from './botAI';
import {
  createInitialSpikeState,
  SpikeState,
  updatePlantProgress,
  updateDefuseProgress,
  tickSpikeTimer,
  getSpikeBeepInterval,
} from './spike';
import { calculateRoundEndCredits } from './economy';
import { multiplayerClient } from '../network/multiplayerClient';
import { createDefaultSettings } from './progression';
import { PlayerAnimationController, PlayerAnimStateId } from './animationSystem';
import {
  ActiveModuleId,
  ACTIVE_MODULES,
  DEFAULT_RIG_PRESETS,
  OperatorRigBuild,
  PASSIVE_MODULES,
} from './rigSystem';

export interface BenchmarkResult {
  avgFps: number;
  onePercentLowFps: number;
  avgFrameTimeMs: number;
  renderResolution: string;
  presetTested: string;
  recommendedPreset: GameSettings['quality'];
}

export type AbilityArchetype =
  | 'RECON'
  | 'MOBILITY'
  | 'DEFENSIVE'
  | 'DISRUPTION'
  | 'SUPPORT';

export interface ActiveAbilityBuff {
  name: string;
  archetype: AbilityArchetype;
  remaining: number;
  duration: number;
}

export interface RangeChallengeState {
  active: boolean;
  kills: number;
  targetKills: number;
  elapsed: number;
  bestTime: number | null;
  shotsFired: number;
  shotsHit: number;
}

export interface EngineHUDState {
  playerAgent: AgentId;
  rigBuild?: OperatorRigBuild;
  gameMode: GameMode;
  mapId: MapId;
  health: number;
  shield: number;
  activeWeaponId: WeaponId;
  activeWeaponName: string;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  isScoped: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isSlowed: boolean;
  credits: number;
  roundPhase: 'buy' | 'action' | 'roundEnd' | 'matchOver';
  phaseTimer: number;
  attackersScore: number;
  defendersScore: number;
  playerTeam: TeamSide;
  spikeState: SpikeState;
  isInsidePlantZone: boolean;
  plantZoneSite: 'A' | 'B' | null;
  flashAlpha: number;
  damageVignette: number;
  damageDirectionDeg: number | null;
  lastHitEvent: {
    id: number;
    damage: number;
    isHeadshot: boolean;
    targetName: string;
  } | null;
  activeAbilityBuff: ActiveAbilityBuff | null;
  rangeChallenge: RangeChallengeState;
  killStreak: number;
  playerKills: number;
  playerDeaths: number;
  playerHeadshots: number;
  recentKillEvent: { count: number; isHeadshot: boolean; victimName: string } | null;
  aliveAttackers: number;
  aliveDefenders: number;
  botRoster: {
    name: string;
    team: TeamSide;
    isAlive: boolean;
    agent: AgentId;
    x: number;
    z: number;
    isRevealed?: boolean;
  }[];
  scoreboard: ScoreboardEntry[];
  playerPos: { x: number; z: number; yaw: number };
  abilityCharges: Record<'c' | 'q' | 'e' | 'x', number>;
  abilityCooldowns: Record<'c' | 'q' | 'e' | 'x', number>;
  ultPoints: number;
  ultMax: number;
  statusBanner: string | null;
  fps: number;
  frameTimeMs: number;
  renderWidth: number;
  renderHeight: number;
  roomId: string;
  isMultiplayerConnected: boolean;
  onlinePlayerCount: number;
}

interface RemotePlayerEntity {
  state: RemotePlayerState;
  group: THREE.Group;
  hitboxes: THREE.Mesh[];
  hpBarFill: THREE.Mesh;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  walkPhase: number;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _muzzlePos = new THREE.Vector3();
const _endPoint = new THREE.Vector3();
const _upNormal = new THREE.Vector3(0, 1, 0);
const _camUp = new THREE.Vector3(0, 1, 0);
const _bulletDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _raycaster = new THREE.Raycaster();

function checkHorizontalAABBCollision(
  px: number,
  py: number,
  pz: number,
  radius: number,
  height: number,
  colliders: FastAABB[],
  isBuyPhase: boolean
): boolean {
  const minX = px - radius;
  const maxX = px + radius;
  const minY = py + 0.42; // Allow smooth step-up onto stairs/ledges up to 0.42m!
  const maxY = py + height;
  const minZ = pz - radius;
  const maxZ = pz + radius;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.isBarrier && !isBuyPhase) continue;
    if (
      maxX > c.minX &&
      minX < c.maxX &&
      maxY > c.minY &&
      minY < c.maxY &&
      maxZ > c.minZ &&
      minZ < c.maxZ
    ) {
      return true;
    }
  }
  return false;
}

function getSupportFloorHeight(
  px: number,
  py: number,
  pz: number,
  radius: number,
  colliders: FastAABB[]
): number {
  let highestFloor = 0;
  const minX = px - radius * 0.85;
  const maxX = px + radius * 0.85;
  const minZ = pz - radius * 0.85;
  const maxZ = pz + radius * 0.85;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.isBarrier) continue;
    if (maxX > c.minX && minX < c.maxX && maxZ > c.minZ && minZ < c.maxZ) {
      // Allow climbing stairs and standing on catwalks/crates up to 2.8m high
      if (c.maxY <= 2.8 && py + 0.55 >= c.maxY && c.maxY > highestFloor) {
        highestFloor = c.maxY;
      }
    }
  }
  return highestFloor;
}

export class ValorantEngine {
  private mountElement: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envTexture: THREE.Texture | null = null;
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private muzzlePointLight: THREE.PointLight;
  private isSoftwareGl: boolean;
  private frameId: number = 0;
  private isRunning: boolean = false;
  public isMenuShowcase: boolean = true;
  private showcaseTime: number = 0;
  private showcaseAgentGroup: THREE.Group | null = null;

  // Systems
  private mapData: MapData;
  public currentMapId: MapId = 'industrial';
  private particleSystem: ParticleSystem;
  private botManager: BotManager;
  private spikeMesh: THREE.Group | null = null;

  // Multiplayer Remote Entities
  private remotePlayers = new Map<string, RemotePlayerEntity>();
  private netSyncTimer: number = 0;
  public playerCallsign: string = 'AGENT_01';

  // Viewmodel & 13-State Procedural/Articulated Weapon Animation Controller
  private viewModelContainer: THREE.Group;
  private currentViewModel: THREE.Group | null = null;
  private muzzleFlashObj: THREE.Object3D | null = null;
  private leftArmObj: THREE.Object3D | null = null;
  private rightArmObj: THREE.Object3D | null = null;
  private magazineObj: THREE.Object3D | null = null;
  private boltCarrierObj: THREE.Object3D | null = null;
  private muzzleFlashTimer: number = 0;
  private equipAnimTimer: number = 0;
  private unequipAnimTimer: number = 0;
  private pendingWeaponSlot: 'primary' | 'secondary' | 'melee' | null = null;
  private inspectTimer: number = 0;
  private moduleCastTimer: number = 0;
  private equippedSkin: SkinId = 'tactical';
  private animController: PlayerAnimationController = new PlayerAnimationController();
  private frameLookDeltaX: number = 0;
  private frameLookDeltaY: number = 0;
  private wasGroundedLastFrame: boolean = true;
  public currentAnimState: PlayerAnimStateId = 'idle';
  public rigBuild: OperatorRigBuild = { ...DEFAULT_RIG_PRESETS[0] };

  // Settings & Performance Telemetry
  public settings: GameSettings = createDefaultSettings();
  private currentFps: number = 60;
  private currentFrameTimeMs: number = 16.6;
  private fpsSamples: number[] = [];
  private isBenchmarking: boolean = false;
  private benchmarkTimer: number = 0;
  private benchmarkSamples: number[] = [];
  private benchmarkCallback: ((res: BenchmarkResult) => void) | null = null;

  // Player State
  public playerTeam: TeamSide = 'attackers';
  public playerAgent: AgentId = 'jett';
  public health: number = 100;
  public shield: number = 50;
  public credits: number = 3900;
  public isPlayerAlive: boolean = true;
  public playerKills: number = 0;
  public playerDeaths: number = 0;
  public playerHeadshots: number = 0;
  private playerRespawnTimer: number = 0;
  private isCrouching: boolean = false;
  private isSprinting: boolean = false;
  private isScoped: boolean = false;
  private isPlayerSlowed: boolean = false;
  private eyeHeight: number = 1.7;
  private landingDipOffset: number = 0;
  private cameraRoll: number = 0;

  // Active Ability States & Modular Archetype Buffs
  private isBladestormActive: boolean = false;
  private bladestormKnives: number = 0;
  private dismissTimer: number = 0;
  private empressTimer: number = 0;
  private runItBackTimer: number = 0;
  private runItBackAnchor: THREE.Vector3 | null = null;
  private activeAbilityBuff: ActiveAbilityBuff | null = null;
  private statusBanner: string | null = null;
  private statusBannerTimer: number = 0;
  private burnTickTimer: number = 0;

  // Range Reflex Challenge State
  public rangeChallenge: RangeChallengeState = {
    active: false,
    kills: 0,
    targetKills: 30,
    elapsed: 0,
    bestTime: null,
    shotsFired: 0,
    shotsHit: 0,
  };

  // Inventory & Weapons
  public inventory: { primary?: WeaponId; secondary: WeaponId; melee: WeaponId } = {
    primary: 'vandal',
    secondary: 'classic',
    melee: 'knife',
  };
  public activeSlot: 'primary' | 'secondary' | 'melee' = 'primary';
  public ammoStock: Record<WeaponId, { mag: number; reserve: number }> = {
    knife: { mag: 0, reserve: 0 },
    classic: { mag: 12, reserve: 36 },
    ghost: { mag: 15, reserve: 45 },
    sheriff: { mag: 6, reserve: 24 },
    spectre: { mag: 30, reserve: 90 },
    judge: { mag: 7, reserve: 28 },
    phantom: { mag: 30, reserve: 90 },
    vandal: { mag: 30, reserve: 90 },
    odin: { mag: 100, reserve: 200 },
    operator: { mag: 5, reserve: 15 },
  };
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private reloadDuration: number = 2.5;
  private continuousShots: number = 0;
  private lastShotTime: number = 0;
  private walkBobTime: number = 0;

  // Recoil & Aim
  private cameraPitch: number = 0;
  private cameraYaw: number = 0;
  private recoilPitchOffset: number = 0;
  private recoilYawOffset: number = 0;
  public mouseSensitivity: number = 0.0022;

  // Player Kinematics & Dynamic Movement Accuracy
  private position: THREE.Vector3 = new THREE.Vector3(-0.4, 0, 31.2);
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private isGrounded: boolean = true;
  private movementInaccuracy: number = 0; // 0 (standing pinpoint) to 1.0 (full run/strafe penalty)
  private currentMovementState: MovementAccuracyStateId = 'standing';

  // Input State (PC + Mobile Multi-Touch)
  private keysHeld = new Set<string>();
  private isMouseDown: boolean = false;
  private isPlantDefuseKeyDown: boolean = false;
  private touchMoveVector = { x: 0, y: 0 };

  // Match & Round State
  public gameMode: GameMode = 'standard';
  public roundPhase: 'buy' | 'action' | 'roundEnd' | 'matchOver' = 'buy';
  public phaseTimeRemaining: number = 5;
  public attackersScore: number = 0;
  public defendersScore: number = 0;
  public spikeState: SpikeState = createInitialSpikeState();
  private lastSpikeBeepTime: number = 0;

  // Screen VFX & Hit Confirmation
  private flashAlpha: number = 0;
  private damageVignetteAlpha: number = 0;
  private damageDirectionDeg: number | null = null;
  private lastHitEvent: {
    id: number;
    damage: number;
    isHeadshot: boolean;
    targetName: string;
  } | null = null;
  private hitEventTimer: number = 0;
  private killStreakCount: number = 0;
  private killBannerEvent: { count: number; isHeadshot: boolean; victimName: string } | null =
    null;
  private killBannerTimeout: number = 0;

  // Abilities
  private abilityCharges = { c: 2, q: 2, e: 1, x: 1 };
  private abilityCooldowns = { c: 0, q: 0, e: 0, x: 0 };
  private ultPoints: number = 6;

  // Callbacks
  private onHUDUpdate: (state: EngineHUDState) => void;
  private onKillfeedAdd: (entry: KillfeedEntry) => void;
  private onMatchEnd: (winnerTeam: TeamSide) => void;
  private onChatReceive?: (msg: ChatMessage) => void;
  private hudThrottleTimer: number = 0;
  private hudDirty: boolean = true;
  private lastPushedSecond: number = -1;

  constructor(
    mountElement: HTMLElement,
    options: {
      onHUDUpdate: (state: EngineHUDState) => void;
      onKillfeedAdd: (entry: KillfeedEntry) => void;
      onMatchEnd: (winnerTeam: TeamSide) => void;
      onChatReceive?: (msg: ChatMessage) => void;
    }
  ) {
    this.mountElement = mountElement;
    this.onHUDUpdate = options.onHUDUpdate;
    this.onKillfeedAdd = options.onKillfeedAdd;
    this.onMatchEnd = options.onMatchEnd;
    this.onChatReceive = options.onChatReceive;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize Renderer with ACES Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5)
    );
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    mountElement.appendChild(this.renderer.domElement);

    // 3. Scene, Industrial Bunker Atmosphere & Studio PBR Reflections
    this.scene = new THREE.Scene();
    const mapMeta = MAPS[this.currentMapId];
    this.scene.background = new THREE.Color(mapMeta.skyColor);
    this.scene.fog = new THREE.FogExp2(mapMeta.fogColor, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      78,
      mountElement.clientWidth / mountElement.clientHeight,
      0.08,
      165
    );
    this.scene.add(this.camera);

    // Dynamic Muzzle Flash PointLight attached to camera
    this.muzzlePointLight = new THREE.PointLight(0xff9f43, 0, 7.5);
    this.muzzlePointLight.position.set(0.22, -0.15, -0.8);
    this.camera.add(this.muzzlePointLight);

    // 4. Industrial Bunker Lighting
    this.hemiLight = new THREE.HemisphereLight(0xfef3c7, 0x292524, 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    this.sunLight.position.set(28, 65, 38);
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    // 5. Build Map
    this.mapData = buildTacticalMap(this.currentMapId);
    this.scene.add(this.mapData.scene);

    // 6. Systems
    this.particleSystem = new ParticleSystem(this.scene);
    this.botManager = new BotManager(this.scene, this.particleSystem);

    // 7. Viewmodel container attached to camera
    this.viewModelContainer = new THREE.Group();
    this.camera.add(this.viewModelContainer);

    this.position.set(-0.4, 0, 31.2);
    this.camera.position.set(-0.4, 1.7, 31.2);

    this.updateViewModel();
    this.setupShowcaseAgent();
    this.bindEvents();
    this.setupMultiplayerListeners();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Start menu showcase render loop immediately so the Home Screen has a live 3D background!
    this.startLoop();
  }

  private setupShowcaseAgent() {
    if (this.showcaseAgentGroup) {
      this.scene.remove(this.showcaseAgentGroup);
    }
    const { group } = createAgentCharacter(
      'showcase_agent',
      this.playerAgent.toUpperCase(),
      false,
      '#00f2fe',
      this.playerAgent
    );
    group.position.set(-1.5, 0, 27.5);
    group.rotation.y = 0.25;
    this.showcaseAgentGroup = group;
    this.scene.add(group);
  }

  public setMap(mapId: MapId) {
    if (this.currentMapId === mapId) return;
    this.currentMapId = mapId;
    this.scene.remove(this.mapData.scene);
    this.mapData = buildTacticalMap(mapId);
    this.scene.add(this.mapData.scene);

    const mapMeta = MAPS[mapId];
    this.scene.background = new THREE.Color(mapMeta.skyColor);
    this.scene.fog = new THREE.FogExp2(mapMeta.fogColor, 0.0085);
    this.mapData.applyGraphicsSettings(this.settings);
  }

  public applySettings(newSettings: GameSettings) {
    this.settings = newSettings;
    this.mouseSensitivity = newSettings.sensitivity;

    soundSystem.setVolumes(
      newSettings.masterVolume,
      newSettings.sfxVolume,
      newSettings.musicVolume
    );

    this.botManager.difficulty = newSettings.botDifficulty;

    if (this.equippedSkin !== newSettings.equippedSkin) {
      this.equippedSkin = newSettings.equippedSkin;
      this.updateViewModel();
    }

    if (!this.isScoped) {
      this.camera.fov = newSettings.fov;
    }
    this.camera.far = newSettings.drawDistance;
    this.camera.updateProjectionMatrix();

    const baseDpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const effectiveRatio = Math.max(0.25, Math.min(2.0, baseDpr * newSettings.resolutionScale));
    this.renderer.setPixelRatio(effectiveRatio);
    this.renderer.setSize(this.mountElement.clientWidth, this.mountElement.clientHeight);

    const isPotato = newSettings.potatoMode || newSettings.quality === 'potato';
    this.scene.environment = isPotato ? null : this.envTexture;
    const enableShadows = !this.isSoftwareGl && !isPotato && newSettings.shadowQuality !== 'off';
    this.renderer.shadowMap.enabled = enableShadows;
    this.sunLight.castShadow = enableShadows;
    if (enableShadows) {
      const mapSize =
        newSettings.shadowQuality === 'ultra'
          ? 2048
          : newSettings.shadowQuality === 'high'
          ? 1024
          : 512;
      this.sunLight.shadow.mapSize.set(mapSize, mapSize);
    }

    this.mapData.applyGraphicsSettings(newSettings);
    if (this.isMenuShowcase) {
      this.updateMenuShowcase(0);
    }
    this.renderer.render(this.scene, this.camera);
    this.hudDirty = true;
  }

  public runBenchmark(onComplete: (result: BenchmarkResult) => void) {
    this.isBenchmarking = true;
    this.benchmarkTimer = 2.8;
    this.benchmarkSamples = [];
    this.benchmarkCallback = onComplete;
    this.showStatusBanner('RUNNING GPU BENCHMARK // MEASURING FRAME TIMES...', 3.0);
  }

  public startRangeChallenge() {
    if (this.gameMode !== 'range') return;
    this.rangeChallenge = {
      active: true,
      kills: 0,
      targetKills: 30,
      elapsed: 0,
      bestTime: this.rangeChallenge.bestTime,
      shotsFired: 0,
      shotsHit: 0,
    };
    this.showStatusBanner('30-BOT REFLEX CHALLENGE STARTED // ELIMINATE 30 TARGETS!', 2.5);
    soundSystem.playRoundStartHorn();
    this.hudDirty = true;
  }

  private setupMultiplayerListeners() {
    multiplayerClient.setCallbacks({
      onRoomJoined: (data) => {
        this.playerTeam = data.team;
        this.botManager.botsEnabled = data.fillWithBots;
        this.clearRemotePlayers();
        data.players.forEach((p) => {
          if (p.id !== data.playerId) {
            this.upsertRemotePlayer(p);
          }
        });
        this.hudDirty = true;
      },
      onPlayerJoined: (player) => {
        if (player.id !== multiplayerClient.playerId) {
          this.upsertRemotePlayer(player);
          this.showStatusBanner(`${player.name} JOINED THE SECTOR`, 2.5);
          this.hudDirty = true;
        }
      },
      onPlayerMoved: (player) => {
        if (player.id !== multiplayerClient.playerId) {
          this.upsertRemotePlayer(player);
        }
      },
      onPlayerLeft: (playerId) => {
        this.removeRemotePlayer(playerId);
        this.hudDirty = true;
      },
      onPlayerShot: (data) => {
        if (data.shooterId === multiplayerClient.playerId) return;
        soundSystem.playGunfire(data.weaponId, true);
        this.particleSystem.emitTracer(
          new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
          new THREE.Vector3(data.target.x, data.target.y, data.target.z)
        );
      },
      onPlayerDamaged: (data) => {
        if (data.victimId === multiplayerClient.playerId) {
          this.health = data.remainingHealth;
          this.shield = data.remainingShield;
          this.damageVignetteAlpha = 0.85;
          this.hudDirty = true;
          if (data.isEliminated && this.isPlayerAlive) {
            this.isPlayerAlive = false;
            this.playerDeaths += 1;
            this.playerRespawnTimer = 2.5;
            this.onKillfeedAdd({
              id: `kf_${Date.now()}_${Math.random()}`,
              killerName: data.shooterName,
              killerTeam: data.shooterTeam,
              victimName: this.playerCallsign,
              victimTeam: this.playerTeam,
              weaponId: data.weaponId,
              isHeadshot: data.isHeadshot,
              timestamp: Date.now(),
            });
          }
        } else {
          const remote = this.remotePlayers.get(data.victimId);
          if (remote) {
            remote.state.health = data.remainingHealth;
            remote.state.shield = data.remainingShield;
            remote.state.isAlive = !data.isEliminated;
            remote.hpBarFill.scale.x = Math.max(
              0.01,
              (data.remainingHealth + data.remainingShield) / 150
            );
            remote.group.visible = !data.isEliminated;
          }
          if (data.isEliminated) {
            this.onKillfeedAdd({
              id: `kf_${Date.now()}_${Math.random()}`,
              killerName: data.shooterName,
              killerTeam: data.shooterTeam,
              victimName: data.victimName,
              victimTeam: data.victimTeam,
              weaponId: data.weaponId,
              isHeadshot: data.isHeadshot,
              timestamp: Date.now(),
            });
          }
        }
      },
      onAbilityCast: (data) => {
        const target = new THREE.Vector3(data.target.x, data.target.y, data.target.z);
        const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
        const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
        if (data.key === 'c' && (data.agent === 'jett' || data.agent === 'cypher')) {
          this.particleSystem.spawnSmoke(target, 10.0);
        } else if (data.agent === 'phoenix' && data.key === 'c') {
          this.particleSystem.spawnFlameWall(origin, dir, 8.0);
        } else if (data.agent === 'phoenix' && data.key === 'e') {
          this.particleSystem.spawnMolly(target, false, 6.0);
        } else if (data.agent === 'sage' && data.key === 'c') {
          this.particleSystem.spawnBarrierWall(origin, dir, this.mapData.colliders, 28.0);
        } else if (data.agent === 'sova' && data.key === 'x') {
          this.particleSystem.spawnEnergyBeam(origin, dir, 60);
        }
      },
      onRoundEvent: (data) => {
        if (data.eventType === 'skipBuy' && this.roundPhase === 'buy') {
          this.skipBuyPhase(false);
        }
      },
      onChatMessage: (msg) => {
        this.onChatReceive?.(msg);
      },
    });
  }

  private upsertRemotePlayer(state: RemotePlayerState) {
    let entity = this.remotePlayers.get(state.id);
    if (!entity) {
      const isEnemy = state.team !== this.playerTeam;
      const { group, hitboxes, hpBarFill } = createAgentCharacter(
        state.id,
        state.name,
        isEnemy,
        isEnemy ? '#ff4655' : '#00f2fe',
        state.agent
      );
      hitboxes.forEach((hb) => {
        hb.userData.isRemotePlayer = true;
        hb.userData.playerId = state.id;
      });
      group.position.set(state.x, state.y, state.z);
      this.scene.add(group);
      entity = {
        state,
        group,
        hitboxes,
        hpBarFill,
        leftLeg: group.getObjectByName('LeftLeg'),
        rightLeg: group.getObjectByName('RightLeg'),
        walkPhase: 0,
      };
      this.remotePlayers.set(state.id, entity);
    } else {
      entity.state = state;
      entity.group.visible = state.isAlive;
      entity.hpBarFill.scale.x = Math.max(0.01, (state.health + state.shield) / 150);
    }
  }

  private removeRemotePlayer(playerId: string) {
    const entity = this.remotePlayers.get(playerId);
    if (entity) {
      this.scene.remove(entity.group);
      this.remotePlayers.delete(playerId);
    }
  }

  private clearRemotePlayers() {
    this.remotePlayers.forEach((entity) => {
      this.scene.remove(entity.group);
    });
    this.remotePlayers.clear();
  }

  private startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    let lastTime = performance.now();

    const tick = () => {
      if (!this.isRunning) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const instFps = rawDt > 0.0005 ? 1 / rawDt : 60;
      this.fpsSamples.push(instFps);
      if (this.fpsSamples.length > 25) this.fpsSamples.shift();
      const avg =
        this.fpsSamples.reduce((acc, v) => acc + v, 0) / Math.max(1, this.fpsSamples.length);
      this.currentFps = Math.round(avg);
      this.currentFrameTimeMs = Number((1000 / Math.max(1, avg)).toFixed(1));

      if (this.isBenchmarking) {
        this.benchmarkSamples.push(instFps);
        this.benchmarkTimer -= dt;
        if (this.benchmarkTimer <= 0) {
          this.finishBenchmark();
        }
      }

      if (this.isMenuShowcase && !this.isBenchmarking) {
        this.updateMenuShowcase(dt);
      } else {
        this.update(dt);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else if (this.settings.fpsLimit > 0) {
        const targetMs = 1000 / this.settings.fpsLimit;
        this.frameId = window.setTimeout(
          () => requestAnimationFrame(tick),
          Math.max(0, targetMs - 12)
        );
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private updateMenuShowcase(dt: number) {
    this.showcaseTime += dt;
    this.viewModelContainer.visible = false;
    this.mapData.barrierMeshes.forEach((m) => (m.visible = false));

    // Update subtle floating dust particles in the deep charcoal architectural volume
    this.particleSystem.updateAmbientDust(dt, this.showcaseTime);

    // Subtle ambient lighting breathing (almost imperceptible, natural depth)
    this.hemiLight.intensity = 1.15 + Math.sin(this.showcaseTime * 0.35) * 0.06;
    this.sunLight.intensity = 2.0 + Math.cos(this.showcaseTime * 0.28) * 0.08;

    if (this.showcaseAgentGroup) {
      this.showcaseAgentGroup.visible = true;
      // Restrained idle breathing & subtle weight shift on the 3D operator chassis
      this.showcaseAgentGroup.position.set(
        0.52,
        Math.sin(this.showcaseTime * 1.65) * 0.008,
        27.35
      );
      this.showcaseAgentGroup.rotation.y = 0.28 + Math.sin(this.showcaseTime * 0.45) * 0.09;
    }

    // Barely noticeable camera parallax framing the operator on the right and open charcoal architecture on the left
    this.camera.position.set(
      -0.18 + Math.sin(this.showcaseTime * 0.22) * 0.16,
      1.86 + Math.cos(this.showcaseTime * 0.32) * 0.03,
      30.15
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -0.06 + Math.sin(this.showcaseTime * 0.18) * 0.025;
    this.camera.rotation.x = 0.015;
    this.camera.rotation.z = 0;
  }

  private finishBenchmark() {
    this.isBenchmarking = false;
    const sorted = [...this.benchmarkSamples].sort((a, b) => a - b);
    const avgFps = Math.round(
      sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length)
    );
    const lowIdx = Math.max(0, Math.floor(sorted.length * 0.05));
    const onePercentLowFps = Math.round(sorted[lowIdx] || avgFps);
    const avgFrameTimeMs = Number((1000 / Math.max(1, avgFps)).toFixed(1));
    const canvas = this.renderer.domElement;

    const recommendedPreset: GameSettings['quality'] =
      avgFps < 35
        ? 'potato'
        : avgFps < 50
        ? 'low'
        : avgFps < 75
        ? 'high'
        : 'ultra';

    this.benchmarkCallback?.({
      avgFps,
      onePercentLowFps,
      avgFrameTimeMs,
      renderResolution: `${canvas.width} × ${canvas.height}`,
      presetTested: this.settings.quality.toUpperCase(),
      recommendedPreset,
    });
    this.benchmarkCallback = null;
  }

  public start() {
    this.isMenuShowcase = false;
    this.viewModelContainer.visible = true;
    if (this.showcaseAgentGroup) {
      this.showcaseAgentGroup.visible = false;
    }

    this.attackersScore = 0;
    this.defendersScore = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerHeadshots = 0;
    this.isPlayerAlive = true;
    this.health = 100;
    this.shield = 50;
    this.cameraYaw = -0.04;
    this.cameraPitch = 0.02;
    this.activeAbilityBuff = null;
    this.rangeChallenge.active = false;

    if (this.gameMode === 'range') {
      this.roundPhase = 'action';
      this.phaseTimeRemaining = 999;
      this.credits = 9000;
      this.position.set(-0.4, 0, 26);
      this.mapData.barrierMeshes.forEach((m) => (m.visible = false));
      this.showStatusBanner(
        'THE RANGE // PRESS [G] FOR 30-BOT REFLEX CHALLENGE OR PRACTICE ABILITIES'
      );
    } else if (this.gameMode === 'dm' || this.gameMode === 'tdm') {
      this.roundPhase = 'action';
      this.phaseTimeRemaining = 300;
      this.credits = 9000;
      this.position.set(-0.4, 0, 31.2);
      this.mapData.barrierMeshes.forEach((m) => (m.visible = false));
      this.showStatusBanner(
        this.gameMode === 'dm'
          ? 'FREE-FOR-ALL DEATHMATCH // FIRST TO 20 KILLS'
          : 'TEAM DEATHMATCH // FIRST TEAM TO 30 KILLS'
      );
    } else if (this.gameMode === 'spikerush') {
      this.roundPhase = 'buy';
      this.phaseTimeRemaining = 3;
      this.credits = 4500;
      this.position.set(-0.4, 0, 31.2);
      this.mapData.barrierMeshes.forEach((m) => (m.visible = true));
      this.showStatusBanner('SPIKE RUSH // FAST ROUNDS');
    } else {
      this.roundPhase = 'buy';
      this.phaseTimeRemaining = 6;
      this.credits = 3900;
      this.position.set(-0.4, 0, 31.2);
      this.mapData.barrierMeshes.forEach((m) => (m.visible = true));
      this.showStatusBanner('BUY PHASE // PRESS [B] FOR SHOP OR [ENTER] TO DROP BARRIERS');
    }

    this.camera.position.set(this.position.x, this.position.y + 1.85, this.position.z);
    this.botManager.spawnMatchBots(this.playerTeam, this.gameMode);
    soundSystem.playRoundStartHorn();
    this.hudDirty = true;
    this.pushHUDState(false, null);
    this.startLoop();
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!this.isRunning) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public stop() {
    this.isMenuShowcase = true;
    this.viewModelContainer.visible = false;
    if (this.showcaseAgentGroup) {
      this.showcaseAgentGroup.visible = true;
    }
  }

  public dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.renderer.dispose();
    if (this.mountElement.contains(this.renderer.domElement)) {
      this.mountElement.removeChild(this.renderer.domElement);
    }
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.isMenuShowcase) {
      this.updateMenuShowcase(0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  public setAgent(agentId: AgentId) {
    this.playerAgent = agentId;
    const agent = AGENTS[agentId];
    if (agent) {
      this.abilityCharges = {
        c: agent.abilities.c.maxCharges,
        q: ACTIVE_MODULES[this.rigBuild.activeSlot1]?.maxCharges || 2,
        e: ACTIVE_MODULES[this.rigBuild.activeSlot2]?.maxCharges || 1,
        x: 1,
      };
      this.ultPoints = agent.abilities.x.ultPointsRequired;
      this.setupShowcaseAgent();
      if (!this.isMenuShowcase && this.showcaseAgentGroup) {
        this.showcaseAgentGroup.visible = false;
      }
      this.hudDirty = true;
    }
  }

  public setRigBuild(build: OperatorRigBuild) {
    this.rigBuild = { ...build };
    this.playerAgent = build.chassisId;
    this.inventory.primary = build.primaryWeapon;
    this.inventory.secondary = build.secondaryWeapon;
    const mod1 = ACTIVE_MODULES[build.activeSlot1] || ACTIVE_MODULES.vector;
    const mod2 = ACTIVE_MODULES[build.activeSlot2] || ACTIVE_MODULES.echo_probe;
    this.abilityCharges = {
      c: 1,
      q: mod1.maxCharges,
      e: mod2.maxCharges,
      x: 1,
    };
    this.abilityCooldowns = { c: 0, q: 0, e: 0, x: 0 };
    this.setupShowcaseAgent();
    if (!this.isMenuShowcase && this.showcaseAgentGroup) {
      this.showcaseAgentGroup.visible = false;
    }
    this.updateViewModel();
    this.hudDirty = true;
    this.pushHUDState(false, null);
  }

  public skipBuyPhase(broadcast = true) {
    if (this.roundPhase === 'buy') {
      this.roundPhase = 'action';
      this.phaseTimeRemaining = 100;
      this.mapData.barrierMeshes.forEach((m) => (m.visible = false));
      this.showStatusBanner('BARRIERS DROPPED // ENGAGE!');
      this.hudDirty = true;
      this.pushHUDState(false, null);
      if (broadcast) {
        multiplayerClient.sendRoundEvent('skipBuy');
      }
    }
  }

  private showStatusBanner(msg: string, duration = 3.0) {
    this.statusBanner = msg;
    this.statusBannerTimer = duration;
    this.hudDirty = true;
  }

  private setActiveBuff(name: string, archetype: AbilityArchetype, duration: number) {
    this.activeAbilityBuff = {
      name,
      archetype,
      remaining: duration,
      duration,
    };
    this.hudDirty = true;
  }

  public setCrosshair(_config: CrosshairConfig) {}

  public getActiveWeaponId(): WeaponId {
    if (this.activeSlot === 'primary')
      return this.inventory.primary || this.inventory.secondary;
    if (this.activeSlot === 'secondary') return this.inventory.secondary;
    return this.inventory.melee;
  }

  public switchWeapon(slot: 'primary' | 'secondary' | 'melee') {
    if (slot === 'primary' && !this.inventory.primary) return;
    if (this.activeSlot === slot && !this.isBladestormActive) return;
    this.isBladestormActive = false;
    this.isReloading = false;
    this.isScoped = false;
    this.pendingWeaponSlot = slot;
    this.unequipAnimTimer = 0.14;
    this.animController.forceWeaponSwitch();
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    soundSystem.playWeaponSwitch();
    this.hudDirty = true;
  }

  public triggerWeaponInspect() {
    this.inspectTimer = 1.6;
    this.showStatusBanner(
      `INSPECTING ${WEAPONS[this.getActiveWeaponId()].name} // ${this.equippedSkin.toUpperCase()}`,
      1.6
    );
  }

  public purchaseWeapon(weaponId: WeaponId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon || this.credits < weapon.cost) return false;

    this.credits -= weapon.cost;
    this.isBladestormActive = false;
    if (
      weapon.category === 'rifle' ||
      weapon.category === 'smg' ||
      weapon.category === 'shotgun' ||
      weapon.category === 'machinegun' ||
      weapon.category === 'sniper'
    ) {
      this.inventory.primary = weaponId;
      this.activeSlot = 'primary';
    } else if (weapon.category === 'sidearm') {
      this.inventory.secondary = weaponId;
      this.activeSlot = 'secondary';
    }
    this.ammoStock[weaponId] = {
      mag: weapon.magazineSize,
      reserve: weapon.maxReserve,
    };
    this.equipAnimTimer = 0.28;
    this.updateViewModel();
    this.hudDirty = true;
    this.pushHUDState(false, null);
    return true;
  }

  public purchaseShield(type: 'light' | 'heavy') {
    const cost = type === 'light' ? 400 : 1000;
    const amount = type === 'light' ? 25 : 50;
    if (this.credits >= cost && this.shield < amount) {
      this.credits -= cost;
      this.shield = amount;
      this.hudDirty = true;
      this.pushHUDState(false, null);
      return true;
    }
    return false;
  }

  public purchaseAbility(key: 'c' | 'q' | 'e') {
    if (key === 'c') {
      const agent = AGENTS[this.playerAgent];
      const ab = agent.abilities.c;
      const cost = ab.cost;
      const maxCharges = ab.maxCharges;
      if (this.credits >= cost && this.abilityCharges.c < maxCharges) {
        this.credits -= cost;
        this.abilityCharges.c += 1;
        this.hudDirty = true;
        this.pushHUDState(false, null);
        return true;
      }
      return false;
    }
    const mod =
      key === 'q'
        ? ACTIVE_MODULES[this.rigBuild.activeSlot1]
        : ACTIVE_MODULES[this.rigBuild.activeSlot2];
    const cost = mod ? mod.creditCost : 200;
    const maxCharges = mod ? mod.maxCharges : 2;
    const targetKey = key === 'q' ? 'q' : 'e';
    if (this.credits >= cost && this.abilityCharges[targetKey] < maxCharges) {
      this.credits -= cost;
      this.abilityCharges[targetKey] += 1;
      this.hudDirty = true;
      this.pushHUDState(false, null);
      return true;
    }
    return false;
  }

  private updateViewModel() {
    if (this.currentViewModel) {
      this.viewModelContainer.remove(this.currentViewModel);
    }
    const activeWep = this.isBladestormActive ? 'kunai' : this.getActiveWeaponId();
    this.currentViewModel = createWeaponViewModel(activeWep, this.equippedSkin);
    this.muzzleFlashObj = this.currentViewModel.getObjectByName('MuzzleFlash') || null;
    this.leftArmObj = this.currentViewModel.getObjectByName('LeftArmGroup') || null;
    this.rightArmObj = this.currentViewModel.getObjectByName('RightArmGroup') || null;
    this.magazineObj = this.currentViewModel.getObjectByName('WeaponMagazine') || null;
    this.boltCarrierObj = this.currentViewModel.getObjectByName('BoltCarrier') || null;
    this.viewModelContainer.add(this.currentViewModel);
  }

  // Mobile & External Control Hooks
  public setMobileMove(x: number, y: number) {
    this.touchMoveVector.x = Math.max(-1, Math.min(1, x));
    this.touchMoveVector.y = Math.max(-1, Math.min(1, y));
  }

  public addMobileLook(dx: number, dy: number) {
    const sens = (this.isScoped ? this.mouseSensitivity * 0.6 : this.mouseSensitivity) * 1.45;
    this.frameLookDeltaX += dx;
    this.frameLookDeltaY += dy;
    this.cameraYaw -= dx * sens;
    this.cameraPitch -= dy * sens;
    this.cameraPitch = Math.max(-1.52, Math.min(1.52, this.cameraPitch));
  }

  public setMobileFire(down: boolean) {
    this.isMouseDown = down;
    if (down) {
      this.attemptShoot();
    } else {
      this.continuousShots = 0;
    }
  }

  public toggleScope() {
    const activeWep = WEAPONS[this.getActiveWeaponId()];
    if (activeWep && activeWep.scopeZoom !== 1) {
      this.isScoped = !this.isScoped;
      const zoom = activeWep.hasScope ? activeWep.scopeZoom : 1.25;
      this.camera.fov = this.isScoped ? this.settings.fov / zoom : this.settings.fov;
      this.camera.updateProjectionMatrix();
      if (this.currentViewModel) {
        this.currentViewModel.visible = !(this.isScoped && activeWep.hasScope);
      }
      this.hudDirty = true;
    }
  }

  public toggleCrouch() {
    this.isCrouching = !this.isCrouching;
    if (this.isCrouching) this.isSprinting = false;
    this.hudDirty = true;
  }

  public toggleSprint(state?: boolean) {
    this.isSprinting = typeof state === 'boolean' ? state : !this.isSprinting;
    if (this.isSprinting) this.isCrouching = false;
    this.hudDirty = true;
  }

  public triggerJump() {
    if (this.isGrounded && this.isPlayerAlive) {
      this.velocity.y = 6.35;
      this.isGrounded = false;
      this.landingDipOffset = 0.04;
      soundSystem.playJump(false);
    }
  }

  public setPlantDefuseHeld(held: boolean) {
    this.isPlantDefuseKeyDown = held;
  }

  public triggerReload() {
    if (this.isBladestormActive) return;
    const activeWepId = this.getActiveWeaponId();
    const weapon = WEAPONS[activeWepId];
    const stock = this.ammoStock[activeWepId];
    if (!weapon || !stock || this.isReloading) return;
    if (stock.mag >= weapon.magazineSize || stock.reserve <= 0) return;

    this.isReloading = true;
    const speedMult = this.empressTimer > 0 ? 0.55 : 1.0;
    this.reloadDuration = weapon.reloadTime * speedMult;
    this.reloadTimer = this.reloadDuration;
    this.hudDirty = true;
    soundSystem.playReload();
  }

  public triggerAbility(key: 'c' | 'q' | 'e' | 'x') {
    this.useAbility(key);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleWindowBlur = () => {
    this.keysHeld.clear();
    this.isMouseDown = false;
    this.isSprinting = false;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isMenuShowcase) return;
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    this.keysHeld.add(key);

    if (key === '1') this.switchWeapon('primary');
    if (key === '2') this.switchWeapon('secondary');
    if (key === '3') this.switchWeapon('melee');
    if (key === 'r') this.triggerReload();
    if (key === 'y') this.triggerWeaponInspect();
    if (key === 'g' && this.gameMode === 'range') this.startRangeChallenge();
    if (key === 'control') {
      this.isCrouching = true;
      this.isSprinting = false;
    }
    if (key === 'shift') {
      this.isSprinting = true;
      this.isCrouching = false;
    }
    if (key === ' ') {
      this.triggerJump();
    }
    if (key === '4' || key === 'f') this.isPlantDefuseKeyDown = true;
    if (key === 'enter' && this.roundPhase === 'buy') this.skipBuyPhase(true);

    if (key === 'c') this.useAbility('c');
    if (key === 'q') this.useAbility('q');
    if (key === 'e') this.useAbility('e');
    if (key === 'x') this.useAbility('x');
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keysHeld.delete(key);
    if (key === 'control') this.isCrouching = false;
    if (key === 'shift') this.isSprinting = false;
    if (key === '4' || key === 'f') this.isPlantDefuseKeyDown = false;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.isMenuShowcase) return;
    if (
      e.target !== this.renderer.domElement &&
      document.pointerLockElement !== this.renderer.domElement &&
      document.pointerLockElement !== this.mountElement
    ) {
      return;
    }
    if (e.button === 0) {
      this.isMouseDown = true;
      this.attemptShoot();
    } else if (e.button === 2) {
      this.toggleScope();
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isMouseDown = false;
      this.continuousShots = 0;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (
      document.pointerLockElement !== this.mountElement &&
      document.pointerLockElement !== this.renderer.domElement
    ) {
      return;
    }

    const sens = this.isScoped ? this.mouseSensitivity * 0.6 : this.mouseSensitivity;
    this.frameLookDeltaX += e.movementX;
    this.frameLookDeltaY += e.movementY;
    this.cameraYaw -= e.movementX * sens;
    this.cameraPitch -= e.movementY * sens;
    this.cameraPitch = Math.max(-1.52, Math.min(1.52, this.cameraPitch));
  };

  public requestPointerLock() {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore on mobile touch browsers
    }
  }

  private completeReload() {
    const activeWepId = this.getActiveWeaponId();
    const weapon = WEAPONS[activeWepId];
    const stock = this.ammoStock[activeWepId];
    if (weapon && stock) {
      const needed = weapon.magazineSize - stock.mag;
      const transfer =
        this.gameMode === 'range' || this.gameMode === 'dm'
          ? needed
          : Math.min(needed, stock.reserve);
      stock.mag += transfer;
      if (this.gameMode !== 'range' && this.gameMode !== 'dm') {
        stock.reserve -= transfer;
      }
    }
    this.isReloading = false;
    this.hudDirty = true;
  }

  /**
   * Modular Ability Framework across 5 Archetypes:
   * - RECON (Sova, Cypher): Sonar beacons, tracking darts, 3D enemy silhouette tagging & radar reveal
   * - MOBILITY (Jett, Omen, Reyna): Directional velocity bursts, vertical updrafts, shadow teleports & intangible phase
   * - DEFENSIVE (Sage, Cypher): 4-segment destructible 400 HP fortified ice barrier wall, slow crystal fields & tripwires
   * - DISRUPTION (Phoenix, Reyna, Omen, Viper): Corner-curving flashes, destructible nearsight eyes & toxic vision clouds
   * - SUPPORT / AREA DENIAL (Sage, Phoenix, Viper): Heal-over-time, ally resurrection, vulnerable acid pools & fire walls
   */
  private executeRigModule(moduleId: ActiveModuleId, targetPoint: THREE.Vector3) {
    const mod = ACTIVE_MODULES[moduleId];
    const passive = PASSIVE_MODULES[this.rigBuild.passiveSlot];
    const hpMult = passive ? passive.deployableHpMultiplier : 1.0;

    if (moduleId === 'echo_probe') {
      soundSystem.playSpikeBeep(1120);
      const probeHp = Math.round(mod.deviceHp * hpMult);
      this.particleSystem.spawnReconBeacon(targetPoint, mod.duration, probeHp, false);
      const tagged = this.botManager.revealEnemiesNear(
        targetPoint,
        mod.range,
        this.playerTeam,
        mod.duration
      );
      this.setActiveBuff(`ECHO PROBE (${tagged} DETECTED)`, 'RECON', mod.duration);
      this.showStatusBanner(
        `ECHO PROBE DEPLOYED // ${tagged} HOSTILES DETECTED (${probeHp} HP NODE)`
      );
    } else if (moduleId === 'aegis') {
      soundSystem.playDefuseCheckpoint();
      const panelHp = Math.round(mod.deviceHp * hpMult);
      this.particleSystem.spawnBarrierWall(
        this.position,
        _forward,
        this.mapData.colliders,
        mod.duration,
        panelHp
      );
      this.setActiveBuff(`AEGIS BARRIER (4×${panelHp} HP)`, 'DEFENSIVE', mod.duration);
      this.showStatusBanner(
        `AEGIS HARD-LIGHT BARRIER ANCHORED // 4×${panelHp} HP PANELS`
      );
    } else if (moduleId === 'mirage') {
      soundSystem.playDash();
      const decoyHp = Math.round(mod.deviceHp * hpMult);
      this.particleSystem.spawnMirageDecoy(this.position, _forward, mod.duration, decoyHp);
      this.setActiveBuff('MIRAGE HOLO-DECOY ACTIVE', 'DISRUPTION', mod.duration);
      this.showStatusBanner('MIRAGE DECOY PROJECTED // ADVANCING ON VECTOR');
    } else if (moduleId === 'vector') {
      soundSystem.playDash();
      _euler.set(0, this.cameraYaw, 0);
      const dashDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler);
      if (this.keysHeld.has('KeyA')) dashDir.add(new THREE.Vector3(-1, 0, 0).applyEuler(_euler));
      if (this.keysHeld.has('KeyD')) dashDir.add(new THREE.Vector3(1, 0, 0).applyEuler(_euler));
      if (this.keysHeld.has('KeyS')) dashDir.set(0, 0, 1).applyEuler(_euler);
      dashDir.normalize();
      this.velocity.addScaledVector(dashDir, 24.5);
      this.setActiveBuff('VECTOR THRUST BURST', 'MOBILITY', mod.duration);
      this.showStatusBanner('VECTOR // DIRECTIONAL THRUST ENGAGED!');
    } else if (moduleId === 'static_field') {
      soundSystem.playSpikeBeep(920);
      const pylonHp = Math.round(mod.deviceHp * hpMult);
      this.particleSystem.spawnSlowZone(targetPoint, mod.duration, pylonHp);
      const slowed = this.botManager.slowEnemiesNear(targetPoint, mod.range, this.playerTeam);
      this.setActiveBuff(`STATIC FIELD (${slowed} DISRUPTED)`, 'DISRUPTION', mod.duration);
      this.showStatusBanner(
        `STATIC FIELD DEPLOYED // ${slowed} HOSTILES SLOWED (${pylonHp} HP PYLON)`
      );
    } else if (moduleId === 'relay') {
      soundSystem.playDefuseCheckpoint();
      const relayHp = Math.round(mod.deviceHp * hpMult);
      this.particleSystem.spawnReconBeacon(this.position, mod.duration, relayHp, true);
      this.shield = Math.min(50, this.shield + 20);
      const shared = this.botManager.revealEnemiesNear(
        this.position,
        mod.range,
        this.playerTeam,
        4.0
      );
      this.setActiveBuff(`RELAY UPLINK (+20 SHIELD / ${shared} SHARED)`, 'SUPPORT', mod.duration);
      this.showStatusBanner(
        `RELAY ANCHORED // +20 OVERSHIELD & ${shared} SIGNATURES SHARED`
      );
    }
  }

  private useAbility(key: 'c' | 'q' | 'e' | 'x') {
    if (!this.isPlayerAlive) return;
    const agent = AGENTS[this.playerAgent];
    const ability = agent.abilities[key];
    const passive = PASSIVE_MODULES[this.rigBuild.passiveSlot];
    const cdRate = passive ? passive.cooldownRateMultiplier : 1.0;

    if (key === 'q' || key === 'e') {
      const modId = key === 'q' ? this.rigBuild.activeSlot1 : this.rigBuild.activeSlot2;
      const mod = ACTIVE_MODULES[modId];
      if (!mod) return;

      if (this.abilityCharges[key] <= 0 || this.abilityCooldowns[key] > 0) {
        this.showStatusBanner(
          `${mod.name} RECHARGING (${Math.ceil(this.abilityCooldowns[key])}s)`,
          1.4
        );
        return;
      }

      if (this.gameMode !== 'range') {
        this.abilityCharges[key] = Math.max(0, this.abilityCharges[key] - 1);
      }
      this.abilityCooldowns[key] =
        this.gameMode === 'range' ? 1.5 : Number((mod.cooldown / cdRate).toFixed(1));

      this.moduleCastTimer = 0.34;
      this.equipAnimTimer = 0.22;
      soundSystem.playWavBuffer('ability_cast', 0.45, 1.0);
      this.hudDirty = true;
      this.writeForwardDirection(_forward);

      _raycaster.set(this.camera.position, _forward);
      _raycaster.far = mod.range > 4 ? mod.range : 16;
      const wallHits = _raycaster.intersectObjects(this.mapData.wallMeshes, false);
      const targetPoint =
        wallHits.length > 0
          ? wallHits[0].point.clone()
          : this.position.clone().addScaledVector(_forward, Math.min(11, mod.range));

      multiplayerClient.sendAbilityCast({
        agent: this.playerAgent,
        key,
        origin: { x: this.position.x, y: this.position.y, z: this.position.z },
        direction: { x: _forward.x, y: _forward.y, z: _forward.z },
        target: { x: targetPoint.x, y: targetPoint.y, z: targetPoint.z },
      });

      this.executeRigModule(modId, targetPoint);
      return;
    }

    if (ability.isUltimate) {
      if (this.ultPoints < ability.ultPointsRequired && this.abilityCharges.x <= 0) {
        this.showStatusBanner(
          `RIG OVERCLOCK NOT READY (${this.ultPoints}/${ability.ultPointsRequired} PTS)`,
          1.8
        );
        return;
      }
      this.ultPoints = 0;
      this.abilityCharges.x = 0;
      soundSystem.playWavBuffer('ability_ult', 0.55, 1.0);
      soundSystem.playAceFanfare();
    } else {
      if (this.abilityCharges[key] <= 0 || this.abilityCooldowns[key] > 0) return;
      if (this.gameMode !== 'range') {
        this.abilityCharges[key] -= 1;
      }
      this.abilityCooldowns[key] = this.gameMode === 'range' ? 2 : 14;
    }

    this.moduleCastTimer = 0.34;
    this.equipAnimTimer = 0.24;
    soundSystem.playWavBuffer('ability_cast', 0.45, 1.0);
    this.hudDirty = true;
    this.writeForwardDirection(_forward);

    _raycaster.set(this.camera.position, _forward);
    _raycaster.far = 26;
    const wallHits = _raycaster.intersectObjects(this.mapData.wallMeshes, false);
    const targetPoint =
      wallHits.length > 0
        ? wallHits[0].point.clone()
        : this.position.clone().addScaledVector(_forward, 11);

    multiplayerClient.sendAbilityCast({
      agent: this.playerAgent,
      key,
      origin: { x: this.position.x, y: this.position.y, z: this.position.z },
      direction: { x: _forward.x, y: _forward.y, z: _forward.z },
      target: { x: targetPoint.x, y: targetPoint.y, z: targetPoint.z },
    });

    const actionKey = key as string;

    if (this.playerAgent === 'jett') {
      if (actionKey === 'c') {
        soundSystem.playDash();
        this.particleSystem.spawnSmoke(targetPoint, 12.0);
        this.setActiveBuff('AERO-SHROUD SMOKE', 'DISRUPTION', 12.0);
        this.showStatusBanner('AERO-SHROUD DEPLOYED // SIGHTLINE BLOCKED');
      } else if (actionKey === 'q') {
        soundSystem.playDash();
        this.velocity.y = 11.8;
        this.isGrounded = false;
        this.setActiveBuff('UPDRAFT AIRBORNE', 'MOBILITY', 2.0);
        this.showStatusBanner('UPDRAFT // VERTICAL PROPULSION!');
      } else if (actionKey === 'e') {
        soundSystem.playDash();
        _euler.set(0, this.cameraYaw, 0);
        const dashDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler);
        this.velocity.addScaledVector(dashDir, 25.0);
        this.setActiveBuff('TAILWIND DASH', 'MOBILITY', 1.2);
        this.showStatusBanner('TAILWIND DASH!');
      } else if (actionKey === 'x') {
        this.isBladestormActive = true;
        this.bladestormKnives = 5;
        this.updateViewModel();
        this.setActiveBuff('BLADESTORM KUNAI', 'MOBILITY', 20.0);
        this.showStatusBanner('BLADESTORM // 100% ACCURATE KUNAI EQUIPPED');
      }
    } else if (this.playerAgent === 'phoenix') {
      if (actionKey === 'c') {
        soundSystem.playDash();
        this.particleSystem.spawnFlameWall(this.position, _forward, 8.0);
        this.setActiveBuff('BLAZE FLAME WALL', 'SUPPORT', 8.0);
        this.showStatusBanner('BLAZE FLAME WALL DEPLOYED // HEALS PHOENIX');
      } else if (actionKey === 'q') {
        soundSystem.playFlashbang();
        this.flashAlpha = 0.55;
        const count = this.botManager.blindEnemiesNear(targetPoint, 18.0, this.playerTeam);
        this.setActiveBuff(`CURVEBALL (${count} BLINDED)`, 'DISRUPTION', 3.2);
        this.showStatusBanner(`CURVEBALL FLASH // ${count} ENEMIES BLINDED!`);
      } else if (actionKey === 'e') {
        soundSystem.playDash();
        this.particleSystem.spawnMolly(targetPoint, true, 6.5);
        this.setActiveBuff('HOT HANDS FIRE ZONE', 'SUPPORT', 6.5);
        this.showStatusBanner('HOT HANDS FIREBALL // BURNS ENEMIES & HEALS YOU');
      } else if (actionKey === 'x') {
        this.runItBackAnchor = this.position.clone();
        this.runItBackTimer = 12.0;
        this.particleSystem.spawnMolly(this.position, true, 12.0);
        this.setActiveBuff('RUN IT BACK ANCHOR', 'SUPPORT', 12.0);
        this.showStatusBanner('RUN IT BACK ACTIVE (12s RESPAWN ANCHOR)');
      }
    } else if (this.playerAgent === 'reyna') {
      if (actionKey === 'c') {
        soundSystem.playFlashbang();
        const eyePos = this.position.clone().addScaledVector(_forward, 6);
        this.particleSystem.spawnLeerEye(eyePos, 4.0);
        const count = this.botManager.blindEnemiesNear(eyePos, 22.0, this.playerTeam);
        this.setActiveBuff(`LEER NEARSIGHT (${count})`, 'DISRUPTION', 4.0);
        this.showStatusBanner(`LEER // ${count} ENEMIES NEARSIGHTED!`);
      } else if (actionKey === 'q') {
        soundSystem.playDefuseCheckpoint();
        this.health = Math.min(100, this.health + 50);
        this.shield = Math.min(50, this.shield + 25);
        this.setActiveBuff('DEVOUR OVERHEAL', 'SUPPORT', 3.0);
        this.showStatusBanner('DEVOUR // +50 HEALTH & OVERHEAL');
      } else if (actionKey === 'e') {
        soundSystem.playDash();
        this.dismissTimer = 2.8;
        this.setActiveBuff('DISMISS PHASE (INVULNERABLE)', 'MOBILITY', 2.8);
        this.showStatusBanner('DISMISS // INVULNERABLE & SPEED BOOST');
      } else if (actionKey === 'x') {
        this.empressTimer = 15.0;
        this.setActiveBuff('EMPRESS FRENZY', 'MOBILITY', 15.0);
        this.showStatusBanner('EMPRESS ACTIVE // RAPID FIRE & AUTO-DEVOUR');
      }
    } else if (this.playerAgent === 'sova') {
      if (actionKey === 'c') {
        soundSystem.playSpikeBeep(1100);
        this.particleSystem.spawnReconBeacon(targetPoint, 6.0);
        const tagged = this.botManager.revealEnemiesNear(targetPoint, 24.0, this.playerTeam, 6.0);
        this.setActiveBuff(`OWL DRONE SCAN (${tagged} TAGGED)`, 'RECON', 6.0);
        this.showStatusBanner(`OWL DRONE // ${tagged} ENEMIES TAGGED!`);
      } else if (actionKey === 'q') {
        soundSystem.playGunfire('operator', false);
        this.particleSystem.emitSparks(targetPoint, _upNormal, true, 18);
        this.particleSystem.emitTracer(this.camera.position, targetPoint);
        const enemies = this.botManager.getAliveBots(
          this.playerTeam === 'attackers' ? 'defenders' : 'attackers'
        );
        enemies.forEach((b) => {
          const dist = b.position.distanceTo(targetPoint);
          if (dist <= 5.8) {
            const dmg = Math.round(80 * (1 - dist / 6.8));
            const res = this.botManager.applyHitToBot(b.id, dmg, false);
            if (res.isEliminated && res.bot) {
              this.handlePlayerKill(res.bot, false, 'vandal');
            }
          }
        });
        this.showStatusBanner('SHOCK DART DETONATED!');
      } else if (actionKey === 'e') {
        soundSystem.playSpikeBeep(960);
        this.particleSystem.spawnReconBeacon(targetPoint, 7.0);
        const tagged = this.botManager.revealEnemiesNear(targetPoint, 26.0, this.playerTeam, 7.0);
        this.setActiveBuff(`RECON BOLT (${tagged} REVEALED)`, 'RECON', 7.0);
        this.showStatusBanner(`RECON BOLT // ${tagged} ENEMIES REVEALED!`);
      } else if (actionKey === 'x') {
        soundSystem.playGunfire('operator', false);
        this.particleSystem.spawnEnergyBeam(this.camera.position, _forward, 65);
        const enemies = this.botManager.getAliveBots(
          this.playerTeam === 'attackers' ? 'defenders' : 'attackers'
        );
        const ray = new THREE.Ray(this.camera.position, _forward);
        enemies.forEach((b) => {
          const botCenter = b.position.clone().add(new THREE.Vector3(0, 1.1, 0));
          if (ray.distanceToPoint(botCenter) < 1.35) {
            const res = this.botManager.applyHitToBot(b.id, 85, false);
            this.botManager.revealEnemiesNear(b.position, 4.0, this.playerTeam, 5.0);
            soundSystem.playHitmarker();
            if (res.isEliminated && res.bot) {
              this.handlePlayerKill(res.bot, false, 'operator');
            }
          }
        });
        this.setActiveBuff("HUNTER'S FURY BEAM", 'RECON', 2.5);
        this.showStatusBanner("HUNTER'S FURY // WALL-PIERCING BLAST!");
      }
    } else if (this.playerAgent === 'viper') {
      if (actionKey === 'c') {
        soundSystem.playDash();
        this.particleSystem.spawnMolly(targetPoint, false, 7.0, true);
        this.botManager.applyVulnerableNear(targetPoint, 5.5, this.playerTeam, 7.0);
        this.setActiveBuff('SNAKE BITE (1.5x VULNERABLE)', 'DISRUPTION', 7.0);
        this.showStatusBanner('SNAKE BITE // ACID APPLYING 1.5x VULNERABLE!');
      } else if (actionKey === 'q') {
        soundSystem.playDash();
        this.particleSystem.spawnSmoke(targetPoint, 14.0, true);
        this.setActiveBuff('POISON CLOUD TOXIN', 'DISRUPTION', 14.0);
        this.showStatusBanner('POISON CLOUD // TOXIC ORB ACTIVE');
      } else if (actionKey === 'e') {
        soundSystem.playDash();
        this.particleSystem.spawnFlameWall(this.position, _forward, 10.0);
        this.setActiveBuff('TOXIC SCREEN WALL', 'DISRUPTION', 10.0);
        this.showStatusBanner('TOXIC SCREEN // GAS WALL RAISED');
      } else if (actionKey === 'x') {
        this.particleSystem.spawnSmoke(this.position, 18.0, true);
        this.particleSystem.spawnMolly(this.position, false, 12.0, true);
        this.botManager.applyVulnerableNear(this.position, 14.0, this.playerTeam, 12.0);
        this.setActiveBuff("VIPER'S PIT CONTAINMENT", 'DISRUPTION', 18.0);
        this.showStatusBanner("VIPER'S PIT // TOXIC CONTAINMENT ZONE!");
      }
    } else if (this.playerAgent === 'omen') {
      if (actionKey === 'c') {
        soundSystem.playDash();
        const tpPos = targetPoint.clone();
        tpPos.y = 0;
        this.position.set(
          Math.max(-40, Math.min(40, tpPos.x)),
          0,
          Math.max(-46, Math.min(46, tpPos.z))
        );
        this.setActiveBuff('SHROUDED STEP BLINK', 'MOBILITY', 1.5);
        this.showStatusBanner('SHROUDED STEP // SHADOW BLINK COMPLETE');
      } else if (actionKey === 'q') {
        soundSystem.playFlashbang();
        this.particleSystem.spawnLeerEye(targetPoint, 4.5);
        const count = this.botManager.blindEnemiesNear(targetPoint, 20.0, this.playerTeam);
        this.setActiveBuff(`PARANOIA (${count} NEARSIGHTED)`, 'DISRUPTION', 4.5);
        this.showStatusBanner(`PARANOIA // ${count} ENEMIES NEARSIGHTED!`);
      } else if (actionKey === 'e') {
        soundSystem.playDash();
        this.particleSystem.spawnSmoke(targetPoint, 15.0);
        this.setActiveBuff('DARK COVER SPHERE', 'DISRUPTION', 15.0);
        this.showStatusBanner('DARK COVER // SHADOW SPHERE DEPLOYED');
      } else if (actionKey === 'x') {
        soundSystem.playDash();
        this.dismissTimer = 3.0;
        this.position.set(0, 0, this.playerTeam === 'attackers' ? -26 : 24);
        this.setActiveBuff('FROM THE SHADOWS CLOAK', 'MOBILITY', 3.0);
        this.showStatusBanner('FROM THE SHADOWS // TELEPORTED BEHIND LINES!');
      }
    } else if (this.playerAgent === 'sage') {
      if (actionKey === 'c') {
        soundSystem.playDefuseCheckpoint();
        // Spawns a 4-segment solid crystalline barrier wall with real AABB collision & 400 HP destructible blocks!
        this.particleSystem.spawnBarrierWall(
          this.position,
          _forward,
          this.mapData.colliders,
          28.0
        );
        this.setActiveBuff('FORTIFIED BARRIER WALL (4x400 HP)', 'DEFENSIVE', 28.0);
        this.showStatusBanner('BARRIER ORB // SOLID 4-SEGMENT ICE WALL DEPLOYED!');
      } else if (actionKey === 'q') {
        soundSystem.playDash();
        this.particleSystem.spawnSlowZone(targetPoint, 7.0);
        const count = this.botManager.slowEnemiesNear(targetPoint, 12.0, this.playerTeam);
        this.setActiveBuff(`SLOW ORB FIELD (${count} SLOWED)`, 'DEFENSIVE', 7.0);
        this.showStatusBanner('SLOW ORB // ICE CRYSTAL FIELD DEPLOYED');
      } else if (actionKey === 'e') {
        soundSystem.playDefuseCheckpoint();
        this.health = 100;
        this.setActiveBuff('RADIANT HEALING ORB', 'SUPPORT', 4.0);
        this.showStatusBanner('HEALING ORB // RESTORED TO 100 HP');
      } else if (actionKey === 'x') {
        soundSystem.playAceFanfare();
        const revivedName = this.botManager.reviveOneAlly(this.playerTeam);
        this.health = 100;
        this.shield = 50;
        this.setActiveBuff('RESURRECTION AEGIS', 'SUPPORT', 6.0);
        this.showStatusBanner(
          revivedName
            ? `RESURRECTION // REVIVED ${revivedName.toUpperCase()} + FULL SHIELD!`
            : 'RESURRECTION // RADIANT AEGIS OVERSHIELD GRANTED!'
        );
      }
    } else if (this.playerAgent === 'cypher') {
      if (actionKey === 'c') {
        soundSystem.playSpikeBeep(1020);
        this.particleSystem.spawnReconBeacon(targetPoint, 12.0);
        this.particleSystem.spawnSlowZone(targetPoint, 12.0);
        this.botManager.slowEnemiesNear(targetPoint, 9.0, this.playerTeam);
        this.botManager.revealEnemiesNear(targetPoint, 12.0, this.playerTeam, 8.0);
        this.setActiveBuff('TRAPWIRE TETHER ACTIVE', 'DEFENSIVE', 12.0);
        this.showStatusBanner('TRAPWIRE // TETHER & CONCUSS ARMED');
      } else if (actionKey === 'q') {
        soundSystem.playDash();
        this.particleSystem.spawnSmoke(targetPoint, 9.0);
        this.setActiveBuff('CYBER CAGE ACTIVE', 'DEFENSIVE', 9.0);
        this.showStatusBanner('CYBER CAGE // ACTIVATED');
      } else if (actionKey === 'e') {
        soundSystem.playSpikeBeep(1240);
        this.particleSystem.spawnReconBeacon(targetPoint, 9.0);
        const tagged = this.botManager.revealEnemiesNear(targetPoint, 28.0, this.playerTeam, 9.0);
        this.setActiveBuff(`SPYCAM DART (${tagged} TAGGED)`, 'RECON', 9.0);
        this.showStatusBanner(`SPYCAM // ${tagged} ENEMIES TRACKED!`);
      } else if (actionKey === 'x') {
        soundSystem.playSpikeDefused();
        this.particleSystem.spawnReconBeacon(new THREE.Vector3(0, 1, 0), 10.0);
        const tagged = this.botManager.revealEnemiesNear(
          new THREE.Vector3(0, 0, 0),
          120.0,
          this.playerTeam,
          10.0
        );
        this.setActiveBuff(`NEURAL THEFT (${tagged} REVEALED)`, 'RECON', 10.0);
        this.showStatusBanner(`NEURAL THEFT // ALL ${tagged} ENEMIES REVEALED!`);
      }
    }
  }

  private triggerMuzzleFlash() {
    this.muzzleFlashTimer = 0.048;
    if (this.muzzleFlashObj) {
      this.muzzleFlashObj.visible = true;
      this.muzzleFlashObj.rotation.z = Math.random() * Math.PI * 2;
    }
    this.muzzlePointLight.intensity = 4.5;
  }

  private attemptShoot() {
    if (!this.isPlayerAlive || this.isReloading) return;

    if (this.isBladestormActive) {
      this.fireBladestormKunai();
      return;
    }

    const activeWepId = this.getActiveWeaponId();
    const weapon = WEAPONS[activeWepId];
    const stock = this.ammoStock[activeWepId];
    if (!weapon || !stock) return;

    if (activeWepId === 'knife') {
      this.fireKnife();
      return;
    }

    if (stock.mag <= 0) {
      this.triggerReload();
      return;
    }

    const now = performance.now() / 1000;
    const fireRateMult = this.empressTimer > 0 ? 1.35 : 1.0;
    const shotInterval = 1 / (weapon.fireRate * fireRateMult);
    if (now - this.lastShotTime < shotInterval) return;

    this.lastShotTime = now;
    stock.mag -= 1;
    this.continuousShots += 1;
    this.inspectTimer = 0;
    if (this.rangeChallenge.active) {
      this.rangeChallenge.shotsFired += 1;
    }
    this.hudDirty = true;

    this.triggerMuzzleFlash();
    soundSystem.playGunfire(activeWepId, false);
    this.botManager.alertBotsNearGunfire(this.position, this.playerTeam);

    // Deterministic, learnable weapon recoil curve
    const recoilStep = sampleWeaponRecoilStep(
      activeWepId,
      this.continuousShots,
      this.isCrouching,
      this.isScoped
    );

    const maxPitch = weapon.maxContinuousRecoilPitch ?? 0.25;
    const maxYaw = weapon.maxContinuousRecoilYaw ?? 0.09;
    this.recoilPitchOffset = Math.min(maxPitch, this.recoilPitchOffset + recoilStep.pitchStep);
    this.recoilYawOffset = Math.max(-maxYaw, Math.min(maxYaw, this.recoilYawOffset + recoilStep.yawStep));

    // Synchronize camera rotation immediately so visual orientation and matrices match the shot frame
    const totalPitch = this.cameraPitch + this.recoilPitchOffset;
    const totalYaw = this.cameraYaw + this.recoilYawOffset;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = totalYaw;
    this.camera.rotation.x = totalPitch;
    this.camera.rotation.z = this.cameraRoll;
    this.camera.updateMatrixWorld();

    if (this.currentViewModel) {
      this.currentViewModel.position.z += recoilStep.viewKickZ;
      this.currentViewModel.rotation.x -= recoilStep.viewKickPitch;
    }

    // Evaluate dynamic movement accuracy state based on actual velocity
    const movementEval = evaluateMovementState(
      this.velocity,
      this.cameraYaw,
      this.isGrounded,
      this.landingDipOffset,
      this.isCrouching,
      this.isSprinting,
      this.isScoped
    );
    this.currentMovementState = movementEval.state;

    const spreadResult = computeWeaponSpread(
      weapon,
      movementEval,
      this.continuousShots,
      this.movementInaccuracy
    );
    const finalSpread = spreadResult.finalSpread;

    const pelletCount = weapon.pellets || 1;
    _muzzlePos.set(0.22, -0.18, -0.5).applyEuler(this.camera.rotation).add(this.camera.position);

    const enemyBots = this.botManager.getAliveBots(
      this.gameMode === 'dm'
        ? undefined
        : this.playerTeam === 'attackers'
        ? 'defenders'
        : 'attackers'
    );
    const hitboxesToTest: THREE.Mesh[] = [];
    for (let i = 0; i < enemyBots.length; i++) {
      hitboxesToTest.push(...enemyBots[i].hitboxes);
    }
    this.remotePlayers.forEach((rp) => {
      if (rp.state.isAlive && (this.gameMode === 'dm' || rp.state.team !== this.playerTeam)) {
        hitboxesToTest.push(...rp.hitboxes);
      }
    });

    // Include destructible 3D deployables (Sage Barrier Segments, Recon Beacons)
    const destructibleMeshes = this.particleSystem.getDestructibleMeshes();

    // Base aim direction aligned with camera view and crosshair
    this.writeForwardDirection(_forward);

    // Screen-space orthogonal basis vectors for true conical spread
    _euler.set(totalPitch, totalYaw, 0, 'YXZ');
    _right.set(1, 0, 0).applyEuler(_euler).normalize();
    _camUp.set(0, 1, 0).applyEuler(_euler).normalize();

    for (let p = 0; p < pelletCount; p++) {
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadRadius = Math.sqrt(Math.random()) * finalSpread;
      _bulletDir
        .copy(_forward)
        .addScaledVector(_right, Math.cos(spreadAngle) * spreadRadius)
        .addScaledVector(_camUp, Math.sin(spreadAngle) * spreadRadius)
        .normalize();

      _raycaster.set(this.camera.position, _bulletDir);
      _raycaster.far = 130;

      const wallHits = _raycaster.intersectObjects(
        [...this.mapData.wallMeshes, ...destructibleMeshes],
        false
      );
      const closestWallDist = wallHits.length > 0 ? wallHits[0].distance : 130;
      const closestWallPoint =
        wallHits.length > 0
          ? wallHits[0].point
          : _endPoint.copy(this.camera.position).addScaledVector(_bulletDir, 65);
      const closestWallNormal =
        wallHits.length > 0 && wallHits[0].face
          ? wallHits[0].face.normal
          : _upNormal;

      const targetHits = _raycaster.intersectObjects(hitboxesToTest, false);

      if (targetHits.length > 0 && targetHits[0].distance < closestWallDist) {
        const firstHit = targetHits[0];
        const hitMesh = firstHit.object as THREE.Mesh;
        const zone = (hitMesh.userData.zone as 'head' | 'body' | 'leg') || 'body';
        const isHeadshot = zone === 'head';
        const dmg = calculateDamage(activeWepId, zone);

        if (isHeadshot) {
          soundSystem.playHeadshotDink();
        } else {
          soundSystem.playHitmarker();
        }

        if (this.rangeChallenge.active && p === 0) {
          this.rangeChallenge.shotsHit += 1;
        }

        this.particleSystem.emitSparks(
          firstHit.point,
          firstHit.normal || _upNormal,
          true,
          pelletCount > 1 ? 4 : 10
        );
        this.particleSystem.emitTracer(_muzzlePos, firstHit.point);

        if (hitMesh.userData.isRemotePlayer) {
          const remotePlayerId = hitMesh.userData.playerId as string;
          const remoteEntity = this.remotePlayers.get(remotePlayerId);
          this.recordHitConfirmation(
            dmg,
            isHeadshot,
            remoteEntity?.state.name || 'OPERATIVE'
          );
          multiplayerClient.sendShoot({
            weaponId: activeWepId,
            origin: { x: _muzzlePos.x, y: _muzzlePos.y, z: _muzzlePos.z },
            target: { x: firstHit.point.x, y: firstHit.point.y, z: firstHit.point.z },
            hitPlayerId: remotePlayerId,
            damage: dmg,
            isHeadshot,
          });
        } else {
          const botId = hitMesh.userData.botId as string;
          const hitResult = this.botManager.applyHitToBot(botId, dmg, isHeadshot);
          if (hitResult.bot) {
            this.recordHitConfirmation(
              hitResult.actualDamage,
              isHeadshot,
              hitResult.bot.name
            );
          }
          if (hitResult.isEliminated && hitResult.bot) {
            this.handlePlayerKill(hitResult.bot, isHeadshot, activeWepId);
          }
          if (p === 0) {
            multiplayerClient.sendShoot({
              weaponId: activeWepId,
              origin: { x: _muzzlePos.x, y: _muzzlePos.y, z: _muzzlePos.z },
              target: { x: firstHit.point.x, y: firstHit.point.y, z: firstHit.point.z },
            });
          }
        }
      } else {
        // Check if player hit a destructible deployable (Sage Barrier Segment or Recon Beacon)
        if (wallHits.length > 0) {
          const hitObj = wallHits[0].object;
          if (hitObj.userData.isDestructibleBarrier) {
            const dmg = calculateDamage(activeWepId, 'body');
            const res = this.particleSystem.damageBarrierSegment(
              hitObj.userData.barrierId,
              dmg
            );
            soundSystem.playHitmarker();
            this.showStatusBanner(
              res.destroyed
                ? 'BARRIER SEGMENT SHATTERED!'
                : `BARRIER DAMAGED (${res.hp} HP REMAINING)`,
              1.4
            );
          } else if (hitObj.userData.isDestructibleBeacon) {
            const destroyed = this.particleSystem.damageReconBeacon(
              hitObj.userData.beaconId,
              calculateDamage(activeWepId, 'body')
            );
            soundSystem.playHitmarker();
            if (destroyed) {
              this.showStatusBanner('UTILITY DESTROYED!', 1.5);
            }
          } else if (p === 0) {
            this.particleSystem.emitBulletDecal(closestWallPoint, closestWallNormal);
          }
        }

        this.particleSystem.emitTracer(_muzzlePos, closestWallPoint);
        this.particleSystem.emitSparks(
          closestWallPoint,
          closestWallNormal,
          false,
          pelletCount > 1 ? 2 : 5
        );
        if (p === 0) {
          multiplayerClient.sendShoot({
            weaponId: activeWepId,
            origin: { x: _muzzlePos.x, y: _muzzlePos.y, z: _muzzlePos.z },
            target: { x: closestWallPoint.x, y: closestWallPoint.y, z: closestWallPoint.z },
          });
        }
      }
    }
  }

  private recordHitConfirmation(damage: number, isHeadshot: boolean, targetName: string) {
    this.lastHitEvent = {
      id: Date.now() + Math.random(),
      damage,
      isHeadshot,
      targetName,
    };
    this.hitEventTimer = 0.85;
    this.hudDirty = true;
  }

  private fireBladestormKunai() {
    const now = performance.now() / 1000;
    if (now - this.lastShotTime < 0.22) return;
    this.lastShotTime = now;

    this.bladestormKnives -= 1;
    soundSystem.playDash();

    this.writeForwardDirection(_forward);
    _raycaster.set(this.camera.position, _forward);
    _raycaster.far = 120;

    const wallHits = _raycaster.intersectObjects(this.mapData.wallMeshes, false);
    const closestWallDist = wallHits.length > 0 ? wallHits[0].distance : 120;
    const closestWallPoint =
      wallHits.length > 0
        ? wallHits[0].point
        : _endPoint.copy(this.camera.position).addScaledVector(_forward, 60);

    const enemyBots = this.botManager.getAliveBots(
      this.gameMode === 'dm'
        ? undefined
        : this.playerTeam === 'attackers'
        ? 'defenders'
        : 'attackers'
    );
    const hitboxesToTest: THREE.Mesh[] = [];
    enemyBots.forEach((b) => hitboxesToTest.push(...b.hitboxes));

    const botHits = _raycaster.intersectObjects(hitboxesToTest, false);
    _muzzlePos.set(0.1, -0.15, -0.4).applyEuler(this.camera.rotation).add(this.camera.position);

    if (botHits.length > 0 && botHits[0].distance < closestWallDist) {
      const hit = botHits[0];
      const zone = (hit.object.userData.zone as 'head' | 'body' | 'leg') || 'body';
      const isHeadshot = zone === 'head';
      const dmg = isHeadshot ? 150 : 50;
      const res = this.botManager.applyHitToBot(hit.object.userData.botId, dmg, isHeadshot);

      if (isHeadshot) soundSystem.playHeadshotDink();
      else soundSystem.playHitmarker();

      if (res.bot) {
        this.recordHitConfirmation(res.actualDamage, isHeadshot, res.bot.name);
      }

      this.particleSystem.emitSparks(hit.point, _upNormal, true, 12);
      this.particleSystem.emitTracer(_muzzlePos, hit.point);

      if (res.isEliminated && res.bot) {
        this.bladestormKnives = 5;
        this.handlePlayerKill(res.bot, isHeadshot, 'knife');
      }
    } else {
      this.particleSystem.emitTracer(_muzzlePos, closestWallPoint);
      this.particleSystem.emitSparks(closestWallPoint, _upNormal, false, 5);
    }

    if (this.bladestormKnives <= 0) {
      this.isBladestormActive = false;
      this.updateViewModel();
    }
    this.hudDirty = true;
  }

  private fireKnife() {
    this.writeForwardDirection(_forward);
    _raycaster.set(this.camera.position, _forward);
    _raycaster.far = 2.8;

    if (this.currentViewModel) {
      this.currentViewModel.position.z -= 0.1;
      this.currentViewModel.rotation.y += 0.35;
    }

    const enemyBots = this.botManager.getAliveBots(
      this.gameMode === 'dm'
        ? undefined
        : this.playerTeam === 'attackers'
        ? 'defenders'
        : 'attackers'
    );
    const hitboxesToTest: THREE.Mesh[] = [];
    for (let i = 0; i < enemyBots.length; i++) {
      hitboxesToTest.push(...enemyBots[i].hitboxes);
    }

    const hits = _raycaster.intersectObjects(hitboxesToTest, false);
    if (hits.length > 0) {
      const hit = hits[0];
      const botId = hit.object.userData.botId;
      const zone = hit.object.userData.zone || 'body';
      const isHeadshot = zone === 'head';
      const dmg = calculateDamage('knife', zone);
      const res = this.botManager.applyHitToBot(botId, dmg, isHeadshot);

      soundSystem.playHitmarker();
      this.particleSystem.emitSparks(hit.point, _upNormal, true, 6);
      if (res.bot) {
        this.recordHitConfirmation(res.actualDamage, isHeadshot, res.bot.name);
      }

      if (res.isEliminated && res.bot) {
        this.handlePlayerKill(res.bot, isHeadshot, 'knife');
      }
    }
  }

  private handlePlayerKill(victim: BotState, isHeadshot: boolean, weaponId: WeaponId) {
    this.killStreakCount += 1;
    this.playerKills += 1;
    if (isHeadshot) this.playerHeadshots += 1;
    this.credits = Math.min(9000, this.credits + 200);
    const maxUlt = AGENTS[this.playerAgent].abilities.x.ultPointsRequired;
    this.ultPoints = Math.min(maxUlt, this.ultPoints + 1);
    if (this.ultPoints >= maxUlt) {
      this.abilityCharges.x = 1;
    }

    if (this.empressTimer > 0) {
      this.health = 100;
      this.shield = 50;
    }

    if (this.rangeChallenge.active) {
      this.rangeChallenge.kills += 1;
      if (this.rangeChallenge.kills >= this.rangeChallenge.targetKills) {
        this.rangeChallenge.active = false;
        const finalTime = Number(this.rangeChallenge.elapsed.toFixed(2));
        if (
          this.rangeChallenge.bestTime === null ||
          finalTime < this.rangeChallenge.bestTime
        ) {
          this.rangeChallenge.bestTime = finalTime;
        }
        soundSystem.playAceFanfare();
        this.showStatusBanner(
          `CHALLENGE COMPLETE: ${finalTime}s! (BEST: ${this.rangeChallenge.bestTime}s)`,
          4.5
        );
      }
    }

    this.hudDirty = true;
    soundSystem.playKillSound(isHeadshot);

    this.killBannerEvent = {
      count: this.killStreakCount,
      isHeadshot,
      victimName: victim.name,
    };
    this.killBannerTimeout = 3.5;

    this.onKillfeedAdd({
      id: `kill_${Date.now()}_${Math.random()}`,
      killerName: this.playerCallsign,
      killerTeam: this.playerTeam,
      victimName: victim.name,
      victimTeam: victim.team,
      weaponId,
      isHeadshot,
      timestamp: Date.now(),
    });

    if (this.gameMode === 'dm') {
      this.attackersScore = this.playerKills;
      if (this.playerKills >= 20) {
        this.roundPhase = 'matchOver';
        this.onMatchEnd(this.playerTeam);
      }
    } else if (this.gameMode === 'tdm') {
      if (this.playerTeam === 'attackers') this.attackersScore += 1;
      else this.defendersScore += 1;
      if (this.attackersScore >= 30 || this.defendersScore >= 30) {
        this.roundPhase = 'matchOver';
        this.onMatchEnd(this.attackersScore >= 30 ? 'attackers' : 'defenders');
      }
    } else if (this.gameMode !== 'range') {
      this.checkRoundEndCondition();
    }
  }

  private checkRoundEndCondition() {
    if (
      this.roundPhase !== 'action' ||
      this.gameMode === 'range' ||
      this.gameMode === 'dm' ||
      this.gameMode === 'tdm'
    ) {
      return;
    }

    const aliveEnemies = this.botManager.getAliveBots(
      this.playerTeam === 'attackers' ? 'defenders' : 'attackers'
    );
    const aliveAllies = this.botManager.getAliveBots(this.playerTeam);
    const totalAlliesAlive = (this.isPlayerAlive ? 1 : 0) + aliveAllies.length;

    if (this.spikeState.status === 'planted' || this.spikeState.status === 'defusing') {
      if (totalAlliesAlive === 0 && this.playerTeam === 'defenders') {
        this.endRound('attackers', 'elimination');
      }
      return;
    }

    if (aliveEnemies.length === 0 && this.botManager.botsEnabled) {
      this.endRound(this.playerTeam, 'elimination');
    } else if (totalAlliesAlive === 0) {
      this.endRound(
        this.playerTeam === 'attackers' ? 'defenders' : 'attackers',
        'elimination'
      );
    }
  }

  private endRound(
    winner: TeamSide,
    reason: 'elimination' | 'spike_detonated' | 'spike_defused' | 'time_expired'
  ) {
    this.roundPhase = 'roundEnd';
    this.phaseTimeRemaining = 5;
    this.hudDirty = true;

    if (winner === 'attackers') {
      this.attackersScore += 1;
    } else {
      this.defendersScore += 1;
    }

    const playerWon = winner === this.playerTeam;
    if (playerWon) {
      soundSystem.playAceFanfare();
      this.showStatusBanner(`ROUND WON (${reason.toUpperCase()}) // +$3,000`, 4.5);
    } else {
      this.showStatusBanner(`ROUND LOST (${reason.toUpperCase()}) // +$1,900`, 4.5);
    }

    const econ = calculateRoundEndCredits(playerWon, 0);
    this.credits = Math.min(9000, this.credits + econ.reward);

    const targetWins = this.gameMode === 'spikerush' ? 3 : 5;
    if (this.attackersScore >= targetWins || this.defendersScore >= targetWins) {
      this.roundPhase = 'matchOver';
      this.onMatchEnd(winner);
    }
  }

  private startNewRound() {
    this.roundPhase = 'buy';
    this.phaseTimeRemaining = this.gameMode === 'spikerush' ? 3 : 6;
    this.isPlayerAlive = true;
    this.health = 100;
    this.shield = 50;
    this.killStreakCount = 0;
    this.isBladestormActive = false;
    this.activeAbilityBuff = null;
    this.updateViewModel();
    this.hudDirty = true;
    soundSystem.resetKillStreak();

    this.abilityCharges.e = AGENTS[this.playerAgent].abilities.e.maxCharges;

    const spawn =
      this.playerTeam === 'attackers'
        ? this.mapData.spawnAttacker
        : this.mapData.spawnDefender;
    this.position.set(spawn.x, 0, spawn.z);
    this.camera.position.set(spawn.x, 1.7, spawn.z);
    this.velocity.set(0, 0, 0);

    Object.keys(this.ammoStock).forEach((k) => {
      const wep = WEAPONS[k as WeaponId];
      if (wep) {
        this.ammoStock[k as WeaponId].mag = wep.magazineSize;
        this.ammoStock[k as WeaponId].reserve = wep.maxReserve;
      }
    });

    this.spikeState = createInitialSpikeState();
    if (this.spikeMesh) {
      this.scene.remove(this.spikeMesh);
      this.spikeMesh = null;
    }

    this.mapData.barrierMeshes.forEach((m) => (m.visible = true));
    this.botManager.resetForRound(this.playerTeam);
    this.particleSystem.clearAll();
    multiplayerClient.sendRoundEvent('newRound');
    soundSystem.playRoundStartHorn();
  }

  private update(dt: number) {
    const now = performance.now() / 1000;

    if (this.rangeChallenge.active) {
      this.rangeChallenge.elapsed += dt;
      this.hudDirty = true;
    }

    // Muzzle flash decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      if (this.muzzleFlashTimer <= 0) {
        if (this.muzzleFlashObj) this.muzzleFlashObj.visible = false;
        this.muzzlePointLight.intensity = 0;
      }
    }

    // Hit confirmation decay
    if (this.hitEventTimer > 0) {
      this.hitEventTimer = Math.max(0, this.hitEventTimer - dt);
      if (this.hitEventTimer <= 0) {
        this.lastHitEvent = null;
        this.hudDirty = true;
      }
    }

    // Active ability buff bar decay
    if (this.activeAbilityBuff) {
      this.activeAbilityBuff.remaining = Math.max(
        0,
        this.activeAbilityBuff.remaining - dt
      );
      if (this.activeAbilityBuff.remaining <= 0) {
        this.activeAbilityBuff = null;
      }
      this.hudDirty = true;
    }

    // Respawn player in TDM / DM / Range if killed
    if (
      !this.isPlayerAlive &&
      (this.gameMode === 'tdm' || this.gameMode === 'dm' || this.gameMode === 'range')
    ) {
      this.playerRespawnTimer -= dt;
      if (this.playerRespawnTimer <= 0) {
        this.isPlayerAlive = true;
        this.health = 100;
        this.shield = 50;
        this.position.set((Math.random() - 0.5) * 10, 0, 31.2);
        this.showStatusBanner('RESPAWNED // BACK IN COMBAT', 1.8);
        this.hudDirty = true;
      }
    }

    if (this.gameMode !== 'range') {
      this.phaseTimeRemaining -= dt;
      if (this.phaseTimeRemaining <= 0) {
        if (this.roundPhase === 'buy') {
          this.skipBuyPhase(false);
        } else if (this.roundPhase === 'action') {
          if (this.gameMode === 'tdm' || this.gameMode === 'dm') {
            this.roundPhase = 'matchOver';
            this.onMatchEnd(
              this.attackersScore >= this.defendersScore ? 'attackers' : 'defenders'
            );
          } else if (
            this.spikeState.status !== 'planted' &&
            this.spikeState.status !== 'defusing'
          ) {
            this.endRound('defenders', 'time_expired');
          }
        } else if (this.roundPhase === 'roundEnd') {
          this.startNewRound();
        }
      }
    }

    if (this.dismissTimer > 0) this.dismissTimer = Math.max(0, this.dismissTimer - dt);
    if (this.empressTimer > 0) this.empressTimer = Math.max(0, this.empressTimer - dt);
    if (this.inspectTimer > 0) this.inspectTimer = Math.max(0, this.inspectTimer - dt);
    if (this.moduleCastTimer > 0) this.moduleCastTimer = Math.max(0, this.moduleCastTimer - dt);
    if (this.unequipAnimTimer > 0) {
      this.unequipAnimTimer = Math.max(0, this.unequipAnimTimer - dt);
      if (this.unequipAnimTimer <= 0 && this.pendingWeaponSlot) {
        this.activeSlot = this.pendingWeaponSlot;
        this.pendingWeaponSlot = null;
        this.equipAnimTimer = 0.32;
        this.updateViewModel();
        this.hudDirty = true;
      }
    } else if (this.equipAnimTimer > 0) {
      this.equipAnimTimer = Math.max(0, this.equipAnimTimer - dt);
    }
    if (this.runItBackTimer > 0) {
      this.runItBackTimer = Math.max(0, this.runItBackTimer - dt);
      if (this.runItBackTimer <= 0) this.runItBackAnchor = null;
    }
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) {
        this.statusBanner = null;
        this.hudDirty = true;
      }
    }

    // 2. MOLLY & FLAME WALL BURN / HEAL TICK
    this.burnTickTimer += dt;
    if (this.burnTickTimer >= 0.25) {
      this.burnTickTimer = 0;
      const mollies = this.particleSystem.getMollyFires();
      const enemyBots = this.botManager.getAliveBots(
        this.playerTeam === 'attackers' ? 'defenders' : 'attackers'
      );

      for (let i = 0; i < mollies.length; i++) {
        const mf = mollies[i];
        if (
          this.playerAgent === 'phoenix' &&
          !mf.isAcid &&
          this.position.distanceTo(mf.position) <= mf.radius
        ) {
          if (this.health < 100) {
            this.health = Math.min(100, this.health + 6);
            this.hudDirty = true;
          }
        }
        for (let j = 0; j < enemyBots.length; j++) {
          const b = enemyBots[j];
          if (b.position.distanceTo(mf.position) <= mf.radius) {
            if (mf.isAcid) {
              b.vulnerableTimer = Math.max(b.vulnerableTimer, 1.5);
            }
            const res = this.botManager.applyHitToBot(b.id, 12, false);
            if (res.isEliminated && res.bot) {
              this.handlePlayerKill(res.bot, false, 'vandal');
            }
          }
        }
      }
    }

    // 3. SPIKE TICK & SOUND
    if (this.spikeState.status === 'planted' || this.spikeState.status === 'defusing') {
      const tickRes = tickSpikeTimer(this.spikeState, dt);
      this.spikeState = tickRes.state;

      const interval = getSpikeBeepInterval(this.spikeState.timeRemaining);
      if (now - this.lastSpikeBeepTime >= interval) {
        this.lastSpikeBeepTime = now;
        soundSystem.playSpikeBeep(this.spikeState.timeRemaining < 10 ? 1200 : 880);
      }

      if (tickRes.justDetonated) {
        soundSystem.playSpikeExplosion();
        this.endRound('attackers', 'spike_detonated');
      }
    }

    const currentPlantZone = this.checkInsidePlantZone(this.position);
    const isInsidePlantZone = currentPlantZone !== null;

    if (this.isPlantDefuseKeyDown && this.isPlayerAlive && this.roundPhase === 'action') {
      if (
        this.playerTeam === 'attackers' &&
        isInsidePlantZone &&
        currentPlantZone &&
        this.spikeState.status === 'unplanted'
      ) {
        const plantRes = updatePlantProgress(
          this.spikeState,
          dt,
          true,
          this.playerCallsign,
          currentPlantZone.site,
          { x: this.position.x, y: 0, z: this.position.z }
        );
        this.spikeState = plantRes.state;
        this.hudDirty = true;

        if (plantRes.justPlanted) {
          this.spikeMesh = createSpikeMesh();
          this.spikeMesh.position.set(this.position.x, 0, this.position.z);
          this.scene.add(this.spikeMesh);
          soundSystem.playSpikeBeep(1000);
          this.credits = Math.min(9000, this.credits + 300);
          this.botManager.notifySpikePlanted(currentPlantZone.site);
          this.showStatusBanner(
            `SPIKE PLANTED ON SITE ${currentPlantZone.site} // DEFEND IT!`
          );
        }
      } else if (
        this.playerTeam === 'defenders' &&
        (this.spikeState.status === 'planted' || this.spikeState.status === 'defusing')
      ) {
        const distToSpike = this.spikeMesh
          ? this.position.distanceTo(this.spikeMesh.position)
          : 999;
        if (distToSpike < 3.5) {
          const defuseRes = updateDefuseProgress(
            this.spikeState,
            dt,
            true,
            this.playerCallsign
          );
          if (
            defuseRes.state.hasHalfDefuseCheckpoint &&
            !this.spikeState.hasHalfDefuseCheckpoint
          ) {
            soundSystem.playDefuseCheckpoint();
          }
          this.spikeState = defuseRes.state;
          this.hudDirty = true;

          if (defuseRes.justDefused) {
            soundSystem.playSpikeDefused();
            this.endRound('defenders', 'spike_defused');
          }
        }
      }
    } else {
      if (this.spikeState.status === 'planting') {
        this.spikeState = updatePlantProgress(
          this.spikeState,
          dt,
          false,
          '',
          'A',
          { x: 0, y: 0, z: 0 }
        ).state;
        this.hudDirty = true;
      } else if (this.spikeState.status === 'defusing') {
        this.spikeState = updateDefuseProgress(this.spikeState, dt, false, '').state;
        this.hudDirty = true;
      }
    }

    if (this.spikeMesh) {
      const core = this.spikeMesh.getObjectByName('SpikeCore');
      if (core) core.rotation.y += dt * 4;
    }

    // 4. RELOAD TIMER
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.completeReload();
      }
    }

    // 5. AUTOMATIC WEAPON SPRAY
    if (this.isMouseDown && !this.isReloading) {
      const activeWep = WEAPONS[this.getActiveWeaponId()];
      if (activeWep && activeWep.isAutomatic && !this.isBladestormActive) {
        this.attemptShoot();
      }
    }

    // 6. RECOIL RECOVERY (Smooth exponential return when firing stops)
    const activeWep = WEAPONS[this.getActiveWeaponId()];
    const recRate = activeWep ? activeWep.recoilRecoveryRate : 6.0;
    if (!this.isMouseDown || this.isReloading) {
      const decay = Math.exp(-recRate * 2.8 * dt);
      this.recoilPitchOffset *= decay;
      this.recoilYawOffset *= decay;
      if (this.recoilPitchOffset < 0.0001) this.recoilPitchOffset = 0;
      if (Math.abs(this.recoilYawOffset) < 0.0001) this.recoilYawOffset = 0;
    }

    // 7. PLAYER MOVEMENT & COLLISION (Unmodified fluid movement physics)
    this.updatePlayerMovement(dt);

    // Dynamic Movement-Based Accuracy Tracking & Smooth Recovery
    const moveEval = evaluateMovementState(
      this.velocity,
      this.cameraYaw,
      this.isGrounded,
      this.landingDipOffset,
      this.isCrouching,
      this.isSprinting,
      this.isScoped
    );
    this.currentMovementState = moveEval.state;

    if (moveEval.horizontalSpeed > 0.4 || !this.isGrounded) {
      // Rapid penalty build-up when moving or airborne
      this.movementInaccuracy = Math.min(1.0, this.movementInaccuracy + dt * 22.0);
    } else {
      // Smooth, rapid counter-strafe recovery to pinpoint first-shot accuracy
      this.movementInaccuracy = Math.max(0, this.movementInaccuracy - dt * 14.0);
    }

    if (this.landingDipOffset > 0) {
      this.landingDipOffset = Math.max(0, this.landingDipOffset - dt * 0.45);
    }

    // 8. CAMERA, SPRINT FOV SURGE & VIEWMODEL MULTI-STAGE ANIMATION
    if (!this.isScoped) {
      const targetFov =
        this.settings.fov + (this.isSprinting || this.dismissTimer > 0 ? 4.5 : 0);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
        this.camera.updateProjectionMatrix();
      }
    }

    const totalPitch = this.cameraPitch + this.recoilPitchOffset;
    const totalYaw = this.cameraYaw + this.recoilYawOffset;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = totalYaw;
    this.camera.rotation.x = totalPitch;
    this.camera.rotation.z = this.cameraRoll;

    if (this.currentViewModel) {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const baseZ = this.isBladestormActive
        ? -0.25
        : this.getActiveWeaponId() === 'vandal'
        ? -0.4
        : -0.38;
      const baseX = this.isBladestormActive ? 0.05 : 0.24;

      const reloadProgress = this.isReloading
        ? 1 - this.reloadTimer / Math.max(0.1, this.reloadDuration)
        : 0;

      // Detect whether player is on metal catwalk or central steel floor drainage grate
      const onMetalSurface =
        this.position.y > 0.35 ||
        (Math.abs(this.position.x - -1.1) < 1.1 && this.position.z > -4 && this.position.z < 44);

      const pose = this.animController.update(
        {
          dt,
          speed,
          velocityY: this.velocity.y,
          isGrounded: this.isGrounded,
          wasGrounded: this.wasGroundedLastFrame,
          isCrouching: this.isCrouching,
          isSprinting: this.isSprinting,
          isWalkingSlow: Boolean(this.keysHeld.has('ShiftLeft') && !this.isSprinting),
          isFiring: this.muzzleFlashTimer > 0,
          timeSinceLastShot: Math.max(0, now - this.lastShotTime),
          isReloading: this.isReloading,
          reloadProgress,
          equipTimer: this.equipAnimTimer,
          unequipTimer: this.unequipAnimTimer,
          inspectTimer: this.inspectTimer,
          moduleCastTimer: this.moduleCastTimer,
          lookDeltaX: this.frameLookDeltaX,
          lookDeltaY: this.frameLookDeltaY,
          onMetalSurface,
          cameraBobScale: 1.0,
        },
        { x: baseX, y: -0.2, z: baseZ }
      );

      this.currentAnimState = pose.state;
      this.wasGroundedLastFrame = this.isGrounded;
      this.frameLookDeltaX = 0;
      this.frameLookDeltaY = 0;

      // Apply root weapon transform
      this.currentViewModel.position.set(
        pose.weaponPos.x,
        pose.weaponPos.y - this.landingDipOffset * 0.35,
        pose.weaponPos.z
      );
      this.currentViewModel.rotation.set(
        pose.weaponRot.x,
        pose.weaponRot.y,
        pose.weaponRot.z
      );

      // Apply Articulated Left Support Arm & Hand (Detaches to pull mag & rack bolt!)
      if (this.leftArmObj) {
        this.leftArmObj.position.set(
          pose.leftArmPos.x,
          pose.leftArmPos.y,
          pose.leftArmPos.z
        );
      }
      // Apply Articulated Magazine animation during reload
      if (this.magazineObj) {
        this.magazineObj.position.set(
          pose.magazinePos.x,
          pose.magazinePos.y,
          pose.magazinePos.z
        );
        this.magazineObj.rotation.x = pose.magazineRot.x;
      }
      // Apply Reciprocating Bolt Carrier / Charging Handle
      if (this.boltCarrierObj) {
        this.boltCarrierObj.position.z = -0.06 + pose.boltCarrierOffsetZ;
      }

      // Trigger synchronized footstep & reload stage audio cues
      if (pose.footstepTriggered) {
        soundSystem.playFootstep(this.isSprinting, pose.footstepSurface);
      }
      if (pose.reloadStageTriggered) {
        soundSystem.playReloadStage(pose.reloadStageTriggered);
      }
    }

    // 9. INTERPOLATE REMOTE MULTIPLAYER PLAYERS & SYNC OWN POSITION AT 15Hz
    this.remotePlayers.forEach((rp) => {
      rp.group.position.x = THREE.MathUtils.damp(
        rp.group.position.x,
        rp.state.x,
        14,
        dt
      );
      rp.group.position.y = THREE.MathUtils.damp(
        rp.group.position.y,
        rp.state.y,
        14,
        dt
      );
      rp.group.position.z = THREE.MathUtils.damp(
        rp.group.position.z,
        rp.state.z,
        14,
        dt
      );
      rp.group.rotation.y = rp.state.yaw + Math.PI;
    });

    this.netSyncTimer += dt;
    if (this.netSyncTimer >= 0.065 && multiplayerClient.isConnected) {
      this.netSyncTimer = 0;
      multiplayerClient.sendPlayerUpdate({
        x: Number(this.position.x.toFixed(2)),
        y: Number(this.position.y.toFixed(2)),
        z: Number(this.position.z.toFixed(2)),
        yaw: Number(this.cameraYaw.toFixed(3)),
        pitch: Number(this.cameraPitch.toFixed(3)),
        weapon: this.getActiveWeaponId(),
        agent: this.playerAgent,
        team: this.playerTeam,
        health: this.health,
        shield: this.shield,
        isAlive: this.isPlayerAlive,
      });
    }

    // 10. UPDATE BOTS
    this.botManager.update(
      dt,
      this.roundPhase === 'buy',
      this.gameMode,
      this.mapData.colliders,
      this.position,
      this.isPlayerAlive,
      this.dismissTimer > 0,
      this.playerTeam,
      (dmg, isHeadshot, botName, botPos) => {
        if (!this.isPlayerAlive || this.dismissTimer > 0) return;
        this.damageVignetteAlpha = 0.85;
        // Compute directional angle from player's facing direction to shooter
        const dx = botPos.x - this.position.x;
        const dz = botPos.z - this.position.z;
        const worldAngle = Math.atan2(dx, -dz);
        this.damageDirectionDeg = Math.round(
          ((worldAngle - this.cameraYaw) * 180) / Math.PI
        );

        this.health = Math.max(0, this.health - dmg);
        this.hudDirty = true;

        if (this.health <= 0) {
          if (this.runItBackAnchor && this.runItBackTimer > 0) {
            this.health = 100;
            this.position.copy(this.runItBackAnchor);
            this.runItBackAnchor = null;
            this.runItBackTimer = 0;
            soundSystem.playDefuseCheckpoint();
            this.showStatusBanner('RUN IT BACK // RESPAWNED AT FIRE ANCHOR!');
            return;
          }

          this.isPlayerAlive = false;
          this.playerDeaths += 1;
          this.playerRespawnTimer = 2.5;
          if (this.gameMode === 'tdm') {
            if (this.playerTeam === 'attackers') this.defendersScore += 1;
            else this.attackersScore += 1;
          }
          this.onKillfeedAdd({
            id: `kill_${Date.now()}_${Math.random()}`,
            killerName: botName,
            killerTeam: this.playerTeam === 'attackers' ? 'defenders' : 'attackers',
            victimName: this.playerCallsign,
            victimTeam: this.playerTeam,
            weaponId: 'vandal',
            isHeadshot,
            timestamp: Date.now(),
          });
          this.checkRoundEndCondition();
        }
      },
      (killer, victim, isHeadshot) => {
        this.hudDirty = true;
        if (this.gameMode === 'tdm') {
          if (killer.team === 'attackers') this.attackersScore += 1;
          else this.defendersScore += 1;
        }
        this.onKillfeedAdd({
          id: `kill_${Date.now()}_${Math.random()}`,
          killerName: killer.name,
          killerTeam: killer.team,
          victimName: victim.name,
          victimTeam: victim.team,
          weaponId: killer.weapon,
          isHeadshot,
          timestamp: Date.now(),
        });
        this.checkRoundEndCondition();
      }
    );

    // 11. UPDATE PARTICLES & SCREEN EFFECTS
    this.particleSystem.update(dt);
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.85);
      this.hudDirty = true;
    }
    if (this.damageVignetteAlpha > 0) {
      this.damageVignetteAlpha = Math.max(0, this.damageVignetteAlpha - dt * 2.2);
      if (this.damageVignetteAlpha <= 0) {
        this.damageDirectionDeg = null;
      }
      this.hudDirty = true;
    }
    if (this.killBannerTimeout > 0) {
      this.killBannerTimeout -= dt;
      if (this.killBannerTimeout <= 0) {
        this.killBannerEvent = null;
        this.hudDirty = true;
      }
    }

    (['c', 'q', 'e', 'x'] as const).forEach((k) => {
      if (this.abilityCooldowns[k] > 0) {
        this.abilityCooldowns[k] = Math.max(0, this.abilityCooldowns[k] - dt);
        if (this.abilityCooldowns[k] === 0) {
          if (k === 'q') {
            const m1 = ACTIVE_MODULES[this.rigBuild.activeSlot1];
            if (m1 && this.abilityCharges.q === 0) this.abilityCharges.q = 1;
          } else if (k === 'e') {
            const m2 = ACTIVE_MODULES[this.rigBuild.activeSlot2];
            if (m2 && this.abilityCharges.e === 0) this.abilityCharges.e = 1;
          }
          this.hudDirty = true;
        }
      }
    });

    this.hudThrottleTimer += dt;
    const currentSec = Math.ceil(this.phaseTimeRemaining);
    if (currentSec !== this.lastPushedSecond) {
      this.lastPushedSecond = currentSec;
      this.hudDirty = true;
    }

    if (this.hudThrottleTimer >= 0.1) {
      this.hudThrottleTimer = 0;
      this.hudDirty = false;
      this.pushHUDState(isInsidePlantZone, currentPlantZone?.site || null);
    }
  }

  private updatePlayerMovement(dt: number) {
    const targetEye = this.isCrouching ? 1.05 : 1.7;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);
    this.landingDipOffset = THREE.MathUtils.damp(this.landingDipOffset, 0, 14, dt);

    const kbForward = (this.keysHeld.has('w') ? 1 : 0) - (this.keysHeld.has('s') ? 1 : 0);
    const kbSide = (this.keysHeld.has('d') ? 1 : 0) - (this.keysHeld.has('a') ? 1 : 0);

    const forwardInput = Math.max(-1, Math.min(1, kbForward + this.touchMoveVector.y));
    const sideInput = Math.max(-1, Math.min(1, kbSide + this.touchMoveVector.x));

    // Subtle tactical strafe camera roll
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, -sideInput * 0.016, 12, dt);

    _euler.set(0, this.cameraYaw, 0);
    _forward.set(0, 0, -1).applyEuler(_euler);
    _right.set(1, 0, 0).applyEuler(_euler);

    _moveDir.set(0, 0, 0);
    _moveDir.addScaledVector(_forward, forwardInput);
    _moveDir.addScaledVector(_right, sideInput);

    if (_moveDir.lengthSq() > 1) {
      _moveDir.normalize();
    }

    this.isPlayerSlowed = this.particleSystem.isPositionSlowed(this.position);
    const slowMult = this.isPlayerSlowed ? 0.55 : 1.0;
    const sprintMult = this.isSprinting && !this.isCrouching && !this.isScoped ? 1.28 : 1.0;
    const speedBoost = (this.dismissTimer > 0 ? 1.42 : 1.0) * sprintMult * slowMult;
    const baseSpeed =
      (this.isCrouching ? 2.8 : this.isScoped ? 3.5 : 6.7) * speedBoost;

    // Distinct ground vs air acceleration & counter-strafe friction
    const accel = this.isGrounded ? 54.0 : 18.0;
    const friction = this.isGrounded ? 15.0 : 1.8;

    if (this.isPlayerAlive) {
      this.velocity.x += _moveDir.x * accel * dt;
      this.velocity.z += _moveDir.z * accel * dt;
    }

    this.velocity.y -= 18.0 * dt;

    const currentSpeedSq =
      this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    if (currentSpeedSq > baseSpeed * baseSpeed) {
      const invSpeed = baseSpeed / Math.sqrt(currentSpeedSq);
      this.velocity.x *= invSpeed;
      this.velocity.z *= invSpeed;
    }

    const damping = Math.exp(-friction * dt);
    this.velocity.x *= damping;
    this.velocity.z *= damping;

    _nextPos.copy(this.position).addScaledVector(this.velocity, dt);

    const playerRadius = 0.45;
    const playerHeight = 1.75;
    const colliders = this.mapData.colliders;
    const isBuy =
      this.roundPhase === 'buy' &&
      this.gameMode !== 'range' &&
      this.gameMode !== 'dm' &&
      this.gameMode !== 'tdm';

    if (
      !checkHorizontalAABBCollision(
        _nextPos.x,
        this.position.y,
        _nextPos.z,
        playerRadius,
        playerHeight,
        colliders,
        isBuy
      )
    ) {
      this.position.x = _nextPos.x;
      this.position.z = _nextPos.z;
    } else {
      if (
        !checkHorizontalAABBCollision(
          _nextPos.x,
          this.position.y,
          this.position.z,
          playerRadius,
          playerHeight,
          colliders,
          isBuy
        )
      ) {
        this.position.x = _nextPos.x;
      }
      if (
        !checkHorizontalAABBCollision(
          this.position.x,
          this.position.y,
          _nextPos.z,
          playerRadius,
          playerHeight,
          colliders,
          isBuy
        )
      ) {
        this.position.z = _nextPos.z;
      }
    }

    const floorY = getSupportFloorHeight(
      this.position.x,
      _nextPos.y,
      this.position.z,
      playerRadius,
      colliders
    );

    if (_nextPos.y <= floorY) {
      if (!this.isGrounded && this.velocity.y < -3.5) {
        this.landingDipOffset = Math.min(0.16, Math.abs(this.velocity.y) * 0.018);
        soundSystem.playJump(true);
      }
      this.position.y = floorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.position.y = _nextPos.y;
    }

    this.position.x = Math.max(-42, Math.min(42, this.position.x));
    this.position.z = Math.max(-50, Math.min(50, this.position.z));

    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight - this.landingDipOffset,
      this.position.z
    );
  }

  private checkInsidePlantZone(pos: THREE.Vector3): { site: 'A' | 'B' } | null {
    for (let i = 0; i < this.mapData.plantZones.length; i++) {
      const zone = this.mapData.plantZones[i];
      if (
        pos.x >= zone.minX &&
        pos.x <= zone.maxX &&
        pos.z >= zone.minZ &&
        pos.z <= zone.maxZ
      ) {
        return { site: zone.site };
      }
    }
    return null;
  }

  private writeForwardDirection(out: THREE.Vector3): THREE.Vector3 {
    const totalPitch = this.cameraPitch + this.recoilPitchOffset;
    const totalYaw = this.cameraYaw + this.recoilYawOffset;
    _euler.set(totalPitch, totalYaw, 0, 'YXZ');
    return out.set(0, 0, -1).applyEuler(_euler).normalize();
  }

  private pushHUDState(isInsidePlantZone: boolean, site: 'A' | 'B' | null) {
    const activeWepId = this.getActiveWeaponId();
    const weapon = WEAPONS[activeWepId];
    const stock = this.ammoStock[activeWepId];

    const allBots = this.botManager.getBots();
    let remoteAttackersAlive = 0;
    let remoteDefendersAlive = 0;
    this.remotePlayers.forEach((rp) => {
      if (rp.state.isAlive) {
        if (rp.state.team === 'attackers') remoteAttackersAlive++;
        else remoteDefendersAlive++;
      }
    });

    const aliveAttackers =
      (this.playerTeam === 'attackers' && this.isPlayerAlive ? 1 : 0) +
      remoteAttackersAlive +
      allBots.filter((b) => b.team === 'attackers' && b.isAlive).length;
    const aliveDefenders =
      (this.playerTeam === 'defenders' && this.isPlayerAlive ? 1 : 0) +
      remoteDefendersAlive +
      allBots.filter((b) => b.team === 'defenders' && b.isAlive).length;

    const botRoster = [
      ...Array.from(this.remotePlayers.values()).map((rp) => ({
        name: rp.state.name,
        team: rp.state.team,
        isAlive: rp.state.isAlive,
        agent: rp.state.agent,
        x: rp.state.x,
        z: rp.state.z,
        isRevealed: false,
      })),
      ...allBots.map((b) => ({
        name: b.name,
        team: b.team,
        isAlive: b.isAlive,
        agent: b.agent,
        x: b.position.x,
        z: b.position.z,
        isRevealed: b.revealedTimer > 0,
      })),
    ];

    const scoreboard: ScoreboardEntry[] = [
      {
        id: 'local_player',
        name: this.playerCallsign,
        team: this.playerTeam,
        agent: this.playerAgent,
        isAlive: this.isPlayerAlive,
        kills: this.playerKills,
        deaths: this.playerDeaths,
        assists: 0,
        credits: this.credits,
        isPlayer: true,
        ping: 14,
      },
      ...Array.from(this.remotePlayers.values()).map((rp) => ({
        id: rp.state.id,
        name: rp.state.name,
        team: rp.state.team,
        agent: rp.state.agent,
        isAlive: rp.state.isAlive,
        kills: rp.state.kills,
        deaths: rp.state.deaths,
        assists: 0,
        credits: 3900,
        isRemote: true,
        ping: 28,
      })),
      ...allBots.map((b) => ({
        id: b.id,
        name: b.name,
        team: b.team,
        agent: b.agent,
        isAlive: b.isAlive,
        kills: b.kills,
        deaths: b.deaths,
        assists: 0,
        credits: 3900,
      })),
    ];

    const maxUlt = AGENTS[this.playerAgent].abilities.x.ultPointsRequired;

    this.onHUDUpdate({
      playerAgent: this.playerAgent,
      rigBuild: { ...this.rigBuild },
      gameMode: this.gameMode,
      mapId: this.currentMapId,
      health: this.health,
      shield: this.shield,
      activeWeaponId: activeWepId,
      activeWeaponName: this.isBladestormActive
        ? 'BLADESTORM KUNAI'
        : weapon
        ? weapon.name
        : 'KNIFE',
      ammoInMag: this.isBladestormActive
        ? this.bladestormKnives
        : stock
        ? stock.mag
        : 0,
      reserveAmmo: this.isBladestormActive ? 5 : stock ? stock.reserve : 0,
      isReloading: this.isReloading,
      isScoped: this.isScoped,
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isSlowed: this.isPlayerSlowed,
      credits: this.credits,
      roundPhase: this.roundPhase,
      phaseTimer: Math.max(0, Math.ceil(this.phaseTimeRemaining)),
      attackersScore: this.attackersScore,
      defendersScore: this.defendersScore,
      playerTeam: this.playerTeam,
      spikeState: this.spikeState,
      isInsidePlantZone,
      plantZoneSite: site,
      flashAlpha: this.flashAlpha,
      damageVignette: this.damageVignetteAlpha,
      damageDirectionDeg: this.damageDirectionDeg,
      lastHitEvent: this.lastHitEvent,
      activeAbilityBuff: this.activeAbilityBuff ? { ...this.activeAbilityBuff } : null,
      rangeChallenge: { ...this.rangeChallenge },
      killStreak: this.killStreakCount,
      playerKills: this.playerKills,
      playerDeaths: this.playerDeaths,
      playerHeadshots: this.playerHeadshots,
      recentKillEvent: this.killBannerEvent,
      aliveAttackers,
      aliveDefenders,
      botRoster,
      scoreboard,
      playerPos: {
        x: this.position.x,
        z: this.position.z,
        yaw: this.cameraYaw,
      },
      abilityCharges: { ...this.abilityCharges },
      abilityCooldowns: { ...this.abilityCooldowns },
      ultPoints: this.ultPoints,
      ultMax: maxUlt,
      statusBanner: this.statusBanner,
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      renderWidth: this.renderer.domElement.width,
      renderHeight: this.renderer.domElement.height,
      roomId: multiplayerClient.currentRoomId,
      isMultiplayerConnected: multiplayerClient.isConnected,
      onlinePlayerCount: 1 + this.remotePlayers.size,
    });
  }

  public getPlayerPosition(): THREE.Vector3 {
    return this.position;
  }

  public getPlayerRotation(): { pitch: number; yaw: number } {
    return { pitch: this.cameraPitch, yaw: this.cameraYaw };
  }
}
