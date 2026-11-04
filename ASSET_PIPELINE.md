# VALORANT: Radiant Protocol 3D — Documented Asset Pipeline

This document catalogs every physical asset file in `/public/assets/`, its category, creation method, import settings, material/system assignment, performance considerations, and licensing information.

---

## 1. Asset Inventory & Creation Pipeline

All physical assets in `/public/assets/` are generated deterministically via `scripts/build_assets.mjs` (CC0 / Original First-Party Procedural Studio Pipeline) so there are zero copyrighted commercial shooter assets and zero fragile third-party URLs.

### A. PBR Environment Texture Maps (`/public/assets/textures/*.png`)
- **Format**: 32-bit RGBA `.png`, `256×256` seamless power-of-two tiles with automatic mipmapping (`THREE.LinearMipmapLinearFilter` / `THREE.RepeatWrapping`).
- **Channel Maps per Material Category** (55 PNG files total across 11 surface categories):
  1. **Concrete (`concrete_*`)**:
     - `concrete_albedo.png` (`sRGB`), `concrete_normal.png` (`Linear`, Sobel tangent-space), `concrete_roughness.png` (`Linear`), `concrete_metallic.png` (`Linear`), `concrete_ao.png` (`Linear`)
     - **Assigned Meshes**: Industrial facility floor slabs, reactor bay aprons, Range floor deck (`mapBuilder.ts` -> `MAT_CONCRETE_FLOOR`).
  2. **Painted Concrete (`painted_concrete_*`)**:
     - `painted_concrete_albedo.png`, `painted_concrete_normal.png`, `painted_concrete_roughness.png`, `painted_concrete_metallic.png`, `painted_concrete_ao.png`
     - **Assigned Meshes**: Perimeter bunker walls, buttress columns, left-wall horizontal concrete ribs (`mapBuilder.ts` -> `MAT_BUNKER_WALL`).
  3. **Structural Metal (`metal_*`)**:
     - `metal_albedo.png`, `metal_normal.png`, `metal_roughness.png`, `metal_metallic.png`, `metal_ao.png`
     - **Assigned Meshes**: Catwalk stair stringers, X-truss frames, handrails, overhead I-beams, reinforced blast doors (`mapBuilder.ts` -> `MAT_DARK_STEEL`).
  4. **Brushed Gunmetal (`brushed_metal_*`)**:
     - `brushed_metal_albedo.png`, `brushed_metal_normal.png`, `brushed_metal_roughness.png`, `brushed_metal_metallic.png`, `brushed_metal_ao.png`
     - **Assigned Meshes**: First-person weapon receivers (Vandal, Phantom, Operator, Odin, Sheriff), overhead ventilation ducts (`models.ts`, `mapBuilder.ts`).
  5. **Silo Diamond Steel (`silo_diamond_*`)**:
     - `silo_diamond_albedo.png`, `silo_diamond_normal.png`, `silo_diamond_roughness.png`, `silo_diamond_metallic.png`, `silo_diamond_ao.png`
     - **Assigned Meshes**: Twin central pressurized `"CS"` & Flame hazard silos (`mapBuilder.ts` -> `MAT_SILO_METAL`).
  6. **Tactical Asphalt (`asphalt_*`)**:
     - `asphalt_albedo.png`, `asphalt_normal.png`, `asphalt_roughness.png`, `asphalt_metallic.png`, `asphalt_ao.png`
     - **Assigned Meshes**: Exterior tarmac zones, Desert courtyard approaches, industrial loading dock lanes (`mapBuilder.ts` -> `MAT_ASPHALT`).
  7. **Ceramic / Research Floor Tiles (`floor_tiles_*`)**:
     - `floor_tiles_albedo.png`, `floor_tiles_normal.png`, `floor_tiles_roughness.png`, `floor_tiles_metallic.png`, `floor_tiles_ao.png`
     - **Assigned Meshes**: Research Cryo Facility floor deck and cleanroom platforms (`mapBuilder.ts` -> `MAT_FLOOR_TILES`).
  8. **Hardwood Supply Crate (`wood_*`)**:
     - `wood_albedo.png`, `wood_normal.png`, `wood_roughness.png`, `wood_metallic.png`, `wood_ao.png`
     - **Assigned Meshes**: Tactical ordnance crates, Vandal walnut handguard & stock (`mapBuilder.ts` -> `MAT_WOOD_CRATE`, `models.ts`).
  9. **Tempered Viewport Glass (`glass_*`)**:
     - `glass_albedo.png`, `glass_normal.png`, `glass_roughness.png`, `glass_metallic.png`, `glass_ao.png`
     - **Assigned Meshes**: Cryo Stasis Pods, observation partitions, holographic tactical barriers (`mapBuilder.ts` -> `MAT_GLASS_PBR`).
  10. **Ballistic Nylon / Tactical Fabric (`fabric_*`)**:
      - `fabric_albedo.png`, `fabric_normal.png`, `fabric_roughness.png`, `fabric_metallic.png`, `fabric_ao.png`
      - **Assigned Meshes**: First-person operator sleeves, tactical gloves, supply tarpaulins (`models.ts` -> `MAT_SLEEVE`, `MAT_GLOVE`).
  11. **Painted Facility Walls (`painted_walls_*`)**:
      - `painted_walls_albedo.png`, `painted_walls_normal.png`, `painted_walls_roughness.png`, `painted_walls_metallic.png`, `painted_walls_ao.png`
      - **Assigned Meshes**: Interior corridor walls, control room dividers (`mapBuilder.ts` -> `MAT_PAINTED_WALL`).

---

### B. PCM `.wav` Audio Assets (`/public/assets/audio/*.wav`)
- **Format**: `22,050 Hz`, 16-bit Mono PCM `.wav` files preloaded by `src/audio/soundSystem.ts` with Web Audio API synthesis fallback.
- **Files**:
  - `rifle_fire.wav`, `pistol_fire.wav`, `sniper_fire.wav`
  - `reload_mag_out.wav`, `reload_mag_in.wav`, `reload_bolt_rack.wav`
  - `footstep_concrete.wav`, `footstep_metal.wav`
  - `jump_launch.wav`, `land_impact.wav`
  - `ability_cast.wav`, `ability_ult.wav`
  - `ui_click.wav`, `ambient_hum.wav`

---

### C. 3D glTF 2.0 Model Assets (`/public/assets/models/*.gltf`)
- **Format**: Standard Khronos glTF 2.0 JSON with embedded base64 vertex/index buffers and PBR metallic-roughness material definitions.
- **Files**:
  - `vandal_receiver.gltf`: Core receiver block reference for Vandal rifle.
  - `tactical_crate.gltf`: Standard 1.6m tactical cover crate mesh.
  - `recon_beacon.gltf`: Sova/Cypher destructible recon pulse emitter mesh.
  - `barrier_crystal.gltf`: Sage destructible Fortifying Barrier crystal segment mesh.

---

## 2. Performance & Hardware Scalability Rules
- **Intel UHD 620 / 8 GB RAM (`potato` & `low` presets)**:
  - Uses power-of-two `256×256` mipmapped PNG textures (< 12 MB total VRAM footprint across all 55 maps).
  - Box geometry world-space UV scaling (`applyBoxWorldUVs`) avoids creating unique textures per wall size.
- **Mid-Range to High-End GPUs (`medium`, `high`, `ultra`, `extreme`)**:
  - Enables anisotropic filtering (`renderer.capabilities.getMaxAnisotropy()`), tangent-space normal mapping, roughness/metallic channels, and PMREM environment reflections.
