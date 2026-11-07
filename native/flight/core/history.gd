extends RefCounted
const Blueprint = preload("res://core/blueprint.gd")
const LIMIT: int = 40
var _current: Dictionary = {}
var current: Dictionary:
 get:
  return _current.duplicate(true)
var selected: String = ""
var _undo: Array[Dictionary] = []
var _redo: Array[Dictionary] = []

func _init(initial: Dictionary, selected_id: String) -> void:
 _current = (initial if Blueprint.validate(initial).ok else Blueprint.starter()).duplicate(true)
 selected = _selection(_current,selected_id)

func can_undo() -> bool:
 return not _undo.is_empty()

func can_redo() -> bool:
 return not _redo.is_empty()

func apply(bp: Dictionary, selected_id: String) -> Dictionary:
 var validation: Dictionary = Blueprint.validate(bp)
 if not validation.ok:
  return validation
 _undo.append(_snapshot())
 if _undo.size() > LIMIT:
  _undo.pop_front()
 _redo.clear()
 _current = bp.duplicate(true)
 selected = _selection(_current,selected_id)
 return {"ok":true,"error":""}

func undo() -> void:
 if _undo.is_empty():
  return
 _redo.append(_snapshot())
 _restore(_undo.pop_back())

func redo() -> void:
 if _redo.is_empty():
  return
 _undo.append(_snapshot())
 _restore(_redo.pop_back())

func _snapshot() -> Dictionary:
 return {"blueprint":_current.duplicate(true),"selected":selected}

func _restore(snapshot: Dictionary) -> void:
 _current = snapshot.blueprint.duplicate(true)
 selected = snapshot.selected

func _selection(bp: Dictionary, requested: String) -> String:
 for part in bp.parts:
  if part.id == requested:
   return requested
 return ""
