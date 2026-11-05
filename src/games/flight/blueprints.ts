export type PartKind = 'cockpit' | 'structure' | 'wing' | 'control' | 'engine' | 'battery' | 'cargo' | 'skid';
export interface Part {
    id: string;
    kind: PartKind;
    x: number;
    y: number;
    z: number;
    rotation: number;
}
export interface Blueprint {
    version: 1;
    name: string;
    parts: Part[];
}
export const PARTS: Record<PartKind, {
    label: string;
    mass: number;
    color: number;
    area: number;
}> = { cockpit: { label: 'Cockpit', mass: 2, color: 0x1e6a61, area: .3 }, structure: { label: 'Fuselage', mass: .7, color: 0xf5f3ec, area: .1 }, wing: { label: 'Wing', mass: .45, color: 0xe7ed91, area: .35 }, control: { label: 'Control surface', mass: .35, color: 0xf1a078, area: .35 }, engine: { label: 'Motor', mass: 2, color: 0x172f35, area: .1 }, battery: { label: 'Battery', mass: 2, color: 0x1e6a61, area: .2 }, cargo: { label: 'Cargo', mass: 3, color: 0xcf956d, area: .3 }, skid: { label: 'Skid', mass: .6, color: 0x6c7a79, area: .05 } };
export function validateBlueprint(value: unknown): Blueprint {
    if (!value || typeof value !== 'object')
        throw Error('Choose an aircraft JSON file.');
    const b = value as Blueprint;
    if (b.version !== 1 || typeof b.name !== 'string' || b.name.length > 80 || !Array.isArray(b.parts) || b.parts.length < 1 || b.parts.length > 128)
        throw Error('Aircraft needs 1–128 parts and a short name.');
    const occupied = new Set<string>(), ids = new Set<string>();
    for (const p of b.parts) {
        if (!p || !Object.hasOwn(PARTS, p.kind) || typeof p.id !== 'string' || p.id.length > 80 || ids.has(p.id) || ![p.x, p.y, p.z].every(v => Number.isInteger(v) && Math.abs(v) <= 32) || !Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 3)
            throw Error('Invalid part, coordinate, or duplicate identifier.');
        const key = `${p.x},${p.y},${p.z}`;
        if (occupied.has(key))
            throw Error('Two parts occupy the same cell.');
        occupied.add(key);
        ids.add(p.id);
    }
    const seen = new Set<string>(), queue = [b.parts[0]];
    while (queue.length) {
        const p = queue.pop()!;
        if (seen.has(p.id))
            continue;
        seen.add(p.id);
        for (const q of b.parts)
            if (!seen.has(q.id) && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + Math.abs(q.z - p.z) === 1)
                queue.push(q);
    }
    if (seen.size !== b.parts.length)
        throw Error('Connect every part by a face.');
    return structuredClone(b);
}
export function massProperties(b: Blueprint) { let mass = 0; const com = { x: 0, y: 0, z: 0 }; for (const p of b.parts) {
    const m = PARTS[p.kind].mass;
    mass += m;
    com.x += m * p.x;
    com.y += m * p.y;
    com.z += m * p.z;
} for (const a of ['x', 'y', 'z'] as const)
    com[a] /= mass; const inertia = { x: 0, y: 0, z: 0 }; for (const p of b.parts) {
    const m = PARTS[p.kind].mass, dx = p.x - com.x, dy = p.y - com.y, dz = p.z - com.z;
    inertia.x += m * (1 / 6 + dy * dy + dz * dz);
    inertia.y += m * (1 / 6 + dx * dx + dz * dz);
    inertia.z += m * (1 / 6 + dx * dx + dy * dy);
} return { mass, com, inertia }; }
function craft(name: string, motor: boolean, payload = false): Blueprint { const parts: Part[] = []; const add = (kind: PartKind, x: number, y: number, z: number, rotation = 0) => parts.push({ id: `p${parts.length}`, kind, x, y, z, rotation }); add('cockpit', 0, 0, 0); add('structure', -1, 0, 0); add('structure', -2, 0, 0); add('structure', 1, 0, 0); for (const z of [-3, -2, -1, 1, 2, 3])
    add('wing', 0, 0, z); for (const z of [-1, 1])
    add('control', -2, 0, z); add('control', -2, 1, 0, 1); add('skid', 0, -1, 0); if (!motor)
    add('cargo', 2, 0, 0); if (motor) {
    add('engine', 2, 0, 0);
    add('battery', -1, 1, 0);
} if (payload)
    add('cargo', 0, 1, 0); return { version: 1, name, parts }; }
export const PRESETS = [craft('01 · Valley glider', false), craft('02 · Island scout', true), craft('03 · Cargo courier', true, true)];
