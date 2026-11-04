class_name RigSystem
extends RefCounted

## Radiant Protocol // Modular Operator Rig Architecture (Godot 4)
## Enforces 7-energy point budget, module compatibility, and passive modifiers.

const MAX_RIG_ENERGY: int = 7

const ACTIVE_MODULES: Dictionary = {
	"echo_probe": {
		"id": "echo_probe",
		"name": "ECHO PROBE",
		"category": "RECON",
		"energy_cost": 3,
		"credit_cost": 200,
		"cooldown": 16.0,
		"max_charges": 2,
		"duration": 5.5,
		"range": 24.0,
		"device_hp": 80
	},
	"aegis": {
		"id": "aegis",
		"name": "AEGIS",
		"category": "DEFENCE",
		"energy_cost": 4,
		"credit_cost": 300,
		"cooldown": 22.0,
		"max_charges": 1,
		"duration": 18.0,
		"range": 4.0,
		"device_hp": 400
	},
	"mirage": {
		"id": "mirage",
		"name": "MIRAGE",
		"category": "DECEPTION",
		"energy_cost": 2,
		"credit_cost": 150,
		"cooldown": 14.0,
		"max_charges": 2,
		"duration": 7.5,
		"range": 18.0,
		"device_hp": 65
	},
	"vector": {
		"id": "vector",
		"name": "VECTOR",
		"category": "MOBILITY",
		"energy_cost": 4,
		"credit_cost": 250,
		"cooldown": 14.0,
		"max_charges": 1,
		"duration": 0.85,
		"range": 9.5,
		"device_hp": 0
	},
	"static_field": {
		"id": "static_field",
		"name": "STATIC FIELD",
		"category": "CONTROL",
		"energy_cost": 3,
		"credit_cost": 200,
		"cooldown": 17.0,
		"max_charges": 2,
		"duration": 7.0,
		"range": 4.2,
		"device_hp": 90
	},
	"relay": {
		"id": "relay",
		"name": "RELAY",
		"category": "SUPPORT",
		"energy_cost": 2,
		"credit_cost": 150,
		"cooldown": 15.0,
		"max_charges": 2,
		"duration": 12.0,
		"range": 16.0,
		"device_hp": 100
	}
}

const PASSIVE_MODULES: Dictionary = {
	"signal_dampener": {
		"id": "signal_dampener",
		"name": "SIGNAL DAMPENER",
		"recon_duration_multiplier": 0.55,
		"recon_radius_multiplier": 0.75,
		"deployable_hp_multiplier": 1.0,
		"cooldown_rate_multiplier": 1.0
	},
	"reinforced_systems": {
		"id": "reinforced_systems",
		"name": "REINFORCED SYSTEMS",
		"recon_duration_multiplier": 1.0,
		"recon_radius_multiplier": 1.0,
		"deployable_hp_multiplier": 1.30,
		"cooldown_rate_multiplier": 1.0
	},
	"energy_recovery": {
		"id": "energy_recovery",
		"name": "ENERGY RECOVERY",
		"recon_duration_multiplier": 1.0,
		"recon_radius_multiplier": 1.0,
		"deployable_hp_multiplier": 1.0,
		"cooldown_rate_multiplier": 1.18
	}
}

static func calculate_rig_energy(slot1_id: String, slot2_id: String) -> int:
	var cost1: int = ACTIVE_MODULES.get(slot1_id, {}).get("energy_cost", 0)
	var cost2: int = ACTIVE_MODULES.get(slot2_id, {}).get("energy_cost", 0)
	return cost1 + cost2

static func validate_rig_build(build: Dictionary) -> Dictionary:
	var errors: Array[String] = []
	var slot1: String = build.get("active_slot1", "")
	var slot2: String = build.get("active_slot2", "")
	var passive: String = build.get("passive_slot", "")

	if not ACTIVE_MODULES.has(slot1):
		errors.append("Active Slot 1 must have a valid Rig module equipped.")
	if not ACTIVE_MODULES.has(slot2):
		errors.append("Active Slot 2 must have a valid Rig module equipped.")
	if slot1 != "" and slot1 == slot2:
		errors.append("Active Slot 1 and Slot 2 cannot equip duplicate modules.")
	if not PASSIVE_MODULES.has(passive):
		errors.append("Passive Slot must have a valid modification equipped.")

	var total_energy: int = calculate_rig_energy(slot1, slot2)
	if total_energy > MAX_RIG_ENERGY:
		errors.append("Rig Energy Overload: Energy budget exceeded (%d/%d pts exceeds capacity)." % [total_energy, MAX_RIG_ENERGY])

	return {
		"is_valid": errors.is_empty(),
		"total_energy": total_energy,
		"max_energy": MAX_RIG_ENERGY,
		"remaining_energy": maxi(0, MAX_RIG_ENERGY - total_energy),
		"errors": errors
	}

static func can_equip_module_in_slot(build: Dictionary, target_slot: int, candidate_id: String) -> Dictionary:
	var other_slot_id: String = build.get("active_slot2" if target_slot == 1 else "active_slot1", "")
	if candidate_id == other_slot_id:
		return {
			"allowed": false,
			"projected_energy": calculate_rig_energy(build.get("active_slot1", ""), build.get("active_slot2", "")),
			"reason": "%s is already installed in the other slot." % ACTIVE_MODULES[candidate_id]["name"]
		}

	var projected: int = calculate_rig_energy(candidate_id, other_slot_id) if target_slot == 1 else calculate_rig_energy(other_slot_id, candidate_id)
	if projected > MAX_RIG_ENERGY:
		return {
			"allowed": false,
			"projected_energy": projected,
			"reason": "Exceeds %d Rig Energy capacity (%d/%d)." % [MAX_RIG_ENERGY, projected, MAX_RIG_ENERGY]
		}

	return { "allowed": true, "projected_energy": projected }

static func generate_bot_rig_build(archetype: String, chassis_id: String, weapon_id: String) -> Dictionary:
	var s1 := "vector"
	var s2 := "echo_probe"
	var pas := "energy_recovery"

	match archetype:
		"anchor":
			s1 = "aegis"
			s2 = "static_field"
			pas = "reinforced_systems"
		"flanker":
			s1 = "vector"
			s2 = "mirage"
			pas = "signal_dampener"
		_:
			s1 = "vector"
			s2 = "echo_probe"
			pas = "energy_recovery"

	return {
		"id": "bot_rig_%s_%d" % [archetype, randi()],
		"name": "%s RIG" % archetype.to_upper(),
		"chassis_id": chassis_id,
		"active_slot1": s1,
		"active_slot2": s2,
		"passive_slot": pas,
		"primary_weapon": weapon_id,
		"secondary_weapon": "classic"
	}
