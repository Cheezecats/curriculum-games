extends RefCounted
## Deliberately simplified, dissipative aerodynamics in SI units.
const DENSITY = 1.225
const EFFICIENCY = 0.72

static func surface_force(velocity: Vector3, axes: Basis, area: float, deflection: float, vertical: bool) -> Dictionary:
	var speed = velocity.length()
	if speed < .01 or area <= 0:
		return {"force":Vector3.ZERO,"stall":false,"alpha":0.0}
	var local = axes.transposed() * velocity
	var alpha = atan2(local.x if vertical else -local.y, -local.z) + deflection + (0.0 if vertical else .07)
	alpha = wrapf(alpha, -PI, PI)
	var stalled = abs(alpha) > .30
	var cl = clampf(alpha * 5.0, -1.45, 1.45)
	if stalled:
		cl = lerpf(cl, sin(2.0 * alpha) * .90, smoothstep(.30, .65, absf(alpha)))
	var cd = .028 + .065 * cl * cl + .55 * pow(sin(alpha), 2)
	var span = axes.y if vertical else axes.x
	var planar = velocity - span * velocity.dot(span)
	var lift_direction = span.cross(planar).normalized()
	var q = .5 * DENSITY * speed * speed * area
	return {"force":lift_direction * (q * cl) - velocity / speed * (q * cd),"stall":stalled,"alpha":alpha}

static func engine_force(throttle: float, maximum: float, forward_speed: float, energy: float, dt: float) -> Dictionary:
	var requested = maximum * clampf(throttle, 0.0, 1.0)
	if requested <= 0 or energy <= 0 or dt <= 0:
		return {"thrust":0.0,"used":0.0}
	var wanted = (requested * maxf(6.0, forward_speed) / EFFICIENCY + 20.0 * throttle) * dt
	var used = minf(wanted, energy)
	return {"thrust":requested * used / wanted,"used":used}
