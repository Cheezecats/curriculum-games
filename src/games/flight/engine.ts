import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three';
import { massProperties, PARTS, type Blueprint } from './blueprints';
export const STEP = 1 / 120;
let ready: Promise<void> | undefined;
export const initPhysics = () => ready ??= (RAPIER.init().then(() => { }));
export function dragForce(v: {
    x: number;
    y: number;
    z: number;
}, area: number) { const speed = Math.hypot(v.x, v.y, v.z), k = -.5 * 1.225 * .008 * area * speed; return { x: k * v.x, y: k * v.y, z: k * v.z }; }
export interface Metrics {
    [key: string]: number;
}
export function missionPassed(id: string, m: Metrics) { switch (id) {
    case 'flight-1': return m.time >= 4 && m.distance >= 45 && !m.crashed;
    case 'flight-2': return m.benchRuns >= 1 && Math.abs(m.acceleration / m.expectedAcceleration - 1) < .03;
    case 'flight-3': return m.time >= 4 && m.distance >= 65 && m.delivered === 1 && m.payload >= 3 && m.maxRoll < .6 && !m.crashed;
    case 'flight-4': return m.time >= 5 && m.distance >= 60 && m.energyUsed < 6000 && !m.crashed;
    case 'flight-5': return m.benchRuns >= 1 && m.balanceError < .01;
    case 'flight-6': return m.benchRuns >= 2 && m.inertiaRatio > 1.2 && Math.abs(m.angularRatio * m.inertiaRatio - 1) < .08;
    default: return false;
} }
export interface Options {
    gravity?: boolean;
    aero?: boolean;
    ground?: boolean;
    velocity?: number;
}
export class FlightEngine {
    world!: RAPIER.World;
    body!: RAPIER.RigidBody;
    mass;
    energy = 0;
    initialEnergy = 0;
    time = 0;
    throttle = 0;
    pitch = 0;
    roll = 0;
    yaw = 0;
    accumulator = 0;
    paused = false;
    disposed = false;
    crashed = false;
    landed = false;
    delivered = false;
    maxRoll = 0;
    externalForce = { x: 0, y: 0, z: 0 };
    forces: {
        position: Vector3;
        force: Vector3;
        kind: string;
    }[] = [];
    constructor(public blueprint: Blueprint, public options: Options = {}) { this.mass = massProperties(blueprint); this.create(); }
    private create() { this.world = new RAPIER.World({ x: 0, y: this.options.gravity === false ? 0 : -9.81, z: 0 }); this.world.timestep = STEP; this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 36, 0).setCanSleep(false)); for (const p of this.blueprint.parts)
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(.48, .48, .48).setTranslation(p.x, p.y, p.z).setMass(PARTS[p.kind].mass).setFriction(.65).setRestitution(.05), this.body); this.body.recomputeMassPropertiesFromColliders(); this.body.setLinvel({ x: this.options.velocity ?? 18, y: 0, z: 0 }, true); if (this.options.ground !== false) {
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(600, 1, 180).setTranslation(250, -1, 0));
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 16, 12).setTranslation(-8, 16, 0));
    } this.initialEnergy = this.blueprint.parts.filter(p => p.kind === 'battery').length * 60000; this.energy = this.initialEnergy; }
    advance(dt: number) { if (this.paused || this.disposed || this.crashed || this.landed)
        return; this.accumulator += Math.min(Math.max(dt, 0), 10); while (this.accumulator + 1e-10 >= STEP) {
        this.step();
        this.accumulator -= STEP;
        if (this.crashed || this.landed)
            break;
    } }
    private step() {
        this.forces = [];
        const rot = this.body.rotation(), q = new Quaternion(rot.x, rot.y, rot.z, rot.w), inv = q.clone().invert(), pos = this.body.translation(), v = this.body.linvel(), omega = this.body.angvel();
        let power = 0;
        for (const p of this.blueprint.parts) {
            const local = new Vector3(p.x, p.y, p.z), offset = local.clone().sub(new Vector3(this.mass.com.x, this.mass.com.y, this.mass.com.z)).applyQuaternion(q), point = local.clone().applyQuaternion(q).add(new Vector3(pos.x, pos.y, pos.z));
            const velocity = new Vector3(v.x, v.y, v.z).add(new Vector3(omega.x, omega.y, omega.z).cross(offset)), lv = velocity.clone().applyQuaternion(inv);
            const force = new Vector3();
            if (this.options.aero !== false) {
                const d = dragForce(lv, PARTS[p.kind].area);
                force.set(d.x, d.y, d.z);
                if (p.kind === 'wing' || p.kind === 'control') {
                    const vertical = p.rotation % 2 === 1;
                    const deflection = p.kind === 'control' ? (vertical ? this.yaw * .12 : -this.pitch * .16) : -this.roll * Math.sign(p.z) * .06;
                    const flow = vertical ? lv.z : lv.y;
                    const alpha = Math.atan2(-flow, Math.max(1, lv.x)) + (p.kind === 'wing' ? .06 : 0) + deflection;
                    const cl = Math.abs(alpha) < .30 ? 5.2 * alpha : Math.sign(alpha) * 1.56 * Math.max(.12, Math.cos(Math.min(Math.PI / 2, Math.abs(alpha))));
                    const lift = .5 * 1.225 * lv.x * Math.abs(lv.x) * PARTS[p.kind].area * cl;
                    const flowSpeed = Math.hypot(lv.x, flow) || 1;
                    force[vertical ? 'z' : 'y'] += lift * lv.x / flowSpeed;
                    force.x -= lift * flow / flowSpeed;
                    force.x -= Math.abs(lift) * (.035 + .08 * Math.abs(cl));
                }
            }
            if (p.kind === 'engine' && this.energy > 0) {
                const thrust = 24 * this.throttle;
                const demand=thrust * Math.max(5, Math.abs(lv.x)) / .72 + 20 * this.throttle;
                const fraction=demand>0?Math.min(1,Math.max(0,this.energy/STEP-power)/demand):0;
                force.x += thrust*fraction;
                power += demand*fraction;
            }
            force.applyQuaternion(q);
            this.body.addForceAtPoint(force, point, true);
            this.forces.push({ position: point, force: force.clone(), kind: p.kind });
        }
        this.body.addForce(this.externalForce, true);
        this.energy = Math.max(0, this.energy - power * STEP);
        this.world.step();
        this.body.resetForces(true);
        this.body.resetTorques(true);
        this.time += STEP;
        const up = new Vector3(0, 1, 0).applyQuaternion(q);
        this.maxRoll = Math.max(this.maxRoll, Math.acos(Math.max(-1, Math.min(1, up.y))));
        const now = this.body.translation();
        if (now.x >= 65 && now.x <= 66 && now.y >= 25 && now.y <= 50 && Math.abs(now.z) < 10 && this.blueprint.parts.some(p => p.kind === 'cargo'))
            this.delivered = true;
        if (this.options.ground !== false) {
            let contact=false;
            for(let i=0;i<this.body.numColliders();i++){
                const collider=this.body.collider(i);
                this.world.contactPairsWith(collider,other=>this.world.contactPair(collider,other,manifold=>{if(manifold.numSolverContacts()>0)contact=true;}));
            }
            if(contact){
                const gentle=Math.abs(v.y)<2&&Math.hypot(v.x,v.z)<22&&up.y>.85;
                if(gentle&&(now.y<4||now.y>32))this.landed=true;
                else this.crashed=true;
            }
        }
        if (Math.abs(now.x) > 550 || Math.abs(now.z) > 160 || now.y > 220 || now.y < -10)
            this.crashed = true;
    }
    metrics(): Metrics { const p = this.body.translation(), v=this.body.linvel(); return { speed:Math.hypot(v.x,v.y,v.z),energy:this.energy,throttle:this.throttle,lift:this.forces.reduce((n,f)=>n+f.force.y,0),weight:this.mass.mass*9.81,time: this.time, distance: p.x, altitude: p.y, maxRoll: this.maxRoll, payload: this.blueprint.parts.filter(p => p.kind === 'cargo').length * 3, energyUsed: this.initialEnergy - this.energy, landed: Number(this.landed), delivered: Number(this.delivered), crashed: Number(this.crashed) }; }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    reset() { if (this.disposed)
        return; this.world.free(); this.time = 0; this.accumulator = 0; this.crashed = false; this.landed = false; this.delivered = false; this.paused = false; this.maxRoll = 0; this.throttle = 0; this.pitch = this.roll = this.yaw = 0; this.externalForce = { x: 0, y: 0, z: 0 }; this.forces = []; this.create(); }
    dispose() { if (this.disposed)
        return; this.world.free(); this.disposed = true; }
}
export function runBench(b: Blueprint) { const e = new FlightEngine(b, { gravity: false, aero: false, ground: false, velocity: 0 }), mass = e.body.mass(), com = e.body.worldCom(); e.body.addForce({ x: 10, y: 0, z: 0 }, true); e.world.step(); const acceleration = e.body.linvel().x / STEP; e.body.setLinvel({ x: 0, y: 0, z: 0 }, true); e.body.resetForces(true); e.body.addForceAtPoint({ x: 0, y: 10, z: 0 }, { x: com.x + 2, y: com.y, z: com.z }, true); e.world.step(); const angularAcceleration = Math.abs(e.body.angvel().z / STEP); e.body.setAngvel({ x: 0, y: 0, z: 0 }, true); e.body.resetForces(true); e.body.resetTorques(true); e.body.addForceAtPoint({ x: 0, y: 10, z: 0 }, e.body.worldCom(), true); e.world.step(); const balancedAngularAcceleration = Math.abs(e.body.angvel().z / STEP), inertia = 20 / angularAcceleration; e.dispose(); return { mass, acceleration, expectedAcceleration: 10 / mass, angularAcceleration, balancedAngularAcceleration, inertia }; }
