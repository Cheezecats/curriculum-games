/** The painted ring and the measured delivery opening share these SI dimensions. */
export const DELIVERY_GATE = { x: 65, y: 37, z: 0, radius: 10, tube: 0.3 } as const;

interface Position {
  x: number;
  y: number;
  z: number;
}

export function crossesDeliveryGate(previous: Position, current: Position) {
  const gate = DELIVERY_GATE;
  if (previous.x >= gate.x || current.x < gate.x) return false;
  const fraction = (gate.x - previous.x) / (current.x - previous.x),
    y = previous.y + (current.y - previous.y) * fraction - gate.y,
    z = previous.z + (current.z - previous.z) * fraction - gate.z,
    aperture = gate.radius - gate.tube;
  return y * y + z * z < aperture * aperture;
}
