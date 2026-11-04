import * as THREE from 'three';
import { AgentId, SkinId, WeaponId } from '../types/game';
import { WEAPON_SKINS } from './weapons';
import { loadDiskPBRTextureSet } from './pbrTextureGenerator';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const brushedSteelMaps = isBrowser ? loadDiskPBRTextureSet('brushed_metal', 2, 2, 8) : null;
const woodMaps = isBrowser ? loadDiskPBRTextureSet('wood', 2, 2, 8) : null;
const fabricMaps = isBrowser ? loadDiskPBRTextureSet('fabric', 3, 3, 8) : null;

// Shared PBR Materials for Weapons & Props (Backed by real /assets/textures/*.png)
const MAT_DARK_CARBON = new THREE.MeshStandardMaterial({
  color: 0x1c2026,
  normalMap: brushedSteelMaps?.normal ?? null,
  normalScale: new THREE.Vector2(0.45, 0.45),
  roughnessMap: brushedSteelMaps?.roughness ?? null,
  roughness: 0.28,
  metalness: 0.86,
});

const MAT_BLUED_STEEL = new THREE.MeshStandardMaterial({
  map: brushedSteelMaps?.albedo ?? null,
  color: 0x3b424d,
  normalMap: brushedSteelMaps?.normal ?? null,
  normalScale: new THREE.Vector2(0.55, 0.55),
  roughnessMap: brushedSteelMaps?.roughness ?? null,
  metalnessMap: brushedSteelMaps?.metallic ?? null,
  roughness: 0.22,
  metalness: 0.92,
});

const MAT_WOOD_POLYMER = new THREE.MeshStandardMaterial({
  map: woodMaps?.albedo ?? null,
  color: 0x6e4736,
  normalMap: woodMaps?.normal ?? null,
  normalScale: new THREE.Vector2(0.65, 0.65),
  roughnessMap: woodMaps?.roughness ?? null,
  roughness: 0.52,
  metalness: 0.14,
});

const MAT_GOLD_TRIM = new THREE.MeshStandardMaterial({
  color: 0xfbbf24,
  normalMap: brushedSteelMaps?.normal ?? null,
  roughness: 0.22,
  metalness: 0.88,
});

const MAT_RADIANT_CYAN = new THREE.MeshBasicMaterial({
  color: 0x00f2fe,
});

const MAT_RADIANT_RED = new THREE.MeshBasicMaterial({
  color: 0xff4655,
});

const MAT_PRIME_WHITE = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.25,
  metalness: 0.35,
});

const MAT_GLOVE = new THREE.MeshStandardMaterial({
  map: fabricMaps?.albedo ?? null,
  color: 0x222730,
  normalMap: fabricMaps?.normal ?? null,
  normalScale: new THREE.Vector2(0.7, 0.7),
  roughnessMap: fabricMaps?.roughness ?? null,
  roughness: 0.65,
  metalness: 0.14,
});

const MAT_SLEEVE = new THREE.MeshStandardMaterial({
  map: fabricMaps?.albedo ?? null,
  color: 0x1e293b,
  normalMap: fabricMaps?.normal ?? null,
  normalScale: new THREE.Vector2(0.85, 0.85),
  roughnessMap: fabricMaps?.roughness ?? null,
  roughness: 0.78,
  metalness: 0.08,
});

const MAT_SKIN = new THREE.MeshLambertMaterial({
  color: 0xd6a686,
});

const MAT_MUZZLE_FLASH = new THREE.MeshBasicMaterial({
  color: 0xfef08a,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Shared Sculpted Humanoid Geometries for Agent Characters
const AGENT_HEAD_GEO = new THREE.SphereGeometry(0.21, 16, 14);
const AGENT_HOOD_GEO = new THREE.SphereGeometry(
  0.225,
  16,
  12,
  0,
  Math.PI * 2,
  0,
  Math.PI * 0.62
);
const AGENT_VISOR_GEO = new THREE.CylinderGeometry(
  0.215,
  0.215,
  0.08,
  16,
  1,
  false,
  -Math.PI * 0.35,
  Math.PI * 0.7
);
const AGENT_HEAD_HITBOX_GEO = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const AGENT_TORSO_GEO = new THREE.CylinderGeometry(0.25, 0.21, 0.68, 12);
const AGENT_PAULDRON_GEO = new THREE.SphereGeometry(0.14, 12, 10);
const AGENT_PLATE_GEO = new THREE.BoxGeometry(0.32, 0.32, 0.12);
const AGENT_BODY_HITBOX_GEO = new THREE.BoxGeometry(0.68, 0.76, 0.48);
const AGENT_LEG_GEO = new THREE.CylinderGeometry(0.1, 0.085, 0.74, 10);
const AGENT_BOOT_GEO = new THREE.BoxGeometry(0.18, 0.14, 0.28);
const AGENT_LEG_HITBOX_GEO = new THREE.BoxGeometry(0.62, 0.8, 0.48);
const AGENT_ARM_GEO = new THREE.CylinderGeometry(0.075, 0.065, 0.54, 10);
const AGENT_RIFLE_GEO = new THREE.BoxGeometry(0.06, 0.1, 0.64);
const AGENT_SHADOW_GEO = new THREE.CircleGeometry(0.55, 16);

// Enemy vs Ally Materials
const MAT_SUIT_ENEMY = new THREE.MeshStandardMaterial({
  color: 0x7f1d1d,
  emissive: 0x450a0a,
  emissiveIntensity: 0.4,
  roughness: 0.5,
  metalness: 0.25,
});
const MAT_SUIT_ALLY = new THREE.MeshStandardMaterial({
  color: 0x1e3a8a,
  emissive: 0x0c4a6e,
  emissiveIntensity: 0.3,
  roughness: 0.5,
  metalness: 0.25,
});
const MAT_VEST_ENEMY = new THREE.MeshStandardMaterial({
  color: 0x991b1b,
  roughness: 0.4,
  metalness: 0.5,
});
const MAT_VEST_ALLY = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.4,
  metalness: 0.5,
});
const MAT_BOOT = new THREE.MeshLambertMaterial({ color: 0x0f172a });
const MAT_GLOW_ENEMY = new THREE.MeshBasicMaterial({ color: 0xff4655 });
const MAT_GLOW_ALLY = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
const MAT_HITBOX = new THREE.MeshBasicMaterial({ visible: false });
const MAT_CONTACT_SHADOW = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

function getSkinMaterials(skinId: SkinId = 'tactical') {
  const skin = WEAPON_SKINS[skinId] || WEAPON_SKINS.tactical;
  if (skinId === 'tactical') {
    return {
      primary: MAT_BLUED_STEEL,
      secondary: MAT_DARK_CARBON,
      accent: MAT_WOOD_POLYMER,
      glow: MAT_RADIANT_RED,
    };
  }
  return {
    primary: new THREE.MeshStandardMaterial({
      color: skin.primaryColor,
      roughness: 0.22,
      metalness: 0.72,
    }),
    secondary: new THREE.MeshStandardMaterial({
      color: skin.secondaryColor,
      roughness: 0.36,
      metalness: 0.78,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: skin.accentColor,
      roughness: 0.24,
      metalness: 0.85,
    }),
    glow: new THREE.MeshBasicMaterial({
      color: skin.glowColor,
    }),
  };
}

function attachMuzzleFlashMesh(group: THREE.Group, zPos: number, yPos = 0.02) {
  const flashGroup = new THREE.Group();
  flashGroup.name = 'MuzzleFlash';
  flashGroup.position.set(0, yPos, zPos);
  flashGroup.visible = false;

  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), MAT_MUZZLE_FLASH);
    plane.rotation.z = (i * Math.PI) / 3;
    flashGroup.add(plane);
  }
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.22, 8).rotateX(-Math.PI / 2),
    MAT_MUZZLE_FLASH
  );
  cone.position.z = -0.1;
  flashGroup.add(cone);

  group.add(flashGroup);
}

/**
 * Creates PBR weapon viewmodel with brushed steel/gunmetal receiver, polymer/wood handguard, and muzzle flash.
 */
export function createWeaponViewModel(
  weaponId: WeaponId | 'kunai',
  skinId: SkinId = 'tactical'
): THREE.Group {
  const group = new THREE.Group();
  group.name = `ViewModel_${weaponId}`;

  const mats = getSkinMaterials(skinId);

  const addHands = (gripZ: number, forendZ: number) => {
    // Articulated Right Trigger Arm & Hand (Forearm sleeve + wrist cuff + armored palm + wrapped fingers)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.name = 'RightArmGroup';
    rightArmGroup.position.set(0.015, -0.088, gripZ);

    const rightPalm = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.076, 0.105),
      MAT_GLOVE
    );
    rightArmGroup.add(rightPalm);

    const rightKnucklePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.022, 0.065),
      MAT_DARK_CARBON
    );
    rightKnucklePlate.position.set(0.004, 0.032, -0.01);
    rightArmGroup.add(rightKnucklePlate);

    // Trigger Finger & Wrapped Grip Fingers
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.01, 0.056, 8).rotateZ(Math.PI / 2),
        MAT_GLOVE
      );
      finger.position.set(-0.028, 0.02 - f * 0.016, -0.035 + f * 0.012);
      rightArmGroup.add(finger);
    }

    const rightForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.058, 0.34, 12).rotateX(Math.PI / 2.2),
      MAT_SLEEVE
    );
    rightForearm.position.set(0.04, -0.07, 0.19);
    rightForearm.rotation.y = -0.18;
    rightArmGroup.add(rightForearm);

    group.add(rightArmGroup);

    // Articulated Left Support Arm & Hand (Detaches during reload to pull magazine & rack bolt!)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.name = 'LeftArmGroup';
    leftArmGroup.position.set(-0.028, -0.042, forendZ);

    const leftPalm = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, 0.068, 0.12),
      MAT_GLOVE
    );
    leftArmGroup.add(leftPalm);

    const leftThumb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.01, 0.055, 8).rotateZ(-0.6),
      MAT_GLOVE
    );
    leftThumb.position.set(-0.032, 0.034, -0.02);
    leftArmGroup.add(leftThumb);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.01, 0.058, 8).rotateZ(Math.PI / 2),
        MAT_GLOVE
      );
      finger.position.set(0.026, -0.015, -0.042 + f * 0.022);
      leftArmGroup.add(finger);
    }

    // Tactical Wrist Chrono Watch on Left Wrist
    const watchBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.032, 10).rotateX(Math.PI / 2),
      MAT_DARK_CARBON
    );
    watchBand.position.set(-0.02, -0.02, 0.08);
    leftArmGroup.add(watchBand);

    const leftForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.058, 0.38, 12).rotateX(Math.PI / 2.3),
      MAT_SLEEVE
    );
    leftForearm.position.set(-0.08, -0.09, 0.23);
    leftForearm.rotation.y = 0.34;
    leftArmGroup.add(leftForearm);

    group.add(leftArmGroup);
  };

  if (weaponId === 'kunai') {
    for (let i = -2; i <= 2; i++) {
      const kunaiGroup = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.22, 4), MAT_RADIANT_CYAN);
      blade.rotation.x = -Math.PI / 2;
      kunaiGroup.add(blade);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6),
        MAT_PRIME_WHITE
      );
      handle.rotation.x = -Math.PI / 2;
      handle.position.z = 0.14;
      kunaiGroup.add(handle);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), MAT_GOLD_TRIM);
      ring.position.z = 0.19;
      kunaiGroup.add(ring);

      kunaiGroup.position.set(i * 0.075, Math.abs(i) * -0.02, -0.35 + Math.abs(i) * 0.03);
      group.add(kunaiGroup);
    }
    group.position.set(0.05, -0.16, -0.25);
    return group;
  }

  if (weaponId === 'vandal') {
    // Authentic Stamped/Ribbed Blued-Steel Dust Cover + Receiver (Matches Reference Image AK/Vandal in image.png!)
    const upperCoverGeo = new THREE.CylinderGeometry(0.044, 0.05, 0.48, 14);
    upperCoverGeo.rotateX(Math.PI / 2);
    const upperCover = new THREE.Mesh(upperCoverGeo, mats.primary);
    upperCover.position.set(0, 0.046, 0.04);
    group.add(upperCover);

    // Stamped receiver stiffening ribs along dust cover (Visible in image.png bottom-right!)
    for (const rz of [-0.12, -0.03, 0.06, 0.15]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.038, 0.026), mats.primary);
      rib.position.set(0, 0.044, rz);
      group.add(rib);
    }

    // Lower Stamped Steel Receiver with Specular Rails
    const lowerReceiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.084, 0.078, 0.48),
      mats.secondary
    );
    lowerReceiver.position.set(0, -0.008, 0.04);
    group.add(lowerReceiver);

    // Side Specular Rail Step
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.46), mats.primary);
    sideRail.position.set(0, 0.022, 0.04);
    group.add(sideRail);

    // Reciprocating Bolt Carrier & Charging Handle on right side
    const chargingHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.055, 8).rotateZ(Math.PI / 2),
      mats.primary
    );
    chargingHandle.name = 'BoltCarrier';
    chargingHandle.position.set(0.058, 0.032, -0.06);
    group.add(chargingHandle);

    // Dark Walnut / Polymer Handguard (Matches warm dark wood/polymer forend in image.png!)
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.068, 0.26), mats.accent);
    handguard.position.set(0, 0.012, -0.31);
    group.add(handguard);

    const upperHandguard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.036, 0.22, 10).rotateX(Math.PI / 2),
      mats.accent
    );
    upperHandguard.position.set(0, 0.05, -0.3);
    group.add(upperHandguard);

    // Gas tube & gas block above barrel
    const gasTubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 10);
    gasTubeGeo.rotateX(Math.PI / 2);
    const gasTube = new THREE.Mesh(gasTubeGeo, mats.primary);
    gasTube.position.set(0, 0.054, -0.32);
    group.add(gasTube);

    // Heavy Rifled Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.44, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, mats.primary);
    barrel.position.set(0, 0.02, -0.48);
    group.add(barrel);

    // Front Sight Tower & Protective Ears (Matches silhouette in image.png!)
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.072, 0.036), mats.secondary);
    frontSight.position.set(0, 0.062, -0.6);
    group.add(frontSight);

    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.065, 10).rotateX(Math.PI / 2),
      mats.secondary
    );
    muzzle.position.set(0, 0.02, -0.68);
    group.add(muzzle);

    // Curved Ribbed Steel 30-Round Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.24, 0.105), mats.secondary);
    mag.name = 'WeaponMagazine';
    mag.position.set(0, -0.14, -0.06);
    mag.rotation.x = -0.28;
    group.add(mag);

    // Rear Tangent Iron Sight Block + Leaf
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.036, 0.075), mats.primary);
    sight.position.set(0, 0.082, -0.16);
    group.add(sight);

    // Pistol Grip & Stock
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.075), mats.accent);
    grip.position.set(0, -0.09, 0.18);
    grip.rotation.x = 0.25;
    group.add(grip);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.105, 0.24), mats.accent);
    stock.position.set(0, -0.01, 0.34);
    group.add(stock);

    if (skinId !== 'tactical') {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.018, 0.34), mats.glow);
      strip.position.set(0, 0.028, -0.02);
      group.add(strip);
    }

    attachMuzzleFlashMesh(group, -0.74, 0.02);
    addHands(0.16, -0.28);
    group.position.set(0.24, -0.2, -0.4);
  } else if (weaponId === 'odin') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.54), mats.primary);
    receiver.position.set(0, 0.02, 0);
    group.add(receiver);

    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.18), mats.accent);
    ammoBox.position.set(0, -0.11, -0.08);
    group.add(ammoBox);

    const shroudGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.44, 12);
    shroudGeo.rotateX(Math.PI / 2);
    const shroud = new THREE.Mesh(shroudGeo, mats.secondary);
    shroud.position.set(0, 0.025, -0.46);
    group.add(shroud);

    const glowCore = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.025, 0.38), mats.glow);
    glowCore.position.set(0, 0.03, -0.05);
    group.add(glowCore);

    attachMuzzleFlashMesh(group, -0.7, 0.025);
    addHands(0.16, -0.26);
    group.position.set(0.25, -0.23, -0.48);
  } else if (weaponId === 'phantom') {
    const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.072, 0.42), mats.primary);
    upperReceiver.position.set(0, 0.025, 0);
    group.add(upperReceiver);

    const lowerReceiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.055, 0.4),
      mats.secondary
    );
    lowerReceiver.position.set(0, -0.025, 0);
    group.add(lowerReceiver);

    const silencerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.36, 12);
    silencerGeo.rotateX(Math.PI / 2);
    const silencer = new THREE.Mesh(silencerGeo, mats.secondary);
    silencer.position.set(0, 0.015, -0.38);
    group.add(silencer);

    const silencerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.04, 12),
      mats.glow
    );
    silencerRing.rotation.x = Math.PI / 2;
    silencerRing.position.set(0, 0.015, -0.26);
    group.add(silencerRing);

    const holo = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.055, 0.1), mats.accent);
    holo.position.set(0, 0.08, -0.06);
    group.add(holo);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.18, 0.08), mats.secondary);
    mag.position.set(0, -0.11, 0.08);
    group.add(mag);

    attachMuzzleFlashMesh(group, -0.6, 0.015);
    addHands(0.14, -0.2);
    group.position.set(0.23, -0.2, -0.44);
  } else if (weaponId === 'operator') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.11, 0.56), mats.primary);
    group.add(receiver);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.06, 0.52), mats.secondary);
    lower.position.set(0, -0.05, 0);
    group.add(lower);

    const barrelGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.68, 10);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, mats.accent);
    barrel.position.set(0, 0.03, -0.58);
    group.add(barrel);

    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.1), mats.glow);
    brake.position.set(0, 0.03, -0.94);
    group.add(brake);

    const scopeGeo = new THREE.CylinderGeometry(0.038, 0.034, 0.3, 12);
    scopeGeo.rotateX(Math.PI / 2);
    const scope = new THREE.Mesh(scopeGeo, mats.secondary);
    scope.position.set(0, 0.11, -0.05);
    group.add(scope);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), mats.glow);
    lens.position.set(0, 0.11, 0.102);
    group.add(lens);

    attachMuzzleFlashMesh(group, -1.0, 0.03);
    addHands(0.16, -0.25);
    group.position.set(0.25, -0.22, -0.5);
  } else if (weaponId === 'judge') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.09, 0.44), mats.primary);
    receiver.position.set(0, 0.02, 0);
    group.add(receiver);

    const drumGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.11, 14);
    drumGeo.rotateX(Math.PI / 2);
    const drumMag = new THREE.Mesh(drumGeo, mats.secondary);
    drumMag.position.set(0, -0.075, -0.06);
    group.add(drumMag);

    const barrelGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.38, 10);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, mats.secondary);
    barrel.position.set(0, 0.035, -0.36);
    group.add(barrel);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.24), mats.accent);
    shroud.position.set(0, 0.03, -0.28);
    group.add(shroud);

    attachMuzzleFlashMesh(group, -0.58, 0.035);
    addHands(0.14, -0.2);
    group.position.set(0.23, -0.21, -0.44);
  } else if (weaponId === 'knife') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.042, 0.15), mats.secondary);
    group.add(handle);

    const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 16), mats.accent);
    pommelRing.position.set(0, 0, 0.09);
    group.add(pommelRing);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.048, 0.24), mats.primary);
    blade.position.set(0, 0.015, -0.18);
    group.add(blade);

    const laserEdge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.24), mats.glow);
    laserEdge.position.set(0, -0.012, -0.18);
    group.add(laserEdge);

    addHands(0.02, 0.02);
    group.position.set(0.2, -0.19, -0.35);
  } else {
    const isSpectre = weaponId === 'spectre';
    const slideLen = isSpectre ? 0.36 : 0.25;
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.064, slideLen), mats.primary);
    group.add(slide);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.04, slideLen * 0.9),
      mats.secondary
    );
    frame.position.set(0, -0.03, 0);
    group.add(frame);

    const barrelGeo = new THREE.CylinderGeometry(0.014, 0.014, isSpectre ? 0.22 : 0.1, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, mats.accent);
    barrel.position.set(0, 0.01, -slideLen / 2 - 0.06);
    group.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.14, 0.07), mats.secondary);
    grip.position.set(0, -0.09, 0.04);
    grip.rotation.x = -0.2;
    group.add(grip);

    attachMuzzleFlashMesh(group, -slideLen / 2 - (isSpectre ? 0.18 : 0.12), 0.01);
    addHands(0.04, -0.08);
    group.position.set(0.19, -0.18, -0.38);
  }

  return group;
}

/**
 * Creates 3D Spike object.
 */
export function createSpikeMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Spike';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 6), MAT_DARK_CARBON);
  base.position.y = 0.225;
  group.add(base);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 12), MAT_RADIANT_CYAN);
  core.position.y = 0.5;
  core.name = 'SpikeCore';
  group.add(core);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.2, 6), MAT_GOLD_TRIM);
  cap.position.y = 0.85;
  group.add(cap);

  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.28), MAT_DARK_CARBON);
    const angle = (i * Math.PI * 2) / 3;
    fin.position.set(Math.cos(angle) * 0.28, 0.45, Math.sin(angle) * 0.28);
    fin.rotation.y = -angle;
    group.add(fin);
  }

  return group;
}

/**
 * Creates a sculpted humanoid tactical Agent mesh with distinct Head, Torso, Legs, Arms, Visor, and Role Silhouette.
 */
export function createAgentCharacter(
  botId: string,
  name: string,
  isEnemy: boolean,
  accentColorHex: string,
  agentId: AgentId = 'jett'
): {
  group: THREE.Group;
  hitboxes: THREE.Mesh[];
  hpBarFill: THREE.Mesh;
  statusTagMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = `Agent_${botId}_${name}`;

  const suitMat = isEnemy ? MAT_SUIT_ENEMY : MAT_SUIT_ALLY;
  const vestMat = isEnemy ? MAT_VEST_ENEMY : MAT_VEST_ALLY;
  const glowMat = isEnemy ? MAT_GLOW_ENEMY : MAT_GLOW_ALLY;
  const agentAccentMat = new THREE.MeshBasicMaterial({ color: accentColorHex });

  const hitboxes: THREE.Mesh[] = [];

  // 1. HEAD + TACTICAL COWL + GLOWING VISOR (1.42m to 1.78m)
  const headMesh = new THREE.Mesh(AGENT_HEAD_GEO, MAT_SKIN);
  headMesh.position.y = 1.56;
  group.add(headMesh);

  const hoodMesh = new THREE.Mesh(AGENT_HOOD_GEO, vestMat);
  hoodMesh.position.y = 1.57;
  group.add(hoodMesh);

  const visorMesh = new THREE.Mesh(AGENT_VISOR_GEO, agentAccentMat);
  visorMesh.position.set(0, 1.57, 0.02);
  group.add(visorMesh);

  if (agentId === 'cypher' || agentId === 'sova') {
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), vestMat);
    hatBrim.position.y = 1.72;
    group.add(hatBrim);
  } else if (agentId === 'sage' || agentId === 'reyna') {
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), agentAccentMat);
    crest.position.set(0, 1.76, -0.06);
    group.add(crest);
  }

  const headHitbox = new THREE.Mesh(AGENT_HEAD_HITBOX_GEO, MAT_HITBOX);
  headHitbox.position.y = 1.58;
  headHitbox.userData = { isBotHitbox: true, botId, zone: 'head' };
  group.add(headHitbox);
  hitboxes.push(headHitbox);

  // 2. TORSO + CHEST RIG + SHOULDER PAULDRONS (0.74m to 1.42m)
  const torsoMesh = new THREE.Mesh(AGENT_TORSO_GEO, suitMat);
  torsoMesh.position.y = 1.08;
  group.add(torsoMesh);

  const chestPlate = new THREE.Mesh(AGENT_PLATE_GEO, vestMat);
  chestPlate.position.set(0, 1.12, 0.14);
  group.add(chestPlate);

  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), agentAccentMat);
  chestCore.position.set(0, 1.16, 0.15);
  group.add(chestCore);

  const leftPauldron = new THREE.Mesh(AGENT_PAULDRON_GEO, vestMat);
  leftPauldron.position.set(-0.3, 1.32, 0);
  group.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(AGENT_PAULDRON_GEO, vestMat);
  rightPauldron.position.set(0.3, 1.32, 0);
  group.add(rightPauldron);

  const bodyHitbox = new THREE.Mesh(AGENT_BODY_HITBOX_GEO, MAT_HITBOX);
  bodyHitbox.position.y = 1.08;
  bodyHitbox.userData = { isBotHitbox: true, botId, zone: 'body' };
  group.add(bodyHitbox);
  hitboxes.push(bodyHitbox);

  // 3. SCULPTED LEGS + BOOTS (0.0m to 0.74m)
  const leftLegMesh = new THREE.Mesh(AGENT_LEG_GEO, vestMat);
  leftLegMesh.position.set(-0.13, 0.37, 0);
  leftLegMesh.name = 'LeftLeg';
  group.add(leftLegMesh);

  const leftBoot = new THREE.Mesh(AGENT_BOOT_GEO, MAT_BOOT);
  leftBoot.position.set(0, -0.32, 0.04);
  leftLegMesh.add(leftBoot);

  const rightLegMesh = new THREE.Mesh(AGENT_LEG_GEO, vestMat);
  rightLegMesh.position.set(0.13, 0.37, 0);
  rightLegMesh.name = 'RightLeg';
  group.add(rightLegMesh);

  const rightBoot = new THREE.Mesh(AGENT_BOOT_GEO, MAT_BOOT);
  rightBoot.position.set(0, -0.32, 0.04);
  rightLegMesh.add(rightBoot);

  const legHitbox = new THREE.Mesh(AGENT_LEG_HITBOX_GEO, MAT_HITBOX);
  legHitbox.position.y = 0.38;
  legHitbox.userData = { isBotHitbox: true, botId, zone: 'leg' };
  group.add(legHitbox);
  hitboxes.push(legHitbox);

  // 4. ARMS & EQUIPPED RIFLE
  const leftArm = new THREE.Mesh(AGENT_ARM_GEO, suitMat);
  leftArm.position.set(-0.31, 1.06, 0.14);
  leftArm.rotation.x = Math.PI / 3;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(AGENT_ARM_GEO, suitMat);
  rightArm.position.set(0.31, 1.06, 0.16);
  rightArm.rotation.x = Math.PI / 2.4;
  group.add(rightArm);

  const rifle = new THREE.Mesh(AGENT_RIFLE_GEO, MAT_DARK_CARBON);
  rifle.position.set(0.22, 1.04, 0.42);
  group.add(rifle);

  // 5. GROUND CONTACT SHADOW
  const contactShadow = new THREE.Mesh(AGENT_SHADOW_GEO, MAT_CONTACT_SHADOW);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  group.add(contactShadow);

  // 6. OVERHEAD HEALTH BAR + RECON / BLIND STATUS DIAMOND
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide })
  );
  hpBg.position.y = 2.02;
  group.add(hpBg);

  const hpFillGeo = new THREE.PlaneGeometry(0.78, 0.065);
  const hpFillMat = glowMat.clone();
  hpFillMat.side = THREE.DoubleSide;
  const hpBarFill = new THREE.Mesh(hpFillGeo, hpFillMat);
  hpBarFill.position.set(0, 2.02, 0.01);
  group.add(hpBarFill);

  // Status Diamond above HP bar (Visible when Revealed by Sova/Cypher, Blinded, or Slowed)
  const statusTagMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: false })
  );
  statusTagMesh.position.set(0, 2.28, 0);
  statusTagMesh.visible = false;
  statusTagMesh.name = 'StatusTagDiamond';
  group.add(statusTagMesh);

  return { group, hitboxes, hpBarFill, statusTagMesh };
}
