import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { readRecord, writeRecord } from '../../core/storage';
import { VisionEngine } from './engine';
import type { Snapshot } from './engine';
import { dataset, augment } from './datasets';
import { missionComplete } from './outcome';
import { modelEvidence, provenanceMetrics, validProvenance } from './provenance';

it.each([3, 5])(
  'retains genuine mission %i evidence across save, new model mount and deployment',
  async (order) => {
    const kind = order === 3 ? 'linear' : 'image';
    const engine = new VisionEngine();
    await engine.init(kind, kind === 'image' ? 'cnn' : 'perceptron', 12);
    const base = dataset(kind, 'train', 72);
    const train = order === 5 ? base.flatMap((s) => [s, ...augment(s)]) : base;
    await engine.train(
      train,
      dataset(kind, 'validation', 24),
      kind === 'image' ? 16 : 45,
      0.025,
      () => {},
      { auditRepairedLabels: order === 3 },
    );
    const snapshot = engine.snapshot();
    expect(snapshot.provenance?.status).toBe('known');
    const fixtures = dataset(kind, 'test', 24, order === 5);
    const predictions = engine.predict(fixtures.map((s) => s.input));
    const before = {
      ...modelEvidence(snapshot),
      accuracy: engine.evaluate(fixtures).accuracy,
      parameters: engine.inspect(base[0]!.input).parameters,
    };
    expect(missionComplete(order, before)).toBe(true);
    await writeRecord(`vision-roundtrip-${order}`, snapshot);
    engine.dispose();
    const loaded = await readRecord<Snapshot | null>(`vision-roundtrip-${order}`, null);
    const remounted = new VisionEngine();
    await remounted.restore(loaded!);
    const after = remounted.snapshot();
    expect(after.provenance).toEqual(snapshot.provenance);
    expect(provenanceMetrics(after)).toEqual(provenanceMetrics(snapshot));
    expect(remounted.predict(fixtures.map((s) => s.input))).toEqual(predictions);
    expect(
      missionComplete(order, {
        ...modelEvidence(after),
        accuracy: remounted.evaluate(fixtures).accuracy,
        parameters: remounted.inspect(base[0]!.input).parameters,
      }),
    ).toBe(true);
    const legacy = { ...snapshot };
    delete legacy.provenance;
    await remounted.restore(legacy);
    expect(remounted.snapshot().provenance).toEqual({ status: 'unknown' });
    expect(provenanceMetrics(remounted.snapshot())).toEqual({ provenanceKnown: 0 });
    expect(
      missionComplete(order, {
        ...modelEvidence(remounted.snapshot()),
        accuracy: 1,
        parameters: 631,
      }),
    ).toBe(false);
    remounted.dispose();
  },
  30000,
);
it('rejects invalid provenance atomically instead of inventing evidence', async () => {
  const e = new VisionEngine();
  await e.init('linear', 'perceptron');
  const original = e.snapshot();
  for (const invalid of [
    { status: 'known', augmented: 'yes', repairs: 9, epochs: 45, trainingMs: 100 },
    { status: 'known', augmented: true, repairs: 100, epochs: 45, trainingMs: 100 },
    { status: 'known', augmented: true, repairs: 3, epochs: 0, trainingMs: 100 },
    { status: 'known', augmented: true, repairs: 3, epochs: 45, trainingMs: NaN },
  ]) {
    await expect(e.restore({ ...original, provenance: invalid } as Snapshot)).rejects.toThrow(
      'Invalid saved model',
    );
    expect(e.snapshot()).toEqual(original);
  }
  e.dispose();
});
it('retraining a legacy model earns newly measured provenance without borrowing cancelled epochs', async () => {
  const e = new VisionEngine();
  await e.init('linear', 'perceptron');
  const legacy = e.snapshot();
  delete legacy.provenance;
  await e.restore(legacy);
  expect(provenanceMetrics(e.snapshot())).toEqual({ provenanceKnown: 0 });
  await e.train(
    dataset('linear', 'train', 72),
    dataset('linear', 'validation', 12),
    45,
    0.025,
    () => e.cancel(),
    { auditRepairedLabels: true },
  );
  expect(e.snapshot().provenance).toMatchObject({
    status: 'known',
    augmented: false,
    repairs: 9,
    epochs: 1,
  });
  e.dispose();
});

it('accepts older evidence while bounding optional saved training settings', () => {
  const legacy = { status: 'known', augmented: false, repairs: 0, epochs: 45, trainingMs: 100 };
  expect(validProvenance(legacy)).toBe(true);
  expect(
    validProvenance({ ...legacy, learningRate: 0.025, examples: 72, fingerprint: '1234abcd' }),
  ).toBe(true);
  for (const fields of [
    { learningRate: NaN },
    { learningRate: 0.2 },
    { examples: 361 },
    { examples: 5 },
    { fingerprint: 'unbounded arbitrary settings' },
  ])
    expect(validProvenance({ ...legacy, ...fields })).toBe(false);
});
