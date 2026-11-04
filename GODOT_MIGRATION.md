# RADIANT PROTOCOL // GODOT 4 MIGRATION GUIDE & ARCHITECTURE PARITY

This document establishes the exact architectural alignment, mathematical formulas, coordinate parity, and asset pipeline for porting **Radiant Protocol** from the web Three.js/TypeScript prototype to native **Godot 4.7+ Engine**.

---

## 1. Combat System Mathematical Parity

### A. Unified Recoil & Camera Synchronization (Resolving Bug 1)
In the original web engine, recoil was cosmetic because the camera rotated on screen while the bullet raycast was fired using the un-recoiled yaw/pitch vectors.

In both TypeScript (`src/game/engine.ts`) and Godot (`godot_port/scripts/player_controller.gd`):
```gdscript
# 1. Total aim angle incorporates base look + continuous recoil offset
var total_pitch := camera_pitch + recoil_pitch_offset
var total_yaw   := camera_yaw + recoil_yaw_offset

# 2. Camera transform is updated synchronously BEFORE the raycast is executed
camera_mount.rotation.y = total_yaw
camera.rotation.x       = total_pitch
camera.rotation.z       = camera_roll

# 3. Raycast direction is derived directly from the recoiled camera basis
var cam_transform := camera.global_transform
var forward := -cam_transform.basis.z.normalized()
var right   := cam_transform.basis.x.normalized()
var up      := cam_transform.basis.y.normalized()
```

### B. Viewport Conical Spread Generation
Rather than distorting world coordinates, spread is generated uniformly across a circle on the camera's orthogonal viewport plane:
```gdscript
var angle := randf() * TAU
var radius := sqrt(randf()) * spread_rad
var bullet_dir := (forward + (right * cos(angle) + up * sin(angle)) * radius).normalized()
```

### C. Yaw-Relative Velocity Decomposition (Resolving Bug 2: Strafing Accuracy)
Strafing accuracy penalties require decomposing the 3D velocity vector relative to the camera's horizontal heading:
```gdscript
var yaw_cos := cos(camera_yaw)
var yaw_sin := sin(camera_yaw)

# Forward/backward velocity along line of sight
var forward_speed := -(velocity.x * yaw_sin + velocity.z * yaw_cos)

# Lateral strafing speed perpendicular to line of sight
var strafe_speed := (velocity.x * yaw_cos - velocity.z * yaw_sin)
var lateral_speed := absf(strafe_speed)
```

**Spread Formula**:
$$\text{EffectiveSpread} = \text{BaseSpread} + \left( \frac{\text{LateralSpeed}}{\text{WalkSpeed}} \times \text{BaseSpread} \times \text{StrafeSpreadMult} \right) + \text{AirbornePenalty} + \text{ContinuousSprayBloom}$$

---

## 2. Weapon Data Profiles

| Weapon | Category | Cost | 1st Shot Spread | Strafe Mult | Air Penalty | Recoil Climb |
|---|---|---|---|---|---|---|
| **Vandal** | Rifle | $2,900 | 0.0008 rad | 4.8x | 0.098 rad | Heavy (0.25 max) |
| **Phantom** | Rifle | $2,900 | 0.0011 rad | 4.2x | 0.085 rad | Medium (0.23 max) |
| **Spectre** | SMG | $1,600 | 0.0055 rad | 1.9x | 0.032 rad | Low (0.22 max) |
| **Operator**| Sniper | $4,700 | 0.00008 rad | 15.0x | 0.240 rad | Severe (0.42 max) |
| **Judge** | Shotgun | $1,850 | 0.0480 rad | 1.45x | 0.028 rad | Moderate (0.32 max) |
| **Sheriff** | Sidearm | $800 | 0.0025 rad | 3.8x | 0.075 rad | High (0.28 max) |

---

## 3. Modular Rig System Architecture

The Rig System decouples character visuals (Chassis) from gameplay function:
- **Maximum Rig Energy**: 7 Points
- **Active Slot 1 [Q]** + **Active Slot 2 [E]** must sum $\le 7$ Points
- **Passive Slot**: 1 Modification (e.g., Signal Dampener, Reinforced Systems, Energy Recovery)

### Active Modules:
1. `vector` (4 Energy, $250): Instant kinetic thrust burst.
2. `aegis` (4 Energy, $300): 4-segment destructible hard-light barrier wall.
3. `echo_probe` (3 Energy, $200): Destructible acoustic sonar scanner (24m range).
4. `static_field` (3 Energy, $200): EMP disruptor pylon with 45% slow zone.
5. `mirage` (2 Energy, $150): Mobile holographic decoy that draws bot fire.
6. `relay` (2 Energy, $150): Squad uplink transponder granting +20 overshield.

---

## 4. Godot 4 Node Hierarchy

```
Player (CharacterBody3D) [player_controller.gd]
├── CollisionShape3D (CapsuleShape3D, radius=0.45m, height=1.75m)
└── CameraMount (Node3D)
    └── Camera3D (Camera3D, fov=78)
        ├── WeaponRayCast (RayCast3D, target_position=Vector3(0, 0, -150))
        └── ViewModel (Node3D)
            ├── Arms_Rig (Node3D)
            └── Weapon_Mesh (MeshInstance3D)
```

---

## 5. Asset Pipeline Conversion

1. **3D Models**: All `/public/assets/models/*.glb` load directly into Godot 4 without re-exporting.
2. **PBR Textures**: All `/public/assets/textures/*.png` map directly to Godot's `StandardMaterial3D`:
   - `albedo_texture`: Base color PNG
   - `roughness_texture`: Roughness PNG
   - `normal_texture`: Normal map PNG
3. **Audio**: All `/public/assets/audio/*.wav` load as native `AudioStreamWAV` with linear volume curves.
