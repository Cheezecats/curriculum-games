extends Node

const InputBindings = preload("res://core/input_bindings.gd")

var test_mode = false
var profile_dir = "user://profile"
var startup_audio_driver = ""

func _init():
	var args = OS.get_cmdline_user_args()
	test_mode = "--test-muted" in args or DisplayServer.get_name() == "headless"
	for arg in args:
		if arg.begins_with("--profile-dir="):
			profile_dir = arg.trim_prefix("--profile-dir=")
	if test_mode and profile_dir == "user://profile":
		profile_dir = "/private/tmp/flight-islands-test-profile"
	if test_mode:
		AudioServer.set_bus_mute(0, true)
	startup_audio_driver = AudioServer.get_driver_name()
	if test_mode and startup_audio_driver != "Dummy":
		push_error("Silent tests require --audio-driver Dummy before startup. Refusing audible session.")
		Engine.time_scale = 0.0
		call_deferred("_unsafe_audio_exit")

func _unsafe_audio_exit():
	get_tree().quit(86)

func _process(_dt):
	if test_mode and not AudioServer.is_bus_mute(0):
		AudioServer.set_bus_mute(0, true)

func _input(event: InputEvent) -> void:
	var normalized: InputEvent = InputBindings.normalize_event(event)
	if normalized != event:
		get_viewport().set_input_as_handled()
		Input.parse_input_event(normalized)
		# Nested dispatch resets the viewport handled flag; consume the original again.
		get_viewport().set_input_as_handled()
