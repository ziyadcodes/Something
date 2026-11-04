import * as THREE from 'three';
import { AgentId, BotDifficulty, GameMode, TeamSide, WeaponId } from '../types/game';
import { createAgentCharacter } from './models';
import { calculateDamage, applyDamageToHealthAndShield, WEAPONS } from './weapons';
import { soundSystem } from '../audio/soundSystem';
import { ParticleSystem, SmokeCloud } from './particles';
import { FastAABB } from './mapBuilder';
import {
  OperatorRigBuild,
  PASSIVE_MODULES,
  generateBotRigBuild,
} from './rigSystem';

export type BotArchetype = 'rusher' | 'anchor' | 'flanker';

export interface BotState {
  id: string;
  name: string;
  team: TeamSide;
  agent: AgentId;
  weapon: WeaponId;
  rigBuild: OperatorRigBuild;
  moduleCooldownTimer: number;
  health: number;
  shield: number;
  isAlive: boolean;
  kills: number;
  deaths: number;
  archetype: BotArchetype;
  position: THREE.Vector3;
  waypoints: THREE.Vector3[];
  waypointIdx: number;
  meshGroup: THREE.Group;
  hitboxes: THREE.Mesh[];
  hpBarFill: THREE.Mesh;
  statusTagMesh: THREE.Mesh;
  leftLeg: THREE.Object3D | undefined;
  rightLeg: THREE.Object3D | undefined;
  walkPhase: number;
  lastShotTime: number;
  reactionTimer: number;
  blindTimer: number;
  slowTimer: number;
  revealedTimer: number;
  vulnerableTimer: number;
  respawnTimer: number;
  strafeDir: number;
  strafeTimer: number;
  siteTarget: 'A' | 'B';
}

const _lookDir = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _muzzlePos = new THREE.Vector3();
const _targetEyePos = new THREE.Vector3();

function hasClearLineOfSight(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  colliders: FastAABB[],
  smokes: SmokeCloud[]
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  for (let i = 0; i < smokes.length; i++) {
    const s = smokes[i].position;
    const r = smokes[i].maxRadius * 0.85;
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq > 0.001) {
      const t = Math.max(
        0,
        Math.min(1, ((s.x - x1) * dx + (s.y - y1) * dy + (s.z - z1) * dz) / lenSq)
      );
      const px = x1 + t * dx - s.x;
      const py = y1 + t * dy - s.y;
      const pz = z1 + t * dz - s.z;
      if (px * px + py * py + pz * pz < r * r) {
        return false;
      }
    }
  }

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.isBarrier) continue;

    let tmin = 0.0;
    let tmax = 1.0;

    if (Math.abs(dx) < 1e-6) {
      if (x1 < c.minX || x1 > c.maxX) continue;
    } else {
      const invD = 1.0 / dx;
      let t1 = (c.minX - x1) * invD;
      let t2 = (c.maxX - x1) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dy) < 1e-6) {
      if (y1 < c.minY || y1 > c.maxY) continue;
    } else {
      const invD = 1.0 / dy;
      let t1 = (c.minY - y1) * invD;
      let t2 = (c.maxY - y1) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dz) < 1e-6) {
      if (z1 < c.minZ || z1 > c.maxZ) continue;
    } else {
      const invD = 1.0 / dz;
      let t1 = (c.minZ - z1) * invD;
      let t2 = (c.maxZ - z1) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    return false;
  }

  return true;
}

function isBotColliding(
  x: number,
  z: number,
  colliders: FastAABB[],
  isBuyPhase: boolean
): boolean {
  const r = 0.45;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.isBarrier && !isBuyPhase) continue;
    if (c.maxY < 0.5 || c.minY > 2.2) continue;
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
      return true;
    }
  }
  return false;
}

export class BotManager {
  private bots: BotState[] = [];
  private scene: THREE.Scene;
  private particleSystem: ParticleSystem;
  public difficulty: BotDifficulty = 'medium';
  public botsEnabled: boolean = true;

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
  }

  public getBots(): BotState[] {
    return this.bots;
  }

  public getAliveBots(team?: TeamSide): BotState[] {
    return this.bots.filter((b) => b.isAlive && (!team || b.team === team));
  }

  public blindEnemiesNear(pos: THREE.Vector3, radius: number, playerTeam: TeamSide): number {
    let count = 0;
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.isAlive && b.team !== playerTeam && b.position.distanceTo(pos) <= radius) {
        b.blindTimer = 3.2;
        count++;
      }
    }
    return count;
  }

  public slowEnemiesNear(pos: THREE.Vector3, radius: number, playerTeam: TeamSide): number {
    let count = 0;
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.isAlive && b.team !== playerTeam && b.position.distanceTo(pos) <= radius) {
        b.slowTimer = 5.5;
        count++;
      }
    }
    return count;
  }

  public revealEnemiesNear(
    pos: THREE.Vector3,
    radius: number,
    playerTeam: TeamSide,
    duration = 6.0
  ): number {
    let count = 0;
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (!b.isAlive || b.team === playerTeam) continue;
      // Apply Signal Dampener passive if equipped on this bot
      const passive = PASSIVE_MODULES[b.rigBuild.passiveSlot];
      const effectiveRadius = radius * (passive ? passive.reconRadiusMultiplier : 1.0);
      if (b.position.distanceTo(pos) <= effectiveRadius) {
        const effectiveDuration = duration * (passive ? passive.reconDurationMultiplier : 1.0);
        b.revealedTimer = Math.max(b.revealedTimer, effectiveDuration);
        count++;
      }
    }
    return count;
  }

  public applyVulnerableNear(
    pos: THREE.Vector3,
    radius: number,
    playerTeam: TeamSide,
    duration = 5.0
  ) {
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.isAlive && b.team !== playerTeam && b.position.distanceTo(pos) <= radius) {
        b.vulnerableTimer = Math.max(b.vulnerableTimer, duration);
      }
    }
  }

  public alertBotsNearGunfire(shotPos: THREE.Vector3, shooterTeam: TeamSide) {
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.isAlive && b.team !== shooterTeam && b.position.distanceTo(shotPos) <= 32) {
        _lookDir.subVectors(shotPos, b.position).normalize();
        b.meshGroup.rotation.y = Math.atan2(_lookDir.x, _lookDir.z);
      }
    }
  }

  public notifySpikePlanted(site: 'A' | 'B') {
    const siteCenter =
      site === 'A' ? new THREE.Vector3(24, 0, -22) : new THREE.Vector3(-24, 0, -22);
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.isAlive && b.team === 'defenders') {
        b.waypoints = [
          new THREE.Vector3(0, 0, -18),
          siteCenter.clone().add(new THREE.Vector3((i % 2 === 0 ? 1 : -1) * 3, 0, 3)),
          siteCenter.clone(),
        ];
        b.waypointIdx = 0;
      }
    }
  }

  public reviveOneAlly(team: TeamSide): string | null {
    const fallen = this.bots.find((b) => b.team === team && !b.isAlive);
    if (!fallen) return null;
    fallen.isAlive = true;
    fallen.health = 100;
    fallen.shield = 50;
    fallen.hpBarFill.scale.x = 1;
    fallen.meshGroup.rotation.set(0, 0, 0);
    fallen.position.y = 0;
    fallen.meshGroup.position.copy(fallen.position);
    return fallen.name;
  }

  public spawnMatchBots(playerTeam: TeamSide, mode: GameMode) {
    this.clearBots();
    if (!this.botsEnabled) return;

    const enemyTeam: TeamSide = playerTeam === 'attackers' ? 'defenders' : 'attackers';

    if (mode === 'range') {
      const rangeNames = [
        'BOT-ALPHA',
        'BOT-BRAVO',
        'BOT-DELTA',
        'BOT-ECHO',
        'BOT-NOVA',
        'BOT-APEX',
      ];
      const rangeAgents: AgentId[] = ['jett', 'phoenix', 'reyna', 'sova', 'viper', 'cypher'];
      const rangePositions = [
        new THREE.Vector3(-6, 0, 12),
        new THREE.Vector3(0, 0, 10),
        new THREE.Vector3(6, 0, 12),
        new THREE.Vector3(-4, 0, 4),
        new THREE.Vector3(4, 0, 4),
        new THREE.Vector3(0, 0, -2),
      ];

      rangeNames.forEach((name, idx) => {
        const id = `bot_range_${idx}`;
        const { group, hitboxes, hpBarFill, statusTagMesh } = createAgentCharacter(
          id,
          name,
          true,
          '#ff4655',
          rangeAgents[idx]
        );
        const pos = rangePositions[idx].clone();
        group.position.copy(pos);
        this.scene.add(group);

        this.bots.push({
          id,
          name,
          team: enemyTeam,
          agent: rangeAgents[idx],
          weapon: 'classic',
          rigBuild: generateBotRigBuild('anchor', rangeAgents[idx], 'classic'),
          moduleCooldownTimer: 8 + idx * 2,
          health: 100,
          shield: 50,
          isAlive: true,
          kills: 0,
          deaths: 0,
          archetype: 'anchor',
          position: pos,
          waypoints: [
            pos.clone().add(new THREE.Vector3(-3.2, 0, 0)),
            pos.clone().add(new THREE.Vector3(3.2, 0, 0)),
          ],
          waypointIdx: 0,
          meshGroup: group,
          hitboxes,
          hpBarFill,
          statusTagMesh,
          leftLeg: group.getObjectByName('LeftLeg'),
          rightLeg: group.getObjectByName('RightLeg'),
          walkPhase: idx,
          lastShotTime: 0,
          reactionTimer: 0.4,
          blindTimer: 0,
          slowTimer: 0,
          revealedTimer: 0,
          vulnerableTimer: 0,
          respawnTimer: 0,
          strafeDir: idx % 2 === 0 ? 1 : -1,
          strafeTimer: 0.65,
          siteTarget: 'A',
        });
      });
      return;
    }

    const botConfigs = [
      // 4 Allied Bots (In Free-For-All DM, all bots are assigned to enemyTeam!)
      {
        name: 'Omen',
        agent: 'omen' as AgentId,
        weapon: 'vandal' as WeaponId,
        team: mode === 'dm' ? enemyTeam : playerTeam,
        archetype: 'rusher' as BotArchetype,
        site: 'A' as const,
      },
      {
        name: 'Sova',
        agent: 'sova' as AgentId,
        weapon: 'phantom' as WeaponId,
        team: mode === 'dm' ? enemyTeam : playerTeam,
        archetype: 'anchor' as BotArchetype,
        site: 'B' as const,
      },
      {
        name: 'Phoenix',
        agent: 'phoenix' as AgentId,
        weapon: 'judge' as WeaponId,
        team: mode === 'dm' ? enemyTeam : playerTeam,
        archetype: 'rusher' as BotArchetype,
        site: 'A' as const,
      },
      {
        name: 'Sage',
        agent: 'sage' as AgentId,
        weapon: 'vandal' as WeaponId,
        team: mode === 'dm' ? enemyTeam : playerTeam,
        archetype: 'flanker' as BotArchetype,
        site: 'B' as const,
      },
      // 5 Opposing Bots
      {
        name: 'Viper',
        agent: 'viper' as AgentId,
        weapon: 'vandal' as WeaponId,
        team: enemyTeam,
        archetype: 'rusher' as BotArchetype,
        site: 'A' as const,
      },
      {
        name: 'Cypher',
        agent: 'cypher' as AgentId,
        weapon: 'operator' as WeaponId,
        team: enemyTeam,
        archetype: 'anchor' as BotArchetype,
        site: 'A' as const,
      },
      {
        name: 'Reyna',
        agent: 'reyna' as AgentId,
        weapon: 'phantom' as WeaponId,
        team: enemyTeam,
        archetype: 'anchor' as BotArchetype,
        site: 'B' as const,
      },
      {
        name: 'Jett',
        agent: 'jett' as AgentId,
        weapon: 'spectre' as WeaponId,
        team: enemyTeam,
        archetype: 'rusher' as BotArchetype,
        site: 'B' as const,
      },
      {
        name: 'Brimstone',
        agent: 'phoenix' as AgentId,
        weapon: 'odin' as WeaponId,
        team: enemyTeam,
        archetype: 'flanker' as BotArchetype,
        site: 'A' as const,
      },
    ];

    const spawnLaneOffsets = [-8.5, -4.5, 4.5, 8.5, -12.5];

    botConfigs.forEach((cfg, idx) => {
      const id = `bot_${idx}_${cfg.name.toLowerCase()}`;
      const isEnemy = cfg.team !== playerTeam;
      const { group, hitboxes, hpBarFill, statusTagMesh } = createAgentCharacter(
        id,
        cfg.name,
        isEnemy,
        isEnemy ? '#ff4655' : '#00f2fe',
        cfg.agent
      );

      let spawnPos: THREE.Vector3;
      if (mode === 'dm') {
        const dmSpawns = [
          new THREE.Vector3(-24, 0, -20),
          new THREE.Vector3(24, 0, -20),
          new THREE.Vector3(-25, 0, 12),
          new THREE.Vector3(25, 0, 12),
          new THREE.Vector3(0, 0, -28),
          new THREE.Vector3(-8, 0, 4),
          new THREE.Vector3(8, 0, -10),
          new THREE.Vector3(-22, 0, -6),
          new THREE.Vector3(22, 0, -6),
        ];
        spawnPos = dmSpawns[idx % dmSpawns.length].clone();
      } else {
        const isAttacker = cfg.team === 'attackers';
        const laneOffset = spawnLaneOffsets[idx % 5];
        const spawnZ = isAttacker ? 33 + (idx % 2) * 2.5 : -36 - (idx % 2) * 2.5;
        spawnPos = new THREE.Vector3(laneOffset, 0, spawnZ);
      }

      group.position.copy(spawnPos);
      this.scene.add(group);

      const waypoints = this.buildLaneWaypoints(cfg.site, cfg.archetype, cfg.team);

      this.bots.push({
        id,
        name: cfg.name,
        team: cfg.team,
        agent: cfg.agent,
        weapon: cfg.weapon,
        rigBuild: generateBotRigBuild(cfg.archetype, cfg.agent, cfg.weapon),
        moduleCooldownTimer: 4 + (idx % 4) * 2.5,
        health: 100,
        shield: 50,
        isAlive: true,
        kills: 0,
        deaths: 0,
        archetype: cfg.archetype,
        position: spawnPos,
        waypoints,
        waypointIdx: 0,
        meshGroup: group,
        hitboxes,
        hpBarFill,
        statusTagMesh,
        leftLeg: group.getObjectByName('LeftLeg'),
        rightLeg: group.getObjectByName('RightLeg'),
        walkPhase: idx * 0.8,
        lastShotTime: 0,
        reactionTimer: 0.35 + Math.random() * 0.25,
        blindTimer: 0,
        slowTimer: 0,
        revealedTimer: 0,
        vulnerableTimer: 0,
        respawnTimer: 0,
        strafeDir: idx % 2 === 0 ? 1 : -1,
        strafeTimer: 0.6 + (idx % 3) * 0.35,
        siteTarget: cfg.site,
      });
    });
  }

  private buildLaneWaypoints(
    site: 'A' | 'B',
    archetype: BotArchetype,
    team: TeamSide
  ): THREE.Vector3[] {
    if (archetype === 'flanker') {
      return team === 'attackers'
        ? [
            new THREE.Vector3(-3, 0, 16),
            new THREE.Vector3(-4, 0, 2),
            new THREE.Vector3(0, 0, -13),
            new THREE.Vector3(18, 0, -21),
          ]
        : [
            new THREE.Vector3(0, 0, -24),
            new THREE.Vector3(4, 0, -12),
            new THREE.Vector3(3, 0, 2),
            new THREE.Vector3(0, 0, 15),
          ];
    }
    if (site === 'A') {
      return team === 'attackers'
        ? [
            new THREE.Vector3(25, 0, 24),
            new THREE.Vector3(25, 0, 6),
            new THREE.Vector3(25, 0, -12),
            new THREE.Vector3(24, 0, -22),
          ]
        : [
            new THREE.Vector3(24, 0, -28),
            new THREE.Vector3(25, 0, -20),
            new THREE.Vector3(25, 0, -8),
          ];
    } else {
      return team === 'attackers'
        ? [
            new THREE.Vector3(-25, 0, 24),
            new THREE.Vector3(-25, 0, 6),
            new THREE.Vector3(-25, 0, -12),
            new THREE.Vector3(-22, 0, -22),
          ]
        : [
            new THREE.Vector3(-24, 0, -28),
            new THREE.Vector3(-22, 0, -19),
            new THREE.Vector3(-25, 0, -8),
          ];
    }
  }

  public resetForRound(_playerTeam: TeamSide) {
    const spawnLaneOffsets = [-8.5, -4.5, 4.5, 8.5, -12.5];
    this.bots.forEach((bot, idx) => {
      bot.health = 100;
      bot.shield = 50;
      bot.isAlive = true;
      bot.blindTimer = 0;
      bot.slowTimer = 0;
      bot.revealedTimer = 0;
      bot.vulnerableTimer = 0;
      bot.respawnTimer = 0;
      bot.waypointIdx = 0;
      bot.meshGroup.visible = true;
      bot.meshGroup.rotation.set(0, 0, 0);
      bot.hpBarFill.scale.set(1, 1, 1);
      bot.statusTagMesh.visible = false;

      const isAttacker = bot.team === 'attackers';
      const laneOffset = spawnLaneOffsets[idx % 5];
      const spawnZ = isAttacker ? 33 + (idx % 2) * 2.5 : -36 - (idx % 2) * 2.5;
      bot.position.set(laneOffset, 0, spawnZ);
      bot.meshGroup.position.copy(bot.position);
      bot.waypoints = this.buildLaneWaypoints(bot.siteTarget, bot.archetype, bot.team);
    });
  }

  public applyHitToBot(
    botId: string,
    damage: number,
    _isHeadshot: boolean
  ): { bot: BotState | null; isEliminated: boolean; actualDamage: number } {
    const bot = this.bots.find((b) => b.id === botId && b.isAlive);
    if (!bot) return { bot: null, isEliminated: false, actualDamage: 0 };

    // Apply Vulnerable status multiplier (1.5x damage when affected by Viper Snake Bite acid)
    const effectiveDamage =
      bot.vulnerableTimer > 0 ? Math.round(damage * 1.5) : damage;

    const result = applyDamageToHealthAndShield(effectiveDamage, bot.health, bot.shield);
    bot.health = result.remainingHealth;
    bot.shield = result.remainingShield;

    const ratio = Math.max(0.01, (bot.health + bot.shield) / 150);
    bot.hpBarFill.scale.x = ratio;

    if (bot.health <= 0) {
      bot.isAlive = false;
      bot.deaths += 1;
      bot.respawnTimer = 1.8;
      bot.statusTagMesh.visible = false;
      bot.meshGroup.rotation.x = -Math.PI / 2;
      bot.meshGroup.position.y = 0.2;
      return { bot, isEliminated: true, actualDamage: result.damageDealt };
    }

    return { bot, isEliminated: false, actualDamage: result.damageDealt };
  }

  public update(
    dt: number,
    isBuyPhase: boolean,
    gameMode: GameMode,
    colliders: FastAABB[],
    playerPosition: THREE.Vector3,
    isPlayerAlive: boolean,
    isPlayerDismissed: boolean,
    playerTeam: TeamSide,
    onPlayerDamage: (
      damage: number,
      isHeadshot: boolean,
      botName: string,
      botPosition: THREE.Vector3
    ) => void,
    onBotKillOther: (killer: BotState, victim: BotState, isHeadshot: boolean) => void
  ) {
    const now = performance.now() / 1000;
    const smokes = this.particleSystem.getSmokeClouds();
    const reconBeacons = this.particleSystem.getReconBeacons();

    const diffAccuracyMult =
      this.difficulty === 'easy' ? 0.55 : this.difficulty === 'hard' ? 1.35 : 0.95;
    const diffCooldownAdd =
      this.difficulty === 'easy' ? 0.35 : this.difficulty === 'hard' ? 0.05 : 0.18;

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];

      if (!bot.isAlive) {
        if (gameMode === 'range' || gameMode === 'tdm' || gameMode === 'dm') {
          bot.respawnTimer -= dt;
          if (bot.respawnTimer <= 0) {
            bot.isAlive = true;
            bot.health = 100;
            bot.shield = 50;
            bot.hpBarFill.scale.x = 1;
            bot.meshGroup.rotation.set(0, 0, 0);
            if (gameMode === 'tdm') {
              const isAttacker = bot.team === 'attackers';
              bot.position.set(((i % 5) - 2) * 4, 0, isAttacker ? 34 : -38);
              bot.waypointIdx = 0;
            } else if (gameMode === 'range') {
              // Randomize X offset slightly in Range for flick practice
              bot.position.x = ((i % 3) - 1) * 5.5 + (Math.random() - 0.5) * 2.5;
              bot.position.y = 0;
            } else {
              bot.position.y = 0;
            }
            bot.meshGroup.position.copy(bot.position);
          }
        }
        continue;
      }

      // Tick status timers
      if (bot.blindTimer > 0) bot.blindTimer = Math.max(0, bot.blindTimer - dt);
      if (bot.slowTimer > 0) bot.slowTimer = Math.max(0, bot.slowTimer - dt);
      if (bot.revealedTimer > 0) bot.revealedTimer = Math.max(0, bot.revealedTimer - dt);
      if (bot.vulnerableTimer > 0) bot.vulnerableTimer = Math.max(0, bot.vulnerableTimer - dt);

      // Check active recon beacons for sonar tagging
      if (bot.team !== playerTeam) {
        for (let r = 0; r < reconBeacons.length; r++) {
          if (bot.position.distanceTo(reconBeacons[r].position) <= 22) {
            bot.revealedTimer = Math.max(bot.revealedTimer, 1.5);
          }
        }
      }

      // Check active slow zones
      if (this.particleSystem.isPositionSlowed(bot.position)) {
        bot.slowTimer = Math.max(bot.slowTimer, 0.5);
      }

      // Update 3D overhead Status Diamond indicator
      const hasStatus =
        bot.blindTimer > 0 ||
        bot.revealedTimer > 0 ||
        bot.vulnerableTimer > 0 ||
        bot.slowTimer > 0;
      bot.statusTagMesh.visible = hasStatus;
      if (hasStatus) {
        bot.statusTagMesh.rotation.y += dt * 4.5;
        const mat = bot.statusTagMesh.material as THREE.MeshBasicMaterial;
        if (bot.blindTimer > 0) mat.color.setHex(0xfacc15); // Yellow = Blinded
        else if (bot.revealedTimer > 0) mat.color.setHex(0x00f2fe); // Cyan = Recon Revealed
        else if (bot.vulnerableTimer > 0) mat.color.setHex(0x10b981); // Green = Acid Vulnerable
        else mat.color.setHex(0x38bdf8); // Ice Blue = Slowed
      }

      if (isBuyPhase && gameMode !== 'range' && gameMode !== 'dm' && gameMode !== 'tdm') {
        continue;
      }

      let closestEnemyPos: THREE.Vector3 | null = null;
      let closestDist = 38.0;
      let isTargetPlayer = false;
      let targetBot: BotState | null = null;

      const botEyeX = bot.position.x;
      const botEyeY = bot.position.y + 1.55;
      const botEyeZ = bot.position.z;

      if (gameMode !== 'range' && bot.blindTimer <= 0) {
        if (isPlayerAlive && !isPlayerDismissed && bot.team !== playerTeam) {
          const dist = bot.position.distanceTo(playerPosition);
          if (
            dist < closestDist &&
            hasClearLineOfSight(
              botEyeX,
              botEyeY,
              botEyeZ,
              playerPosition.x,
              playerPosition.y + 1.4,
              playerPosition.z,
              colliders,
              smokes
            )
          ) {
            closestDist = dist;
            closestEnemyPos = playerPosition;
            isTargetPlayer = true;
          }
        }

        for (let j = 0; j < this.bots.length; j++) {
          const other = this.bots[j];
          if (!other.isAlive || other.id === bot.id) continue;
          if (gameMode !== 'dm' && other.team === bot.team) continue;
          const dist = bot.position.distanceTo(other.position);
          if (
            dist < closestDist &&
            hasClearLineOfSight(
              botEyeX,
              botEyeY,
              botEyeZ,
              other.position.x,
              other.position.y + 1.4,
              other.position.z,
              colliders,
              smokes
            )
          ) {
            closestDist = dist;
            closestEnemyPos = other.position;
            isTargetPlayer = false;
            targetBot = other;
          }
        }
      }

      if (closestEnemyPos) {
        _lookDir.subVectors(closestEnemyPos, bot.position).normalize();
        bot.meshGroup.rotation.y = Math.atan2(_lookDir.x, _lookDir.z);

        // AI Modular Rig Tactical Activation during combat engagements
        bot.moduleCooldownTimer -= dt;
        if (bot.moduleCooldownTimer <= 0 && gameMode !== 'range') {
          bot.moduleCooldownTimer = 14 + Math.random() * 6;
          const activeMod =
            Math.random() < 0.5 ? bot.rigBuild.activeSlot1 : bot.rigBuild.activeSlot2;
          if (activeMod === 'echo_probe') {
            this.particleSystem.spawnReconBeacon(bot.position, 4.5, 80, false);
          } else if (activeMod === 'static_field') {
            const dropPos = bot.position.clone().addScaledVector(_lookDir, Math.min(8, closestDist * 0.6));
            this.particleSystem.spawnSlowZone(dropPos, 5.5, 90);
          } else if (activeMod === 'mirage') {
            this.particleSystem.spawnMirageDecoy(bot.position, _lookDir, 6.0, 65);
          } else if (activeMod === 'relay') {
            this.particleSystem.spawnReconBeacon(bot.position, 8.0, 100, true);
            bot.shield = Math.min(50, bot.shield + 15);
          }
        }

        // Check if enemy bot is baited by a player Mirage Holographic Decoy in line of sight
        const decoys = this.particleSystem.getMirageDecoys();
        if (bot.team !== playerTeam && decoys.length > 0 && Math.random() < 0.25) {
          const d = decoys[0];
          if (bot.position.distanceTo(d.position) < 18) {
            this.particleSystem.damageReconBeacon(d.id, 22);
            // Counterplay: shooting a Mirage decoy pings the shooter briefly!
            bot.revealedTimer = Math.max(bot.revealedTimer, 2.5);
          }
        }

        // Tactical Combat Counter-Strafing & Archetype Positioning (Bots never freeze like statues!)
        bot.strafeTimer -= dt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir *= -1;
          bot.strafeTimer =
            bot.archetype === 'anchor'
              ? 0.45 + Math.random() * 0.35 // Tight jiggle-peek
              : 0.75 + Math.random() * 0.55; // Wide tactical swing
        }

        const slowMult = bot.slowTimer > 0 ? 0.45 : 1.0;
        const strafeSpeed =
          (bot.archetype === 'rusher' ? 3.1 : bot.archetype === 'flanker' ? 2.8 : 2.1) *
          slowMult;
        // Perpendicular strafe vector (-lookDir.z, lookDir.x) + slight forward pressure for rushers
        const fwdPush = bot.archetype === 'rusher' && closestDist > 9 ? 0.38 : 0;
        const moveX = (-_lookDir.z * bot.strafeDir + _lookDir.x * fwdPush) * strafeSpeed * dt;
        const moveZ = (_lookDir.x * bot.strafeDir + _lookDir.z * fwdPush) * strafeSpeed * dt;

        if (!isBotColliding(bot.position.x + moveX, bot.position.z + moveZ, colliders, isBuyPhase)) {
          bot.position.x += moveX;
          bot.position.z += moveZ;
          bot.meshGroup.position.copy(bot.position);
        } else {
          bot.strafeDir *= -1;
        }

        bot.walkPhase += dt * 7.5 * slowMult;
        const combatSwing = Math.sin(bot.walkPhase) * 0.28;
        if (bot.leftLeg) bot.leftLeg.rotation.x = combatSwing;
        if (bot.rightLeg) bot.rightLeg.rotation.x = -combatSwing;

        // Difficulty-scaled target acquisition reaction delay
        if (bot.reactionTimer > 0) {
          bot.reactionTimer = Math.max(0, bot.reactionTimer - dt);
        } else {
          const weapon = WEAPONS[bot.weapon];
          const minShotInterval = 1 / weapon.fireRate;

          if (
            now - bot.lastShotTime >=
            minShotInterval + (weapon.isAutomatic ? diffCooldownAdd : diffCooldownAdd * 1.8)
          ) {
            bot.lastShotTime = now;

            soundSystem.playGunfire(bot.weapon, true);

            _muzzlePos.set(bot.position.x, bot.position.y + 1.35, bot.position.z);
            _targetEyePos.set(closestEnemyPos.x, closestEnemyPos.y + 1.2, closestEnemyPos.z);
            this.particleSystem.emitTracer(_muzzlePos, _targetEyePos);

            const hitChance = Math.max(0.12, (0.55 - closestDist * 0.013) * diffAccuracyMult);
            if (Math.random() < hitChance) {
              const isHeadshot = Math.random() < (this.difficulty === 'hard' ? 0.28 : 0.16);
              const zone = isHeadshot ? 'head' : 'body';
              const dmg = calculateDamage(bot.weapon, zone);

              if (isTargetPlayer) {
                onPlayerDamage(dmg, isHeadshot, bot.name, bot.position);
              } else if (targetBot) {
                const res = this.applyHitToBot(targetBot.id, dmg, isHeadshot);
                if (res.isEliminated) {
                  bot.kills += 1;
                  onBotKillOther(bot, targetBot, isHeadshot);
                }
              }
            }
          }
        }
      } else {
        // Reset reaction timer when target leaves line of sight according to difficulty
        bot.reactionTimer =
          this.difficulty === 'easy' ? 0.42 : this.difficulty === 'hard' ? 0.11 : 0.24;
        const currentWp = bot.waypoints[bot.waypointIdx] || bot.position;
        const distToDest = bot.position.distanceTo(currentWp);

        if (distToDest > 1.2) {
          _moveDir.subVectors(currentWp, bot.position).normalize();
          const slowMult = bot.slowTimer > 0 ? 0.45 : 1.0;
          const speed = (gameMode === 'range' ? 2.6 : 4.4) * slowMult;
          const stepX = bot.position.x + _moveDir.x * speed * dt;
          const stepZ = bot.position.z + _moveDir.z * speed * dt;

          if (!isBotColliding(stepX, stepZ, colliders, isBuyPhase)) {
            bot.position.x = stepX;
            bot.position.z = stepZ;
          } else if (!isBotColliding(stepX, bot.position.z, colliders, isBuyPhase)) {
            bot.position.x = stepX;
          } else if (!isBotColliding(bot.position.x, stepZ, colliders, isBuyPhase)) {
            bot.position.z = stepZ;
          } else {
            bot.waypointIdx = (bot.waypointIdx + 1) % bot.waypoints.length;
          }

          bot.meshGroup.position.copy(bot.position);
          if (gameMode === 'range') {
            _lookDir.subVectors(playerPosition, bot.position).normalize();
            bot.meshGroup.rotation.y = Math.atan2(_lookDir.x, _lookDir.z);
          } else {
            bot.meshGroup.rotation.y = Math.atan2(_moveDir.x, _moveDir.z);
          }

          bot.walkPhase += dt * 9 * slowMult;
          const swing = Math.sin(bot.walkPhase) * 0.45;
          if (bot.leftLeg) bot.leftLeg.rotation.x = swing;
          if (bot.rightLeg) bot.rightLeg.rotation.x = -swing;
        } else {
          if (bot.waypointIdx < bot.waypoints.length - 1) {
            bot.waypointIdx += 1;
          } else {
            bot.waypointIdx = 0;
          }
        }
      }
    }
  }

  private clearBots() {
    this.bots.forEach((b) => {
      this.scene.remove(b.meshGroup);
    });
    this.bots = [];
  }
}
