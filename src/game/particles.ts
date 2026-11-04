import * as THREE from 'three';
import { FastAABB } from './mapBuilder';

export interface SmokeCloud {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  maxRadius: number;
  isToxic?: boolean;
}

export interface MollyFire {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  radius: number;
  damagePerSec: number;
  isOwnerFriendly: boolean;
  isAcid?: boolean;
}

export interface SlowZone {
  id: string;
  mesh: THREE.Mesh;
  pylonMesh: THREE.Mesh;
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  radius: number;
  hp: number;
}

export interface FlameWall {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  startTime: number;
  duration: number;
}

export interface ReconBeacon {
  id: string;
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  hp: number;
  isRelay?: boolean;
}

export interface MirageDecoy {
  id: string;
  group: THREE.Group;
  hitboxMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  startTime: number;
  duration: number;
  hp: number;
  walkPhase: number;
}

export interface DestructibleBarrierSegment {
  id: string;
  mesh: THREE.Mesh;
  colliderId: string;
  hp: number;
  maxHp: number;
  startTime: number;
  duration: number;
}

const SHARED_SMOKE_GEO = new THREE.SphereGeometry(3.6, 16, 16);
const SHARED_MOLLY_GEO = new THREE.CylinderGeometry(3.2, 3.2, 0.14, 20);
const SHARED_SLOW_GEO = new THREE.CylinderGeometry(4.2, 4.2, 0.08, 24);
const SHARED_PYLON_GEO = new THREE.CylinderGeometry(0.14, 0.22, 0.72, 10);
const SHARED_LEER_GEO = new THREE.OctahedronGeometry(0.55, 1);
const SHARED_BEACON_GEO = new THREE.CylinderGeometry(0.12, 0.16, 0.85, 10);
const SHARED_RING_GEO = new THREE.RingGeometry(0.5, 0.88, 28);
const SHARED_DECAL_GEO = new THREE.CircleGeometry(0.085, 8);

const MAT_BULLET_DECAL = new THREE.MeshBasicMaterial({
  color: 0x111317,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

export class ParticleSystem {
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkLifetimes: Float32Array;
  private sparkMaxLifetimes: Float32Array;
  private sparkColors: Float32Array;
  private maxSparks = 110;
  private sparkCursor = 0;

  private tracerLines: THREE.LineSegments;
  private tracerPositions: Float32Array;
  private tracerLifetimes: Float32Array;
  private maxTracers = 32;
  private tracerCursor = 0;

  // Subtle floating atmospheric dust motes for the charcoal architectural scene
  private dustPoints: THREE.Points;
  private dustPositions: Float32Array;
  private dustSeeds: Float32Array;
  private dustCount = 48;

  private decalMeshes: THREE.Mesh[] = [];
  private maxDecals = 48;
  private decalCursor = 0;

  private smokeClouds: SmokeCloud[] = [];
  private mollyFires: MollyFire[] = [];
  private slowZones: SlowZone[] = [];
  private flameWalls: FlameWall[] = [];
  private reconBeacons: ReconBeacon[] = [];
  private mirageDecoys: MirageDecoy[] = [];
  private barrierSegments: DestructibleBarrierSegment[] = [];
  private mapCollidersRef: FastAABB[] | null = null;
  private tempVisuals: { mesh: THREE.Object3D; startTime: number; duration: number }[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. POOLED SPARKS & IMPACTS
    const sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkVelocities = new Float32Array(this.maxSparks * 3);
    this.sparkLifetimes = new Float32Array(this.maxSparks);
    this.sparkMaxLifetimes = new Float32Array(this.maxSparks);
    this.sparkColors = new Float32Array(this.maxSparks * 3);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPositions[i * 3 + 1] = -999;
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // 2. POOLED BULLET TRACERS
    const tracerGeo = new THREE.BufferGeometry();
    this.tracerPositions = new Float32Array(this.maxTracers * 6);
    this.tracerLifetimes = new Float32Array(this.maxTracers);

    for (let i = 0; i < this.maxTracers * 6; i++) {
      this.tracerPositions[i] = -999;
    }

    tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPositions, 3));
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    this.tracerLines = new THREE.LineSegments(tracerGeo, tracerMat);
    this.tracerLines.frustumCulled = false;
    this.scene.add(this.tracerLines);

    // 3. SUBTLE ATMOSPHERIC DUST MOTES (Barely noticeable floating dust in lighting shafts)
    const dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustSeeds = new Float32Array(this.dustCount);
    for (let i = 0; i < this.dustCount; i++) {
      this.dustPositions[i * 3] = (Math.random() - 0.5) * 14;
      this.dustPositions[i * 3 + 1] = 0.6 + Math.random() * 3.8;
      this.dustPositions[i * 3 + 2] = 18 + Math.random() * 14;
      this.dustSeeds[i] = Math.random() * Math.PI * 2;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.032,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.dustPoints.frustumCulled = false;
    this.scene.add(this.dustPoints);

    // 4. POOLED BULLET IMPACT SCORCH DECALS
    for (let i = 0; i < this.maxDecals; i++) {
      const decal = new THREE.Mesh(SHARED_DECAL_GEO, MAT_BULLET_DECAL);
      decal.visible = false;
      this.scene.add(decal);
      this.decalMeshes.push(decal);
    }
  }

  public updateAmbientDust(dt: number, timeSec: number) {
    for (let i = 0; i < this.dustCount; i++) {
      const seed = this.dustSeeds[i];
      this.dustPositions[i * 3] += Math.sin(timeSec * 0.22 + seed) * 0.04 * dt;
      this.dustPositions[i * 3 + 1] += Math.cos(timeSec * 0.18 + seed * 1.3) * 0.025 * dt;
      if (this.dustPositions[i * 3 + 1] > 4.4) this.dustPositions[i * 3 + 1] = 0.6;
      if (this.dustPositions[i * 3 + 1] < 0.5) this.dustPositions[i * 3 + 1] = 4.2;
    }
    this.dustPoints.geometry.attributes.position.needsUpdate = true;
  }

  public emitBulletDecal(pos: THREE.Vector3, normal: THREE.Vector3) {
    const decal = this.decalMeshes[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.maxDecals;
    decal.visible = true;
    decal.position.copy(pos).addScaledVector(normal, 0.015);
    decal.lookAt(pos.clone().add(normal));
  }

  public emitSparks(pos: THREE.Vector3, normal: THREE.Vector3, isEnemyHit: boolean, count = 6) {
    for (let i = 0; i < count; i++) {
      const idx = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % this.maxSparks;

      this.sparkPositions[idx * 3] = pos.x;
      this.sparkPositions[idx * 3 + 1] = pos.y;
      this.sparkPositions[idx * 3 + 2] = pos.z;

      const speed = 2.2 + Math.random() * 4.8;
      this.sparkVelocities[idx * 3] = (normal.x + (Math.random() - 0.5) * 1.2) * speed;
      this.sparkVelocities[idx * 3 + 1] = (normal.y + Math.random() * 0.9) * speed;
      this.sparkVelocities[idx * 3 + 2] = (normal.z + (Math.random() - 0.5) * 1.2) * speed;

      this.sparkLifetimes[idx] = 0;
      this.sparkMaxLifetimes[idx] = 0.22 + Math.random() * 0.22;

      if (isEnemyHit) {
        this.sparkColors[idx * 3] = 1.0;
        this.sparkColors[idx * 3 + 1] = 0.22;
        this.sparkColors[idx * 3 + 2] = 0.3;
      } else {
        this.sparkColors[idx * 3] = 1.0;
        this.sparkColors[idx * 3 + 1] = 0.85;
        this.sparkColors[idx * 3 + 2] = 0.35;
      }
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.geometry.attributes.color.needsUpdate = true;
  }

  public emitTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const idx = this.tracerCursor;
    this.tracerCursor = (this.tracerCursor + 1) % this.maxTracers;

    const base = idx * 6;
    this.tracerPositions[base] = from.x;
    this.tracerPositions[base + 1] = from.y;
    this.tracerPositions[base + 2] = from.z;
    this.tracerPositions[base + 3] = to.x;
    this.tracerPositions[base + 4] = to.y;
    this.tracerPositions[base + 5] = to.z;

    this.tracerLifetimes[idx] = 0.065;
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
  }

  public spawnSmoke(position: THREE.Vector3, duration = 12.0, isToxic = false) {
    const mat = new THREE.MeshLambertMaterial({
      color: isToxic ? 0x34d399 : 0xbae6fd,
      emissive: isToxic ? 0x059669 : 0x0284c7,
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(SHARED_SMOKE_GEO, mat);
    mesh.position.copy(position);
    mesh.position.y = Math.max(1.8, position.y);
    mesh.scale.set(0.1, 0.1, 0.1);
    this.scene.add(mesh);

    this.smokeClouds.push({
      mesh,
      position: mesh.position.clone(),
      startTime: performance.now() / 1000,
      duration,
      maxRadius: 3.6,
      isToxic,
    });
  }

  public spawnMolly(
    position: THREE.Vector3,
    isOwnerFriendly: boolean,
    duration = 6.5,
    isAcid = false
  ) {
    const mat = new THREE.MeshBasicMaterial({
      color: isAcid ? 0x10b981 : 0xff5c00,
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(SHARED_MOLLY_GEO, mat);
    mesh.position.set(position.x, 0.06, position.z);
    this.scene.add(mesh);

    this.mollyFires.push({
      mesh,
      position: new THREE.Vector3(position.x, 0, position.z),
      startTime: performance.now() / 1000,
      duration,
      radius: 3.2,
      damagePerSec: 45,
      isOwnerFriendly,
      isAcid,
    });
  }

  /**
   * Spawns the STATIC FIELD (CTL-03) area-control emitter with a destructible central pylon.
   */
  public spawnSlowZone(position: THREE.Vector3, duration = 7.0, hp = 90) {
    const zoneId = `static_${Date.now()}_${Math.random()}`;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(SHARED_SLOW_GEO, mat);
    mesh.position.set(position.x, 0.04, position.z);
    this.scene.add(mesh);

    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.85,
    });
    const pylonMesh = new THREE.Mesh(SHARED_PYLON_GEO, pylonMat);
    pylonMesh.position.set(position.x, 0.36, position.z);
    pylonMesh.userData = {
      isDestructibleBeacon: true,
      beaconId: zoneId,
    };
    this.scene.add(pylonMesh);

    this.slowZones.push({
      id: zoneId,
      mesh,
      pylonMesh,
      position: new THREE.Vector3(position.x, 0, position.z),
      startTime: performance.now() / 1000,
      duration,
      radius: 4.2,
      hp,
    });
  }

  /**
   * Spawns the MIRAGE (DEC-02) moving holographic operator decoy.
   * Walks forward along forwardDir, has subtle scanline flicker, cannot deal damage, and can be destroyed.
   */
  public spawnMirageDecoy(
    origin: THREE.Vector3,
    forwardDir: THREE.Vector3,
    duration = 7.5,
    hp = 65
  ) {
    const decoyId = `mirage_${Date.now()}_${Math.random()}`;
    const flatDir = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
    const spawnPos = origin.clone().addScaledVector(flatDir, 1.4);
    spawnPos.y = 0;

    const group = new THREE.Group();
    group.position.copy(spawnPos);
    group.rotation.y = Math.atan2(flatDir.x, flatDir.z);

    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.68,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.28), holoMat);
    torso.position.set(0, 1.05, 0);
    torso.userData = {
      isDestructibleBeacon: true,
      beaconId: decoyId,
    };
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), holoMat);
    head.position.set(0, 1.56, 0);
    head.userData = {
      isDestructibleBeacon: true,
      beaconId: decoyId,
    };
    group.add(head);

    const legGeo = new THREE.BoxGeometry(0.16, 0.68, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, holoMat);
    leftLeg.position.set(-0.13, 0.35, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, holoMat);
    rightLeg.position.set(0.13, 0.35, 0);
    group.add(rightLeg);

    this.scene.add(group);

    this.mirageDecoys.push({
      id: decoyId,
      group,
      hitboxMesh: torso,
      leftLeg,
      rightLeg,
      position: spawnPos,
      direction: flatDir,
      startTime: performance.now() / 1000,
      duration,
      hp,
      walkPhase: 0,
    });
  }

  /**
   * Spawns AEGIS (DEF-04) 4-segment Hard-Light Energy Barrier with real AABB collision & configurable HP!
   */
  public spawnBarrierWall(
    origin: THREE.Vector3,
    forwardDir: THREE.Vector3,
    colliders: FastAABB[],
    duration = 18.0,
    hpPerSegment = 400
  ) {
    this.mapCollidersRef = colliders;
    const flatForward = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
    const rightVec = new THREE.Vector3(-flatForward.z, 0, flatForward.x).normalize();
    const wallCenter = origin.clone().addScaledVector(flatForward, 3.8);

    const segWidth = 2.0;
    const segHeight = 2.65;
    const segDepth = 0.85;
    const now = performance.now() / 1000;

    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * segWidth;
      const segPos = wallCenter.clone().addScaledVector(rightVec, offset);

      const segMat = new THREE.MeshStandardMaterial({
        color: 0x5eead4,
        emissive: 0x0d9488,
        emissiveIntensity: 0.32,
        roughness: 0.18,
        metalness: 0.65,
        transparent: true,
        opacity: 0.94,
      });

      const segGeo = new THREE.BoxGeometry(segWidth - 0.06, segHeight, segDepth);
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set(segPos.x, segHeight / 2, segPos.z);
      segMesh.rotation.y = Math.atan2(flatForward.x, flatForward.z);

      const segId = `barrier_seg_${Date.now()}_${i}`;
      const colId = `col_${segId}`;
      segMesh.userData = {
        isDestructibleBarrier: true,
        barrierId: segId,
      };
      this.scene.add(segMesh);

      const halfExtent = Math.max(segWidth, segDepth) * 0.48;
      colliders.push({
        id: colId,
        minX: segPos.x - halfExtent,
        maxX: segPos.x + halfExtent,
        minY: 0,
        maxY: segHeight,
        minZ: segPos.z - halfExtent,
        maxZ: segPos.z + halfExtent,
        isDynamic: true,
      });

      this.barrierSegments.push({
        id: segId,
        mesh: segMesh,
        colliderId: colId,
        hp: hpPerSegment,
        maxHp: hpPerSegment,
        startTime: now,
        duration,
      });
    }
  }

  public damageBarrierSegment(barrierId: string, damage: number): { destroyed: boolean; hp: number } {
    const idx = this.barrierSegments.findIndex((s) => s.id === barrierId);
    if (idx === -1) return { destroyed: false, hp: 0 };

    const seg = this.barrierSegments[idx];
    seg.hp = Math.max(0, seg.hp - damage);
    const mat = seg.mesh.material as THREE.MeshStandardMaterial;
    const ratio = seg.hp / seg.maxHp;
    mat.opacity = 0.45 + ratio * 0.5;
    mat.color.setHex(ratio < 0.4 ? 0xfca5a5 : 0x5eead4);

    if (seg.hp <= 0) {
      this.removeBarrierSegment(idx);
      return { destroyed: true, hp: 0 };
    }
    return { destroyed: false, hp: seg.hp };
  }

  private removeBarrierSegment(idx: number) {
    const seg = this.barrierSegments[idx];
    if (!seg) return;
    this.scene.remove(seg.mesh);
    seg.mesh.geometry.dispose();
    (seg.mesh.material as THREE.Material).dispose();
    if (this.mapCollidersRef) {
      const colIdx = this.mapCollidersRef.findIndex((c) => c.id === seg.colliderId);
      if (colIdx !== -1) {
        this.mapCollidersRef.splice(colIdx, 1);
      }
    }
    this.barrierSegments.splice(idx, 1);
  }

  public getDestructibleMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < this.barrierSegments.length; i++) {
      meshes.push(this.barrierSegments[i].mesh);
    }
    for (let i = 0; i < this.reconBeacons.length; i++) {
      meshes.push(this.reconBeacons[i].mesh);
    }
    for (let i = 0; i < this.slowZones.length; i++) {
      meshes.push(this.slowZones[i].pylonMesh);
    }
    for (let i = 0; i < this.mirageDecoys.length; i++) {
      meshes.push(this.mirageDecoys[i].hitboxMesh);
    }
    return meshes;
  }

  public damageReconBeacon(beaconId: string, damage: number): boolean {
    const idx = this.reconBeacons.findIndex((r) => r.id === beaconId);
    if (idx !== -1) {
      this.reconBeacons[idx].hp -= damage;
      if (this.reconBeacons[idx].hp <= 0) {
        const rb = this.reconBeacons[idx];
        this.scene.remove(rb.mesh);
        this.scene.remove(rb.ringMesh);
        (rb.ringMesh.material as THREE.Material).dispose();
        this.reconBeacons.splice(idx, 1);
        return true;
      }
      return false;
    }

    const szIdx = this.slowZones.findIndex((s) => s.id === beaconId);
    if (szIdx !== -1) {
      this.slowZones[szIdx].hp -= damage;
      if (this.slowZones[szIdx].hp <= 0) {
        const sz = this.slowZones[szIdx];
        this.scene.remove(sz.mesh);
        this.scene.remove(sz.pylonMesh);
        (sz.mesh.material as THREE.Material).dispose();
        (sz.pylonMesh.material as THREE.Material).dispose();
        this.slowZones.splice(szIdx, 1);
        return true;
      }
      return false;
    }

    const mdIdx = this.mirageDecoys.findIndex((m) => m.id === beaconId);
    if (mdIdx !== -1) {
      this.mirageDecoys[mdIdx].hp -= damage;
      if (this.mirageDecoys[mdIdx].hp <= 0) {
        const md = this.mirageDecoys[mdIdx];
        this.emitSparks(md.position.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, 1, 0), true, 14);
        this.scene.remove(md.group);
        this.mirageDecoys.splice(mdIdx, 1);
        return true;
      }
      return false;
    }

    return false;
  }

  public spawnFlameWall(origin: THREE.Vector3, dir: THREE.Vector3, duration = 8.0) {
    const length = 14;
    const height = 3.2;
    const geo = new THREE.BoxGeometry(0.35, height, length);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      transparent: true,
      opacity: 0.82,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const flatDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const center = origin.clone().addScaledVector(flatDir, length / 2 + 1.2);
    mesh.position.set(center.x, height / 2, center.z);
    mesh.rotation.y = Math.atan2(flatDir.x, flatDir.z);
    this.scene.add(mesh);

    this.flameWalls.push({
      mesh,
      start: origin.clone().addScaledVector(flatDir, 1.2),
      end: origin.clone().addScaledVector(flatDir, length + 1.2),
      startTime: performance.now() / 1000,
      duration,
    });
  }

  public spawnLeerEye(position: THREE.Vector3, duration = 3.5) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(SHARED_LEER_GEO, mat);
    mesh.position.copy(position);
    mesh.position.y = Math.max(2.6, position.y);
    this.scene.add(mesh);

    this.tempVisuals.push({
      mesh,
      startTime: performance.now() / 1000,
      duration,
    });
  }

  public spawnReconBeacon(position: THREE.Vector3, duration = 6.0, hp = 80, isRelay = false) {
    const beaconId = `beacon_${Date.now()}_${Math.random()}`;
    const mat = new THREE.MeshBasicMaterial({ color: isRelay ? 0x34d399 : 0x00f2fe });
    const mesh = new THREE.Mesh(SHARED_BEACON_GEO, mat);
    mesh.position.set(position.x, 0.45, position.z);
    mesh.userData = {
      isDestructibleBeacon: true,
      beaconId,
    };
    this.scene.add(mesh);

    const ringMat = new THREE.MeshBasicMaterial({
      color: isRelay ? 0x10b981 : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
    });
    const ringMesh = new THREE.Mesh(SHARED_RING_GEO, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(position.x, 0.06, position.z);
    this.scene.add(ringMesh);

    this.reconBeacons.push({
      id: beaconId,
      mesh,
      ringMesh,
      position: new THREE.Vector3(position.x, 0, position.z),
      startTime: performance.now() / 1000,
      duration,
      hp,
      isRelay,
    });
  }

  public spawnEnergyBeam(origin: THREE.Vector3, dir: THREE.Vector3, length = 60) {
    const geo = new THREE.CylinderGeometry(0.35, 0.35, length, 10);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.88,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const center = origin.clone().addScaledVector(dir, length / 2);
    mesh.position.copy(center);
    mesh.lookAt(origin.clone().addScaledVector(dir, length));
    this.scene.add(mesh);

    this.tempVisuals.push({
      mesh,
      startTime: performance.now() / 1000,
      duration: 0.65,
    });
  }

  public update(dt: number) {
    const now = performance.now() / 1000;
    this.updateAmbientDust(dt, now);

    // Update Sparks
    let anySparkUpdated = false;
    for (let i = 0; i < this.maxSparks; i++) {
      if (this.sparkLifetimes[i] < this.sparkMaxLifetimes[i]) {
        this.sparkLifetimes[i] += dt;
        if (this.sparkLifetimes[i] >= this.sparkMaxLifetimes[i]) {
          this.sparkPositions[i * 3 + 1] = -999;
        } else {
          this.sparkPositions[i * 3] += this.sparkVelocities[i * 3] * dt;
          this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i * 3 + 1] * dt;
          this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i * 3 + 2] * dt;
          this.sparkVelocities[i * 3 + 1] -= 9.8 * dt;
        }
        anySparkUpdated = true;
      }
    }
    if (anySparkUpdated) {
      this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Update Pooled Tracers
    let anyTracerUpdated = false;
    for (let i = 0; i < this.maxTracers; i++) {
      if (this.tracerLifetimes[i] > 0) {
        this.tracerLifetimes[i] -= dt;
        if (this.tracerLifetimes[i] <= 0) {
          const base = i * 6;
          this.tracerPositions[base + 1] = -999;
          this.tracerPositions[base + 4] = -999;
          anyTracerUpdated = true;
        }
      }
    }
    if (anyTracerUpdated) {
      this.tracerLines.geometry.attributes.position.needsUpdate = true;
    }

    // Update Smoke Clouds
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const sc = this.smokeClouds[i];
      const elapsed = now - sc.startTime;
      if (elapsed > sc.duration) {
        this.scene.remove(sc.mesh);
        (sc.mesh.material as THREE.Material).dispose();
        this.smokeClouds.splice(i, 1);
      } else {
        const scale = Math.min(1.0, elapsed / 0.35);
        sc.mesh.scale.set(scale, scale, scale);
        if (elapsed > sc.duration - 1.0) {
          (sc.mesh.material as THREE.MeshLambertMaterial).opacity =
            0.88 * (sc.duration - elapsed);
        }
      }
    }

    // Update Molly Fires
    for (let i = this.mollyFires.length - 1; i >= 0; i--) {
      const mf = this.mollyFires[i];
      const elapsed = now - mf.startTime;
      if (elapsed > mf.duration) {
        this.scene.remove(mf.mesh);
        (mf.mesh.material as THREE.Material).dispose();
        this.mollyFires.splice(i, 1);
      } else {
        const pulse = 1.0 + Math.sin(now * 9) * 0.06;
        mf.mesh.scale.set(pulse, 1, pulse);
      }
    }

    // Update Slow Zones (Static Field)
    for (let i = this.slowZones.length - 1; i >= 0; i--) {
      const sz = this.slowZones[i];
      const elapsed = now - sz.startTime;
      if (elapsed > sz.duration) {
        this.scene.remove(sz.mesh);
        this.scene.remove(sz.pylonMesh);
        (sz.mesh.material as THREE.Material).dispose();
        (sz.pylonMesh.material as THREE.Material).dispose();
        this.slowZones.splice(i, 1);
      } else {
        sz.pylonMesh.rotation.y += dt * 2.5;
      }
    }

    // Update Mirage Holographic Decoys
    for (let i = this.mirageDecoys.length - 1; i >= 0; i--) {
      const md = this.mirageDecoys[i];
      const elapsed = now - md.startTime;
      if (elapsed > md.duration) {
        this.scene.remove(md.group);
        this.mirageDecoys.splice(i, 1);
      } else {
        md.position.addScaledVector(md.direction, 4.1 * dt);
        md.position.x = Math.max(-41, Math.min(41, md.position.x));
        md.position.z = Math.max(-47, Math.min(47, md.position.z));
        md.group.position.copy(md.position);
        md.walkPhase += dt * 10;
        const swing = Math.sin(md.walkPhase) * 0.45;
        md.leftLeg.rotation.x = swing;
        md.rightLeg.rotation.x = -swing;
        // Subtle holographic scanline flicker (counterplay visual cue)
        const mat = md.hitboxMesh.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.55 + Math.sin(now * 28) * 0.14;
      }
    }

    // Update Destructible Barrier Wall Segments
    for (let i = this.barrierSegments.length - 1; i >= 0; i--) {
      const seg = this.barrierSegments[i];
      const elapsed = now - seg.startTime;
      if (elapsed > seg.duration) {
        this.removeBarrierSegment(i);
      }
    }

    // Update Flame Walls
    for (let i = this.flameWalls.length - 1; i >= 0; i--) {
      const fw = this.flameWalls[i];
      const elapsed = now - fw.startTime;
      if (elapsed > fw.duration) {
        this.scene.remove(fw.mesh);
        fw.mesh.geometry.dispose();
        (fw.mesh.material as THREE.Material).dispose();
        this.flameWalls.splice(i, 1);
      }
    }

    // Update Recon Beacons & Relay Nodes
    for (let i = this.reconBeacons.length - 1; i >= 0; i--) {
      const rb = this.reconBeacons[i];
      const elapsed = now - rb.startTime;
      if (elapsed > rb.duration) {
        this.scene.remove(rb.mesh);
        this.scene.remove(rb.ringMesh);
        (rb.ringMesh.material as THREE.Material).dispose();
        this.reconBeacons.splice(i, 1);
      } else {
        const cycle = (elapsed * (rb.isRelay ? 0.85 : 1.25)) % 1.0;
        const ringScale = 1 + cycle * (rb.isRelay ? 16 : 24);
        rb.ringMesh.scale.set(ringScale, ringScale, 1);
        (rb.ringMesh.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.78;
      }
    }

    // Update Temp Visuals
    for (let i = this.tempVisuals.length - 1; i >= 0; i--) {
      const tv = this.tempVisuals[i];
      const elapsed = now - tv.startTime;
      if (elapsed > tv.duration) {
        this.scene.remove(tv.mesh);
        this.tempVisuals.splice(i, 1);
      } else {
        tv.mesh.rotation.y += dt * 3;
      }
    }
  }

  public getMollyFires(): MollyFire[] {
    return this.mollyFires;
  }

  public getSlowZones(): SlowZone[] {
    return this.slowZones;
  }

  public getFlameWalls(): FlameWall[] {
    return this.flameWalls;
  }

  public getSmokeClouds(): SmokeCloud[] {
    return this.smokeClouds;
  }

  public getReconBeacons(): ReconBeacon[] {
    return this.reconBeacons;
  }

  public getMirageDecoys(): MirageDecoy[] {
    return this.mirageDecoys;
  }

  public hasActiveRecon(): boolean {
    return this.reconBeacons.length > 0;
  }

  public isPositionSlowed(pos: THREE.Vector3): boolean {
    for (let i = 0; i < this.slowZones.length; i++) {
      const sz = this.slowZones[i];
      if (Math.hypot(pos.x - sz.position.x, pos.z - sz.position.z) <= sz.radius) {
        return true;
      }
    }
    return false;
  }

  public clearAll() {
    this.smokeClouds.forEach((sc) => {
      this.scene.remove(sc.mesh);
      (sc.mesh.material as THREE.Material).dispose();
    });
    this.smokeClouds = [];

    this.mollyFires.forEach((mf) => {
      this.scene.remove(mf.mesh);
      (mf.mesh.material as THREE.Material).dispose();
    });
    this.mollyFires = [];

    this.slowZones.forEach((sz) => {
      this.scene.remove(sz.mesh);
      this.scene.remove(sz.pylonMesh);
      (sz.mesh.material as THREE.Material).dispose();
      (sz.pylonMesh.material as THREE.Material).dispose();
    });
    this.slowZones = [];

    this.mirageDecoys.forEach((md) => {
      this.scene.remove(md.group);
    });
    this.mirageDecoys = [];

    for (let i = this.barrierSegments.length - 1; i >= 0; i--) {
      this.removeBarrierSegment(i);
    }

    this.flameWalls.forEach((fw) => {
      this.scene.remove(fw.mesh);
      fw.mesh.geometry.dispose();
      (fw.mesh.material as THREE.Material).dispose();
    });
    this.flameWalls = [];

    this.reconBeacons.forEach((rb) => {
      this.scene.remove(rb.mesh);
      this.scene.remove(rb.ringMesh);
      (rb.ringMesh.material as THREE.Material).dispose();
    });
    this.reconBeacons = [];

    this.tempVisuals.forEach((tv) => {
      this.scene.remove(tv.mesh);
    });
    this.tempVisuals = [];

    for (let i = 0; i < this.maxDecals; i++) {
      this.decalMeshes[i].visible = false;
    }

    for (let i = 0; i < this.maxTracers; i++) {
      this.tracerLifetimes[i] = 0;
      this.tracerPositions[i * 6 + 1] = -999;
      this.tracerPositions[i * 6 + 4] = -999;
    }
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
  }
}
