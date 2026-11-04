extends Control

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _on_deploy_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main_arena.tscn")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("fire") or (event is InputEventKey and event.pressed and event.keycode == KEY_ENTER):
		_on_deploy_pressed()
