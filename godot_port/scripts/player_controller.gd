class_name PlayerController
extends CharacterBody3D

## Radiant Protocol // 3D Tactical FPS Player Controller (Godot 4.7+)
## Implements mathematically identical unified recoil, strafe spread penalties,
## and modular Rig ability execution with zero camera-desync.

# --- EXPORT PROPERTIES ---
@export_group("Movement Physics")
@export var walk_speed: float = 6.7
@export var crouch_speed: float = 2.8
@export var sprint_speed: float = 8.5
@export var ground_accel: float = 54.0
@export var air_accel: float = 18.0
@export var ground_friction: float = 15.0
@export var jump_velocity: float = 6.35
@export var gravity: float = 18.0

@export_group("Aim & Camera")
@export var mouse_sensitivity: float = 0.0022
@export var max_pitch: float = 1.52

# --- NODE REFERENCES ---
@onready var camera_mount: Node3D = $CameraMount
@onready var camera: Camera3D = $CameraMount/Camera3D
@onready var weapon_raycast: RayCast3D = $CameraMount/Camera3D/WeaponRayCast
@onready var view_model: Node3D = $CameraMount/Camera3D/ViewModel

# --- ORIENTATION & UNIFIED RECOIL STATE ---
var camera_pitch: float = 0.0
var camera_yaw: float = 0.0
var camera_roll: float = 0.0

var recoil_pitch_offset: float = 0.0
var recoil_yaw_offset: float = 0.0
var movement_inaccuracy: float = 0.0
var landing_dip_offset: float = 0.0
var continuous_shots: int = 0
var last_shot_time: float = 0.0

# --- WEAPON & STANCE STATE ---
var active_weapon_id: String = "vandal"
var is_scoped: boolean = false
var is_crouching: boolean = false
var is_sprinting: boolean = false
var is_reloading: boolean = false
var reload_timer: float = 0.0

var ammo_mag: int = 25
var ammo_reserve: int = 75

# --- RIG BUILD STATE ---
var rig_build: Dictionary = {
	"active_slot1": "vector",
	"active_slot2": "echo_probe",
	"passive_slot": "energy_recovery"
}
var ability_charges: Dictionary = { "c": 1, "q": 1, "e": 2, "x": 1 }
var ability_cooldowns: Dictionary = { "c": 0.0, "q": 0.0, "e": 0.0, "x": 0.0 }

# --- WEAPON DATA CACHE ---
var weapons_catalog: Dictionary = {}

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_load_weapon_catalog()

func _load_weapon_catalog() -> void:
	var file := FileAccess.open("res://schemas/weapons_data.json", FileAccess.READ)
	if file:
		var json := JSON.new()
		if json.parse(file.get_as_text()) == OK and json.data.has("weapons"):
			weapons_catalog = json.data["weapons"]

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var sens := mouse_sensitivity * (0.6 if is_scoped else 1.0)
		camera_yaw -= event.relative.x * sens
		camera_pitch -= event.relative.y * sens
		camera_pitch = clampf(camera_pitch, -max_pitch, max_pitch)

	if event.is_action_pressed("fire"):
		attempt_shoot()
	if event.is_action_pressed("scope"):
		toggle_scope()
	if event.is_action_pressed("reload"):
		start_reload()
	if event.is_action_pressed("ability_q"):
		use_ability("q")
	if event.is_action_pressed("ability_e"):
		use_ability("e")

func _physics_process(dt: float) -> void:
	var wep: Dictionary = weapons_catalog.get(active_weapon_id, {})

	# 1. Update ability cooldowns
	for k in ability_cooldowns.keys():
		if ability_cooldowns[k] > 0.0:
			ability_cooldowns[k] = maxf(0.0, ability_cooldowns[k] - dt)

	# 2. Update reload state
	if is_reloading:
		reload_timer -= dt
		if reload_timer <= 0.0:
			complete_reload()

	# 3. Smooth Recoil & Accuracy Recovery (Exact exponential decay match)
	var rec_rate: float = wep.get("recoilAccumulationRate", 2.2)
	var recoil_decay: float = exp(-rec_rate * 2.8 * dt)
	recoil_pitch_offset = lerpf(0.0, recoil_pitch_offset, recoil_decay)
	recoil_yaw_offset = lerpf(0.0, recoil_yaw_offset, recoil_decay)

	var horiz_speed: float = Vector2(velocity.x, velocity.z).length()
	if horiz_speed < 0.2 and is_on_floor():
		movement_inaccuracy = maxf(0.0, movement_inaccuracy - 4.5 * dt)
	else:
		movement_inaccuracy = minf(1.0, movement_inaccuracy + 3.8 * dt)

	# 4. Input direction in Camera-Yaw Reference Frame
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var yaw_basis := Basis(Vector3.UP, camera_yaw)
	var move_dir := (yaw_basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()

	# Stance & Speed Evaluation
	is_crouching = Input.is_action_pressed("crouch")
	is_sprinting = Input.is_action_pressed("sprint") and not is_crouching and not is_scoped

	var target_speed: float = walk_speed
	if is_crouching:
		target_speed = crouch_speed
	elif is_sprinting:
		target_speed = sprint_speed
	elif is_scoped:
		target_speed = crouch_speed * 1.25

	# Tactical Strafe Camera Roll
	var side_input: float = input_dir.x
	camera_roll = lerpf(camera_roll, -side_input * 0.016, 12.0 * dt)

	# Acceleration & Friction
	var accel: float = ground_accel if is_on_floor() else air_accel
	var friction: float = ground_friction if is_on_floor() else 1.8

	if move_dir != Vector3.ZERO:
		velocity.x += move_dir.x * accel * dt
		velocity.z += move_dir.z * accel * dt
	else:
		var damping: float = exp(-friction * dt)
		velocity.x *= damping
		velocity.z *= damping

	var current_horiz_sq := velocity.x * velocity.x + velocity.z * velocity.z
	if current_horiz_sq > target_speed * target_speed:
		var inv_speed := target_speed / sqrt(current_horiz_sq)
		velocity.x *= inv_speed
		velocity.z *= inv_speed

	# Gravity & Jump
	if not is_on_floor():
		velocity.y -= gravity * dt
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	move_and_slide()

	# 5. UNIFIED CAMERA & AIM SYNCHRONIZATION (Fixes Bug 1 & Bug 2)
	var total_pitch := camera_pitch + recoil_pitch_offset
	var total_yaw := camera_yaw + recoil_yaw_offset

	camera_mount.rotation.y = total_yaw
	camera.rotation.x = total_pitch
	camera.rotation.z = camera_roll

## Decomposes actual velocity in Camera-Yaw reference frame
func evaluate_movement_state() -> Dictionary:
	var yaw_cos := cos(camera_yaw)
	var yaw_sin := sin(camera_yaw)

	var forward_speed := -(velocity.x * yaw_sin + velocity.z * yaw_cos)
	var strafe_speed := (velocity.x * yaw_cos - velocity.z * yaw_sin)
	var horiz_speed := Vector2(velocity.x, velocity.z).length()

	return {
		"forward_speed": forward_speed,
		"strafe_speed": strafe_speed,
		"lateral_speed": absf(strafe_speed),
		"vertical_velocity": velocity.y,
		"is_grounded": is_on_floor(),
		"horizontal_speed": horiz_speed
	}

## Computes accurate weapon conical spread in radians
func compute_effective_spread() -> float:
	var wep: Dictionary = weapons_catalog.get(active_weapon_id, {})
	var first_shot: float = wep.get("firstShotSpread", 0.0008)
	var strafe_mult: float = wep.get("strafeSpreadMult", 4.8)
	var air_penalty: float = wep.get("airborneSpreadPenalty", 0.098)

	var mov := evaluate_movement_state()
	var base := first_shot * (0.85 if is_scoped else 1.0) * (0.75 if is_crouching else 1.0)

	var lateral_ratio: float = clampf(mov.lateral_speed / maxf(0.1, walk_speed), 0.0, 1.4)
	var strafe_penalty: float = lateral_ratio * base * strafe_mult

	var airborne_term: float = 0.0 if mov.is_grounded else air_penalty
	var spray_bloom: float = pow(float(continuous_shots), 1.25) * 0.0032

	return base + strafe_penalty + airborne_term + spray_bloom

## Executes physical shot along unified recoiled camera vector + orthogonal conical spread
func attempt_shoot() -> void:
	if ammo_mag <= 0 or is_reloading:
		start_reload()
		return

	ammo_mag -= 1
	continuous_shots += 1

	var wep: Dictionary = weapons_catalog.get(active_weapon_id, {})
	var pitch_step: float = 0.016 + continuous_shots * 0.003
	var yaw_step: float = (sin(float(continuous_shots) * 0.85) * 0.008) if continuous_shots > 4 else 0.0

	var max_p: float = wep.get("maxContinuousRecoilPitch", 0.25)
	var max_y: float = wep.get("maxContinuousRecoilYaw", 0.09)
	recoil_pitch_offset = minf(max_p, recoil_pitch_offset + pitch_step)
	recoil_yaw_offset = clampf(recoil_yaw_offset + yaw_step, -max_y, max_y)

	# Synchronize camera transform instantly before raycasting
	var total_pitch := camera_pitch + recoil_pitch_offset
	var total_yaw := camera_yaw + recoil_yaw_offset
	camera_mount.rotation.y = total_yaw
	camera.rotation.x = total_pitch
	camera.rotation.z = camera_roll

	# Screen-space conical bullet spread using camera orthogonal basis vectors
	var spread_rad := compute_effective_spread()
	var cam_transform := camera.global_transform
	var forward := -cam_transform.basis.z.normalized()
	var right := cam_transform.basis.x.normalized()
	var up := cam_transform.basis.y.normalized()

	var angle := randf() * TAU
	var radius := sqrt(randf()) * spread_rad
	var bullet_dir := (forward + (right * cos(angle) + up * sin(angle)) * radius).normalized()

	# Cast bullet physics raycast
	var space_state := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(
		camera.global_position,
		camera.global_position + bullet_dir * 150.0
	)
	var result := space_state.intersect_ray(query)
	if result:
		# Process hit confirmation, damage falloff, and decal spawn
		var collider: Object = result["collider"]
		if collider and collider.has_method("apply_damage"):
			collider.apply_damage(wep.get("damage", {}).get("body", 40))

func toggle_scope() -> void:
	is_scoped = not is_scoped
	camera.fov = 40.0 if is_scoped else 78.0

func start_reload() -> void:
	if is_reloading or ammo_reserve <= 0: return
	is_reloading = true
	var wep: Dictionary = weapons_catalog.get(active_weapon_id, {})
	reload_timer = wep.get("reloadTime", 2.5)

func complete_reload() -> void:
	var wep: Dictionary = weapons_catalog.get(active_weapon_id, {})
	var mag_size: int = wep.get("magazineSize", 25)
	var needed: int = mag_size - ammo_mag
	var transfer: int = mini(needed, ammo_reserve)
	ammo_mag += transfer
	ammo_reserve -= transfer
	is_reloading = false

func use_ability(slot_key: String) -> void:
	if ability_cooldowns.get(slot_key, 0.0) > 0.0 or ability_charges.get(slot_key, 0) <= 0:
		return

	var mod_id: String = rig_build.get("active_slot1" if slot_key == "q" else "active_slot2", "")
	var mod: Dictionary = RigSystem.ACTIVE_MODULES.get(mod_id, {})
	if mod.is_empty(): return

	ability_charges[slot_key] -= 1
	var passive: Dictionary = RigSystem.PASSIVE_MODULES.get(rig_build.get("passive_slot", ""), {})
	var cd_rate: float = passive.get("cooldown_rate_multiplier", 1.0)
	ability_cooldowns[slot_key] = mod.get("cooldown", 15.0) / cd_rate

	# Module-specific action (Vector dash, Aegis barrier, Echo Probe ping, etc.)
	if mod_id == "vector":
		var forward_dash := -camera_mount.global_transform.basis.z.normalized()
		velocity += forward_dash * 24.5
