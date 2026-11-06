# Flight Islands original art library

26 original procedural GLBs: twelve aircraft part families in `models/` and fourteen airfield/coastal/landscape props in `environment/`. All geometry and materials were authored for this project by the included generator. No downloaded meshes, textures, or third-party asset licenses are involved. The project owner controls distribution of these generated assets.

## Rebuild and edit

From the repository root, run:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python native/flight/tools/generate_art.py
```

Blender 5.1.2 was used for the verified build. The script accepts `-- --exports-only` for a quick GLB/manifest rebuild without rendering or replacing the master. The full command exports all models, renders four inspection scenes, and saves `source/flight_islands_master.blend`. Its source collections contain the original editable meshes, and its separate scenes show the aircraft kit, airfield, a composed aircraft, and the coastal landmarks. Source and preview folders contain `.gdignore` so Godot imports only the production GLBs.

## Coordinates and integration

- Metres, +Y up, -Z aircraft forward, +X right. Aircraft root origins are at their physical part centres. Environment origins sit at ground centre. The hangar opens toward +Z.
- The GLBs have identity root rotations/scales. Moving parents are named exactly `Propeller` (motor, local Z rotation), `Wheel` (gear, local X rotation), and `Flap` (aileron/elevator, local X rotation; rudder, local Y rotation). Each moving parent has an identity rotation and a hinge translation; meshes are local to that hinge. Rest geometry is exported without animation tracks.
- Material `Paint` is the exposed muted vermilion finish. Other shared materials are `Ivory`, `Navy`, `Aluminium`, `Wood`, `WoodLight`, `Brass`, `Rubber`, `Glass`, and landscape materials. Materials use embedded PBR colors; no raster textures or external dependencies.
- The blue canopy is an opaque reflective stylization for predictable sorting and distant readability. Its bubble and framing are authored geometry.
- Thin surfaces approximate their physical AABBs. Minor trim/rivet protrusions are documented by actual bounds in `source/asset_manifest.json`. The hangar measures approximately 18.05 m wide, 14.49 m deep and 8.03 m high, with a wide unobstructed portal. Runtime collision geometry remains the game's responsibility.

## Art direction

The kit uses curved sectional fuselage shells, cambered closed airfoils with red tips and rib seams, framed bubble canopy, ribbed cowling and laminated wooden three-blade propeller, rounded battery with straps and brass terminals, articulated forks and rounded tyre/hub geometry, and a wood/metal cargo cradle. Airfield architecture repeats the ivory, navy and red palette through a corrugated barrel-vault hangar, braced observation tower, striped windsock, gooseneck lamps, steel drums and amber markers. Coastal additions include a pitched-roof cottage with framed windows, chimney and doorsteps; a curved fishing hull with wheelhouse, rigging and deck furniture; a tapered banded lighthouse with railed gallery and lantern; and an irregular stone arch with a real open tunnel and moss shelves. Landscape silhouettes use irregular bough rings and clustered broadleaf crowns.

`previews/aircraft_kit.png`, `previews/assembled_aircraft.png`, `previews/airfield_props.png`, and `previews/coastal_props.png` are actual Cycles renders of these meshes, not generated concept images. The assembled aircraft is an inspection arrangement of kit parts, not an extra gameplay asset.

## Performance and verification

Geometry is batched by material and moving parent. Each aircraft part has 3–6 material primitives, approximately 3–6 base-pass draws per visible instance when the renderer does not batch them. Draws multiply with visible instances and material surfaces; shadow and additional rendering passes add work. The 128-part build cap counts aircraft parts and is independent of draw count. These are exported asset counts, not measured runtime GPU counters, and do not promise a frame rate. The manifest records source vertices, exported vertices, triangles, actual bounds, node names and GLB byte sizes. GLB JSON/buffer integrity, identity coordinate transforms, animation node uniqueness and physical bounds were independently audited after export. Blender render output was visually inspected. Godot import, lighting, runtime articulation and performance require integration checks in the game.
