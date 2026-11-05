import { describe, it, expect, beforeAll } from 'vitest';
import { validateBlueprint, massProperties, PRESETS } from './blueprints';
import { FlightEngine, initPhysics, dragForce, missionPassed, runBench } from './engine';
describe('aircraft construction', () => {
    it('computes weighted mass, COM and parallel-axis inertia', () => { const b = { version: 1, name: 'pair', parts: [{ id: 'a', kind: 'structure', x: 0, y: 0, z: 0, rotation: 0 }, { id: 'b', kind: 'cargo', x: 1, y: 0, z: 0, rotation: 0 }] }; const p = massProperties(validateBlueprint(b)); expect(p.mass).toBeCloseTo(3.7); expect(p.com.x).toBeCloseTo(3 / 3.7); expect(p.inertia.y).toBeGreaterThan(p.inertia.x); });
    it('rejects malformed, oversized, overlapping and disconnected imports atomically', () => { for (const b of [null, { version: 1, name: 'x', parts: Array(129).fill(PRESETS[0].parts[0]) }, { ...PRESETS[0], parts: [PRESETS[0].parts[0], PRESETS[0].parts[0]] }, { ...PRESETS[0], parts: [PRESETS[0].parts[0], { ...PRESETS[0].parts[1], x: 99 }] }])
        expect(() => validateBlueprint(b)).toThrow(); expect(PRESETS.map(b => validateBlueprint(b).parts.length)).toHaveLength(3); });
});
describe('real fixed-step dynamics', () => {
    beforeAll(initPhysics);
    it('obeys F/m and ballistic acceleration', () => { const e = new FlightEngine(PRESETS[0], { gravity: false, aero: false, ground: false, velocity: 0 }); const m = e.mass.mass; e.externalForce = { x: 10, y: 0, z: 0 }; e.advance(1); expect(e.body.linvel().x).toBeCloseTo(10 / m, 2); e.dispose(); const b = new FlightEngine(PRESETS[0], { aero: false, ground: false, velocity: 0 }); b.advance(1); expect(b.body.linvel().y).toBeCloseTo(-9.81, 1); b.dispose(); });
    it('has dissipative drag and bounded battery energy', () => { const d = dragForce({ x: 12, y: -2, z: 3 }, 2); expect(d.x * 12 + d.y * -2 + d.z * 3).toBeLessThan(0); const e = new FlightEngine(PRESETS[1], { ground: false }); e.throttle = 1; for (let i = 0; i < 100; i++)
        e.advance(.1); expect(e.energy).toBeGreaterThanOrEqual(0); expect(e.energy).toBeLessThan(e.initialEnergy); e.dispose(); });
    it('applies off-axis torque and reports repeatable inertia', () => { const b = runBench(PRESETS[0]); expect(b.acceleration).toBeCloseTo(10 / b.mass, 2); expect(b.angularAcceleration).toBeGreaterThan(0); expect(b.balancedAngularAcceleration).toBeLessThan(.001); expect(b.inertia).toBeGreaterThan(0); });
    it('produces identical trajectories at 30/60/120 rendering rates', () => { const xs = [30, 60, 120].map(hz => { const e = new FlightEngine(PRESETS[1], { ground: false }); e.throttle = .5; for (let i = 0; i < hz * 3; i++)
        e.advance(1 / hz); const p = e.body.translation(); e.dispose(); return p; }); expect(xs[0].x).toBeCloseTo(xs[2].x, 6); expect(xs[1].y).toBeCloseTo(xs[2].y, 6); });
    it('pause, reset and dispose stop held simulation state', () => { const e = new FlightEngine(PRESETS[0]); e.pause(); e.advance(1); expect(e.time).toBe(0); e.resume(); e.advance(.1); expect(e.time).toBeCloseTo(.1); e.reset(); expect(e.time).toBe(0); e.dispose(); e.advance(1); expect(e.time).toBe(0); });
    it('three stock aircraft sustain useful forward flight', () => { for (const preset of PRESETS) {
        const e = new FlightEngine(preset, { ground: false });
        e.throttle = .55;
        e.advance(6);
        expect(e.body.translation().x).toBeGreaterThan(55);
        expect(e.body.translation().y).toBeGreaterThan(5);
        e.dispose();
    } });
    it('six mission predicates accept measured solutions and reject near misses', () => { for (let i = 1; i <= 6; i++) {
        const m = { time: 6, distance: 70, altitude: 20, maxRoll: .1, payload: 3, energyUsed: 1000, landed: 1, delivered: 1, crashed: 0, acceleration: 1, expectedAcceleration: 1, balanceError: .001, inertiaRatio: 1.5, angularRatio: 1 / 1.5, benchRuns: 2 };
        expect(missionPassed(`flight-${i}`, m)).toBe(true);
        expect(missionPassed(`flight-${i}`, { ...m, time: 0, benchRuns: 0 })).toBe(false);
    } });
});
describe('mission evidence from actual instruments', () => {
    beforeAll(initPhysics);
    it('completes motion, payload gate, and energy flights with stock solutions', () => { for (const [id, index] of [['flight-1', 0], ['flight-3', 2], ['flight-4', 1]] as const) {
        const e = new FlightEngine(PRESETS[index]);
        e.throttle = .55;
        e.advance(6);
        const m = e.metrics();
        expect(missionPassed(id, m), `${id}: ${JSON.stringify(m)}`).toBe(true);
        expect(missionPassed(id, { ...m, distance: 20, delivered: 0 })).toBe(false);
        e.dispose();
    } });
    it('bench solutions prove force, centred torque and inverse inertia response', () => { const a = runBench(PRESETS[2]), wide = structuredClone(PRESETS[2]); const cargo = wide.parts.find(p => p.kind === 'cargo')!; cargo.x = 3; cargo.y = 0; const b = runBench(validateBlueprint(wide)); const m = { ...a, benchRuns: 2, balanceError: a.balancedAngularAcceleration, inertiaRatio: b.inertia / a.inertia, angularRatio: b.angularAcceleration / a.angularAcceleration }; for (const id of ['flight-2', 'flight-5', 'flight-6'])
        expect(missionPassed(id, m), `${id}: ${JSON.stringify(m)}`).toBe(true); expect(missionPassed('flight-6', { ...m, inertiaRatio: 1 })).toBe(false); expect(missionPassed('flight-5', { ...m, balanceError: .1 })).toBe(false); expect(missionPassed('flight-2', { ...m, acceleration: m.expectedAcceleration * .8 })).toBe(false); });
    it('control surfaces generate torque instead of directly rotating a body', () => { const a = new FlightEngine(PRESETS[1], { gravity: false, ground: false }); a.pitch = 1; a.advance(1 / 120); expect(a.body.angvel().z).toBeGreaterThan(0); expect(a.forces.filter(f => f.kind === 'control').some(f => f.force.y < 0)).toBe(true); a.dispose(); });
    it('rejects a cargo aircraft missing the delivery gate', () => { expect(missionPassed('flight-3', { time: 6, distance: 70, payload: 3, maxRoll: .1, crashed: 0, delivered: 0 })).toBe(false); });
    it('lifts perpendicular to airflow so unpowered aero does not add energy', () => { const e = new FlightEngine(PRESETS[0], { gravity: false, ground: false }); e.body.setLinvel({ x: 18, y: .4, z: 0 }, true); const v = e.body.linvel(); e.advance(1 / 120); const power = e.forces.reduce((n, f) => n + f.force.x * v.x + f.force.y * v.y + f.force.z * v.z, 0); expect(power).toBeLessThanOrEqual(0); e.dispose(); });
});
describe('bounded aircraft data and electrical work', () => {
    beforeAll(initPhysics);
    it('rejects nonfinite coordinates, unknown kinds and invalid orientations', () => { for (const patch of [{ x: Infinity }, { x: NaN }, { x: .5 }, { kind: 'rocket' }, { rotation: 4 }, { rotation: -1 }, { id: '' + 'a'.repeat(81) }]) {
        const b = structuredClone(PRESETS[1]);
        Object.assign(b.parts[0], patch);
        expect(() => validateBlueprint(b)).toThrow();
    } });
    it('matches the compound body mass and centre of mass', () => { const e = new FlightEngine(PRESETS[2]); expect(e.body.mass()).toBeCloseTo(e.mass.mass, 4); const c = e.body.localCom(); expect(c.x).toBeCloseTo(e.mass.com.x, 5); expect(c.y).toBeCloseTo(e.mass.com.y, 5); e.dispose(); });
    it('a powered motor consumes energy; an unpowered motor does not', () => { const a = new FlightEngine(PRESETS[1], { ground: false }), b = new FlightEngine(PRESETS[1], { ground: false }); a.throttle = 1; a.advance(1); b.advance(1); expect(a.initialEnergy).toBe(60000); expect(a.energy).toBeLessThan(60000); expect(b.energy).toBe(60000); expect(a.metrics().energyUsed + a.energy).toBe(a.initialEnergy); a.dispose(); b.dispose(); });
    it('reset clears external bench forces along with flight controls', () => { const e = new FlightEngine(PRESETS[1]); e.externalForce = { x: 4, y: 0, z: 0 }; e.pitch = 1; e.roll = 1; e.throttle = 1; e.reset(); expect(e.externalForce.x).toBe(0); expect(e.pitch + e.roll + e.throttle).toBe(0); e.dispose(); });
});
describe('control direction', () => {
 beforeAll(initPhysics);
 it('positive roll banks the right wing down', () => { const e = new FlightEngine(PRESETS[1], {gravity:false,ground:false});e.roll=1;e.advance(1/120);expect(e.body.angvel().x).toBeGreaterThan(0);e.dispose(); });
});
it('keeps ended-flight instruments in the attempt metrics',async()=>{await initPhysics();const e=new FlightEngine(PRESETS[1]);e.throttle=.5;e.advance(1);e.pause();const m=e.metrics();expect(m.energy).toBe(e.energy);expect(m.throttle).toBe(.5);const v=e.body.linvel();expect(m.speed).toBeCloseTo(Math.hypot(v.x,v.y,v.z),5);e.dispose()});
describe('physical landings and crashes',()=>{
 beforeAll(initPhysics);
 it('does not call an aircraft a landing while still above the surface',()=>{const e=new FlightEngine(PRESETS[0],{aero:false,velocity:0});e.body.setTranslation({x:150,y:2.15,z:0},true);e.advance(1/120);expect(e.landed).toBe(false);expect(e.crashed).toBe(false);e.dispose()});
 it('records a hard impact as a crash',()=>{const e=new FlightEngine(PRESETS[0],{aero:false,velocity:0});e.body.setTranslation({x:150,y:3,z:0},true);e.body.setLinvel({x:0,y:-15,z:0},true);e.advance(.3);expect(e.crashed).toBe(true);e.dispose()});
 it('records gentle skid contact as a landing',()=>{const e=new FlightEngine(PRESETS[0],{aero:false,velocity:0});e.body.setTranslation({x:150,y:1.52,z:0},true);e.body.setLinvel({x:8,y:-.5,z:0},true);e.advance(.15);expect(e.landed).toBe(true);e.dispose()});
});
it('a nearly empty battery cannot supply a full-force time step',async()=>{await initPhysics();const e=new FlightEngine(PRESETS[1],{ground:false});e.energy=1;e.throttle=1;e.advance(1/120);expect(e.forces.find(f=>f.kind==='engine')!.force.x).toBeLessThan(10);expect(e.energy).toBeGreaterThanOrEqual(0);e.dispose()});
