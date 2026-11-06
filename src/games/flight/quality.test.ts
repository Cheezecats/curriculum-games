import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { PRESETS, type Blueprint } from './blueprints';
import { BuilderHistory, type BuilderSnapshot } from './history';
import { chaseOffset, followCamera, OrbitGesture } from './camera';
import * as camera from './camera';
import { evaluateFlightMission } from './assessment';
import { missionPassed } from './engine';
import { crossesDeliveryGate } from './gate';

const snapshot = (name: string, selected: string | null = 'p0'): BuilderSnapshot => ({
  blueprint: { ...structuredClone(PRESETS[0]), name },
  selected,
});

describe('forgiving builder history', () => {
  it('undoes and redoes the aircraft together with the selected part', () => {
    const history = new BuilderHistory();
    const before = snapshot('Before', 'p3'),
      after = snapshot('After', 'p7');
    history.record(before, after);
    expect(history.undo(after)).toEqual(before);
    expect(history.redo(before)).toEqual(after);
  });
  it('retains only bounded edits and clears redo when a different edit is made', () => {
    const history = new BuilderHistory(2),
      states = ['A', 'B', 'C', 'D'].map((name) => snapshot(name));
    history.record(states[0], states[1]);
    history.record(states[1], states[2]);
    history.record(states[2], states[3]);
    expect(history.undo(states[3])).toEqual(states[2]);
    expect(history.undo(states[2])).toEqual(states[1]);
    expect(history.undo(states[1])).toBe(null);
    history.record(states[1], snapshot('Another design'));
    expect(history.redo(states[1])).toBe(null);
  });
  it('rejects a disconnected edit without losing the current redo branch', () => {
    const history = new BuilderHistory(),
      before = snapshot('Before'),
      after = snapshot('After');
    history.record(before, after);
    history.undo(after);
    const invalid: Blueprint = structuredClone(before.blueprint);
    invalid.parts.push({ id: 'isolated', kind: 'wing', x: 20, y: 0, z: 0, rotation: 0 });
    expect(() => history.record(before, { blueprint: invalid, selected: 'isolated' })).toThrow();
    expect(history.redo(before)).toEqual(after);
  });
  it('owns independent snapshots and selects a remaining part after deletion', () => {
    const history = new BuilderHistory(),
      before = snapshot('Before', 'p4'),
      after = snapshot('After', 'p4');
    after.blueprint.parts = after.blueprint.parts.filter((p) => p.id !== 'p4');
    // Removing a wing tip leaves a valid connected aircraft.
    const result = history.record(before, after);
    expect(result.selected).toBe('p0');
    before.blueprint.name = 'Mutated outside history';
    expect(history.undo(result)?.blueprint.name).toBe('Before');
  });
});

describe('flight camera and deliberate part selection', () => {
  const yawedPitch = (pitch: number) =>
    new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 3)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (pitch * Math.PI) / 180));
  it('keeps a yawed chase heading continuous before, at and after vertical pitch', () => {
    const heading = { angle: null as number | null },
      offsets = [0, 89.99, 90, 90.01].map((pitch) => chaseOffset(yawedPitch(pitch), heading));
    for (const offset of offsets.slice(1)) expect(offset.distanceTo(offsets[0])).toBeLessThan(0.01);
  });
  it('does not snap the reduced-motion camera around when leaving the vertical band', () => {
    const heading = { angle: null as number | null },
      before = chaseOffset(yawedPitch(0), heading),
      vertical = chaseOffset(yawedPitch(90), heading),
      after = chaseOffset(yawedPitch(100), heading),
      displayed = followCamera(new Vector3(), after, 1 / 60, true);
    expect(vertical.distanceTo(before)).toBeLessThan(0.01);
    expect(displayed.distanceTo(before)).toBeLessThan(1);
  });
  it('recovers an initial vertical heading from aircraft orientation in either pitch direction', () => {
    const level = chaseOffset(yawedPitch(0));
    for (const pitch of [89.99, 90, 90.01, -89.99, -90, -90.01])
      expect(chaseOffset(yawedPitch(pitch)).distanceTo(level)).toBeLessThan(1e-8);
  });
  it('limits heading changes by elapsed time at 30, 60 and 120 render updates per second', () => {
    const target = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    for (const hz of [30, 60, 120]) {
      const heading = { angle: 0 as number | null };
      for (let frame = 0; frame < hz * 0.3; frame++) chaseOffset(target, heading, 1 / hz);
      expect(heading.angle).toBeCloseTo(-0.75, 10);
    }
  });
  it('frames the actual aircraft centre of mass after a translated and rotated build', () => {
    const focus = camera.aircraftFocus(
      { x: 0, y: 1, z: 20 },
      { x: 10, y: 36, z: 5 },
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
    );
    expect(focus.x).toBeCloseTo(30);
    expect(focus.y).toBeCloseTo(37);
    expect(focus.z).toBeCloseTo(5);
  });
  it('follows heading while keeping the chase height stable through a roll', () => {
    const turned = chaseOffset(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
    );
    expect(turned.x).toBeCloseTo(8);
    expect(turned.z).toBeCloseTo(14);
    expect(turned.y).toBe(7);
    const rolled = chaseOffset(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
    );
    expect(rolled.toArray()).toEqual([-14, 7, 8]);
  });
  it('gives the same damping after equal elapsed time at different render rates', () => {
    const target = new Vector3(30, 12, -4),
      thirty = followCamera(new Vector3(), target, 1 / 30),
      sixty = followCamera(followCamera(new Vector3(), target, 1 / 60), target, 1 / 60);
    expect(thirty.distanceTo(sixty)).toBeLessThan(1e-10);
    expect(thirty.x).toBeGreaterThan(0);
    expect(thirty.x).toBeLessThan(30);
  });
  it('snaps reduced-motion camera changes instead of animating the transition', () => {
    expect(followCamera(new Vector3(), new Vector3(3, 4, 5), 1 / 60, true).toArray()).toEqual([
      3, 4, 5,
    ]);
  });
  it('suppresses selection after an orbit drag even if it returns to the starting point', () => {
    const gesture = new OrbitGesture();
    gesture.begin(50, 50);
    gesture.move(80, 65);
    gesture.move(50, 50);
    expect(gesture.end()).toBe(false);
    gesture.begin(50, 50);
    gesture.move(51, 51);
    expect(gesture.end()).toBe(true);
  });
});

describe('one set of measured flight objectives', () => {
  const measured = {
    time: 5,
    distance: 65,
    crashed: 0,
    delivered: 1,
    payload: 3,
    maxRoll: 0.59,
    energyUsed: 5999,
    benchRuns: 2,
    acceleration: 1,
    expectedAcceleration: 1,
    balanceError: 0.009,
    inertiaRatio: 1.5,
    angularRatio: 1 / 1.5,
  };
  for (const fixture of [
    { id: 'flight-1', metric: { time: 3.99 }, criterion: 'airtime' },
    { id: 'flight-2', metric: { acceleration: 1.04 }, criterion: 'force-agreement' },
    { id: 'flight-3', metric: { maxRoll: 0.6 }, criterion: 'tilt' },
    { id: 'flight-4', metric: { energyUsed: 6000 }, criterion: 'energy' },
    { id: 'flight-5', metric: { balanceError: 0.01 }, criterion: 'centred-force' },
    { id: 'flight-6', metric: { inertiaRatio: 1.2 }, criterion: 'inertia-change' },
  ])
    it(`${fixture.id} explains a near miss using the same threshold as completion`, () => {
      const success = evaluateFlightMission(fixture.id, measured);
      expect(success.completed).toBe(true);
      expect(missionPassed(fixture.id, measured)).toBe(true);
      const failure = evaluateFlightMission(fixture.id, { ...measured, ...fixture.metric }),
        evidence = failure.criteria.find((c) => c.id === fixture.criterion);
      expect(failure.completed).toBe(false);
      expect(evidence?.passed).toBe(false);
      expect(evidence?.actual).toBeTruthy();
      expect(evidence?.target).toBeTruthy();
      expect(evidence?.hint).toBeTruthy();
      expect(missionPassed(fixture.id, { ...measured, ...fixture.metric })).toBe(false);
    });
  it('does not fabricate measurements before launch or pass unknown missions', () => {
    const pending = evaluateFlightMission('flight-1', {});
    expect(pending.completed).toBe(false);
    expect(pending.criteria.find((c) => c.id === 'downrange')?.actual).toBe('Not measured');
    expect(evaluateFlightMission('unknown', measured)).toEqual({ completed: false, criteria: [] });
  });
  it('keeps missing crash evidence pending even when time and distance meet their targets', () => {
    const result = evaluateFlightMission('flight-1', { time: 6, distance: 70 });
    expect(result.criteria.find((c) => c.id === 'safe-flight')?.passed).toBe(false);
    expect(result.completed).toBe(false);
  });
  it('reports tilt in degrees while preserving the original radian threshold', () => {
    const result = evaluateFlightMission('flight-3', { ...measured, maxRoll: Math.PI / 6 });
    expect(result.criteria.find((c) => c.id === 'tilt')?.actual).toBe('30.0 °');
    expect(result.completed).toBe(true);
  });
});

describe('delivery aperture crossing', () => {
  it('uses the interpolated crossing point rather than either timestep endpoint', () => {
    expect(crossesDeliveryGate({ x: 64, y: 60, z: 0 }, { x: 66, y: 20, z: 0 })).toBe(true);
    expect(crossesDeliveryGate({ x: 64, y: 60, z: 0 }, { x: 66, y: 37, z: 0 })).toBe(false);
  });
  it('rejects diagonal corners, backwards crossings and movement beside the ring', () => {
    expect(crossesDeliveryGate({ x: 64, y: 45, z: 8 }, { x: 66, y: 45, z: 8 })).toBe(false);
    expect(crossesDeliveryGate({ x: 66, y: 37, z: 0 }, { x: 64, y: 37, z: 0 })).toBe(false);
    expect(crossesDeliveryGate({ x: 63, y: 37, z: 0 }, { x: 64, y: 37, z: 0 })).toBe(false);
  });
});
