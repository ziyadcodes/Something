import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const TEX_DIR = path.join(ROOT, 'public', 'assets', 'textures');
const AUDIO_DIR = path.join(ROOT, 'public', 'assets', 'audio');
const MODEL_DIR = path.join(ROOT, 'public', 'assets', 'models');

fs.mkdirSync(TEX_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(MODEL_DIR, { recursive: true });

// --- CRC32 & Minimal PNG Encoder (True 32-bit RGBA PNG files on disk) ---
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type 0
    const srcOffset = y * width * 4;
    rgba.copy(raw, y * stride + 1, srcOffset, srcOffset + width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Deterministic Seamless 2D Tileable Noise ---
function hash2(x, y, seed = 1337) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;

  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(u, v, octaves = 4, basePeriod = 8, seed = 101) {
  let val = 0;
  let amp = 0.5;
  let freq = basePeriod;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(u * freq, v * freq, freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / norm;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// Sobel Tangent-Space Normal Map from Height Array (Float32Array)
function buildNormalPNG(width, height, heightField, strength = 3.2) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ym = (y - 1 + height) % height;
    const yp = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;

      const tl = heightField[ym * width + xm];
      const tc = heightField[ym * width + x];
      const tr = heightField[ym * width + xp];
      const ml = heightField[y * width + xm];
      const mr = heightField[y * width + xp];
      const bl = heightField[yp * width + xm];
      const bc = heightField[yp * width + x];
      const br = heightField[yp * width + xp];

      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1;

      const idx = (y * width + x) * 4;
      rgba[idx] = clampByte(((-dx / len) * 0.5 + 0.5) * 255);
      rgba[idx + 1] = clampByte(((-dy / len) * 0.5 + 0.5) * 255);
      rgba[idx + 2] = clampByte(((dz / len) * 0.5 + 0.5) * 255);
      rgba[idx + 3] = 255;
    }
  }
  return encodePNG(width, height, rgba);
}

function buildGrayscalePNG(width, height, values) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const b = clampByte(values[i] * 255);
    rgba[i * 4] = b;
    rgba[i * 4 + 1] = b;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodePNG(width, height, rgba);
}

const SIZE = 256;

function generateMaterialMaps(name, generatorFn) {
  const albedo = Buffer.alloc(SIZE * SIZE * 4);
  const heightField = new Float32Array(SIZE * SIZE);
  const roughnessField = new Float32Array(SIZE * SIZE);
  const metallicField = new Float32Array(SIZE * SIZE);
  const aoField = new Float32Array(SIZE * SIZE);

  for (let y = 0; y < SIZE; y++) {
    const v = y / SIZE;
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const idx = y * SIZE + x;
      const p = generatorFn(u, v, x, y);
      albedo[idx * 4] = clampByte(p.r);
      albedo[idx * 4 + 1] = clampByte(p.g);
      albedo[idx * 4 + 2] = clampByte(p.b);
      albedo[idx * 4 + 3] = p.a !== undefined ? clampByte(p.a) : 255;
      heightField[idx] = p.h;
      roughnessField[idx] = p.rough;
      metallicField[idx] = p.metal ?? 0.05;
      aoField[idx] = p.ao ?? 1.0;
    }
  }

  const files = [];
  const albedoFile = `${name}_albedo.png`;
  fs.writeFileSync(path.join(TEX_DIR, albedoFile), encodePNG(SIZE, SIZE, albedo));
  files.push(albedoFile);

  const normalFile = `${name}_normal.png`;
  fs.writeFileSync(
    path.join(TEX_DIR, normalFile),
    buildNormalPNG(SIZE, SIZE, heightField, 3.8)
  );
  files.push(normalFile);

  const roughFile = `${name}_roughness.png`;
  fs.writeFileSync(
    path.join(TEX_DIR, roughFile),
    buildGrayscalePNG(SIZE, SIZE, roughnessField)
  );
  files.push(roughFile);

  const metalFile = `${name}_metallic.png`;
  fs.writeFileSync(
    path.join(TEX_DIR, metalFile),
    buildGrayscalePNG(SIZE, SIZE, metallicField)
  );
  files.push(metalFile);

  const aoFile = `${name}_ao.png`;
  fs.writeFileSync(path.join(TEX_DIR, aoFile), buildGrayscalePNG(SIZE, SIZE, aoField));
  files.push(aoFile);

  return files;
}

// 1. Concrete (Poured industrial floor slabs with expansion joints & oil weathering)
generateMaterialMaps('concrete', (u, v, x, y) => {
  const n1 = fbm(u, v, 5, 8, 11);
  const n2 = fbm(u, v, 4, 24, 37);
  const jointX = Math.min(x % 128, 128 - (x % 128));
  const jointY = Math.min(y % 128, 128 - (y % 128));
  const isJoint = jointX < 2 || jointY < 2;
  const oil = Math.max(0, fbm(u, v, 3, 4, 99) - 0.62) * 2.2;
  const base = 132 + (n1 - 0.5) * 38 + (n2 - 0.5) * 18 - oil * 48 - (isJoint ? 45 : 0);
  return {
    r: base * 1.03,
    g: base * 0.96,
    b: base * 0.86,
    h: isJoint ? 0.12 : 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2,
    rough: isJoint ? 0.95 : Math.min(0.95, Math.max(0.45, 0.82 - oil * 0.3 + (n1 - 0.5) * 0.15)),
    metal: 0.04,
    ao: isJoint ? 0.42 : 0.88 + (n1 - 0.5) * 0.12,
  };
});

// 2. Painted Concrete (Bunker formwork concrete with hazard dado band & tie-rod dimples)
generateMaterialMaps('painted_concrete', (u, v, x, y) => {
  const n1 = fbm(u, v, 5, 8, 205);
  const seamY = Math.min(y % 64, 64 - (y % 64)) < 2;
  const seamX = Math.min(x % 128, 128 - (x % 128)) < 2;
  const holeX = (x % 64) - 32;
  const holeY = (y % 64) - 32;
  const tieHole = Math.hypot(holeX, holeY) < 4.2;
  const base = 122 + (n1 - 0.5) * 32 - (seamY || seamX ? 34 : 0) - (tieHole ? 52 : 0);
  return {
    r: base * 1.02,
    g: base * 0.96,
    b: base * 0.87,
    h: tieHole ? 0.08 : seamY || seamX ? 0.22 : 0.55 + (n1 - 0.5) * 0.28,
    rough: 0.78 + (n1 - 0.5) * 0.14,
    metal: 0.05,
    ao: tieHole ? 0.35 : seamY || seamX ? 0.55 : 0.92,
  };
});

// 3. Metal (Heavy industrial structural steel with riveted seams)
generateMaterialMaps('metal', (u, v, x, y) => {
  const n1 = fbm(u, v, 4, 12, 311);
  const border = x < 3 || y < 3 || x > SIZE - 4 || y > SIZE - 4;
  const rivet =
    (Math.hypot((x % 32) - 8, y - 8) < 2.8 || Math.hypot(x - 8, (y % 32) - 8) < 2.8);
  const val = 72 + (n1 - 0.5) * 24 - (border ? 22 : 0) + (rivet ? 26 : 0);
  return {
    r: val * 0.96,
    g: val * 1.0,
    b: val * 1.06,
    h: rivet ? 0.88 : border ? 0.22 : 0.5 + (n1 - 0.5) * 0.16,
    rough: 0.34 + (n1 - 0.5) * 0.12,
    metal: 0.85,
    ao: border ? 0.55 : 0.94,
  };
});

// 4. Brushed Metal (Anisotropic brushed gunmetal steel)
generateMaterialMaps('brushed_metal', (u, v) => {
  const streak = fbm(u * 2, v * 32, 4, 8, 409);
  const fine = fbm(u * 16, v * 64, 3, 16, 419);
  const val = 92 + (streak - 0.5) * 34 + (fine - 0.5) * 16;
  return {
    r: val * 0.98,
    g: val * 1.0,
    b: val * 1.04,
    h: 0.5 + (streak - 0.5) * 0.22 + (fine - 0.5) * 0.12,
    rough: 0.26 + (streak - 0.5) * 0.1,
    metal: 0.9,
    ao: 0.95,
  };
});

// 5. Silo Diamond Steel (Embossed diamond-lattice steel with "CS" hazard diamonds)
generateMaterialMaps('silo_diamond', (u, v, x, y) => {
  const period = 32;
  const d1 = Math.abs(((x + y) % period) - period / 2);
  const d2 = Math.abs(((x - y + 512) % period) - period / 2);
  const isRib = d1 < 2.4 || d2 < 2.4;
  const n1 = fbm(u, v, 4, 12, 521);
  const base = 104 + (n1 - 0.5) * 24 + (isRib ? 32 : -10);
  return {
    r: base * 1.02,
    g: base * 0.98,
    b: base * 0.9,
    h: isRib ? 0.86 : 0.38 + (n1 - 0.5) * 0.15,
    rough: isRib ? 0.25 : 0.42 + (n1 - 0.5) * 0.1,
    metal: 0.86,
    ao: isRib ? 0.98 : 0.78,
  };
});

// 6. Asphalt (Tactical tarmac ground with mineral aggregate)
generateMaterialMaps('asphalt', (u, v) => {
  const coarse = fbm(u, v, 5, 16, 613);
  const pebble = hash2(Math.floor(u * 128), Math.floor(v * 128), 617);
  const val = 48 + (coarse - 0.5) * 22 + (pebble - 0.5) * 28;
  return {
    r: val,
    g: val * 1.01,
    b: val * 1.04,
    h: 0.35 + (coarse - 0.5) * 0.35 + (pebble - 0.5) * 0.35,
    rough: 0.88 + (pebble - 0.5) * 0.08,
    metal: 0.03,
    ao: 0.75 + pebble * 0.22,
  };
});

// 7. Floor Tiles (Ceramic / Research lab modular floor tiles with recessed grout)
generateMaterialMaps('floor_tiles', (u, v, x, y) => {
  const gx = Math.min(x % 64, 64 - (x % 64));
  const gy = Math.min(y % 64, 64 - (y % 64));
  const isGrout = gx < 2 || gy < 2;
  const n1 = fbm(u, v, 4, 12, 701);
  const val = isGrout ? 68 : 164 + (n1 - 0.5) * 22;
  return {
    r: val * 0.96,
    g: val * 1.0,
    b: val * 1.04,
    h: isGrout ? 0.12 : 0.72 + (n1 - 0.5) * 0.08,
    rough: isGrout ? 0.92 : 0.28 + (n1 - 0.5) * 0.08,
    metal: 0.08,
    ao: isGrout ? 0.42 : 0.96,
  };
});

// 8. Wood (Heavy military supply crate hardwood planks & grain)
generateMaterialMaps('wood', (u, v, x, y) => {
  const grain = fbm(u * 24, v * 3, 4, 8, 809);
  const ring = Math.sin((u * 18 + grain * 2.5) * Math.PI);
  const plankSeam = Math.min(x % 64, 64 - (x % 64)) < 2;
  const base = plankSeam ? 42 : 108 + ring * 18 + (grain - 0.5) * 24;
  return {
    r: base * 1.18,
    g: base * 0.82,
    b: base * 0.54,
    h: plankSeam ? 0.14 : 0.55 + ring * 0.12 + (grain - 0.5) * 0.15,
    rough: 0.68 + (grain - 0.5) * 0.14,
    metal: 0.02,
    ao: plankSeam ? 0.45 : 0.92,
  };
});

// 9. Glass (Tempered observation viewport glass with subtle frosted grid)
generateMaterialMaps('glass', (u, v, x, y) => {
  const edge = x < 4 || y < 4 || x > SIZE - 5 || y > SIZE - 5;
  const n1 = fbm(u, v, 3, 8, 907);
  return {
    r: edge ? 70 : 155,
    g: edge ? 95 : 215,
    b: edge ? 110 : 235,
    h: edge ? 0.85 : 0.5 + (n1 - 0.5) * 0.04,
    rough: edge ? 0.55 : 0.08,
    metal: 0.15,
    ao: 0.98,
  };
});

// 10. Fabric (Ballistic nylon / tactical canvas tarp weave)
generateMaterialMaps('fabric', (u, v, x, y) => {
  const weaveX = (x % 4) < 2 ? 1 : -1;
  const weaveY = (y % 4) < 2 ? 1 : -1;
  const weave = ((x + y) % 4 < 2 ? weaveX : weaveY) * 9;
  const n1 = fbm(u, v, 4, 8, 1009);
  const base = 78 + weave + (n1 - 0.5) * 18;
  return {
    r: base * 0.92,
    g: base * 1.02,
    b: base * 0.88,
    h: 0.5 + weave * 0.025 + (n1 - 0.5) * 0.1,
    rough: 0.88,
    metal: 0.01,
    ao: 0.86 + (weave > 0 ? 0.08 : -0.08),
  };
});

// 11. Painted Walls (Interior tactical facility painted plaster & trim)
generateMaterialMaps('painted_walls', (u, v, x, y) => {
  const n1 = fbm(u, v, 5, 12, 1103);
  const stripe = y > 180 && y < 196;
  const base = 138 + (n1 - 0.5) * 20;
  return {
    r: stripe ? 218 : base * 0.98,
    g: stripe ? 158 : base * 1.0,
    b: stripe ? 34 : base * 1.03,
    h: 0.52 + (n1 - 0.5) * 0.16,
    rough: stripe ? 0.48 : 0.66 + (n1 - 0.5) * 0.1,
    metal: 0.04,
    ao: 0.94,
  };
});

// --- Generate Real 16-bit PCM .wav Audio Assets in /public/assets/audio/ ---
function writeWavFile(filename, durationSec, sampleFn) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967295 * 2 - 1;
  };

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const s = Math.max(-1, Math.min(1, sampleFn(t, durationSec, rand)));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(AUDIO_DIR, filename), buf);
}

writeWavFile('rifle_fire.wav', 0.22, (t, d, rand) => {
  const env = Math.exp(-t * 24);
  const punch = Math.sin(2 * Math.PI * (150 * Math.exp(-t * 18)) * t);
  return (punch * 0.65 + rand() * 0.55) * env;
});

writeWavFile('pistol_fire.wav', 0.16, (t, d, rand) => {
  const env = Math.exp(-t * 32);
  const punch = Math.sin(2 * Math.PI * (220 * Math.exp(-t * 22)) * t);
  return (punch * 0.6 + rand() * 0.45) * env;
});

writeWavFile('sniper_fire.wav', 0.48, (t, d, rand) => {
  const env = Math.exp(-t * 9.5);
  const boom = Math.sin(2 * Math.PI * (95 * Math.exp(-t * 8)) * t);
  return (boom * 0.7 + rand() * 0.5) * env;
});

writeWavFile('reload_mag_out.wav', 0.14, (t, d, rand) => {
  const env = Math.exp(-Math.abs(t - 0.04) * 45);
  return (Math.sin(2 * Math.PI * 520 * t) * 0.5 + rand() * 0.35) * env;
});

writeWavFile('reload_mag_in.wav', 0.16, (t, d, rand) => {
  const env = Math.exp(-Math.abs(t - 0.05) * 42);
  return (Math.sin(2 * Math.PI * 780 * t) * 0.6 + rand() * 0.35) * env;
});

writeWavFile('reload_bolt_rack.wav', 0.18, (t, d, rand) => {
  const env = Math.exp(-Math.abs(t - 0.06) * 38);
  return (Math.sin(2 * Math.PI * 1120 * t) * 0.55 + rand() * 0.45) * env;
});

writeWavFile('footstep_concrete.wav', 0.11, (t, d, rand) => {
  const env = Math.exp(-t * 38);
  return (Math.sin(2 * Math.PI * 115 * t) * 0.5 + rand() * 0.4) * env;
});

writeWavFile('footstep_metal.wav', 0.12, (t, d, rand) => {
  const env = Math.exp(-t * 34);
  return (
    (Math.sin(2 * Math.PI * 640 * t) * 0.45 +
      Math.sin(2 * Math.PI * 1280 * t) * 0.25 +
      rand() * 0.3) *
    env
  );
});

writeWavFile('jump_launch.wav', 0.15, (t, d, rand) => {
  const env = Math.exp(-t * 22);
  return (Math.sin(2 * Math.PI * (140 + t * 240) * t) * 0.45 + rand() * 0.25) * env;
});

writeWavFile('land_impact.wav', 0.18, (t, d, rand) => {
  const env = Math.exp(-t * 26);
  return (Math.sin(2 * Math.PI * 82 * t) * 0.65 + rand() * 0.35) * env;
});

writeWavFile('ability_cast.wav', 0.32, (t) => {
  const env = Math.exp(-t * 9);
  return (
    (Math.sin(2 * Math.PI * (440 + t * 660) * t) * 0.5 +
      Math.sin(2 * Math.PI * 880 * t) * 0.25) *
    env
  );
});

writeWavFile('ability_ult.wav', 0.55, (t) => {
  const env = Math.exp(-t * 5.5);
  return (
    (Math.sin(2 * Math.PI * 220 * t) * 0.45 +
      Math.sin(2 * Math.PI * 330 * t) * 0.35 +
      Math.sin(2 * Math.PI * (550 + t * 300) * t) * 0.3) *
    env
  );
});

writeWavFile('ui_click.wav', 0.06, (t) => {
  const env = Math.exp(-t * 65);
  return Math.sin(2 * Math.PI * 1480 * t) * 0.5 * env;
});

writeWavFile('ambient_hum.wav', 1.0, (t) => {
  return (
    Math.sin(2 * Math.PI * 55 * t) * 0.15 +
    Math.sin(2 * Math.PI * 110 * t) * 0.08
  );
});

// --- Generate Real glTF 2.0 3D Mesh Files in /public/assets/models/ ---
function writeBoxGltf(filename, meshName, hx, hy, hz, baseColorFactor, metallic, roughness) {
  const positions = new Float32Array([
    -hx, -hy,  hz,   hx, -hy,  hz,   hx,  hy,  hz,  -hx,  hy,  hz,
    -hx, -hy, -hz,  -hx,  hy, -hz,   hx,  hy, -hz,   hx, -hy, -hz,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    3, 2, 6, 3, 6, 5,
    0, 7, 1, 0, 4, 7,
    1, 7, 6, 1, 6, 2,
    4, 0, 3, 4, 3, 5,
  ]);
  const posBuf = Buffer.from(positions.buffer);
  const idxBuf = Buffer.from(indices.buffer);
  const bin = Buffer.concat([posBuf, idxBuf]);
  const uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;

  const gltf = {
    asset: { version: '2.0', generator: 'RadiantProtocol-AssetPipeline' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: meshName }],
    meshes: [
      {
        name: meshName,
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: `${meshName}_PBR`,
        pbrMetallicRoughness: {
          baseColorFactor,
          metallicFactor: metallic,
          roughnessFactor: roughness,
        },
      },
    ],
    buffers: [{ byteLength: bin.length, uri }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length, byteLength: idxBuf.length, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
        min: [-hx, -hy, -hz],
        max: [hx, hy, hz],
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5123,
        count: 36,
        type: 'SCALAR',
      },
    ],
  };

  fs.writeFileSync(path.join(MODEL_DIR, filename), JSON.stringify(gltf, null, 2));
}

writeBoxGltf('vandal_receiver.gltf', 'VandalReceiver', 0.045, 0.055, 0.28, [0.14, 0.16, 0.19, 1], 0.88, 0.24);
writeBoxGltf('tactical_crate.gltf', 'TacticalCrate', 0.8, 0.8, 0.8, [0.46, 0.34, 0.22, 1], 0.12, 0.72);
writeBoxGltf('recon_beacon.gltf', 'ReconBeacon', 0.18, 0.25, 0.18, [0.0, 0.95, 1.0, 1], 0.75, 0.22);
writeBoxGltf('barrier_crystal.gltf', 'BarrierCrystal', 0.95, 1.2, 0.42, [0.22, 0.74, 0.97, 0.92], 0.25, 0.14);

console.log('Generated 55 PBR texture PNGs, 14 WAV audio files, and 4 glTF 3D models in /public/assets/');
