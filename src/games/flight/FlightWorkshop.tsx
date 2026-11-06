import { useEffect, useRef, useState } from 'react';
import type { GameProps, ControlSettings, AttemptResult } from '../../core/types';
import ObjectiveChecklist from '../../components/ObjectiveChecklist';
import { readRecord, writeRecord } from '../../core/storage';
import {
  PRESETS,
  PARTS,
  validateBlueprint,
  massProperties,
  type Blueprint,
  type PartKind,
} from './blueprints';
import { FlightEngine, initPhysics, runBench, type Metrics } from './engine';
import { FlightScene } from './scene';
import { BuilderHistory, type BuilderSnapshot } from './history';
import { evaluateFlightMission } from './assessment';
import './flight.css';
const keyLabels: Record<string, string> = {
  pitchUp: 'Pitch up',
  pitchDown: 'Pitch down',
  rollLeft: 'Roll left',
  rollRight: 'Roll right',
  yawLeft: 'Yaw left',
  yawRight: 'Yaw right',
  throttleUp: 'Throttle up',
  throttleDown: 'Throttle down',
};
const shortKey = (s: string) => s.replace('Key', '').replace('Left', '').replace('Right', '');
export default function FlightWorkshop(props: GameProps) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<FlightScene | null>(null),
    engine = useRef<FlightEngine | null>(null),
    keys = useRef(new Set<string>()),
    latest = useRef(props),
    blueprintRef = useRef<Blueprint>(
      structuredClone(PRESETS[props.mission?.id === 'flight-3' ? 2 : 0]),
    ),
    frameRef = useRef(0),
    binding = useRef<string | null>(null),
    ended = useRef(false),
    builderHistory = useRef(new BuilderHistory()),
    overlay = useRef({ forces: false, com: true });
  const [blueprint, setBlueprint] = useState(blueprintRef.current),
    [selected, setSelected] = useState<string | null>(blueprint.parts[0].id),
    [kind, setKind] = useState<PartKind>('wing'),
    [mode, setMode] = useState('build'),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState('Drag to orbit · scroll to zoom · select a part to build.'),
    [telemetry, setTelemetry] = useState<Metrics>({}),
    [forces, setForces] = useState(false),
    [com, setCom] = useState(true),
    [history, setHistory] = useState<
      {
        speed: number;
        altitude: number;
      }[]
    >([]),
    [bench, setBench] = useState<Metrics | null>(null),
    [benchExample, setBenchExample] = useState(false),
    [bindLabel, setBindLabel] = useState<string | null>(null),
    [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });
  latest.current = props;
  blueprintRef.current = blueprint;
  overlay.current = { forces, com };
  const finishRef = useRef<(reason: string) => void>(() => {});
  const report = (
    metrics: Metrics,
    summary: string,
    configuration?: AttemptResult['configuration'],
  ) => {
    const mission = latest.current.mission,
      evaluation = evaluateFlightMission(mission?.id ?? '', metrics),
      flown = engine.current?.blueprint ?? blueprintRef.current;
    latest.current.onAttempt({
      id: crypto.randomUUID(),
      game: 'flight',
      missionId: mission?.id ?? null,
      completed: evaluation.completed,
      createdAt: Date.now(),
      metrics,
      summary,
      criteria: evaluation.criteria,
      configuration: configuration ?? {
        task: 'flight',
        aircraft: flown.name,
        parts: flown.parts.length,
        launchSpeed: 18,
        endReason: engine.current?.endReason ?? 'pilot-ended',
      },
    });
  };
  finishRef.current = (reason) => {
    if (!engine.current || ended.current) return;
    ended.current = true;
    keys.current.clear();
    engine.current.pause();
    setMode('ended');
    const m = engine.current.metrics();
    setTelemetry(m);
    setMessage(reason);
    report(m, reason);
  };
  useEffect(() => {
    let active = true;
    void initPhysics().then(() => {
      if (!active) return;
      try {
        scene.current = new FlightScene(host.current!, (id) => setSelected(id));
        scene.current.blueprint(blueprintRef.current, null);
        setReady(true);
      } catch {
        setMessage(
          'The 3D workspace needs WebGL. Try a browser with hardware acceleration enabled.',
        );
        return;
      }
      let last = performance.now(),
        lastSample = 0;
      const tick = (now: number) => {
        if (!active) return;
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const e = engine.current,
          s = latest.current.settings;
        if (e && !e.paused) {
          const down = (k: string) => (keys.current.has(k) ? 1 : 0);
          e.pitch = (down(s.pitchUp) - down(s.pitchDown)) * (s.invertPitch ? -1 : 1);
          e.roll = down(s.rollRight) - down(s.rollLeft);
          e.yaw = down(s.yawLeft) - down(s.yawRight);
          e.throttle = Math.max(
            0,
            Math.min(1, e.throttle + (down(s.throttleUp) - down(s.throttleDown)) * dt * 0.5),
          );
          const deliveredBefore = e.delivered;
          e.advance(dt);
          if (!deliveredBefore && e.delivered)
            setMessage(
              'Parcel carried through the gate. Keep it steady, then finish to record the flight.',
            );
          if (e.crashed || e.landed)
            finishRef.current(
              e.endReason === 'valley-boundary'
                ? 'The aircraft left the flight valley. Turn back earlier on the next flight.'
                : e.endReason === 'launch-pad-collision'
                  ? 'The aircraft struck the launch pad. Try keeping the nose level until clear of the edge.'
                  : e.crashed
                    ? `The aircraft touched down too hard. Vertical impact speed ${e.impactVerticalSpeed.toFixed(1)} m/s; horizontal ${e.impactHorizontalSpeed.toFixed(1)} m/s.`
                    : 'A safe landing. Compare the recorded forces and energy.',
            );
        }
        scene.current?.render(e, overlay.current.forces, overlay.current.com, dt, s.reducedMotion);
        if (now - lastSample > 100 && e && !e.paused) {
          const v = e.body.linvel(),
            speed = Math.hypot(v.x, v.y, v.z);
          setTelemetry({
            ...e.metrics(),
            speed,
            energy: e.energy,
            throttle: e.throttle,
            lift: e.forces.reduce((n, f) => n + f.force.y, 0),
            weight: e.mass.mass * 9.81,
          });
          setHistory((h) => [...h.slice(-79), { speed, altitude: e.body.translation().y }]);
          lastSample = now;
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    });
    const down = (e: KeyboardEvent) => {
      if (binding.current) {
        e.preventDefault();
        const k = binding.current as keyof ControlSettings;
        latest.current.onSettingsChange({ ...latest.current.settings, [k]: e.code });
        binding.current = null;
        setBindLabel(null);
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (Object.values(latest.current.settings).includes(e.code)) {
        e.preventDefault();
        keys.current.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const release = () => {
      keys.current.clear();
      if (engine.current && !engine.current.paused && !ended.current) {
        engine.current.pause();
        setMode('paused');
      }
    };
    const visibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
      keys.current.clear();
      engine.current?.dispose();
      engine.current = null;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    if (mode === 'build') scene.current?.blueprint(blueprint, selected);
    const p = blueprint.parts.find((p) => p.id === selected);
    if (p) setCoords({ x: p.x, y: p.y, z: p.z });
  }, [blueprint, selected, mode, ready]);
  const apply = (next: Blueprint, nextSelected = selected) => {
    try {
      const edit = builderHistory.current.record(
        { blueprint, selected },
        { blueprint: next, selected: nextSelected },
      );
      setBlueprint(edit.blueprint);
      setSelected(edit.selected);
      setBench(null);
      setMessage('Aircraft updated. Every part is connected.');
      return true;
    } catch (err) {
      setMessage((err as Error).message);
      return false;
    }
  };
  const restoreEdit = (direction: 'undo' | 'redo') => {
    const edit: BuilderSnapshot | null = builderHistory.current[direction]({ blueprint, selected });
    if (!edit) return;
    setBlueprint(edit.blueprint);
    setSelected(edit.selected);
    setBench(null);
    setMessage(
      direction === 'undo' ? 'Previous aircraft edit restored.' : 'Aircraft edit reapplied.',
    );
  };
  const launch = () => {
    engine.current?.dispose();
    engine.current = new FlightEngine(blueprint);
    engine.current.throttle = blueprint.parts.some((p) => p.kind === 'engine') ? 0.55 : 0;
    ended.current = false;
    keys.current.clear();
    setHistory([]);
    setBench(null);
    setMode('fly');
    setMessage('Flight live. Finish & review when you have evidence for the objective.');
    scene.current?.blueprint(blueprint, null);
  };
  const rebuild = () => {
    if (engine.current && !ended.current) finishRef.current('Flight ended for a rebuild.');
    engine.current?.dispose();
    engine.current = null;
    keys.current.clear();
    setMode('build');
    setTelemetry({});
    setHistory([]);
    setMessage('Ready for the next design.');
    scene.current?.blueprint(blueprint, selected);
  };
  const preset = (i: number) => {
    const b = structuredClone(PRESETS[i]);
    apply(b, b.parts[0].id);
  };
  const add = (axis: 'x' | 'y' | 'z', delta: number) => {
    const p = blueprint.parts.find((p) => p.id === selected) ?? blueprint.parts[0];
    const n = { id: crypto.randomUUID(), kind, x: p.x, y: p.y, z: p.z, rotation: 0 };
    n[axis] += delta;
    if (apply({ ...blueprint, parts: [...blueprint.parts, n] }, n.id)) setMessage('Part attached.');
  };
  const doBench = (compare = false) => {
    try {
      const testedBlueprint = compare ? structuredClone(PRESETS[2]) : blueprint,
        a = runBench(testedBlueprint);
      let m: Metrics = {
        benchRuns: 1,
        acceleration: a.acceleration,
        expectedAcceleration: a.expectedAcceleration,
        balanceError: a.balancedAngularAcceleration,
        angularAcceleration: a.angularAcceleration,
        inertia: a.inertia,
        mass: a.mass,
      };
      if (compare) {
        const compact = testedBlueprint,
          wide = structuredClone(compact);
        const cargo = wide.parts.find((p) => p.kind === 'cargo')!;
        cargo.x = 3;
        cargo.y = 0;
        const one = a,
          two = runBench(validateBlueprint(wide));
        m = {
          ...m,
          benchRuns: 2,
          inertiaRatio: two.inertia / one.inertia,
          angularRatio: two.angularAcceleration / one.angularAcceleration,
          compactInertia: one.inertia,
          wideInertia: two.inertia,
          compactAlpha: one.angularAcceleration,
          wideAlpha: two.angularAcceleration,
          mass: one.mass,
        };
      }
      setBench(m);
      setBenchExample(compare);
      setMessage(
        compare
          ? 'Preset example: two equal-mass Cargo courier layouts tested. The nose load resists angular acceleration more.'
          : '10 N force and 20 N·m torque measured. Gravity and airflow are disabled on the bench.',
      );
      report(
        m,
        compare
          ? 'Preset courier example: two equal-mass layouts received the same torque.'
          : 'A controlled force and torque experiment.',
        {
          task: 'bench',
          aircraft: testedBlueprint.name,
          parts: testedBlueprint.parts.length,
          experiment: compare
            ? 'Equal-mass Cargo courier preset example'
            : 'Current-aircraft force and torque',
          forceN: 10,
          armM: 2,
          ...(compare ? { layoutA: 'Cargo above centre', layoutB: 'Cargo at nose' } : {}),
        },
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const save = async () => {
    try {
      await writeRecord('flight-blueprint-v1', blueprint);
      setMessage('Aircraft saved on this browser.');
    } catch {
      setMessage('Save unavailable. Export a JSON copy to keep this aircraft.');
    }
  };
  const load = async () => {
    try {
      const b = await readRecord<unknown>('flight-blueprint-v1', null);
      if (!b) {
        setMessage('No aircraft saved yet.');
        return;
      }
      const valid = validateBlueprint(b);
      if (apply(valid, valid.parts[0].id)) setMessage('Saved aircraft restored.');
    } catch {
      setMessage('The saved aircraft could not be read. Your current design is retained.');
    }
  };
  const exportFile = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(blueprint, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flight-workshop-aircraft.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const mass = massProperties(blueprint),
    part = blueprint.parts.find((p) => p.id === selected),
    isBuild = mode === 'build',
    m = telemetry;
  const evaluation = evaluateFlightMission(props.mission?.id ?? '', bench ?? m),
    successful = evaluation.completed;
  return (
    <div className="flight-workshop">
      <header className="flight-header">
        <button className="flight-back" onClick={props.onExit}>
          ← All workshops
        </button>
        <div>
          <span className="flight-eyebrow">
            FLIGHT WORKSHOP / {props.mission ? 'MISSION ' + props.mission.order : 'FREE FLIGHT'}
          </span>
          <h1>{props.mission?.title ?? 'Make something that flies.'}</h1>
        </div>
        <span className="flight-status">
          <i />
          {isBuild
            ? 'IN THE HANGAR'
            : mode === 'paused'
              ? 'PAUSED'
              : mode === 'ended'
                ? 'FLIGHT RECORDED'
                : 'AIRBORNE'}
        </span>
      </header>
      <div className="flight-layout">
        <aside className="flight-sidebar">
          <div className="flight-section">
            <span className="flight-eyebrow">YOUR OBJECTIVE</span>
            <p>
              {props.mission?.brief ??
                'Build, fly, and follow your curiosity. Start with a working aircraft, then make it your own.'}
            </p>
            <div className="flight-objective">
              {props.mission?.objective ??
                'No limits on the experiment. Up to 128 connected parts.'}
            </div>
            <ObjectiveChecklist criteria={evaluation.criteria} compact />
          </div>
          <div className="flight-section">
            <span className="flight-eyebrow">STARTING AIRCRAFT</span>
            <div className="flight-presets">
              {PRESETS.map((b, i) => (
                <button
                  disabled={!isBuild}
                  key={b.name}
                  onClick={() => preset(i)}
                  className={blueprint.name === b.name ? 'selected' : ''}
                >
                  {b.name}
                  <span>
                    {i === 0
                      ? 'No motor · a quiet descent'
                      : i === 1
                        ? 'Electric · light & lively'
                        : 'Electric · steady with a parcel'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flight-section">
            <div className="flight-section-title">
              <span className="flight-eyebrow">BUILD YOUR AIRCRAFT</span>
              <span>{blueprint.parts.length}/128</span>
            </div>
            <div className="flight-row flight-history">
              <button
                disabled={!isBuild || !builderHistory.current.canUndo}
                onClick={() => restoreEdit('undo')}
              >
                Undo edit
              </button>
              <button
                disabled={!isBuild || !builderHistory.current.canRedo}
                onClick={() => restoreEdit('redo')}
              >
                Redo edit
              </button>
            </div>
            <label className="flight-label">
              Attach a part
              <select
                disabled={!isBuild}
                value={kind}
                onChange={(e) => setKind(e.target.value as PartKind)}
              >
                {Object.entries(PARTS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label} · {p.mass} kg
                  </option>
                ))}
              </select>
            </label>
            <p className="flight-hint">
              Select a block in the scene, then attach to one of its faces.
            </p>
            <div className="flight-faces">
              {(
                [
                  ['x', 1, 'Nose +X'],
                  ['x', -1, 'Tail −X'],
                  ['y', 1, 'Above +Y'],
                  ['y', -1, 'Below −Y'],
                  ['z', 1, 'Right +Z'],
                  ['z', -1, 'Left −Z'],
                ] as const
              ).map(([a, d, l]) => (
                <button
                  disabled={!isBuild || blueprint.parts.length >= 128}
                  key={l}
                  onClick={() => add(a, d)}
                >
                  {l}
                </button>
              ))}
            </div>
            {part && (
              <details className="flight-edit">
                <summary>{PARTS[part.kind].label} · selected part</summary>
                <div className="flight-coordinates">
                  {(['x', 'y', 'z'] as const).map((a) => (
                    <label key={a}>
                      {a.toUpperCase()}
                      <input
                        aria-label={`Part ${a} coordinate`}
                        type="number"
                        min="-32"
                        max="32"
                        value={coords[a]}
                        onChange={(e) => setCoords({ ...coords, [a]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <div className="flight-row">
                  <button
                    disabled={!isBuild}
                    onClick={() =>
                      apply({
                        ...blueprint,
                        parts: blueprint.parts.map((p) =>
                          p.id === part.id ? { ...p, ...coords } : p,
                        ),
                      })
                    }
                  >
                    Move
                  </button>
                  <button
                    disabled={!isBuild}
                    onClick={() =>
                      apply({
                        ...blueprint,
                        parts: blueprint.parts.map((p) =>
                          p.id === part.id ? { ...p, rotation: (p.rotation + 1) % 4 } : p,
                        ),
                      })
                    }
                  >
                    Rotate 90°
                  </button>
                  <button
                    disabled={!isBuild}
                    onClick={() =>
                      apply({
                        ...blueprint,
                        parts: blueprint.parts.filter((p) => p.id !== part.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </details>
            )}
          </div>
          <div className="flight-section">
            <span className="flight-eyebrow">EXPERIMENT BENCH</span>
            <p className="flight-hint">
              10 N through the centre. Then 10 N at a 2 m arm. Zero gravity, zero airflow.
            </p>
            <div className="flight-row">
              <button disabled={!ready || !isBuild} onClick={() => doBench()}>
                Test force & torque
              </button>
              <button disabled={!ready || !isBuild} onClick={() => doBench(true)}>
                Compare courier example
              </button>
            </div>
            {bench && (
              <div className="flight-bench-results">
                <strong>
                  {benchExample
                    ? 'Preset example · Cargo courier'
                    : 'Your aircraft · force & torque'}
                </strong>
                <span>
                  Mass <b>{bench.mass.toFixed(2)} kg</b>
                </span>
                <span>
                  Measured / predicted a{' '}
                  <b>
                    {bench.acceleration.toFixed(3)} / {bench.expectedAcceleration.toFixed(3)} m/s²
                  </b>
                </span>
                <span>
                  20 N·m angular acceleration <b>{bench.angularAcceleration.toFixed(3)} rad/s²</b>
                </span>
                <span>
                  Centred angular acceleration <b>{bench.balanceError.toFixed(5)} rad/s²</b>
                </span>
                {bench.inertiaRatio && (
                  <>
                    <span>
                      Compact / nose-load I{' '}
                      <b>
                        {bench.compactInertia.toFixed(2)} / {bench.wideInertia.toFixed(2)} kg·m²
                      </b>
                    </span>
                    <span>
                      I ratio / α ratio{' '}
                      <b>
                        {bench.inertiaRatio.toFixed(3)} / {bench.angularRatio.toFixed(3)}
                      </b>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <details className="flight-section">
            <summary>Aircraft files</summary>
            <div className="flight-file-actions">
              <button disabled={!isBuild} onClick={() => void save()}>
                Save locally
              </button>
              <button disabled={!isBuild} onClick={() => void load()}>
                Restore save
              </button>
              <button onClick={exportFile}>Export JSON</button>
              <label className="flight-upload">
                Import JSON
                <input
                  aria-label="Import aircraft JSON"
                  type="file"
                  accept="application/json,.json"
                  disabled={!isBuild}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 100000)
                        throw Error('Aircraft file is too large (100 kB maximum).');
                      const valid = validateBlueprint(JSON.parse(await f.text()));
                      if (apply(valid, valid.parts[0].id))
                        setMessage('Imported aircraft is connected and ready.');
                    } catch (error) {
                      setMessage((error as Error).message);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </details>
        </aside>
        <main className="flight-main">
          <div className="flight-stage" ref={host} aria-label="3D aircraft workspace">
            <div className="flight-stage-top">
              <span>
                VALLEY 01 <small>ZERO WIND · 18 m/s LAUNCH</small>
              </span>
              <span>+X FORWARD / +Y UP</span>
            </div>
            <div className="flight-scene-label">
              {isBuild
                ? 'THE HANGAR'
                : mode === 'ended'
                  ? successful
                    ? 'OBJECTIVE RECORDED'
                    : 'FLIGHT RECORDED'
                  : successful
                    ? 'OBJECTIVE MEASURED — FINISH TO RECORD'
                    : 'THE VALLEY'}
              <small>
                {isBuild
                  ? 'Click a part to select · drag to orbit'
                  : mode === 'ended'
                    ? 'Compare your measurements or fly again'
                    : 'Orange gate: 65 m · landing strip: 110–190 m'}
              </small>
            </div>
            <div className="flight-overlay-controls">
              <button onClick={() => scene.current?.resetView()}>Reset view</button>
              <label>
                <input
                  type="checkbox"
                  checked={forces}
                  onChange={(e) => setForces(e.target.checked)}
                />
                Force arrows
              </label>
              <label>
                <input type="checkbox" checked={com} onChange={(e) => setCom(e.target.checked)} />
                Centre of mass
              </label>
            </div>
          </div>
          <div className="flight-flightbar">
            <div>
              <span className="flight-eyebrow">
                {isBuild
                  ? 'ALL SYSTEMS READY'
                  : mode === 'ended'
                    ? 'RECORDED FLIGHT'
                    : mode === 'paused'
                      ? 'PAUSED FLIGHT'
                      : 'LIVE FLIGHT'}
              </span>
              <strong>
                {isBuild
                  ? blueprint.name
                  : mode === 'paused'
                    ? 'Take your time.'
                    : mode === 'ended'
                      ? 'Flight complete.'
                      : `${(m.distance ?? 0).toFixed(0)} m downrange`}
              </strong>
            </div>
            <div className="flight-row">
              {isBuild ? (
                <button className="flight-launch" disabled={!ready} onClick={launch}>
                  {ready ? 'Launch aircraft ↗' : 'Preparing physics…'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (mode === 'ended') {
                        launch();
                        return;
                      }
                      keys.current.clear();
                      if (engine.current?.paused) {
                        engine.current.resume();
                        setMode('fly');
                      } else {
                        engine.current?.pause();
                        setMode('paused');
                      }
                    }}
                  >
                    {mode === 'ended' ? 'Fly again' : mode === 'paused' ? 'Resume flight' : 'Pause'}
                  </button>
                  {mode !== 'ended' && (
                    <button
                      className="flight-launch"
                      onClick={() =>
                        finishRef.current(
                          'Flight ended. Review your measured distance, stability and energy.',
                        )
                      }
                    >
                      Finish & review
                    </button>
                  )}
                  <button onClick={rebuild}>Rebuild</button>
                </>
              )}
            </div>
          </div>
          <div className="flight-message" role="status">
            {message}
          </div>
          <div className="flight-instruments">
            <div>
              <span>SPEED</span>
              <strong>
                {(m.speed ?? 18).toFixed(1)}
                <small> m/s</small>
              </strong>
            </div>
            <div>
              <span>ALTITUDE</span>
              <strong>
                {(m.altitude ?? 36).toFixed(1)}
                <small> m</small>
              </strong>
            </div>
            <div>
              <span>MASS</span>
              <strong>
                {mass.mass.toFixed(2)}
                <small> kg</small>
              </strong>
            </div>
            <div>
              <span>BATTERY</span>
              <strong>
                {(
                  (m.energy ?? blueprint.parts.filter((p) => p.kind === 'battery').length * 60000) /
                  1000
                ).toFixed(1)}
                <small> kJ</small>
              </strong>
            </div>
            <div>
              <span>THROTTLE</span>
              <strong>
                {((m.throttle ?? 0) * 100).toFixed(0)}
                <small> %</small>
              </strong>
            </div>
          </div>
          <div className="flight-bottom">
            <div className="flight-graph">
              <span className="flight-eyebrow">
                ACTUAL FLIGHT TRACE <i className="speed" /> SPEED <i className="height" /> HEIGHT
              </span>
              <svg viewBox="0 0 400 80" aria-label="Live speed and altitude graph" role="img">
                <path d="M0 20H400M0 40H400M0 60H400" stroke="#d9ded5" fill="none" />
                {(['speed', 'altitude'] as const).map((k, i) => (
                  <polyline
                    key={k}
                    points={history
                      .map((p, n) => `${(n * 400) / 79},${76 - Math.min(70, Math.max(0, p[k]))}`)
                      .join(' ')}
                    fill="none"
                    stroke={i ? '#e79466' : '#1e6a61'}
                    strokeWidth="2"
                  />
                ))}
              </svg>
              <div className="flight-hint">
                Last 8 seconds · 0–70 m/s or m · vertical force {(m.lift ?? 0).toFixed(0)} N /
                weight {(mass.mass * 9.81).toFixed(0)} N
              </div>
            </div>
            <div className="flight-controls">
              <span className="flight-eyebrow">FLIGHT CONTROLS</span>
              <div>
                <kbd>{shortKey(props.settings.pitchDown)}</kbd>
                <kbd>{shortKey(props.settings.pitchUp)}</kbd> pitch{' '}
                <kbd>{shortKey(props.settings.rollLeft)}</kbd>
                <kbd>{shortKey(props.settings.rollRight)}</kbd> roll
              </div>
              <div>
                <kbd>{shortKey(props.settings.yawLeft)}</kbd>
                <kbd>{shortKey(props.settings.yawRight)}</kbd> yaw{' '}
                <kbd>{shortKey(props.settings.throttleUp)}</kbd> /{' '}
                <kbd>{shortKey(props.settings.throttleDown)}</kbd> throttle
              </div>
              <details>
                <summary>Configure controls</summary>
                <label>
                  <input
                    type="checkbox"
                    checked={props.settings.invertPitch}
                    onChange={(e) =>
                      props.onSettingsChange({ ...props.settings, invertPitch: e.target.checked })
                    }
                  />{' '}
                  Invert pitch
                </label>
                <div className="flight-keybindings">
                  {Object.entries(keyLabels).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => {
                        keys.current.clear();
                        engine.current?.pause();
                        if (engine.current && !ended.current) setMode('paused');
                        binding.current = k;
                        setBindLabel(label);
                      }}
                    >
                      {label}: {shortKey(String(props.settings[k as keyof ControlSettings]))}
                    </button>
                  ))}
                </div>
                {bindLabel && <p>Press a key for {bindLabel}…</p>}
              </details>
            </div>
          </div>
          <details className="flight-model">
            <summary>How this aircraft works</summary>
            <p>
              Every block contributes its actual mass, centre of mass and rotational inertia to one
              rigid aircraft. Simulation advances in 1/120 s steps. Forces act at each block,
              including velocity from rotation. Wings use 0.35 m² effective lifting area and a 0.06
              rad incidence; control surfaces use 0.35 m². Lift coefficient rises as 5.2 × angle of
              attack to 0.30 rad, then decreases through stall. Drag opposes local airflow. These
              simplified coefficients are teaching assumptions, not aircraft certification data.
            </p>
            <p>
              A motor provides up to 24 N. Battery capacity is 60 kJ per block. Electrical power is
              thrust × max(5 m/s, local forward speed) ÷ 0.72, plus 20 W at full throttle. Controls
              deflect aerodynamic surfaces; they do not directly turn the aircraft. The world has no
              wind. Grid blocks are 1 m with cubic mass distributions; thin renderings are visual.
              Energy in the battery is clamped at zero.
            </p>
            <p>
              Centre of mass: {mass.com.x.toFixed(2)}, {mass.com.y.toFixed(2)},{' '}
              {mass.com.z.toFixed(2)} m. Principal-coordinate inertia estimates:{' '}
              {mass.inertia.x.toFixed(2)}, {mass.inertia.y.toFixed(2)}, {mass.inertia.z.toFixed(2)}{' '}
              kg·m². Rapier includes products of inertia in the full compound body.
            </p>
            <a
              href="https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/physics-guide.pdf"
              target="_blank"
              rel="noreferrer"
            >
              IB Physics guide, first assessment 2025
            </a>{' '}
            ·{' '}
            <a
              href="https://rapier.rs/docs/user_guides/javascript/rigid_bodies/"
              target="_blank"
              rel="noreferrer"
            >
              Rapier rigid-body documentation
            </a>
          </details>
        </main>
      </div>
    </div>
  );
}
