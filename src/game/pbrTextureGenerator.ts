import * as THREE from 'three';
import { MapId } from '../types/game';

export type PBRDiskMaterialCategory =
  | 'concrete'
  | 'painted_concrete'
  | 'metal'
  | 'brushed_metal'
  | 'silo_diamond'
  | 'asphalt'
  | 'floor_tiles'
  | 'wood'
  | 'glass'
  | 'fabric'
  | 'painted_walls';

export interface PBRMaterialMaps {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
  metallic?: THREE.Texture;
  ao?: THREE.Texture;
}

const sharedTextureLoader = new THREE.TextureLoader();
const diskTextureCache = new Map<string, PBRMaterialMaps>();

/**
 * Loads real physical .png PBR texture sets from /assets/textures/<category>_*.png
 * with RepeatWrapping, mipmapping, and anisotropy.
 */
export function loadDiskPBRTextureSet(
  category: PBRDiskMaterialCategory,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 8
): PBRMaterialMaps {
  const cacheKey = `${category}_${repeatX}_${repeatY}`;
  const cached = diskTextureCache.get(cacheKey);
  if (cached) return cached;

  const configTex = (path: string, isSRGB: boolean) => {
    const tex = sharedTextureLoader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  };

  const maps: PBRMaterialMaps = {
    albedo: configTex(`/assets/textures/${category}_albedo.png`, true),
    normal: configTex(`/assets/textures/${category}_normal.png`, false),
    roughness: configTex(`/assets/textures/${category}_roughness.png`, false),
    metallic: configTex(`/assets/textures/${category}_metallic.png`, false),
    ao: configTex(`/assets/textures/${category}_ao.png`, false),
  };

  diskTextureCache.set(cacheKey, maps);
  return maps;
}


/**
 * Converts a grayscale height canvas into a tangent-space normal map (RGB = Nx, Ny, Nz).
 */
function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength = 2.6,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return srcData[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = sample(x - 1, y);
      const right = sample(x + 1, y);
      const up = sample(x, y - 1);
      const down = sample(x, y + 1);

      const dx = (left - right) * strength;
      const dy = (up - down) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.floor((dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.floor((dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.floor((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  const normalTex = new THREE.CanvasTexture(outCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(repeatX, repeatY);
  normalTex.colorSpace = THREE.NoColorSpace;
  return normalTex;
}

/**
 * Generates high-detail PBR Albedo, Normal, and Roughness maps for the Industrial Concrete Floor.
 */
export function createFloorPBRMaps(mapId: MapId, maxAnisotropy = 8): PBRMaterialMaps {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base fill
  aCtx.fillStyle =
    mapId === 'industrial' ? '#706052' : mapId === 'research' ? '#334155' : '#b28d63';
  aCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#888888';
  hCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = mapId === 'research' ? '#686868' : '#b0b0b0';
  rCtx.fillRect(0, 0, size, size);

  const slabSize = 128;
  for (let x = 0; x < size; x += slabSize) {
    for (let y = 0; y < size; y += slabSize) {
      const tone = Math.floor(Math.random() * 14) - 7;
      if (mapId === 'industrial') {
        aCtx.fillStyle = `rgb(${116 + tone}, ${100 + tone}, ${86 + tone})`;
      } else if (mapId === 'research') {
        aCtx.fillStyle = `rgb(${62 + tone}, ${76 + tone}, ${96 + tone})`;
      } else {
        aCtx.fillStyle = `rgb(${178 + tone}, ${142 + tone}, ${102 + tone})`;
      }
      aCtx.fillRect(x + 3, y + 3, slabSize - 6, slabSize - 6);

      // Slab height bevel
      hCtx.fillStyle = '#9a9a9a';
      hCtx.fillRect(x + 4, y + 4, slabSize - 8, slabSize - 8);
    }
  }

  // Fine aggregate concrete speckle & oil/damp roughness variation
  for (let i = 0; i < 3200; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const s = 1 + Math.random() * 3;
    const dark = Math.random() > 0.48;
    aCtx.fillStyle = dark ? 'rgba(28, 22, 18, 0.14)' : 'rgba(215, 198, 180, 0.1)';
    aCtx.fillRect(px, py, s, s);

    hCtx.fillStyle = dark ? '#707070' : '#a8a8a8';
    hCtx.fillRect(px, py, s, s);
  }

  // Damp/oily reflective patches (lower roughness = shinier specular reflection)
  for (let i = 0; i < 24; i++) {
    const ox = Math.random() * size;
    const oy = Math.random() * size;
    const rad = 18 + Math.random() * 42;
    const grad = rCtx.createRadialGradient(ox, oy, 2, ox, oy, rad);
    grad.addColorStop(0, 'rgba(55, 55, 55, 0.75)');
    grad.addColorStop(1, 'rgba(175, 175, 175, 0)');
    rCtx.fillStyle = grad;
    rCtx.beginPath();
    rCtx.arc(ox, oy, rad, 0, Math.PI * 2);
    rCtx.fill();

    aCtx.fillStyle = 'rgba(24, 20, 16, 0.12)';
    aCtx.beginPath();
    aCtx.arc(ox, oy, rad * 0.85, 0, Math.PI * 2);
    aCtx.fill();
  }

  // Deep expansion joint seams
  aCtx.strokeStyle = 'rgba(18, 15, 12, 0.75)';
  aCtx.lineWidth = 4;
  hCtx.strokeStyle = '#222222';
  hCtx.lineWidth = 5;
  rCtx.strokeStyle = '#f0f0f0';
  rCtx.lineWidth = 4;

  for (let i = 0; i <= size; i += slabSize) {
    for (const ctx of [aCtx, hCtx, rCtx]) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  }

  const rx = 20;
  const ry = 24;

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(rx, ry);
  albedo.anisotropy = maxAnisotropy;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(rx, ry);
  roughness.anisotropy = maxAnisotropy;
  roughness.colorSpace = THREE.NoColorSpace;

  const normal = heightCanvasToNormalTexture(heightCanvas, 3.2, rx, ry);
  normal.anisotropy = maxAnisotropy;

  return { albedo, normal, roughness };
}

/**
 * Generates Ribbed Concrete Bunker Wall Albedo & Normal Maps.
 */
export function createWallPBRMaps(
  mapId: MapId,
  isAccent: boolean,
  maxAnisotropy = 8
): PBRMaterialMaps {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const mainBg =
    mapId === 'industrial'
      ? isAccent
        ? '#4e4842'
        : '#655b51'
      : mapId === 'research'
      ? isAccent
        ? '#1e293b'
        : '#475569'
      : isAccent
      ? '#7c5836'
      : '#ba9670';

  aCtx.fillStyle = mainBg;
  aCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#b8b8b8';
  rCtx.fillRect(0, 0, size, size);

  // Horizontal concrete form ribs & deeply recessed shadow channels (Matches left wall in image.png)
  for (let y = 0; y < 440; y += 88) {
    // Top bevel highlight
    aCtx.fillStyle = 'rgba(255, 248, 235, 0.12)';
    aCtx.fillRect(0, y, size, 8);
    // Deep recessed groove
    aCtx.fillStyle = 'rgba(12, 10, 9, 0.45)';
    aCtx.fillRect(0, y + 66, size, 18);

    hCtx.fillStyle = '#b5b5b5';
    hCtx.fillRect(0, y + 6, size, 58);
    hCtx.fillStyle = '#303030';
    hCtx.fillRect(0, y + 66, size, 18);
  }

  // Vertical concrete form seams & tie-rod bolt holes
  aCtx.strokeStyle = 'rgba(15, 13, 11, 0.35)';
  aCtx.lineWidth = 3;
  hCtx.strokeStyle = '#404040';
  hCtx.lineWidth = 4;
  for (let x = 128; x < size; x += 128) {
    aCtx.beginPath();
    aCtx.moveTo(x, 0);
    aCtx.lineTo(x, 444);
    aCtx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(x, 0);
    hCtx.lineTo(x, 444);
    hCtx.stroke();

    // Tie-rod form bolts
    for (let by = 40; by < 420; by += 88) {
      aCtx.fillStyle = '#272421';
      aCtx.beginPath();
      aCtx.arc(x - 24, by, 5, 0, Math.PI * 2);
      aCtx.arc(x + 24, by, 5, 0, Math.PI * 2);
      aCtx.fill();

      hCtx.fillStyle = '#202020';
      hCtx.beginPath();
      hCtx.arc(x - 24, by, 5, 0, Math.PI * 2);
      hCtx.arc(x + 24, by, 5, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  // Surface grit & vertical water leak streaks
  for (let i = 0; i < 900; i++) {
    const wx = Math.random() * size;
    const wy = Math.random() * 440;
    aCtx.fillStyle =
      Math.random() > 0.5 ? 'rgba(24, 20, 16, 0.12)' : 'rgba(210, 195, 178, 0.07)';
    aCtx.fillRect(wx, wy, 2 + Math.random() * 3, 8 + Math.random() * 18);
  }

  // Stenciled industrial sector markings (Matches yellow stencils on upper wall in image.png)
  aCtx.fillStyle = 'rgba(234, 179, 8, 0.55)';
  aCtx.font = 'bold 26px monospace';
  aCtx.fillText('04-B // SEC', 26, 48);

  // Bottom yellow/black diagonal hazard safety stripe baseboard (Matches image.png!)
  aCtx.fillStyle = '#18181b';
  aCtx.fillRect(0, 446, size, 66);
  hCtx.fillStyle = '#9e9e9e';
  hCtx.fillRect(0, 446, size, 66);
  rCtx.fillStyle = '#707070';
  rCtx.fillRect(0, 446, size, 66);

  aCtx.fillStyle = '#e58e09';
  for (let sx = -64; sx < size + 64; sx += 48) {
    aCtx.beginPath();
    aCtx.moveTo(sx, size);
    aCtx.lineTo(sx + 24, size);
    aCtx.lineTo(sx + 56, 452);
    aCtx.lineTo(sx + 32, 452);
    aCtx.closePath();
    aCtx.fill();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = maxAnisotropy;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = maxAnisotropy;
  roughness.colorSpace = THREE.NoColorSpace;

  const normal = heightCanvasToNormalTexture(heightCanvas, 3.4, 1, 1);
  normal.anisotropy = maxAnisotropy;

  return { albedo, normal, roughness };
}

/**
 * Generates a Coffered Concrete & Riveted Steel Ceiling Deck texture (Matches upper ceiling of image.png!).
 */
export function createCofferedCeilingPBRMaps(maxAnisotropy = 8): PBRMaterialMaps {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Structural steel grid ribs
  aCtx.fillStyle = '#3a3632';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#d0d0d0';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#757575';
  rCtx.fillRect(0, 0, size, size);

  // Recessed square coffer bays
  const bay = 128;
  for (let x = 0; x < size; x += bay) {
    for (let y = 0; y < size; y += bay) {
      aCtx.fillStyle = '#252320';
      aCtx.fillRect(x + 14, y + 14, bay - 28, bay - 28);

      aCtx.strokeStyle = '#524c46';
      aCtx.lineWidth = 3;
      aCtx.strokeRect(x + 14, y + 14, bay - 28, bay - 28);

      hCtx.fillStyle = '#454545';
      hCtx.fillRect(x + 14, y + 14, bay - 28, bay - 28);

      rCtx.fillStyle = '#b5b5b5';
      rCtx.fillRect(x + 14, y + 14, bay - 28, bay - 28);
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(8, 12);
  albedo.anisotropy = maxAnisotropy;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(8, 12);
  roughness.colorSpace = THREE.NoColorSpace;

  const normal = heightCanvasToNormalTexture(heightCanvas, 3.8, 8, 12);
  normal.anisotropy = maxAnisotropy;

  return { albedo, normal, roughness };
}

/**
 * Generates Diamond-Lattice Cylindrical Pressure Silo Albedo & Normal Maps with "CS" & Flame Hazard Diamonds (Matches image.png!).
 */
export function createSiloPBRMaps(maxAnisotropy = 8): PBRMaterialMaps {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Brushed gunmetal steel cylinder base
  const grad = aCtx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#4a4744');
  grad.addColorStop(0.28, '#78736d');
  grad.addColorStop(0.5, '#a8a29b');
  grad.addColorStop(0.72, '#78736d');
  grad.addColorStop(1, '#4a4744');
  aCtx.fillStyle = grad;
  aCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#606060';
  hCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#686868';
  rCtx.fillRect(0, 0, size, size);

  // Horizontal weld bands top & bottom
  for (const wy of [28, 480]) {
    aCtx.fillStyle = '#383532';
    aCtx.fillRect(0, wy, size, 16);
    hCtx.fillStyle = '#c8c8c8';
    hCtx.fillRect(0, wy, size, 16);
  }

  // Raised diamond lattice reinforcement ribs (Matches twin silos in image.png!)
  const step = 52;
  for (let i = -size; i < size * 2; i += step) {
    // Dark shadow side
    aCtx.strokeStyle = 'rgba(20, 18, 16, 0.72)';
    aCtx.lineWidth = 7;
    aCtx.beginPath();
    aCtx.moveTo(i, 0);
    aCtx.lineTo(i + size, size);
    aCtx.stroke();
    aCtx.beginPath();
    aCtx.moveTo(i + size, 0);
    aCtx.lineTo(i, size);
    aCtx.stroke();

    // Specular metallic rib crest
    aCtx.strokeStyle = 'rgba(235, 230, 222, 0.42)';
    aCtx.lineWidth = 2.5;
    aCtx.beginPath();
    aCtx.moveTo(i + 2, 0);
    aCtx.lineTo(i + size + 2, size);
    aCtx.stroke();
    aCtx.beginPath();
    aCtx.moveTo(i + size - 2, 0);
    aCtx.lineTo(i - 2, size);
    aCtx.stroke();

    // Normal map raised rib height
    hCtx.strokeStyle = '#ffffff';
    hCtx.lineWidth = 6;
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + size, size);
    hCtx.stroke();
    hCtx.beginPath();
    hCtx.moveTo(i + size, 0);
    hCtx.lineTo(i, size);
    hCtx.stroke();
  }

  // Draw the two stacked Orange Hazard Diamonds ("!" Flame + "CS") on front & side
  const drawHazardDiamond = (cx: number, cy: number, label: string) => {
    aCtx.fillStyle = '#e58e09';
    aCtx.beginPath();
    aCtx.moveTo(cx, cy - 36);
    aCtx.lineTo(cx + 36, cy);
    aCtx.lineTo(cx, cy + 36);
    aCtx.lineTo(cx - 36, cy);
    aCtx.closePath();
    aCtx.fill();

    aCtx.strokeStyle = '#18181b';
    aCtx.lineWidth = 4;
    aCtx.stroke();

    aCtx.fillStyle = '#18181b';
    aCtx.font = 'bold 23px sans-serif';
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.fillText(label, cx, cy + 1);
  };

  for (const cx of [140, 256, 372]) {
    drawHazardDiamond(cx, 195, '▲');
    drawHazardDiamond(cx, 295, 'CS');
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.anisotropy = maxAnisotropy;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.colorSpace = THREE.NoColorSpace;

  const normal = heightCanvasToNormalTexture(heightCanvas, 3.6, 1, 1);
  normal.anisotropy = maxAnisotropy;

  return { albedo, normal, roughness };
}
