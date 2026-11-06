extends SceneTree
const Parts = preload("res://core/parts.gd")
const Blueprint = preload("res://core/blueprint.gd")
const Mass = preload("res://core/mass_properties.gd")
const History = preload("res://core/history.gd")
const Profile = preload("res://core/profile.gd")
const Contracts = preload("res://core/contracts.gd")
var checks: int = 0
var failures: int = 0

func _initialize() -> void:
 test_catalog()
 test_blueprint()
 test_blueprint_limits()
 test_mass()
 test_scaled_cargo()
 test_tensor_reconstruction_stress()
 test_history()
 test_profile()
 test_cargo_delivery()
 print("CORE TESTS: %d checks, %d failures" % [checks, failures])
 quit(1 if failures else 0)

func expect(value: bool, message: String) -> void:
 checks += 1
 if not value:
  failures += 1
  print("FAIL: ", message)

func near(actual: float, expected: float, message: String, tolerance: float = 0.0001) -> void:
 expect(absf(actual - expected) <= tolerance, "%s (actual %.7f expected %.7f)" % [message, actual, expected])

func fixture() -> Dictionary:
 return {"version":1,"name":"Fixture","paint":"c94638","parts":[{"id":"c","kind":"cockpit","p":[0.0,0.0,0.0],"r":[0.0,0.0,0.0]},{"id":"b","kind":"battery","p":[0.6,0.3,0.0],"r":[0.0,0.0,0.0]}]}

func test_catalog() -> void:
 expect(Parts.kinds().size() == 12, "catalog has exactly twelve parts")
 near(Parts.definition("cockpit").get("mass", 0), 4.0, "cockpit mass")
 near(Parts.definition("motor").get("thrust", 0), 65.0, "motor real thrust")
 near(Parts.definition("battery").get("energy", 0), 120000.0, "battery energy (root-calibrated accessible route capacity)")
 expect(Parts.definition("unknown").is_empty(), "unknown part rejected")
 var d = Parts.definition("cockpit")
 d["mass"] = 999
 near(Parts.definition("cockpit").get("mass", 0), 4.0, "catalog return cannot mutate catalog")

func test_blueprint() -> void:
 expect(Blueprint.validate(fixture()).ok, "connected fixture accepted")
 var starter = Blueprint.starter()
 expect(Blueprint.validate(starter).ok, "starter is valid connected trainer")
 var counts: Dictionary = {}
 for p in starter.get("parts", []):
  counts[p.kind] = counts.get(p.kind, 0) + 1
 expect(counts.get("wing", 0) == 2 and counts.get("gear", 0) == 3 and counts.get("cargo_mount", 0) == 1, "starter has standard wings, landing gear, and real cargo mount")
 var bp = fixture()
 bp.parts[1].id = "c"
 expect(not Blueprint.validate(bp).ok, "duplicate id rejected")
 bp = fixture()
 bp.parts[1].p = [20,0,0]
 expect(not Blueprint.validate(bp).ok, "disconnected part rejected")
 bp = fixture()
 bp.parts[1].p = [0,0,0]
 expect(not Blueprint.validate(bp).ok, "identical centers rejected")
 bp = fixture()
 bp.parts[1].p[0] = NAN
 expect(not Blueprint.validate(bp).ok, "nonfinite coordinates rejected")
 bp = fixture()
 bp.parts[1].r[0] = 45
 expect(not Blueprint.validate(bp).ok, "nonquarter rotation rejected")
 bp = fixture()
 bp.parts[1].r[2] = 90
 expect(Blueprint.validate(bp).ok, "connected rotated shape accepted")
 expect(Blueprint.position({"p":[1,2,-3]}) == Vector3(1,2,-3), "position coordinate convention")
 expect((Blueprint.basis({"r":[0,90,0]}) * Vector3.FORWARD).is_equal_approx(Vector3.LEFT), "degree rotation conversion")
 for malformed in [{}, {"version":2,"name":"bad","paint":"ffffff","parts":[]}, {"version":1,"name":"bad","paint":"zzzzzz","parts":[]}]:
  expect(not Blueprint.validate(malformed).ok, "malformed blueprint rejected")

func test_blueprint_limits() -> void:
 var bp = fixture()
 bp.parts[1].kind = "unknown"
 expect(not Blueprint.validate(bp).ok,"unknown component cannot enter assembly")
 bp = fixture()
 bp.parts[0].kind = "battery"
 expect(not Blueprint.validate(bp).ok,"cockpit is required")
 bp = fixture()
 bp.parts[1].kind = "cockpit"
 expect(not Blueprint.validate(bp).ok,"multiple cockpits rejected")
 bp = fixture()
 bp.parts[1].p = [32.01,0,0]
 expect(not Blueprint.validate(bp).ok,"position extent bound enforced")
 bp = fixture()
 bp.parts[1].p = [.7,.6,0]
 expect(Blueprint.validate(bp).ok,"small diagonal physical gap connects")
 bp.parts[1].p = [.75,.65,0]
 expect(not Blueprint.validate(bp).ok,"diagonal Euclidean gap over tolerance does not connect")
 bp = fixture()
 bp.parts.pop_back()
 for i in range(127):
  bp.parts.append({"id":"strut_%d" % i,"kind":"strut","p":[.5+.2*i,0,0],"r":[0,0,0]})
 expect(Blueprint.validate(bp).ok,"maximum connected 128-part aircraft accepted")
 bp.parts.append({"id":"overflow","kind":"strut","p":[25.9,0,0],"r":[0,0,0]})
 expect(not Blueprint.validate(bp).ok,"129th part rejected")

func test_mass() -> void:
 var bp = fixture()
 var m = Mass.compute(bp)
 near(m.mass, 6, "combined mass")
 expect(m.com.is_equal_approx(Vector3(.2,.1,0)), "hand computed asymmetric COM")
 var t: Basis = m.tensor
 near(t.x.x, 1.1854166667, "centroid plus y parallel axis Ixx")
 near(t.y.y, 1.5941666667, "centroid plus x parallel axis Iyy")
 near(t.z.z, 1.11625, "both parallel axes Izz")
 near(t.x.y, -.24, "full inertia negative xy product")
 near(t.y.x, -.24, "inertia is symmetric")
 var axes: Basis = m.axes
 var principal: Vector3 = m.principal
 var rebuilt: Basis = axes * Basis.from_scale(principal) * axes.transposed()
 expect(rebuilt.is_equal_approx(t), "principal eigenvectors reconstruct full tensor")
 expect((axes.transposed() * axes).is_equal_approx(Basis.IDENTITY), "principal axes orthonormal")
 near(axes.determinant(), 1, "principal axes right handed")
 expect(principal.x > 0 and principal.y > 0 and principal.z > 0, "all principal inertia positive")
 # A rotated anisotropic cuboid must exchange local X/Y diagonal inertia.
 var wing = {"version":1,"name":"Wing rotation","paint":"ffffff","parts":[{"id":"c","kind":"cockpit","p":[0,0,0],"r":[0,0,0]},{"id":"w","kind":"wing","p":[.5,.3,0],"r":[0,0,90]}]}
 var rotated = Mass.compute(wing)
 var local_ix = 1.1 * (.14*.14 + .7*.7) / 12
 var local_iy = 1.1 * (2.2*2.2 + .7*.7) / 12
 var reduced = 4.0*1.1/5.1
 near(rotated.tensor.x.x, 4.0*(.8*.8+1.5*1.5)/12 + local_iy + reduced*.3*.3, "rotated cuboid tensor x axis")
 near(rotated.tensor.y.y, 4.0*(.85*.85+1.5*1.5)/12 + local_ix + reduced*.5*.5, "rotated cuboid tensor y axis")
 var trainer = Blueprint.starter()
 var unloaded = Mass.compute(trainer)
 var loaded = Mass.compute(trainer, 18.0)
 var cp = Mass.cargo_position(trainer)
 near(loaded.mass - unloaded.mass, 18, "cargo contributes actual mass")
 if unloaded.mass > 0:
  expect(loaded.com.is_equal_approx((unloaded.com * unloaded.mass + cp * 18.0) / loaded.mass), "cargo moves COM by mass weighting")
 expect(loaded.cargo_position == cp, "cargo position exposed for physics")
 expect(Mass.compute({}, 0).is_empty(), "invalid build mass computation fails safely")
 expect(Mass.compute(trainer, -1).is_empty(), "negative cargo mass rejected")
 expect(Mass.compute(fixture(), 2).is_empty(), "cargo mass requires cargo mount")
 expect(Mass.cargo_position({"parts":false}) == Vector3.ZERO,"malformed cargo helper fails safely")


func test_scaled_cargo() -> void:
 # Root design calibration: constant-density payloads make the introductory
 # parcel smaller while preserving the full 18 kg crate and its mounting point.
 var bp = {"version":1,"name":"Scaled cargo fixture","paint":"ffffff","parts":[{"id":"c","kind":"cockpit","p":[0,0,0],"r":[0,0,0]},{"id":"mount","kind":"cargo_mount","p":[0,-.42,.1],"r":[0,0,0]}]}
 var half: Vector3 = Mass.cargo_size(2.25)
 expect(half.is_equal_approx(Vector3(.4,.325,.425)),"eighth payload mass has exactly half-size dimensions")
 expect(Mass.cargo_size(18) == Vector3(.8,.65,.85),"full payload dimensions unchanged")
 expect(Mass.cargo_size(0) == Vector3.ZERO,"zero payload has zero dimensions")
 for invalid_mass in [-1.0,NAN,INF,-INF]:
  expect(Mass.cargo_size(invalid_mass) == Vector3.ZERO,"invalid payload dimensions fail safely")
  expect(Mass.cargo_position(bp,invalid_mass) == Vector3.ZERO,"invalid payload position fails safely")
  expect(Mass.compute(bp,invalid_mass).is_empty(),"invalid payload mass computation rejected")
 var cp: Vector3 = Mass.cargo_position(bp,2.25)
 expect(cp.is_equal_approx(Vector3(0,-.1625,.1)),"half-height crate center is mount plus .2575 metres")
 expect(Mass.cargo_position(bp) == Blueprint.position(bp.parts[1]) + Vector3(0,.42,0),"default payload position stays backward compatible")
 expect(Mass.cargo_position(bp,18) == Mass.cargo_position(bp),"explicit full payload position equals old default exactly")
 expect(Mass.cargo_position(fixture(),2.25) == Vector3.ZERO,"scaled payload helper requires mount")
 var empty: Dictionary = Mass.compute(bp)
 var loaded: Dictionary = Mass.compute(bp,2.25)
 expect(empty.get("cargo_size",Vector3.ONE) == Vector3.ZERO,"unloaded mass properties expose no cargo volume")
 expect(loaded.get("cargo_size",Vector3.ZERO).is_equal_approx(half),"loaded mass properties expose actual scaled size")
 near(loaded.mass,6.7,"hand scaled cargo total mass")
 # Cockpit4kg at origin + mount.45kg at(0,-.42,.1) + cargo2.25kg at(0,-.1625,.1).
 near(loaded.com.y,(-.45*.42-2.25*.1625)/6.7,"hand scaled cargo COM Y")
 near(loaded.com.z,(.45*.1+2.25*.1)/6.7,"hand scaled cargo COM Z")
 expect(loaded.cargo_position.is_equal_approx(cp),"compute passes actual payload mass to mounting position")
 var empty_com = Vector3(0,-.45*.42/4.45,.45*.1/4.45)
 var delta: Vector3 = Vector3(0,-.1625,.1)-empty_com
 var mu: float = 4.45*2.25/6.7
 var change = Basis(loaded.tensor.x-empty.tensor.x,loaded.tensor.y-empty.tensor.y,loaded.tensor.z-empty.tensor.z)
 near(change.x.x,2.25*(.325*.325+.425*.425)/12.0 + mu*(delta.y*delta.y+delta.z*delta.z),"scaled cuboid Ixx and COM transfer")
 near(change.y.y,2.25*(.4*.4+.425*.425)/12.0 + mu*delta.z*delta.z,"scaled cuboid Iyy and COM transfer")
 near(change.z.z,2.25*(.4*.4+.325*.325)/12.0 + mu*delta.y*delta.y,"scaled cuboid Izz and COM transfer")
 near(change.y.z,-mu*delta.y*delta.z,"scaled cargo off-diagonal COM transfer")
 var full: Dictionary = Mass.compute(bp,18)
 expect(full.get("cargo_size",Vector3.ZERO) == Vector3(.8,.65,.85),"full loaded properties preserve old size exactly")
 var reconstructed: Basis = loaded.axes * Basis.from_scale(loaded.principal) * loaded.axes.transposed()
 expect(reconstructed.is_equal_approx(loaded.tensor),"scaled payload retains full tensor principal reconstruction")

func test_tensor_reconstruction_stress() -> void:
 # Three nonzero products of inertia exercise coupled rotations rather than one 2D eigensystem.
 var bp = fixture()
 bp.parts[1].p = [.6,.3,.5]
 var m = Mass.compute(bp)
 near(m.tensor.x.z,-.4,"hand computed xz product")
 near(m.tensor.y.z,-.2,"hand computed yz product")
 for i in range(32):
  var angle = float(i) * .37
  bp.parts[1].p = [.5*cos(angle),.23*sin(angle*.7),.65*sin(angle)]
  bp.parts[1].r = [90*(i%4),90*((i/4)%4),90*((i/16)%4)]
  m = Mass.compute(bp)
  expect(not m.is_empty(),"rotated connected stress fixture finite")
  if m.is_empty():
   continue
  var axes: Basis = m.axes
  var rebuilt: Basis = axes * Basis.from_scale(m.principal) * axes.transposed()
  expect(rebuilt.is_equal_approx(m.tensor),"coupled Jacobi rotations reconstruct tensor")
  near(axes.determinant(),1,"stress eigenbasis right handed")
  var trace: float = m.tensor.x.x + m.tensor.y.y + m.tensor.z.z
  near(m.principal.x + m.principal.y + m.principal.z,trace,"eigenvalue sum preserves trace")
 # Cargo's own cuboid inertia is essential even when its centre coincides with total COM.
 var single_mount = {"version":1,"name":"Cargo fixture","paint":"ffffff","parts":[{"id":"c","kind":"cockpit","p":[0,0,0],"r":[0,0,0]},{"id":"mount","kind":"cargo_mount","p":[0,-.42,.1],"r":[0,0,0]}]}
 var empty = Mass.compute(single_mount)
 var loaded = Mass.compute(single_mount,18)
 var cp: Vector3 = Mass.cargo_position(single_mount)
 var mu: float = empty.mass*18.0/(empty.mass+18.0)
 var delta: Vector3 = cp-empty.com
 near(loaded.tensor.x.x-empty.tensor.x.x,18.0*(.65*.65+.85*.85)/12.0 + mu*(delta.y*delta.y+delta.z*delta.z),"cargo contributes cuboid inertia and transfer about new COM")

func test_history() -> void:
 var source = fixture()
 var h = History.new(source, "c")
 source.name = "external mutation"
 expect(h.current.get("name", "") == "Fixture", "history owns initial deep copy")
 var invalid = fixture()
 invalid.parts[1].p = [30,0,0]
 expect(not h.apply(invalid, "b").ok and not h.can_undo(), "invalid edit is atomic and adds no undo state")
 for i in range(45):
  var edit = fixture()
  edit.name = "edit %d" % i
  expect(h.apply(edit, "b").ok, "valid edit recorded")
 var undo_count = 0
 while h.can_undo():
  h.undo()
  undo_count += 1
 expect(undo_count == 40, "history preserves exactly forty undo states")
 expect(h.current.get("name", "") == "edit 4", "history evicts oldest states")
 expect(h.selected == "b", "selection travels with state")
 h.redo()
 expect(h.current.get("name", "") == "edit 5", "redo restores state")
 expect(not h.apply(invalid,"c").ok and h.can_redo(),"invalid edit preserves existing redo branch")
 var external = h.current
 external.parts[0].p = [99,99,99]
 expect(Blueprint.validate(h.current).ok,"exposed current does not mutate history internals")
 var branch = fixture()
 branch.name = "branch"
 h.apply(branch,"c")
 expect(not h.can_redo(), "new valid edit clears redo branch")
 branch.name = "mutated"
 expect(h.current.get("name", "") == "branch", "history owns edit deep copy")

func test_profile() -> void:
 var folder = "/private/tmp/flight-islands-core-test-%d" % OS.get_process_id()
 var p = Profile.defaults()
 expect(p.get("version",0) == 1 and p.get("settings",{}).get("master_volume",0) == .6, "profile sane defaults")
 expect(Profile.save(folder,p).ok, "first atomic save")
 var loaded = Profile.load_profile(folder)
 expect(not loaded.recovered and loaded.profile == JSON.parse_string(JSON.stringify(p,"",true,true)), "saved profile round trip")
 p.settings.master_volume = .25
 expect(Profile.save(folder,p).ok, "second atomic save with previous backup")
 var invalid = p.duplicate(true)
 invalid.current = {"version":2}
 expect(not Profile.save(folder,invalid).ok, "malformed profile refused before overwrite")
 invalid = p.duplicate(true)
 invalid.settings.bindings = {"pitch":[{"unsafe":"object"}]}
 expect(not Profile.save(folder,invalid).ok,"binding object rejected before save")
 invalid = p.duplicate(true)
 invalid.version = true
 var invalid_result = Profile.save(folder,invalid)
 expect(invalid_result.has("ok") and not invalid_result.ok and not invalid_result.get("error","").is_empty(),"boolean profile version rejected safely")
 invalid = p.duplicate(true)
 invalid.settings.master_volume = NAN
 expect(not Profile.save(folder,invalid).ok,"nonfinite preference rejected")
 invalid = p.duplicate(true)
 for i in range(257):
  invalid.discovered.append("island_%d" % i)
 expect(not Profile.save(folder,invalid).ok,"unbounded progress list rejected")
 expect(Profile.load_profile(folder).profile == JSON.parse_string(JSON.stringify(p,"",true,true)), "invalid save retains live profile on disk")
 var file = FileAccess.open(folder.path_join("profile.json"),FileAccess.WRITE)
 if file:
  file.store_string("{broken")
  file.close()
 loaded = Profile.load_profile(folder)
 expect(loaded.recovered and loaded.profile.get("settings",{}).get("master_volume",0) == .6, "corrupt current recovers previous known valid backup")
 # Saving after recovery must not copy corrupt current over the known valid backup.
 expect(Profile.save(folder,p).ok, "save after corruption succeeds")
 file = FileAccess.open(folder.path_join("profile.json"),FileAccess.WRITE)
 if file:
  file.store_string("[]")
  file.close()
 expect(Profile.load_profile(folder).recovered, "save preserves valid backup when previous current corrupt")
 file = FileAccess.open(folder.path_join("profile.backup.json"),FileAccess.WRITE)
 if file:
  file.store_string("{}"); file.close()
 loaded = Profile.load_profile(folder)
 expect(not loaded.error.is_empty() and not loaded.profile.is_empty(), "both corrupt returns defaults with explicit error")
 for name in ["profile.json","profile.backup.json","profile.tmp","profile.backup.tmp"]:
  DirAccess.remove_absolute(folder.path_join(name))
 DirAccess.remove_absolute(folder)

func test_cargo_delivery() -> void:
 var entries = Contracts.all()
 expect(entries.size() == 3, "three authored cargo contracts")
 if entries.size() != 3:
  return
 near(entries[1].cargo_mass,18,"heavy cargo real mass")
 expect(Contracts.next_contract([]).id == "first_delivery", "first job unlock order")
 expect(Contracts.next_contract(["first_delivery"]).id == "heavy_cargo", "next incomplete job")
 expect(Contracts.next_contract(["first_delivery","heavy_cargo","ridge_run"]).id == "first_delivery", "practice after campaign")
 var contract = entries[0]
 var evidence = {"cargo_world_position":contract.destination,"grounded":true,"speed":0.5,"crashed":false,"has_cargo":true}
 expect(Contracts.can_deliver(contract,evidence), "actual grounded cargo on pad delivers")
 for change in [{"cargo_world_position":contract.destination + Vector3(0,3.1,0)}, {"cargo_world_position":contract.destination + Vector3(100,0,0)}, {"grounded":false},{"speed":2.0},{"speed":NAN},{"crashed":true},{"has_cargo":false},{"cargo_world_position":Vector3(INF,0,0)},{"cargo_world_position":contract.destination + Vector3(0,-3.1,0)},{"speed":-1.0},{"grounded":1},{"crashed":0},{"has_cargo":1}]:
  var changed = evidence.duplicate(true)
  changed.merge(change,true)
  expect(not Contracts.can_deliver(contract,changed), "cargo delivery rejects invalid real evidence %s" % str(change))
 expect(not Contracts.can_deliver(contract,{}), "missing telemetry never passes delivery")
 var aircraft_only = {"position":contract.destination,"grounded":true,"speed":0,"crashed":false,"has_cargo":true}
 expect(not Contracts.can_deliver(contract,aircraft_only), "aircraft position cannot substitute for actual cargo position")
