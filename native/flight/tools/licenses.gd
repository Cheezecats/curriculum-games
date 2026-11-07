extends SceneTree
func _initialize():
 var file=FileAccess.open("res://THIRD_PARTY_NOTICES.txt",FileAccess.WRITE)
 file.store_string("Flight Islands native alpha\n\nOriginal code: MIT (repository LICENSE). Original art and educational prose: CC BY4.0.\nArt attribution: Flight Islands / Curriculum Games contributors, https://github.com/Cheezecats/curriculum-games\nNo downloaded art or audio packs. Audio is synthesized by the original game code.\n\nGodot Engine 4.7.2 and bundled libraries\n======================================\n\n")
 file.store_string(Engine.get_license_text()+"\n\n")
 for item in Engine.get_copyright_info():
  file.store_string(str(item)+"\n\n")
 for title in Engine.get_license_info():
  file.store_string("\n"+title+"\n"+Engine.get_license_info()[title]+"\n")
 file.close();quit()
