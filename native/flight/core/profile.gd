extends RefCounted
const Blueprint = preload("res://core/blueprint.gd")
const MAX_BYTES: int = 2097152
const CURRENT_FILE: String = "profile.json"
const BACKUP_FILE: String = "profile.backup.json"

static func defaults() -> Dictionary:
 var bp: Dictionary = Blueprint.starter()
 return {"version":1,"blueprints":[bp.duplicate(true)],"current":bp,"completed":[],"discovered":[],"settings":{"master_volume":.6,"invert_pitch":false,"bindings":{}}}

static func save(folder: String, data: Dictionary) -> Dictionary:
 var valid: Dictionary = _validate(data)
 if not valid.ok:
  return valid
 var serialized: String = JSON.stringify(data,"  ",true,true)
 if serialized.to_utf8_buffer().size() > MAX_BYTES:
  return _bad("Profile is too large.")
 if folder.is_empty():
  return _bad("No profile folder was provided.")
 var directory_error: Error = DirAccess.make_dir_recursive_absolute(folder)
 if directory_error != OK:
  return _bad("Cannot create profile folder (%s)." % error_string(directory_error))
 var path: String = folder.path_join(CURRENT_FILE)
 var temp: String = folder.path_join("profile.tmp")
 var written: Dictionary = _write(temp,serialized)
 if not written.ok:
  return written
 # Only a validated current file may replace the last known valid backup.
 # If a corrupt current was recovered, preserve the existing backup verbatim.
 var previous: Dictionary = _read(path)
 if previous.ok:
  var backup_temp: String = folder.path_join("profile.backup.tmp")
  written = _write(backup_temp,JSON.stringify(previous.profile,"  ",true,true))
  if not written.ok:
   DirAccess.remove_absolute(temp)
   return written
  var backup_error: Error = DirAccess.rename_absolute(backup_temp,folder.path_join(BACKUP_FILE))
  if backup_error != OK:
   DirAccess.remove_absolute(temp)
   DirAccess.remove_absolute(backup_temp)
   return _bad("Cannot update profile backup (%s)." % error_string(backup_error))
 var rename_error: Error = DirAccess.rename_absolute(temp,path)
 if rename_error != OK:
  DirAccess.remove_absolute(temp)
  return _bad("Cannot atomically replace profile (%s)." % error_string(rename_error))
 return {"ok":true,"error":""}

static func load_profile(folder: String) -> Dictionary:
 if folder.is_empty():
  return {"profile":defaults(),"recovered":false,"error":"No profile folder was provided."}
 var current: Dictionary = _read(folder.path_join(CURRENT_FILE))
 if current.ok:
  return {"profile":current.profile,"recovered":false,"error":""}
 var backup: Dictionary = _read(folder.path_join(BACKUP_FILE))
 if backup.ok:
  return {"profile":backup.profile,"recovered":true,"error":"Recovered the previous valid profile. " + current.error}
 if not current.exists and not backup.exists:
  return {"profile":defaults(),"recovered":false,"error":""}
 return {"profile":defaults(),"recovered":false,"error":"No valid saved profile could be loaded. " + current.error + " " + backup.error}

static func _write(path: String, text: String) -> Dictionary:
 var file: FileAccess = FileAccess.open(path,FileAccess.WRITE)
 if file == null:
  return _bad("Cannot write profile temporary file (%s)." % error_string(FileAccess.get_open_error()))
 file.store_string(text)
 file.flush()
 var write_error: Error = file.get_error()
 file.close()
 if write_error != OK:
  DirAccess.remove_absolute(path)
  return _bad("Profile write failed (%s)." % error_string(write_error))
 return {"ok":true,"error":""}

static func _read(path: String) -> Dictionary:
 if not FileAccess.file_exists(path):
  return {"ok":false,"exists":false,"error":"Saved file is missing."}
 var file: FileAccess = FileAccess.open(path,FileAccess.READ)
 if file == null:
  return {"ok":false,"exists":true,"error":"Cannot read saved profile."}
 if file.get_length() > MAX_BYTES:
  file.close()
  return {"ok":false,"exists":true,"error":"Saved profile is too large."}
 var text: String = file.get_as_text()
 file.close()
 var parser = JSON.new()
 if parser.parse(text) != OK or not parser.data is Dictionary:
  return {"ok":false,"exists":true,"error":"Saved profile contains malformed JSON."}
 var valid: Dictionary = _validate(parser.data)
 if not valid.ok:
  return {"ok":false,"exists":true,"error":valid.error}
 return {"ok":true,"exists":true,"profile":parser.data,"error":""}

static func _validate(data: Dictionary) -> Dictionary:
 var version = data.get("version")
 if not _json_safe(data,0) or not (version is int or version is float) or float(version) != 1.0:
  return _bad("Unsupported or malformed profile version.")
 if not data.get("current") is Dictionary or not Blueprint.validate(data.current).ok:
  return _bad("Current aircraft blueprint is invalid.")
 if not data.get("blueprints") is Array or data.blueprints.size() > 32:
  return _bad("Saved aircraft list is invalid or too large.")
 for bp in data.blueprints:
  if not bp is Dictionary or not Blueprint.validate(bp).ok:
   return _bad("A saved aircraft blueprint is invalid.")
 for field in ["completed","discovered"]:
  if not data.get(field) is Array or data[field].size() > 256:
   return _bad("Profile progress list is invalid or too large.")
  var seen: Dictionary = {}
  for item in data[field]:
   if not item is String or item.is_empty() or item.length() > 80 or seen.has(item):
    return _bad("Profile progress ids must be unique nonempty strings.")
   seen[item] = true
 if not data.get("settings") is Dictionary:
  return _bad("Profile settings are missing.")
 var settings: Dictionary = data.settings
 var volume = settings.get("master_volume")
 if not (volume is float or volume is int) or not is_finite(float(volume)) or float(volume) < 0 or float(volume) > 1:
  return _bad("Master volume must be between zero and one.")
 if not settings.get("invert_pitch") is bool or not settings.get("bindings") is Dictionary or settings.bindings.size() > 64:
  return _bad("Control settings are malformed.")
 for key in settings.bindings:
  if not key is String or key.is_empty() or key.length() > 80:
   return _bad("Control action name is invalid.")
  var value = settings.bindings[key]
  if value is String:
   if value.is_empty() or value.length() > 128:
    return _bad("Control binding is invalid.")
  elif value is Array:
   if value.size() > 16:
    return _bad("Too many inputs assigned to one control.")
   for token in value:
    if not token is String or token.is_empty() or token.length() > 128:
     return _bad("Control binding is invalid.")
  else:
   return _bad("Control binding is invalid.")
 return {"ok":true,"error":""}

static func _json_safe(value: Variant, depth: int) -> bool:
 if depth > 10:
  return false
 if value == null or value is bool:
  return true
 if value is int or value is float:
  return is_finite(float(value))
 if value is String:
  return value.length() <= 4096
 if value is Array:
  if value.size() > 256:
   return false
  for item in value:
   if not _json_safe(item,depth+1):
    return false
  return true
 if value is Dictionary:
  if value.size() > 256:
   return false
  for key in value:
   if not key is String or key.length() > 80 or not _json_safe(value[key],depth+1):
    return false
  return true
 return false

static func _bad(message: String) -> Dictionary:
 return {"ok":false,"error":message}
