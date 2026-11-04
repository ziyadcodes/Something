import * as THREE from 'three';
import { GameSettings, MapId, MapInfo } from '../types/game';
import {
  createCofferedCeilingPBRMaps,
  createFloorPBRMaps,
  createSiloPBRMaps,
  createWallPBRMaps,
  loadDiskPBRTextureSet,
} from './pbrTextureGenerator';

export const MAPS: Record<MapId, MapInfo> = {
  industrial: {
    id: 'industrial',
    name: 'SECTOR 04 // REACTOR BUNKER',
    codeName: 'INDUSTRIAL COMPLEX',
    location: 'Underground Heavy Industrial Facility',
    description:
      'Subterranean reactor complex featuring ribbed concrete blast walls, steel catwalks, cylindrical pressure silos, floor drainage grates, and overhead pipe networks.',
    skyColor: 0x141210,
    fogColor: 0x1c1815,
    accentHex: '#f59e0b',
  },
  research: {
    id: 'research',
    name: 'KRONOS // CRYO RESEARCH LAB',
    codeName: 'MODERN RESEARCH FACILITY',
    location: 'Arctic Bio-Containment Sector',
    description:
      'High-tech research facility with clean composite lab panels, cryo-stasis specimen pods, server banks, and dual containment sites.',
    skyColor: 0x0f172a,
    fogColor: 0x1e293b,
    accentHex: '#00f2fe',
  },
  desert: {
    id: 'desert',
    name: 'OUTPOST DUST // FORTRESS',
    codeName: 'DESERT MILITARY OUTPOST',
    location: 'Arid Forward Operating Base',
    description:
      'Sun-scorched sandstone military compound with narrow bazaar chokepoints, fortified sandbag bunkers, and open courtyard sightlines.',
    skyColor: 0x7c5836,
    fogColor: 0x9a714c,
    accentHex: '#ef4444',
  },
};

export interface PlantSiteZone {
  site: 'A' | 'B';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: THREE.Vector3;
}

export interface FastAABB {
  id?: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isBarrier?: boolean;
  isDynamic?: boolean;
}

export interface MapData {
  mapId: MapId;
  scene: THREE.Group;
  detailPropsGroup: THREE.Group;
  volumetricGroup: THREE.Group;
  pointLights: THREE.PointLight[];
  colliders: FastAABB[];
  wallMeshes: THREE.Mesh[];
  plantZones: PlantSiteZone[];
  spawnAttacker: THREE.Vector3;
  spawnDefender: THREE.Vector3;
  barrierMeshes: THREE.Mesh[];
  setPotatoMode: (enabled: boolean) => void;
  applyGraphicsSettings: (settings: GameSettings) => void;
}

/**
 * Applies world-space UV scaling to a BoxGeometry so textures tile cleanly without stretching.
 */
function applyBoxWorldUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number, tileMeters = 8) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const uOrig = uv.getX(i);
    const vOrig = uv.getY(i);

    if (nx > 0.5) {
      // Left/Right faces: span depth (d) horizontally, height (h) vertically
      uv.setXY(i, uOrig * Math.max(1, d / tileMeters), vOrig);
    } else if (ny > 0.5) {
      // Top/Bottom faces: span width (w) and depth (d)
      uv.setXY(i, uOrig * Math.max(1, w / tileMeters), vOrig * Math.max(1, d / tileMeters));
    } else {
      // Front/Back faces: span width (w) horizontally
      uv.setXY(i, uOrig * Math.max(1, w / tileMeters), vOrig);
    }
  }
  uv.needsUpdate = true;
}

/**
 * Recessed steel drainage grate texture running along the industrial bunker floor (Matches image.png!).
 */
function createMetalGrateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark drainage trench underneath
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, 256, 256);

  // Outer brushed steel frame
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 16;
  ctx.strokeRect(0, 0, 256, 256);

  // Longitudinal support bars
  ctx.fillStyle = '#52525b';
  ctx.fillRect(82, 0, 8, 256);
  ctx.fillRect(166, 0, 8, 256);

  // Horizontal steel grate slats with bright specular top edges
  for (let y = 10; y < 250; y += 14) {
    ctx.fillStyle = '#52525b';
    ctx.fillRect(10, y, 236, 6);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(10, y, 236, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 22);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Industrial Control Console front panel texture with CRT screen, illuminated meters, and switches (Matches image.png!).
 */
function createConsolePanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Brushed gunmetal steel cabinet housing
  ctx.fillStyle = '#57534e';
  ctx.fillRect(0, 0, 256, 256);

  // Upper instrument cluster bezel
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(12, 12, 232, 112);
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 232, 112);

  // Dark CRT monitor screen on left with green telemetry grid
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(22, 22, 78, 64);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 70, 56);
  ctx.beginPath();
  ctx.moveTo(28, 54);
  ctx.lineTo(45, 42);
  ctx.lineTo(62, 64);
  ctx.lineTo(78, 36);
  ctx.lineTo(92, 54);
  ctx.stroke();

  // 3 Illuminated warm-amber analog gauges on right (Matches image.png!)
  for (let gx = 112; gx < 228; gx += 38) {
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(gx, 24, 32, 24);
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, 24, 32, 24);
    // Needle
    ctx.beginPath();
    ctx.moveTo(gx + 16, 46);
    ctx.lineTo(gx + 10 + ((gx * 7) % 14), 28);
    ctx.stroke();

    // Red/Amber indicator status lamps
    ctx.fillStyle = gx === 150 ? '#ef4444' : '#f59e0b';
    ctx.fillRect(gx + 6, 56, 20, 9);
  }

  // Pushbuttons & rotary selector switches
  for (let bx = 24; bx < 230; bx += 20) {
    ctx.fillStyle = bx % 60 === 0 ? '#ef4444' : bx % 40 === 0 ? '#eab308' : '#1c1917';
    ctx.fillRect(bx, 96, 13, 13);
  }

  // Lower cabinet doors with louvered air vents
  ctx.fillStyle = '#44403c';
  ctx.fillRect(14, 132, 228, 112);
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 132, 112, 112);
  ctx.strokeRect(126, 132, 116, 112);

  // Louvered vent slots
  ctx.fillStyle = '#1c1917';
  for (let vy = 150; vy < 222; vy += 9) {
    ctx.fillRect(34, vy, 72, 4);
    ctx.fillRect(148, vy, 72, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Corrugated metal shipping crate / industrial box texture (Matches ribbed metal crates in image.png!).
 */
function createCorrugatedCrateTexture(isDarkSteel: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isDarkSteel ? '#3f3f46' : '#52525b';
  ctx.fillRect(0, 0, 256, 256);

  // Vertical corrugated metal ribs with deep shadows & specular highlights
  for (let x = 14; x < 242; x += 14) {
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(x, 14, 6, 228);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 6, 14, 4, 228);
  }

  // Heavy welded steel corner frame
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 18;
  ctx.strokeRect(7, 7, 242, 242);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Yellow/Black Diagonal Hazard Warning Stripe Decal Texture.
 */
function createHazardPadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#e58e09';
  for (let x = -128; x < 384; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 18, 128);
    ctx.lineTo(x + 64, 0);
    ctx.lineTo(x + 46, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = '#e58e09';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPlantZoneTexture(site: 'A' | 'B'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 228, 228);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(site, 128, 110);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('TARGET SECTOR ' + site, 128, 182);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds the 3D Tactical Arena matching the atmospheric Industrial Reactor Bunker in image.png,
 * with distinct architecture & materials for all 3 maps ('industrial', 'research', 'desert').
 */
export function buildTacticalMap(mapId: MapId = 'industrial'): MapData {
  const root = new THREE.Group();
  root.name = `TacticalMap_${mapId}`;

  const detailPropsGroup = new THREE.Group();
  detailPropsGroup.name = 'EnvironmentalDetailProps';
  root.add(detailPropsGroup);

  const volumetricGroup = new THREE.Group();
  volumetricGroup.name = 'VolumetricLightCones';
  root.add(volumetricGroup);

  const pointLights: THREE.PointLight[] = [];
  const colliders: FastAABB[] = [];
  const wallMeshes: THREE.Mesh[] = [];
  const barrierMeshes: THREE.Mesh[] = [];

  // Generate Full PBR Map Sets (Albedo + Tangent-Space Normal + Roughness)
  const floorPBR = createFloorPBRMaps(mapId, 8);
  const wallMainPBR = createWallPBRMaps(mapId, false, 8);
  const wallAccentPBR = createWallPBRMaps(mapId, true, 8);
  const ceilingPBR = createCofferedCeilingPBRMaps(8);
  const siloPBR = createSiloPBRMaps(8);

  const grateTex = createMetalGrateTexture();
  const consoleTex = createConsolePanelTexture();
  const crateTexA = createCorrugatedCrateTexture(true);
  const crateTexB = createCorrugatedCrateTexture(false);
  const hazardPadTex = createHazardPadTexture();

  // Load Physical .png PBR Texture Maps from /public/assets/textures/ across all 11 categories
  const diskConcrete = loadDiskPBRTextureSet('concrete', 18, 22, 8);
  const diskPaintedConcrete = loadDiskPBRTextureSet('painted_concrete', 1, 1, 8);
  const diskMetal = loadDiskPBRTextureSet('metal', 2, 2, 8);
  const diskBrushedMetal = loadDiskPBRTextureSet('brushed_metal', 2, 4, 8);
  const diskSiloDiamond = loadDiskPBRTextureSet('silo_diamond', 2, 2, 8);
  const diskAsphalt = loadDiskPBRTextureSet('asphalt', 16, 16, 8);
  const diskFloorTiles = loadDiskPBRTextureSet('floor_tiles', 20, 20, 8);
  const diskWood = loadDiskPBRTextureSet('wood', 2, 2, 8);
  const diskGlass = loadDiskPBRTextureSet('glass', 2, 2, 8);
  const diskFabric = loadDiskPBRTextureSet('fabric', 3, 3, 8);
  const diskPaintedWalls = loadDiskPBRTextureSet('painted_walls', 1, 1, 8);

  const selectedFloorDisk =
    mapId === 'research'
      ? diskFloorTiles
      : mapId === 'desert'
      ? diskAsphalt
      : diskConcrete;

  // High-Fidelity PBR Materials (Backed by real /assets/textures/*.png + architectural decals)
  const floorMatPBR = new THREE.MeshStandardMaterial({
    map: floorPBR.albedo,
    normalMap: selectedFloorDisk.normal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: selectedFloorDisk.roughness,
    aoMap: selectedFloorDisk.ao,
    aoMapIntensity: 0.65,
    roughness: 0.72,
    metalness: 0.16,
  });

  const grateMatPBR = new THREE.MeshStandardMaterial({
    map: grateTex,
    normalMap: diskMetal.normal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: diskMetal.roughness,
    metalnessMap: diskMetal.metallic,
    roughness: 0.28,
    metalness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const hazardDecalMat = new THREE.MeshStandardMaterial({
    map: hazardPadTex,
    normalMap: diskPaintedConcrete.normal,
    roughness: 0.5,
    metalness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const wallMatPBR = new THREE.MeshStandardMaterial({
    map: wallMainPBR.albedo,
    normalMap: diskPaintedConcrete.normal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: diskPaintedConcrete.roughness,
    aoMap: diskPaintedConcrete.ao,
    aoMapIntensity: 0.6,
    roughness: 0.68,
    metalness: 0.16,
  });

  const wallAccentMatPBR = new THREE.MeshStandardMaterial({
    map: wallAccentPBR.albedo,
    normalMap: diskPaintedWalls.normal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: diskPaintedWalls.roughness,
    aoMap: diskPaintedWalls.ao,
    roughness: 0.52,
    metalness: 0.34,
  });

  const ceilingMatPBR = new THREE.MeshStandardMaterial({
    map: ceilingPBR.albedo,
    normalMap: ceilingPBR.normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: ceilingPBR.roughness,
    roughness: 0.58,
    metalness: 0.48,
  });

  const steelMatPBR = new THREE.MeshStandardMaterial({
    map: diskMetal.albedo,
    normalMap: diskMetal.normal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: diskMetal.roughness,
    metalnessMap: diskMetal.metallic,
    aoMap: diskMetal.ao,
    roughness: 0.3,
    metalness: 0.88,
  });

  const darkDuctSteelMatPBR = new THREE.MeshStandardMaterial({
    map: diskBrushedMetal.albedo,
    color: 0x646b75,
    normalMap: diskBrushedMetal.normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: diskBrushedMetal.roughness,
    metalnessMap: diskBrushedMetal.metallic,
    roughness: 0.24,
    metalness: 0.92,
  });

  const siloMatPBR = new THREE.MeshStandardMaterial({
    map: siloPBR.albedo,
    normalMap: diskSiloDiamond.normal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: diskSiloDiamond.roughness,
    metalnessMap: diskSiloDiamond.metallic,
    aoMap: diskSiloDiamond.ao,
    roughness: 0.32,
    metalness: 0.84,
  });

  const consoleMatPBR = new THREE.MeshStandardMaterial({
    map: consoleTex,
    normalMap: diskBrushedMetal.normal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: diskBrushedMetal.roughness,
    roughness: 0.36,
    metalness: 0.68,
  });

  const crateMatA_PBR = new THREE.MeshStandardMaterial({
    map: crateTexA,
    normalMap: diskMetal.normal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: diskMetal.roughness,
    roughness: 0.4,
    metalness: 0.72,
  });

  const crateMatB_PBR = new THREE.MeshStandardMaterial({
    map: diskWood.albedo,
    normalMap: diskWood.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: diskWood.roughness,
    aoMap: diskWood.ao,
    roughness: 0.68,
    metalness: 0.08,
  });

  const fabricTarpMatPBR = new THREE.MeshStandardMaterial({
    map: diskFabric.albedo,
    normalMap: diskFabric.normal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: diskFabric.roughness,
    aoMap: diskFabric.ao,
    roughness: 0.86,
    metalness: 0.04,
  });

  // Ultra-Fast Potato Mode Flat Matte Materials (Used ONLY when Potato Mode is explicitly enabled)
  const floorMatPotato = new THREE.MeshBasicMaterial({ color: 0x574c43 });
  const wallMatPotato = new THREE.MeshBasicMaterial({ color: 0x6e6459 });
  const wallAccentMatPotato = new THREE.MeshBasicMaterial({ color: 0x4b4640 });
  const ceilingMatPotato = new THREE.MeshBasicMaterial({ color: 0x27272a });
  const crateMatA_Potato = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
  const crateMatB_Potato = new THREE.MeshBasicMaterial({ color: 0xd97706 });

  const fluorescentLampMat = new THREE.MeshBasicMaterial({ color: 0xfefce8 });
  const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const amberPipeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  const cyanCryoMat = new THREE.MeshStandardMaterial({
    map: diskGlass.albedo,
    normalMap: diskGlass.normal,
    roughnessMap: diskGlass.roughness,
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.2,
  });

  const swappableMeshes: {
    mesh: THREE.Mesh;
    pbr: THREE.Material;
    potato: THREE.Material;
  }[] = [];

  const registerSwappable = (
    mesh: THREE.Mesh,
    pbr: THREE.Material,
    potato: THREE.Material
  ) => {
    swappableMeshes.push({ mesh, pbr, potato });
  };

  // Solid Wall Helper with World-Space UV Scaling (Never stretches textures!)
  const addWall = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    isAccent: boolean = false
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    applyBoxWorldUVs(geo, w, h, d, 7.5);
    const mesh = new THREE.Mesh(geo, isAccent ? wallAccentMatPBR : wallMatPBR);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isWall: true };
    root.add(mesh);
    wallMeshes.push(mesh);
    registerSwappable(
      mesh,
      isAccent ? wallAccentMatPBR : wallMatPBR,
      isAccent ? wallAccentMatPotato : wallMatPotato
    );

    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y,
      maxY: y + h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
    return mesh;
  };

  // Ribbed Concrete Pillar with Beveled Collars (Matches Pillars in image.png!)
  const addSupportPillar = (x: number, z: number, h = 8.2) => {
    const pillar = addWall(x, 0, z, 1.65, h, 1.65, true);
    for (let cy = 1.9; cy < h - 0.8; cy += 2.0) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.34, 1.95), wallAccentMatPBR);
      collar.position.set(x, cy, z);
      detailPropsGroup.add(collar);
    }
    return pillar;
  };

  // Protruding 3D Concrete Wall Ribs + Upper Catwalk Reinforced Blast Door (Matches left wall of image.png!)
  const addLeftBunkerRibbedWallDetail = () => {
    // 3 Horizontal protruding concrete buttress ribs on the foreground-left wall
    for (const ry of [1.8, 3.6, 5.4]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 6.2), wallAccentMatPBR);
      rib.position.set(-9.1, ry, 28.5);
      detailPropsGroup.add(rib);
    }

    // Upper Catwalk Reinforced Steel Blast Door + Yellow/Black Hazard Doorway Frame (Matches image.png upper-left!)
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 2.5), hazardDecalMat);
    doorFrame.position.set(-9.25, 4.0, 22.8);
    detailPropsGroup.add(doorFrame);

    const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.85, 1.95), steelMatPBR);
    blastDoor.position.set(-9.2, 3.9, 22.8);
    detailPropsGroup.add(blastDoor);

    for (let dy = 2.8; dy <= 4.9; dy += 0.52) {
      const doorRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.14, 1.75),
        darkDuctSteelMatPBR
      );
      doorRib.position.set(-9.18, dy, 22.8);
      detailPropsGroup.add(doorRib);
    }
  };

  // Corrugated Industrial Cover Crate
  const addCrate = (
    x: number,
    z: number,
    w = 2.2,
    h = 2.0,
    d = 2.2,
    isDarkSteel = true,
    baseY = 0
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, isDarkSteel ? crateMatA_PBR : crateMatB_PBR);
    mesh.position.set(x, baseY + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isWall: true };
    root.add(mesh);
    wallMeshes.push(mesh);
    registerSwappable(
      mesh,
      isDarkSteel ? crateMatA_PBR : crateMatB_PBR,
      isDarkSteel ? crateMatA_Potato : crateMatB_Potato
    );

    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: baseY,
      maxY: baseY + h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  };

  // Cylindrical Pressure Silo Tank with Diamond Ribs, Bolted Crown & Glowing Red Reactor Pipe (Matches image.png!)
  const addReactorSilo = (x: number, z: number, radius = 2.15, height = 6.6) => {
    const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 28);
    const cyl = new THREE.Mesh(cylGeo, siloMatPBR);
    cyl.position.set(x, height / 2, z);
    cyl.rotation.y = -Math.PI * 0.42; // Orient "CS" & Flame hazard diamonds directly toward player camera!
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    cyl.userData = { isWall: true };
    root.add(cyl);
    wallMeshes.push(cyl);
    registerSwappable(cyl, siloMatPBR, wallAccentMatPotato);

    // Top dome & heavy bolted crown ring with vertical lug bolts (Matches top of silos in image.png!)
    const domeGeo = new THREE.SphereGeometry(
      radius * 0.96,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.42
    );
    const dome = new THREE.Mesh(domeGeo, darkDuctSteelMatPBR);
    dome.position.set(x, height - 0.15, z);
    detailPropsGroup.add(dome);

    const flangeGeo = new THREE.CylinderGeometry(radius * 1.07, radius * 1.07, 0.45, 20);
    const flange = new THREE.Mesh(flangeGeo, steelMatPBR);
    flange.position.set(x, height - 0.25, z);
    detailPropsGroup.add(flange);

    // Crown lug bolts around top rim
    for (let b = 0; b < 12; b++) {
      const ang = (b / 12) * Math.PI * 2;
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.65, 0.18),
        darkDuctSteelMatPBR
      );
      lug.position.set(
        x + Math.cos(ang) * (radius * 1.04),
        height - 0.2,
        z + Math.sin(ang) * (radius * 1.04)
      );
      detailPropsGroup.add(lug);
    }

    // Glowing Red/Amber Reactor Conduit Pipe connecting the silos
    const pipeGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.4, 10);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, darkDuctSteelMatPBR);
    pipe.position.set(x + radius * 0.95, 4.1, z);
    detailPropsGroup.add(pipe);

    const glowJoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.72, 10).rotateZ(Math.PI / 2),
      amberPipeGlowMat
    );
    glowJoint.position.set(x + radius * 0.95 + 0.55, 4.1, z);
    detailPropsGroup.add(glowJoint);

    colliders.push({
      minX: x - radius * 0.88,
      maxX: x + radius * 0.88,
      minY: 0,
      maxY: height,
      minZ: z - radius * 0.88,
      maxZ: z + radius * 0.88,
    });
  };

  // Slanted-Top Industrial Control Console Cabinet on Caster Wheels with Illuminated Gauges & Side Hazard Stripes (Matches image.png!)
  const addControlConsole = (x: number, z: number, rotY = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    // Main lower steel cabinet
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.58, 1.18), consoleMatPBR);
    body.position.y = 0.85;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { isWall: true };
    group.add(body);
    wallMeshes.push(body);
    registerSwappable(body, consoleMatPBR, crateMatB_Potato);

    // Side yellow/black hazard base stripe
    const sideHazard = new THREE.Mesh(new THREE.BoxGeometry(2.19, 0.38, 1.12), hazardDecalMat);
    sideHazard.position.set(0, 0.28, 0);
    group.add(sideHazard);

    // Caster wheels at bottom corners
    for (const [wx, wz] of [
      [-0.9, -0.45],
      [0.9, -0.45],
      [-0.9, 0.45],
      [0.9, 0.45],
    ]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8).rotateZ(Math.PI / 2),
        darkDuctSteelMatPBR
      );
      wheel.position.set(wx, 0.09, wz);
      group.add(wheel);
    }

    // Glowing instrument meter strip on upper console face
    const meterGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    meterGlow.position.set(0, 1.36, 0.6);
    group.add(meterGlow);

    root.add(group);

    colliders.push({
      minX: x - 1.1,
      maxX: x + 1.1,
      minY: 0,
      maxY: 1.68,
      minZ: z - 0.9,
      maxZ: z + 0.9,
    });
  };

  // Elevated Steel X-Braced Catwalk Platform + Climbable Stepped Staircase (Matches image.png left!)
  const addSteelCatwalk = (x: number, z: number, w: number, d: number, h = 2.35) => {
    // Platform deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, d), darkDuctSteelMatPBR);
    deck.position.set(x, h, z);
    deck.userData = { isWall: true };
    root.add(deck);
    wallMeshes.push(deck);
    registerSwappable(deck, darkDuctSteelMatPBR, wallAccentMatPotato);

    // Support legs & X-bracing trusses underneath
    const corners = [
      [-w / 2 + 0.18, -d / 2 + 0.18],
      [w / 2 - 0.18, -d / 2 + 0.18],
      [-w / 2 + 0.18, d / 2 - 0.18],
      [w / 2 - 0.18, d / 2 - 0.18],
      [w / 2 - 0.18, 0],
      [-w / 2 + 0.18, 0],
    ];
    corners.forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, h, 0.18),
        darkDuctSteelMatPBR
      );
      leg.position.set(x + cx, h / 2, z + cz);
      detailPropsGroup.add(leg);
    });

    // Diagonal X-brace bars on front & side bays (Matches X-braced steel structure in image.png!)
    for (const zOff of [-d * 0.25, d * 0.25]) {
      for (const rotSign of [-1, 1]) {
        const brace = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, h * 1.16, 0.09),
          steelMatPBR
        );
        brace.position.set(x + w / 2 - 0.18, h / 2, z + zOff);
        brace.rotation.x = rotSign * 0.66;
        detailPropsGroup.add(brace);
      }
    }
    // Front-facing X-brace under the stair landing
    for (const rotSign of [-1, 1]) {
      const frontBrace = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, 0.09, 0.09),
        steelMatPBR
      );
      frontBrace.position.set(x, h / 2, z + d / 2 - 0.18);
      frontBrace.rotation.z = rotSign * 0.45;
      detailPropsGroup.add(frontBrace);
    }

    // Top safety handrail bars & vertical posts (Right edge + Front edge)
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, d), steelMatPBR);
    railTop.position.set(x + w / 2 - 0.1, h + 1.08, z);
    detailPropsGroup.add(railTop);

    const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, d), steelMatPBR);
    railMid.position.set(x + w / 2 - 0.1, h + 0.56, z);
    detailPropsGroup.add(railMid);

    for (let pz = -d / 2 + 0.2; pz <= d / 2; pz += d / 3) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.12, 0.075), steelMatPBR);
      post.position.set(x + w / 2 - 0.1, h + 0.56, z + pz);
      detailPropsGroup.add(post);
    }

    // Stepped Staircase Flights + Climbable Step Colliders + Slanted Stair Handrails!
    const steps = 9;
    const stairX = x + w * 0.22;
    const stepDepth = 0.42;
    for (let s = 0; s < steps; s++) {
      const stepY = ((s + 1) / steps) * h;
      const stepZ = z + d / 2 + (steps - s) * stepDepth;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.12, stepDepth),
        steelMatPBR
      );
      stepMesh.position.set(stairX, stepY - 0.06, stepZ);
      stepMesh.userData = { isWall: true };
      root.add(stepMesh);
      wallMeshes.push(stepMesh);

      // Climbable step collider so player walks smoothly up onto the catwalk!
      colliders.push({
        minX: stairX - 0.9,
        maxX: stairX + 0.9,
        minY: 0,
        maxY: stepY,
        minZ: stepZ - stepDepth * 0.6,
        maxZ: stepZ + stepDepth * 0.6,
      });
    }

    // Yellow/Black Hazard Pad on the concrete floor right at the foot of the stairs (Matches image.png!)
    const footHazardPad = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.85),
      hazardDecalMat
    );
    footHazardPad.rotation.x = -Math.PI / 2;
    footHazardPad.position.set(stairX, 0.022, z + d / 2 + (steps + 1) * stepDepth);
    detailPropsGroup.add(footHazardPad);

    // Slanted stair stringers & twin handrails
    for (const sx of [stairX - 0.84, stairX + 0.84]) {
      const stringer = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.22, 4.35),
        darkDuctSteelMatPBR
      );
      stringer.position.set(sx, h * 0.5, z + d / 2 + 1.9);
      stringer.rotation.x = 0.52;
      detailPropsGroup.add(stringer);

      const stairRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 4.35), steelMatPBR);
      stairRail.position.set(sx, h * 0.5 + 0.95, z + d / 2 + 1.9);
      stairRail.rotation.x = 0.52;
      detailPropsGroup.add(stairRail);

      const stairRailMid = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 4.35),
        steelMatPBR
      );
      stairRailMid.position.set(sx, h * 0.5 + 0.5, z + d / 2 + 1.9);
      stairRailMid.rotation.x = 0.52;
      detailPropsGroup.add(stairRailMid);
    }

    // Main catwalk deck collider
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: h + 0.12,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  };

  // Overhead Coffered Ceiling + Heavy Cylindrical Ventilation Ducts + Truss Beams & Fluorescent Lights (Matches top of image.png!)
  const addOverheadBunkerCeiling = (
    x: number,
    z: number,
    w: number,
    d: number,
    ceilY = 7.6
  ) => {
    const roofGeo = new THREE.BoxGeometry(w, 0.6, d);
    applyBoxWorldUVs(roofGeo, w, 0.6, d, 6.0);
    const roof = new THREE.Mesh(roofGeo, ceilingMatPBR);
    roof.position.set(x, ceilY + 0.3, z);
    roof.userData = { isWall: true };
    root.add(roof);
    wallMeshes.push(roof);
    registerSwappable(roof, ceilingMatPBR, ceilingMatPotato);

    // Heavy overhead dark-steel ventilation & coolant pipes with bolted flange rings (Matches ceiling of image.png!)
    for (const [px, radius] of [
      [-w * 0.06, 0.52],
      [w * 0.24, 0.44],
      [-w * 0.28, 0.32],
    ]) {
      const pipeGeo = new THREE.CylinderGeometry(radius, radius, d, 16);
      pipeGeo.rotateX(Math.PI / 2);
      const pipe = new THREE.Mesh(pipeGeo, darkDuctSteelMatPBR);
      pipe.position.set(x + px, ceilY - 0.68, z);
      detailPropsGroup.add(pipe);

      // Bolted pipe flange collars every 4.2m
      for (let fz = -d / 2 + 2.0; fz < d / 2; fz += 4.2) {
        const ringGeo = new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, 0.26, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, steelMatPBR);
        ring.position.set(x + px, ceilY - 0.68, z + fz);
        detailPropsGroup.add(ring);
      }
    }

    // Cross steel truss beams + Fluorescent Strip Lights
    for (let tz = -d / 2 + 3.5; tz < d / 2; tz += 7.0) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.4, 0.36, 0.36),
        darkDuctSteelMatPBR
      );
      beam.position.set(x, ceilY - 0.2, z + tz);
      detailPropsGroup.add(beam);

      // Twin Fluorescent Tube Light Fixtures
      for (const lx of [-w * 0.24, w * 0.16]) {
        const lampHousing = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.14, 2.5),
          darkDuctSteelMatPBR
        );
        lampHousing.position.set(x + lx, ceilY - 0.38, z + tz);
        detailPropsGroup.add(lampHousing);

        const tube = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.08, 2.35),
          fluorescentLampMat
        );
        tube.position.set(x + lx, ceilY - 0.45, z + tz);
        detailPropsGroup.add(tube);

        // Subtle volumetric light cone under fixture
        const coneGeo = new THREE.ConeGeometry(2.6, 5.2, 12, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef9c3,
          transparent: true,
          opacity: 0.038,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(x + lx, ceilY - 3.1, z + tz);
        volumetricGroup.add(cone);
      }
    }
  };

  // 1. MAIN CONCRETE FLOOR + RECESSED STEEL DRAINAGE GRATES
  const groundGeo = new THREE.PlaneGeometry(120, 140);
  const groundMesh = new THREE.Mesh(groundGeo, floorMatPBR);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  groundMesh.userData = { isWall: true };
  root.add(groundMesh);
  wallMeshes.push(groundMesh);
  registerSwappable(groundMesh, floorMatPBR, floorMatPotato);

  // Central & Lateral Metal Floor Grate Trenches (Matches foreground of image.png!)
  const addFloorGrate = (x: number, z: number, w: number, length: number, rotY = 0) => {
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(w, length), grateMatPBR);
    grate.rotation.x = -Math.PI / 2;
    grate.rotation.z = rotY;
    grate.position.set(x, 0.025, z);
    detailPropsGroup.add(grate);
  };
  addFloorGrate(-1.1, 20, 1.55, 48, -0.08); // Main Mid Drainage Grate directly in player spawn sightline!
  addFloorGrate(24, -4, 1.5, 42, 0); // A-Long Grate
  addFloorGrate(-24, -4, 1.5, 42, 0); // B-Main Grate
  addFloorGrate(5.2, 26.8, 2.3, 3.4, 0); // Side Square Drainage Vent (right side of image.png!)

  // 2. PERIMETER BUNKER WALLS & OVERHEAD INDUSTRIAL ROOF
  const mapWidth = 90;
  const mapLength = 110;
  const wallHeight = 8.4;
  const wallThick = 4;

  addWall(0, 0, -mapLength / 2, mapWidth, wallHeight, wallThick, false);
  addWall(0, 0, mapLength / 2, mapWidth, wallHeight, wallThick, false);
  addWall(-mapWidth / 2, 0, 0, wallThick, wallHeight, mapLength, false);
  addWall(mapWidth / 2, 0, 0, wallThick, wallHeight, mapLength, false);

  if (mapId !== 'desert') {
    addOverheadBunkerCeiling(0, 20, 26, 48, 7.5);
    addOverheadBunkerCeiling(0, -24, 32, 34, 7.5);
  }
  addOverheadBunkerCeiling(26, 4, 16, 36, 7.5);
  addOverheadBunkerCeiling(-26, 4, 16, 36, 7.5);

  // 3. FOREGROUND BUNKER HALLWAY (Directly visible from Attacker Spawn at x=-0.4, z=31.2 — Matches image.png!)
  addWall(-10.2, 0, 24, 2.0, 8.0, 24, false);
  addLeftBunkerRibbedWallDetail();
  addSteelCatwalk(-6.4, 21.5, 4.6, 7.2, 2.35);

  // Left & Right Illuminated Industrial Control Consoles (Matches image.png foreground left & right!)
  addControlConsole(-6.2, 28.4, 0.52);
  addControlConsole(3.9, 23.6, -0.22);

  // Twin Cylindrical Pressure Silos & Concrete Support Pillars in Mid Reactor Hall (Matches image.png right-center!)
  addReactorSilo(1.6, 16.2, 2.15, 6.6);
  addReactorSilo(7.3, 16.8, 2.15, 6.6);
  addSupportPillar(4.5, 19.4, 7.8);
  addSupportPillar(-2.1, 15.8, 7.8);

  // Recessed Red Reactor Warning Beacon + Vertical Conduit Pipes between the Twin Silos (Matches glowing red beacon in image.png!)
  const redBackWall = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 6.8, 0.5),
    wallAccentMatPBR
  );
  redBackWall.position.set(4.5, 3.4, 13.5);
  detailPropsGroup.add(redBackWall);

  for (const rpx of [3.2, 3.8, 5.2, 5.8]) {
    const vPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 6.5, 8),
      darkDuctSteelMatPBR
    );
    vPipe.position.set(rpx, 3.25, 13.85);
    detailPropsGroup.add(vPipe);
  }

  const redLampHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.62, 0.28),
    darkDuctSteelMatPBR
  );
  redLampHousing.position.set(4.5, 4.65, 13.9);
  detailPropsGroup.add(redLampHousing);

  const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.32), redBeaconMat);
  redLamp.position.set(4.5, 4.65, 13.95);
  detailPropsGroup.add(redLamp);

  const redPointLight = new THREE.PointLight(0xff331f, 9.5, 20);
  redPointLight.position.set(4.5, 4.65, 15.2);
  root.add(redPointLight);
  pointLights.push(redPointLight);

  const warmFluorescentLight = new THREE.PointLight(0xfffbeb, 7.5, 28);
  warmFluorescentLight.position.set(-2.0, 6.9, 25.5);
  root.add(warmFluorescentLight);
  pointLights.push(warmFluorescentLight);

  const foregroundFillLight = new THREE.PointLight(0xffedd5, 4.8, 22);
  foregroundFillLight.position.set(1.5, 5.5, 29.0);
  root.add(foregroundFillLight);
  pointLights.push(foregroundFillLight);

  // Corrugated Metal & Hardwood Supply Crates near the Silos (with ballistic fabric tarp cover)
  addCrate(1.3, 19.6, 1.55, 1.32, 1.55, true);
  addCrate(7.5, 23.2, 2.05, 1.42, 1.85, false);
  const tarpCover = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 0.14, 1.92),
    fabricTarpMatPBR
  );
  tarpCover.position.set(7.5, 1.48, 23.2);
  detailPropsGroup.add(tarpCover);

  // Map-Specific Landmark Props for 'research' (Cryo Lab) and 'desert' (Outpost Fortress)
  if (mapId === 'research') {
    for (const [cx, cz] of [
      [-5, 6],
      [5, 6],
      [24, -18],
      [-24, -18],
    ]) {
      const cryoTube = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 4.4, 16),
        cyanCryoMat
      );
      cryoTube.position.set(cx, 2.2, cz);
      detailPropsGroup.add(cryoTube);
    }
  } else if (mapId === 'desert') {
    // Sandstone Courtyard Archways
    addWall(0, 4.8, 8, 12, 2.4, 2.2, true);
    addWall(24, 4.8, -10, 10, 2.2, 2.2, true);
    addWall(-24, 4.8, -10, 10, 2.2, 2.2, true);
  }

  // 4. SITE A ARCHITECTURE (East Wing Reactor Sector)
  const siteAGeo = new THREE.PlaneGeometry(14, 14);
  const siteAMat = new THREE.MeshBasicMaterial({
    map: createPlantZoneTexture('A'),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const siteAMesh = new THREE.Mesh(siteAGeo, siteAMat);
  siteAMesh.rotation.x = -Math.PI / 2;
  siteAMesh.position.set(24, 0.03, -22);
  root.add(siteAMesh);

  addWall(34, 0, -32, 12, 4.2, 8, true);
  addWall(24, 0, -36, 16, 6.5, 2, false);
  addWall(38, 0, -20, 2, 6.5, 16, false);
  addReactorSilo(24, -22, 2.3, 6.6);
  addSteelCatwalk(31, -26, 6, 6, 2.35);
  addCrate(20, -18.5, 2.4, 2.1, 2.4, true);
  addCrate(20, -15.8, 2.2, 1.3, 2.2, false);
  addCrate(28, -25, 2.8, 2.3, 2.0, false);
  addControlConsole(17, -25, 0.5);

  const siteALight = new THREE.PointLight(0x38bdf8, 5.5, 26);
  siteALight.position.set(24, 6.5, -22);
  root.add(siteALight);
  pointLights.push(siteALight);

  // A Long Corridor Walls
  addWall(32, 0, 4, 2, 8.2, 30, true);
  addWall(18, 0, 6, 2, 8.2, 22, false);

  // 5. SITE B ARCHITECTURE (West Wing Foundry Sector)
  const siteBGeo = new THREE.PlaneGeometry(14, 14);
  const siteBMat = new THREE.MeshBasicMaterial({
    map: createPlantZoneTexture('B'),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const siteBMesh = new THREE.Mesh(siteBGeo, siteBMat);
  siteBMesh.rotation.x = -Math.PI / 2;
  siteBMesh.position.set(-24, 0.03, -22);
  root.add(siteBMesh);

  addReactorSilo(-24, -22, 2.3, 6.6);
  addSteelCatwalk(-32, -28, 8, 6, 2.35);
  addCrate(-18, -18, 2.5, 2.3, 2.5, false);
  addCrate(-18, -15.3, 2.3, 1.3, 2.3, true);
  addCrate(-28, -25, 2.4, 2.1, 2.4, true);
  addControlConsole(-16, -25, -0.4);

  const siteBLight = new THREE.PointLight(0xf59e0b, 5.5, 26);
  siteBLight.position.set(-24, 6.5, -22);
  root.add(siteBLight);
  pointLights.push(siteBLight);

  // B Main Corridor Walls
  addWall(-32, 0, 4, 2, 8.2, 30, true);
  addWall(-18, 0, 6, 2, 8.2, 22, false);

  // 6. MID REACTOR CONNECTOR & DEFENDER HALL
  addWall(0, 0, -6, 4.2, 8.2, 4.2, true);
  addWall(-11, 0, -4, 2, 8.2, 18, false);
  addWall(11, 0, -4, 2, 8.2, 18, false);
  addWall(10, 0, -18, 9, 8.2, 2, false);
  addWall(-10, 0, -18, 9, 8.2, 2, false);

  addCrate(-4.5, 3, 2.0, 1.35, 2.0, false);
  addCrate(5, -12, 2.2, 2.1, 2.2, true);

  // 7. SPAWN BLAST WALLS
  addWall(-12, 0, 30, 2, 8.2, 10, true);
  addWall(12, 0, 30, 2, 8.2, 10, true);
  addWall(-12, 0, -42, 2, 8.2, 10, true);
  addWall(12, 0, -42, 2, 8.2, 10, true);

  // 8. BUY-PHASE ENERGY BARRIERS
  const barrierMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const createBarrier = (x: number, z: number, w: number, h: number) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, barrierMat);
    mesh.position.set(x, h / 2, z);
    root.add(mesh);
    barrierMeshes.push(mesh);

    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: h,
      minZ: z - 0.4,
      maxZ: z + 0.4,
      isBarrier: true,
    });
  };

  createBarrier(0, 12, 22, 6);
  createBarrier(25, 12, 14, 6);
  createBarrier(-25, 12, 14, 6);

  const plantZones: PlantSiteZone[] = [
    {
      site: 'A',
      minX: 17,
      maxX: 31,
      minZ: -29,
      maxZ: -15,
      center: new THREE.Vector3(24, 0, -22),
    },
    {
      site: 'B',
      minX: -31,
      maxX: -17,
      minZ: -29,
      maxZ: -15,
      center: new THREE.Vector3(-24, 0, -22),
    },
  ];

  const setPotatoMode = (enabled: boolean) => {
    detailPropsGroup.visible = !enabled;
    volumetricGroup.visible = !enabled;
    pointLights.forEach((pl) => (pl.visible = !enabled));
    for (let i = 0; i < swappableMeshes.length; i++) {
      const item = swappableMeshes[i];
      item.mesh.material = enabled ? item.potato : item.pbr;
    }
  };

  const applyGraphicsSettings = (settings: GameSettings) => {
    const isPotato =
      settings.potatoMode ||
      settings.quality === 'potato' ||
      settings.textureQuality === 'potato';

    // Keep full PBR materials & detail props active across Low, Medium, High, Ultra & Extreme!
    detailPropsGroup.visible = !isPotato && settings.environmentalDetail;
    volumetricGroup.visible = !isPotato && settings.volumetricLighting;

    pointLights.forEach((pl) => {
      pl.visible = !isPotato;
    });

    for (let i = 0; i < swappableMeshes.length; i++) {
      const item = swappableMeshes[i];
      item.mesh.material = isPotato ? item.potato : item.pbr;
    }
  };

  return {
    mapId,
    scene: root,
    detailPropsGroup,
    volumetricGroup,
    pointLights,
    colliders,
    wallMeshes,
    plantZones,
    spawnAttacker: new THREE.Vector3(-0.4, 1.7, 31.2),
    spawnDefender: new THREE.Vector3(0, 1.7, -44),
    barrierMeshes,
    setPotatoMode,
    applyGraphicsSettings,
  };
}
