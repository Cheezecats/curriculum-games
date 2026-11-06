import { Quaternion, Vector3, type QuaternionLike } from 'three';

export interface ChaseHeading {
  angle: number | null;
}

export function chaseOffset(
  rotation: QuaternionLike,
  heading: ChaseHeading = { angle: null },
  dt = 1 / 60,
) {
  const q = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    forward = new Vector3(1, 0, 0).applyQuaternion(q);
  forward.y = 0;
  // Heading is undefined near vertical flight. Keep the last reliable heading there;
  // a newly opened view can recover it from the aircraft's projected right axis.
  const reliable = forward.lengthSq() >= 0.01;
  if (heading.angle === null) {
    if (!reliable) {
      const right = new Vector3(0, 0, 1).applyQuaternion(q);
      forward.set(right.z, 0, -right.x);
    }
    heading.angle = Math.atan2(forward.z, forward.x);
  } else if (reliable) {
    const desired = Math.atan2(forward.z, forward.x),
      difference = Math.atan2(Math.sin(desired - heading.angle), Math.cos(desired - heading.angle)),
      maxTurn = 2.5 * Math.max(0, dt);
    // Limit heading changes even when position damping is disabled for reduced motion.
    heading.angle += Math.max(-maxTurn, Math.min(maxTurn, difference));
  }
  forward.set(Math.cos(heading.angle), 0, Math.sin(heading.angle));
  const right = new Vector3(-forward.z, 0, forward.x);
  return forward
    .multiplyScalar(-14)
    .addScaledVector(right, 8)
    .add(new Vector3(0, 7, 0));
}

export function aircraftFocus(
  localCom: { x: number; y: number; z: number },
  position: { x: number; y: number; z: number },
  rotation: QuaternionLike,
) {
  return new Vector3(localCom.x, localCom.y, localCom.z)
    .applyQuaternion(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
    .add(new Vector3(position.x, position.y, position.z));
}

export function followCamera(current: Vector3, target: Vector3, dt: number, reducedMotion = false) {
  return reducedMotion
    ? current.copy(target)
    : current.lerp(target, 1 - Math.exp(-5 * Math.max(0, dt)));
}

export class OrbitGesture {
  private start: { x: number; y: number } | null = null;
  private dragged = false;
  begin(x: number, y: number) {
    this.start = { x, y };
    this.dragged = false;
  }
  move(x: number, y: number) {
    if (this.start && Math.hypot(x - this.start.x, y - this.start.y) >= 4) this.dragged = true;
  }
  end() {
    const click = this.start !== null && !this.dragged;
    this.start = null;
    return click;
  }
}
