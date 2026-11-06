import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameProps } from '../../core/types';
import { readRecord, writeRecord } from '../../core/storage';
import { dataset, augment } from './datasets';
import type { DataKind, Sample } from './datasets';
import type { Preset, Snapshot } from './engine';
import { VisionClient } from './client';
import { evaluateVisionMission } from './outcome';
import { modelEvidence, provenanceMetrics } from './provenance';
import { draftStatus, evidenceReducer, freshEvidence, linearDecision } from './experiment';
import type { InspectedPart } from './experiment';
import ObjectiveChecklist from '../../components/ObjectiveChecklist';
import { StartupGate } from './startup';
import './vision.css';
const names = ['Circle', 'Square', 'Triangle'];
function Part({ sample, size = 40 }: { sample: Sample; size?: number }) {
  return sample.input.length === 2 ? (
    <div
      className="vision-sensor-part"
      style={{
        width: size,
        height: size,
        background: `rgb(${80 + sample.input[0]! * 150},${100 + sample.input[1]! * 120},130)`,
      }}
    >
      <span>{sample.input[0]!.toFixed(1)}</span>
      <span>{sample.input[1]!.toFixed(1)}</span>
    </div>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label="Grayscale part image">
      {sample.input.map((v, i) => (
        <rect
          key={i}
          x={i % 16}
          y={Math.floor(i / 16)}
          width="1"
          height="1"
          fill={`rgb(${v * 255},${v * 255},${v * 255})`}
        />
      ))}
    </svg>
  );
}
export default function VisionWorkshop({ mission, onExit, onAttempt, settings }: GameProps) {
  const order = mission?.order ?? 1;
  const initialKind: DataKind = order >= 4 ? 'image' : order === 2 ? 'xor' : 'linear';
  const [kind, setKind] = useState<DataKind>(initialKind);
  const [preset, setPreset] = useState<Preset>(
    initialKind === 'image' ? 'cnn' : initialKind === 'xor' ? 'mlp' : 'perceptron',
  );
  const [units, setUnits] = useState(12),
    [epochs, setEpochs] = useState(initialKind === 'image' ? 16 : 45),
    [rate, setRate] = useState(0.025),
    [augmentation, setAugmentation] = useState(false);
  const makeSamples = (k: DataKind) =>
    dataset(k, 'train', 72).map((s, i) => ({
      ...s,
      label: order === 3 && k === 'linear' && i < 9 ? 1 - s.label : s.label,
    }));
  const [samples, setSamples] = useState<Sample[]>(() => makeSamples(initialKind));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(samples.map((s) => s.id)));
  const [focus, setFocus] = useState(0);
  const [status, setStatus] = useState('Preparing your robot’s starter brain…');
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [evidence, dispatch] = useReducer(evidenceReducer, undefined, freshEvidence);
  const {
    curve,
    curveEpochs,
    inspection,
    inspected,
    elapsed,
    lastAccuracy,
    mistakes,
    paused,
    resultMessage,
    inspectorOpen,
    lastDecision,
    binCounts,
    criteria,
  } = evidence;
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [stage, setStage] = useState<'data' | 'train' | 'deploy'>('data');
  const [run, setRun] = useState<{
    samples: Sample[];
    predictions: number[][];
    index: number;
    correct: number;
  } | null>(null);
  const [hidden, setHidden] = useState(false);
  const client = useRef<VisionClient | null>(null);
  const deploySamples = useRef<Sample[]>([]);
  const training = useMemo(() => samples.filter((s) => selected.has(s.id)), [samples, selected]);
  const trainingRows = useMemo(
    () => (augmentation ? training.flatMap((s) => [s, ...augment(s)]) : training),
    [training, augmentation],
  );
  const current = useRef({ kind, preset, units, epochs, rate, training, trainingRows });
  current.current = { kind, preset, units, epochs, rate, training, trainingRows };
  const activeModel = useRef<Snapshot | null>(null);
  const restoring = useRef(false);
  const startup = useRef<StartupGate | null>(null);
  const pendingInspection = useRef<InspectedPart | null>(null);
  const inspectorRef = useRef<HTMLDetailsElement | null>(null);
  const launchTraining = (starter = false) => {
    if (document.hidden) return;
    startup.current?.invalidate();
    const c = current.current;
    restoring.current = false;
    dispatch({
      type: 'patch',
      values: {
        curve: [],
        curveEpochs: c.epochs,
        mistakes: [],
        lastAccuracy: null,
        resultMessage: '',
        lastDecision: null,
        paused: false,
        binCounts: [0, 0, 0],
        criteria: [],
        inspection: null,
        inspected: null,
      },
    });
    setBusy(true);
    setReady(false);
    setRun(null);
    pendingInspection.current = c.training[0]
      ? { sample: c.training[0], source: 'training' }
      : null;
    setStatus(starter ? 'Preparing a real starter model…' : 'Learning from your selected labels…');
    client.current!.request({
      action: 'train',
      kind: c.kind,
      preset: c.preset,
      units: c.units,
      epochs: c.epochs,
      rate: c.rate,
      auditRepairedLabels: order === 3 && c.kind === 'linear',
      train: c.trainingRows,
      validation: dataset(c.kind, 'validation', 24),
    });
  };
  useEffect(() => {
    let disposed = false;
    const gate = new StartupGate(() => !document.hidden);
    startup.current = gate;
    const c = new VisionClient((response) => {
      if (disposed || document.hidden) return;
      if (response.type === 'progress' && response.epoch) {
        dispatch({ type: 'epoch', epoch: response.epoch });
        setStatus(`Learning · epoch ${response.epoch.epoch}`);
      }
      if (response.type === 'ready') {
        const model = response.snapshot;
        if (model) {
          activeModel.current = model;
          setPreset(model.preset);
          setUnits(model.units);
        }
        setBusy(false);
        setReady(!!model);
        dispatch({
          type: 'model-ready',
          restored: restoring.current,
          snapshot: model,
          inspection: response.inspection ?? null,
          inspected: pendingInspection.current,
        });
        restoring.current = false;
        setSaved(model ?? null);
        const evidence = model?.provenance;
        setStatus(
          evidence?.status === 'known'
            ? 'Robot ready. Deploy the held-out comparison batch.'
            : 'Robot ready · saved training evidence unknown. Retrain to earn data-repair or augmentation credit.',
        );
        if (model)
          void writeRecord('vision-model-v1', model).catch(() => {
            if (!disposed) setStatus('Robot ready · local model save unavailable.');
          });
      }
      if (response.type === 'error') {
        setBusy(false);
        setStatus(response.error ?? 'Training failed');
      }
      if (response.type === 'predictions' && response.predictions) {
        setBusy(false);
        setRun({
          samples: deploySamples.current,
          predictions: response.predictions,
          index: 0,
          correct: 0,
        });
        setStatus('Sorting the held-out comparison batch…');
      }
      if (response.type === 'inspection' && response.inspection)
        dispatch({
          type: 'patch',
          values: { inspection: response.inspection, inspected: pendingInspection.current },
        });
    });
    client.current = c;
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        gate.invalidate();
        c.cancel();
        setBusy(false);
        setReady(false);
        setRun(null);
        dispatch({ type: 'hidden' });
        setStatus('Paused while hidden. Restore your model or retrain to continue.');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    visibility();
    void gate.start(
      () => readRecord<Snapshot | null>('vision-model-v1', null),
      (model) => {
        if (model && model.kind === initialKind) {
          setPreset(model.preset);
          restoring.current = true;
          dispatch({ type: 'restore-started' });
          pendingInspection.current = { sample: samples[0]!, source: 'training' };
          c.request({
            action: 'restore',
            snapshot: model,
            inputs: [dataset(initialKind, 'train', 1)[0]!.input],
          });
        } else launchTraining(true);
      },
      () => launchTraining(true),
    );
    return () => {
      disposed = true;
      gate.dispose();
      c.dispose();
      if (startup.current === gate) startup.current = null;
      document.removeEventListener('visibilitychange', visibility);
    };
    // A mission view owns exactly one worker; parent remounts when changing missions.
  }, []);
  const advancePart = useCallback(() => {
    if (!run || hidden) return;
    const index = run.index;
    const sample = run.samples[index]!;
    const p = run.predictions[index]!;
    const prediction = p.indexOf(Math.max(...p));
    const correct = run.correct + Number(prediction === sample.label);
    dispatch({
      type: 'decision',
      decision: { sample, prediction, scores: p, correct: prediction === sample.label },
    });
    if (index + 1 === run.samples.length) {
      const accuracy = correct / run.samples.length;
      const model = activeModel.current!;
      const t = modelEvidence(model);
      const parameters = model.weights.reduce((sum, w) => sum + w.values.length, 0);
      const evaluation = mission
        ? evaluateVisionMission(order, {
            ...t,
            accuracy,
            parameters,
            correct,
            total: run.samples.length,
          })
        : { completed: false, criteria: [] };
      const complete = evaluation.completed;
      setRun(null);
      setStatus(`Batch finished · ${correct} of ${run.samples.length} sorted correctly`);
      const resultMessage = !mission
        ? 'Experiment finished. Inspect the mistakes or try another model.'
        : complete
          ? 'Contract fulfilled. Your measurements meet the target.'
          : (evaluation.criteria.find((c) => !c.passed)?.hint ??
            'Inspect the mistakes and compare another experiment.');
      dispatch({
        type: 'patch',
        values: { lastAccuracy: accuracy, resultMessage, criteria: evaluation.criteria },
      });
      const provenance = model.provenance;
      const known = provenance?.status === 'known' ? provenance : null;
      onAttempt({
        id: crypto.randomUUID(),
        game: 'vision',
        missionId: mission?.id ?? null,
        completed: complete,
        createdAt: Date.now(),
        metrics: {
          accuracy,
          correct,
          total: run.samples.length,
          parameters,
          ...provenanceMetrics(model),
        },
        criteria: evaluation.criteria,
        configuration: {
          task: model.kind,
          model: model.preset,
          preset: model.preset,
          hiddenUnits: model.preset === 'mlp' ? model.units : 0,
          epochs: known?.epochs ?? 'unknown',
          augmentation: known?.augmented ?? 'unknown',
          learningRate: known?.learningRate ?? 'unknown',
          trainingExamples: known?.examples ?? 'unknown',
          trainingData: known?.fingerprint ?? 'unknown',
          batch: order === 5 ? 'shifted comparison 01' : 'comparison 01',
        },
        summary: `Sorted ${correct}/${run.samples.length} held-out comparison parts with ${t.preset}; ${parameters} learned parameters.`,
      });
    } else setRun({ ...run, index: index + 1, correct });
  }, [run, hidden, order, mission, onAttempt]);
  useEffect(() => {
    if (!run || paused || hidden) return;
    const timer = setTimeout(advancePart, settings.reducedMotion ? 120 : 420);
    return () => clearTimeout(timer);
  }, [run, paused, hidden, advancePart, settings.reducedMotion]);
  const changeKind = (k: DataKind) => {
    startup.current?.invalidate();
    client.current?.cancel();
    const next = makeSamples(k);
    setKind(k);
    setSamples(next);
    setSelected(new Set(next.map((s) => s.id)));
    setPreset(k === 'image' ? 'cnn' : k === 'xor' ? 'mlp' : 'perceptron');
    setEpochs(k === 'image' ? 16 : 45);
    setFocus(0);
    setReady(false);
    setBusy(false);
    setSaved(null);
    activeModel.current = null;
    pendingInspection.current = null;
    dispatch({ type: 'reset' });
    setRun(null);
    setStatus('New dataset loaded. Train a robot for these inputs.');
  };
  const deploy = () => {
    if (!ready || document.hidden || !activeModel.current) return;
    const test = dataset(activeModel.current.kind, 'test', 24, order === 5);
    deploySamples.current = test;
    setStage('deploy');
    setBusy(true);
    dispatch({
      type: 'patch',
      values: {
        mistakes: [],
        resultMessage: '',
        paused: false,
        lastDecision: null,
        binCounts: [0, 0, 0],
        criteria: [],
        lastAccuracy: null,
      },
    });
    client.current!.request({ action: 'predict', inputs: test.map((s) => s.input) });
  };
  const restore = () => {
    if (!saved || document.hidden) return;
    startup.current?.invalidate();
    setBusy(true);
    restoring.current = true;
    dispatch({ type: 'restore-started' });
    pendingInspection.current = { sample: samples[focus]!, source: 'training' };
    client.current!.request({
      action: 'restore',
      snapshot: saved,
      inputs: [samples[focus]!.input],
    });
  };
  const cancelWork = () => {
    startup.current?.invalidate();
    client.current?.cancel();
    setBusy(false);
    setReady(false);
    dispatch({ type: 'cancelled' });
    setStatus('Training cancelled. The last saved model is available to restore.');
  };
  const inspectPart = (sample: Sample, source: InspectedPart['source'], reveal = true) => {
    if (!ready || busy || run || activeModel.current?.kind !== kind) return;
    pendingInspection.current = { sample, source };
    dispatch({ type: 'patch', values: { inspected: null, inspectorOpen: true } });
    client.current?.request({ action: 'inspect', inputs: [sample.input] });
    if (reveal)
      requestAnimationFrame(() =>
        inspectorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }),
      );
  };
  const trained = activeModel.current;
  const draft = useMemo(
    () =>
      draftStatus(trained, {
        kind,
        preset,
        units,
        epochs,
        rate,
        augmentation,
        train: trainingRows,
      }),
    [trained, kind, preset, units, epochs, rate, augmentation, trainingRows],
  );
  const trainedEvidence = trained?.provenance?.status === 'known' ? trained.provenance : null;
  const currentInspectedTrainingLabel =
    inspected?.source === 'training'
      ? samples.find((sample) => sample.id === inspected.sample.id)?.label
      : undefined;
  const linear =
    trained?.preset === 'perceptron' && trained.kind !== 'image' && inspection && inspected
      ? linearDecision(inspection.weights, inspected.sample.input)
      : null;
  const active = run?.samples[run.index];
  const activePrediction = run?.predictions[run.index];
  const predicted = activePrediction ? activePrediction.indexOf(Math.max(...activePrediction)) : -1;
  return (
    <div className={`vision-workshop ${settings.reducedMotion ? 'vision-reduced' : ''}`}>
      <header className="vision-header">
        <div>
          <p className="vision-eyebrow">
            ROBOTICS DEPARTMENT / {mission ? `CONTRACT 0${order}` : 'OPEN WORKSHOP'}
          </p>
          <h1>
            Robot Vision <span>Workshop</span>
          </h1>
        </div>
        <button onClick={onExit}>← Workshop hub</button>
      </header>
      <div className="vision-brief">
        <span className="vision-contract">{mission?.title ?? 'Your sorting laboratory'}</span>
        <p>
          {mission?.brief ??
            'Collect examples, teach a tiny neural network, and put its decisions to work.'}
        </p>
        <strong>{mission?.objective ?? 'Experiment freely with sensors and shapes.'}</strong>
      </div>
      <section className="vision-model-state" aria-label="Trained model status">
        <div>
          <strong>
            {trained
              ? `${ready ? 'Active' : 'Last'} trained model · ${trained.preset.toUpperCase()}`
              : 'No trained model ready'}
          </strong>
          <span>
            {trainedEvidence
              ? `${trainedEvidence.epochs} completed epochs · augmentation ${trainedEvidence.augmented ? 'used' : 'off'}${trainedEvidence.examples ? ` · ${trainedEvidence.examples} training rows` : ''}`
              : 'Training settings unknown until a fresh training run.'}
          </span>
        </div>
        <p data-testid="vision-draft-status">
          {draft === 'changed'
            ? 'Draft changed. Deploy still uses the trained model; retrain to apply your edits.'
            : draft === 'unknown'
              ? 'Saved weights are available; full training settings are unknown. Retrain to apply this draft.'
              : draft === 'current'
                ? 'Draft matches the trained model. Deployment uses these weights.'
                : 'Choose your examples and train a model for this task.'}
        </p>
        {(draft === 'changed' || draft === 'unknown') && (
          <button disabled={busy || !!run} onClick={() => setStage('train')}>
            Review draft & retrain →
          </button>
        )}
      </section>
      <div className="vision-layout">
        <main className="vision-factory">
          <div className="vision-floor-label">
            <span>
              LINE 04 <b> / VISION SORTING</b>
            </span>
            <span className="vision-live">
              {run ? (paused ? '● BELT PAUSED' : '● SORTING') : busy ? '● LEARNING' : '● STANDBY'}
            </span>
          </div>
          <div className="vision-scene" aria-label="Robot sorting conveyor">
            <div className="vision-factory-window" />
            <div className="vision-robot">
              <div className="vision-antenna" />
              <div className="vision-head">
                <i />
                <i />
                <span />
              </div>
              <div className="vision-body">V / 04</div>
              <div className={`vision-arm ${run && !paused ? 'vision-working' : ''}`} />
            </div>
            <div className="vision-scanner">
              <span>OPTICAL GATE</span>
              <div />
            </div>
            <div className={`vision-belt ${run && !paused ? 'vision-moving' : ''}`}>
              {(run ? run.samples.slice(run.index, run.index + 5) : samples.slice(0, 5)).map(
                (s, i) => (
                  <div
                    className="vision-belt-object"
                    key={s.id}
                    style={{ left: `${12 + i * 17}%` }}
                  >
                    <Part sample={s} size={50} />
                  </div>
                ),
              )}
            </div>
            <div className="vision-bin vision-bin-a">
              <b>{kind === 'image' ? '○ CIRCLE' : 'BIN 0'}</b>
              <span>
                {binCounts[0]} sorted {active && predicted === 0 ? '↓ receiving' : ''}
              </span>
            </div>
            <div className="vision-bin vision-bin-b">
              <b>{kind === 'image' ? '□ SQUARE' : 'BIN 1'}</b>
              <span>
                {binCounts[1]} sorted {active && predicted === 1 ? '↓ receiving' : ''}
              </span>
            </div>
            {kind === 'image' && (
              <div className="vision-bin vision-bin-c">
                <b>△ TRIANGLE</b>
                <span>
                  {binCounts[2]} sorted {active && predicted === 2 ? '↓ receiving' : ''}
                </span>
              </div>
            )}
          </div>
          <div className="vision-scoreboard">
            <div>
              <small>THIS BATCH</small>
              <strong>
                {run
                  ? `${run.correct} / ${run.index} correct`
                  : lastAccuracy !== null
                    ? `${(lastAccuracy * 100).toFixed(1)}%`
                    : '24 parts'}
              </strong>
            </div>
            <div>
              <small>{run ? `SCANNING PART ${run.index + 1} / 24` : 'ROBOT’S DECISION'}</small>
              <strong>
                {active
                  ? kind === 'image'
                    ? names[predicted]
                    : `Bin ${predicted}`
                  : lastDecision
                    ? kind === 'image'
                      ? names[lastDecision.prediction]
                      : `Bin ${lastDecision.prediction}`
                    : 'Awaiting batch'}
              </strong>
            </div>
            <div>
              <small>MODEL SIZE</small>
              <strong>
                {inspection?.parameters ?? '—'} <em>parameters</em>
              </strong>
            </div>
          </div>
          <div className="vision-actions">
            <button className="vision-primary" disabled={!ready || busy || !!run} onClick={deploy}>
              ▶ Deploy robot · 24 parts
            </button>
            {run && (
              <button onClick={() => dispatch({ type: 'toggle-pause' })}>
                {paused ? 'Resume belt' : 'Pause belt'}
              </button>
            )}
            {run && paused && <button onClick={advancePart}>Step one part</button>}
            {busy && <button onClick={cancelWork}>Cancel</button>}
            {saved && !ready && !busy && <button onClick={restore}>Restore last model</button>}
          </div>
          {lastDecision && (
            <div
              className={`vision-decision ${lastDecision.correct ? 'vision-correct' : 'vision-wrong'}`}
              aria-label="Latest sorting decision"
            >
              <Part sample={lastDecision.sample} size={44} />
              <div>
                <strong>{lastDecision.correct ? 'Correct bin' : 'Wrong bin'}</strong>
                <p>
                  Robot chose{' '}
                  {kind === 'image'
                    ? names[lastDecision.prediction]
                    : `bin ${lastDecision.prediction}`}{' '}
                  · verified label{' '}
                  {kind === 'image'
                    ? names[lastDecision.sample.label]
                    : `bin ${lastDecision.sample.label}`}
                </p>
                <div className="vision-score-bars" aria-label="Latest model scores">
                  {lastDecision.scores.map((score, i) => (
                    <span key={i}>
                      {kind === 'image' ? names[i] : `Bin ${i}`}{' '}
                      <meter
                        min="0"
                        max="1"
                        value={score}
                        aria-label={`${kind === 'image' ? names[i] : `Bin ${i}`} model score`}
                      />{' '}
                      {(score * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="vision-status" role="status">
            {status}
          </div>
          {resultMessage && <p className="vision-result">{resultMessage}</p>}
          {criteria.length > 0 && <ObjectiveChecklist criteria={criteria} compact />}
          {mistakes.length > 0 && (
            <div className="vision-mistakes">
              <h3>
                Costly mistakes <small>held out · never added to training</small>
              </h3>
              <div>
                {mistakes.map(({ sample, prediction }) => (
                  <button
                    key={sample.id}
                    disabled={!ready || busy || !!run}
                    aria-label={`Inspect held-out example ${sample.id}`}
                    onClick={() => inspectPart(sample, 'held-out')}
                  >
                    <Part sample={sample} size={30} />
                    <span>
                      {kind === 'image' ? names[prediction] : prediction} →{' '}
                      {kind === 'image' ? names[sample.label] : sample.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
        <aside className="vision-console">
          <nav aria-label="Vision workflow">
            {(['data', 'train', 'deploy'] as const).map((s, i) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                aria-current={stage === s ? 'step' : undefined}
              >
                <b>0{i + 1}</b> {s}
              </button>
            ))}
          </nav>
          {stage === 'data' && (
            <section>
              <h2>Teach by example.</h2>
              <p>Select parts and check their labels. Only this drawer is used for training.</p>
              <label>
                Input task
                <select
                  value={kind}
                  disabled={busy || !!run}
                  onChange={(e) => changeKind(e.target.value as DataKind)}
                >
                  <option value="linear">Two sensors · straight boundary</option>
                  <option value="xor">Two sensors · opposite corners</option>
                  <option value="image">16 × 16 grayscale shapes</option>
                </select>
              </label>
              <div className="vision-data-summary">
                <strong>{selected.size}</strong> / 72 selected{' '}
                <span>
                  {new Set(samples.filter((s) => selected.has(s.id)).map((s) => s.label)).size}{' '}
                  classes
                </span>
              </div>
              <div className="vision-sample-grid">
                {samples.map((s, i) => (
                  <button
                    key={s.id}
                    aria-label={`Inspect training example ${i + 1}`}
                    className={`${focus === i ? 'vision-focused' : ''} ${!selected.has(s.id) ? 'vision-excluded' : ''}`}
                    onClick={() => {
                      setFocus(i);
                      if (ready && !busy && !run) inspectPart(s, 'training', false);
                    }}
                  >
                    <Part sample={s} size={32} />
                    <span>{kind === 'image' ? names[s.label] : `Bin ${s.label}`}</span>
                  </button>
                ))}
              </div>
              <div className="vision-label-editor">
                <strong>Example {focus + 1}</strong>
                {kind !== 'image' && (
                  <div className="vision-sensor-readings" aria-label="Selected sensor readings">
                    <span>
                      A = {samples[focus]!.input[0]!.toFixed(6)} · B ={' '}
                      {samples[focus]!.input[1]!.toFixed(6)}
                    </span>
                    {kind === 'linear' ? (
                      <span>
                        Factory rule: 0.7A + 0.3B ={' '}
                        {(
                          samples[focus]!.input[0]! * 0.7 +
                          samples[focus]!.input[1]! * 0.3
                        ).toFixed(6)}
                        . Above 0.5 → bin 1; otherwise bin 0.
                      </span>
                    ) : (
                      <span>
                        Factory rule: exactly one sensor above 0.5 → bin 1; otherwise bin 0. A is{' '}
                        {samples[focus]!.input[0]! > 0.5 ? 'above' : 'at or below'} 0.5; B is{' '}
                        {samples[focus]!.input[1]! > 0.5 ? 'above' : 'at or below'} 0.5.
                      </span>
                    )}
                  </div>
                )}
                <label>
                  Training label
                  <select
                    disabled={busy || !!run}
                    value={samples[focus]!.label}
                    onChange={(e) =>
                      setSamples((old) =>
                        old.map((s, i) =>
                          i === focus ? { ...s, label: Number(e.target.value) } : s,
                        ),
                      )
                    }
                  >
                    {(kind === 'image' ? [0, 1, 2] : [0, 1]).map((l) => (
                      <option key={l} value={l}>
                        {kind === 'image' ? names[l] : `Bin ${l}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="vision-check">
                  <input
                    type="checkbox"
                    disabled={busy || !!run}
                    checked={selected.has(samples[focus]!.id)}
                    onChange={(e) =>
                      setSelected((old) => {
                        const next = new Set(old);
                        if (e.target.checked) next.add(samples[focus]!.id);
                        else next.delete(samples[focus]!.id);
                        return next;
                      })
                    }
                  />{' '}
                  Include in training
                </label>
                <button
                  className="vision-inspect-selected"
                  disabled={!ready || busy || !!run}
                  onClick={() => inspectPart(samples[focus]!, 'training')}
                >
                  Inspect selected model response ↓
                </button>
              </div>
              {order === 3 && (
                <p className="vision-hint">
                  Audit note: the first nine labels were reversed. The factory rule is 0.7 × sensor
                  A + 0.3 × sensor B &gt; 0.5 → bin 1.
                </p>
              )}
              <label className="vision-check">
                <input
                  type="checkbox"
                  checked={augmentation}
                  disabled={busy || !!run}
                  onChange={(e) => setAugmentation(e.target.checked)}
                />{' '}
                Augment training families (
                {kind === 'image' ? 'translations + dimming' : 'sensor jitter'})
              </label>
              <button className="vision-primary" onClick={() => setStage('train')}>
                Next · configure brain →
              </button>
            </section>
          )}
          {stage === 'train' && (
            <section>
              <h2>
                A small brain.
                <br />A real learner.
              </h2>
              <p>
                The CPU worker learns from your labels. Validation parts measure progress
                independently.
              </p>
              <label>
                Architecture
                <select
                  disabled={busy || !!run}
                  value={preset}
                  onChange={(e) => {
                    setPreset(e.target.value as Preset);
                  }}
                >
                  <option value="perceptron">Perceptron · linear softmax</option>
                  <option value="mlp">MLP · one tanh hidden layer</option>
                  {kind === 'image' && (
                    <option value="cnn">CNN · conv + ReLU + pool + dense</option>
                  )}
                </select>
              </label>
              <div className="vision-control-row">
                <label>
                  Epochs
                  <input
                    type="number"
                    min="1"
                    max="60"
                    disabled={busy || !!run}
                    value={epochs}
                    onChange={(e) => setEpochs(Math.max(1, Math.min(60, Number(e.target.value))))}
                  />
                </label>
                <label>
                  Learning rate
                  <select
                    disabled={busy || !!run}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  >
                    {[0.005, 0.015, 0.025, 0.05, 0.08].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {preset === 'mlp' && (
                  <label>
                    Hidden units
                    <select
                      disabled={busy || !!run}
                      value={units}
                      onChange={(e) => setUnits(Number(e.target.value))}
                    >
                      {[4, 8, 12, 16].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <button
                className="vision-primary"
                disabled={busy || !!run || selected.size < 6}
                onClick={() => launchTraining()}
              >
                ↻ Train robot
              </button>
              <div className="vision-learning">
                <div>
                  <strong>Learning curve</strong>
                  <div className="vision-curve-legend" aria-label="Loss curve legend">
                    <span className="vision-training-loss">Training loss</span>
                    <span className="vision-validation-loss">Validation loss</span>
                  </div>
                </div>
                <svg viewBox="0 0 300 100" aria-label="Actual training and validation loss curve">
                  <path d="M0 90H300" stroke="#ccc" />
                  {['loss', 'valLoss'].map((key, j) => (
                    <polyline
                      key={key}
                      fill="none"
                      stroke={j ? '#ef2b12' : '#111111'}
                      strokeDasharray={j ? '6 4' : undefined}
                      strokeWidth="2"
                      points={curve
                        .map(
                          (e, i) =>
                            `${(i / Math.max(1, curveEpochs - 1)) * 300},${95 - Math.min(3, e[key as 'loss']) * 28}`,
                        )
                        .join(' ')}
                    />
                  ))}
                </svg>
                <p>
                  {curve.length
                    ? `Epoch ${curve.at(-1)!.epoch} · validation ${Math.round(curve.at(-1)!.valAccuracy * 100)}%`
                    : ready
                      ? 'No learning curve is stored with this model. Retrain to record one.'
                      : 'Training measurements appear here.'}
                  {elapsed > 0 && ` · ${(elapsed / 1000).toFixed(2)}s last training`}
                </p>
              </div>
            </section>
          )}
          {stage === 'deploy' && (
            <section>
              <h2>Put it to work.</h2>
              <p>
                {order === 5
                  ? 'This batch has dimmer, shifted shapes from separate test families.'
                  : 'These 24 parts form a held-out comparison batch. Your robot only receives sensor readings or pixels.'}
              </p>
              <div className="vision-deploy-target">
                <small>{mission ? 'CONTRACT TARGET' : 'COMPARISON BATCH'}</small>
                <strong>
                  {mission ? (
                    <>At least {order === 5 ? '16' : order >= 4 ? '18' : '20'} / 24 correct</>
                  ) : (
                    'Explore 24 parts'
                  )}
                </strong>
                {mission ? (
                  <>
                    <span>Accuracy threshold {order === 5 ? '65' : order >= 4 ? '75' : '80'}%</span>
                    {order === 6 && <span>≤ 1,500 learned parameters</span>}
                  </>
                ) : (
                  <span>Compare accuracy, model size, and mistakes across experiments.</span>
                )}
              </div>
              <p>
                Retries use the same comparison batch so you can compare changes. Reviewed parts
                stay outside training; they are not fresh unseen evidence. The answer key only
                scores completed decisions.
              </p>
              <button onClick={() => setStage('data')}>← Improve the training data</button>
            </section>
          )}
        </aside>
      </div>
      {inspection && (
        <details
          className="vision-inspector"
          ref={inspectorRef}
          open={inspectorOpen}
          onToggle={(e) =>
            dispatch({ type: 'patch', values: { inspectorOpen: e.currentTarget.open } })
          }
        >
          <summary>Inside the active model · real weights, decision surface & feature maps</summary>
          <div className="vision-inspected-input" aria-label="Inspected model input">
            {inspected ? (
              <>
                <Part sample={inspected.sample} size={80} />
                <div>
                  <h3>Inspected {inspected.source} example</h3>
                  <p>{inspected.sample.id}</p>
                  <p>
                    {inspected.source === 'training' ? 'Training label' : 'Verified held-out label'}
                    :{' '}
                    {kind === 'image'
                      ? names[currentInspectedTrainingLabel ?? inspected.sample.label]
                      : `Bin ${currentInspectedTrainingLabel ?? inspected.sample.label}`}
                  </p>
                  {kind !== 'image' && (
                    <p>
                      A = {inspected.sample.input[0]!.toFixed(6)} · B ={' '}
                      {inspected.sample.input[1]!.toFixed(6)}
                    </p>
                  )}
                  <div className="vision-score-bars" aria-label="Inspected model scores">
                    {inspection.scores.map((score, i) => (
                      <span key={i}>
                        {kind === 'image' ? names[i] : `Bin ${i}`}{' '}
                        <meter
                          min="0"
                          max="1"
                          value={score}
                          aria-label={`${kind === 'image' ? names[i] : `Bin ${i}`} inspected model score`}
                        />{' '}
                        {(score * 100).toFixed(2)}%
                      </span>
                    ))}
                  </div>
                  <small>Softmax model scores computed from these active weights.</small>
                </div>
              </>
            ) : (
              <p>Reading the selected input through the active model…</p>
            )}
          </div>
          {linear && (
            <p className="vision-linear-rule">
              Learned decision: {linear.a.toFixed(4)} × A + {linear.b.toFixed(4)} × B +{' '}
              {linear.bias.toFixed(4)} = <strong>{linear.score.toFixed(4)}</strong>. Positive → bin
              1; zero or negative → bin 0. These are class-one minus class-zero weights and biases.
            </p>
          )}
          <div className="vision-inspector-grid">
            <div>
              <h3>Learned tensors</h3>
              {inspection.weights.map((w, i) => (
                <p key={i}>
                  <b>
                    {trained?.preset === 'perceptron'
                      ? i === 0
                        ? 'Input → class weights'
                        : 'Class biases'
                      : [
                          'Input/filter weights',
                          'Hidden/filter biases',
                          'Hidden → class weights',
                          'Class biases',
                        ][i]}{' '}
                    · {w.shape.join(' × ')}
                  </b>{' '}
                  [
                  {w.values
                    .slice(0, 12)
                    .map((v) => v.toFixed(3))
                    .join(', ')}
                  {w.values.length > 12 ? ', …' : ''}]
                </p>
              ))}
            </div>
            {inspection.boundary.length > 0 && (
              <div>
                <h3>Decision surface</h3>
                <div className="vision-boundary">
                  {inspection.boundary.map((p, i) => (
                    <i
                      key={i}
                      style={{ background: `color-mix(in srgb, #1e6a61 ${p * 100}%, #f1a078)` }}
                    />
                  ))}
                </div>
                <small>A → · B ↓ · colour = P(bin 1)</small>
              </div>
            )}
            {inspection.activations.length > 0 && inspected && (
              <div>
                <h3>Active convolution · {inspection.activationShape.slice(1).join(' × ')}</h3>
                <div className="vision-feature-maps">
                  {[0, 1, 2, 3].map((channel) => (
                    <div key={channel} aria-label={`Filter ${channel + 1} activation map`}>
                      {Array.from({ length: 196 }, (_, i) => (
                        <i
                          key={i}
                          style={{
                            background: `rgba(30,106,97,${Math.min(1, inspection.activations[i * 4 + channel]! / Math.max(0.001, ...inspection.activations))})`,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <small>
                  Actual ReLU outputs for the inspected part; each map shares a learned kernel.
                </small>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
