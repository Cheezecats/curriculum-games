import { expect, it } from 'vitest';
import { dataset } from './datasets';
import { VisionEngine } from './engine';
import { evidenceReducer, freshEvidence } from './experiment';

it.each(['cancelled', 'hidden'] as const)(
  'discards interrupted training measurements on %s and restores only the saved model evidence',
  async (interruption) => {
    const engine = new VisionEngine();
    const train = dataset('linear', 'train', 24);
    const validation = dataset('linear', 'validation', 12);
    const sample = train[0]!;
    try {
      await engine.init('linear', 'perceptron', 12);
      await engine.train(train, validation, 3, 0.025, () => {});
      const saved = engine.snapshot();
      const savedScores = engine.predict([sample.input])[0]!;

      let evidence = { ...freshEvidence(), curveEpochs: 60 };
      await engine.init('linear', 'mlp', 16);
      await engine.train(train, validation, 60, 0.08, (epoch) => {
        evidence = evidenceReducer(evidence, { type: 'epoch', epoch });
        engine.cancel();
      });
      expect(evidence.curve).toHaveLength(1);
      const interruptedMeasurements = evidence;
      evidence = evidenceReducer(evidence, { type: interruption });
      expect(evidence.curve).toEqual([]);
      expect(evidence.curveEpochs).toBe(1);
      expect(evidence.inspection).toBeNull();

      evidence = evidenceReducer(evidence, { type: 'restore-started' });
      await engine.restore(saved);
      const restored = engine.snapshot();
      const inspection = engine.inspect(sample.input);
      evidence = evidenceReducer(evidence, {
        type: 'model-ready',
        restored: true,
        snapshot: restored,
        inspection,
        inspected: { sample, source: 'training' },
      });
      expect(restored.preset).toBe('perceptron');
      expect(restored.provenance).toMatchObject({ epochs: 3, learningRate: 0.025 });
      expect(evidence.curve).toEqual([]);
      expect(evidence.inspection?.scores).toEqual(savedScores);
      expect(evidence.elapsed).toBe(
        saved.provenance?.status === 'known' ? saved.provenance.trainingMs : 0,
      );

      // A restored response must also discard an unowned curve if interruption cleanup was missed.
      expect(
        evidenceReducer(interruptedMeasurements, {
          type: 'model-ready',
          restored: true,
          snapshot: restored,
          inspection,
          inspected: { sample, source: 'training' },
        }).curve,
      ).toEqual([]);
    } finally {
      engine.dispose();
    }
  },
);

it('hiding during restoration clears measurements and a legacy snapshot adds no validation data', () => {
  const sample = dataset('linear', 'train', 1)[0]!;
  let evidence = {
    ...freshEvidence(),
    curveEpochs: 60,
    curve: [{ epoch: 1, loss: 1, accuracy: 0.5, valLoss: 2, valAccuracy: 0.25 }],
    elapsed: 100,
  };
  evidence = evidenceReducer(evidence, { type: 'restore-started' });
  evidence = evidenceReducer(evidence, { type: 'hidden' });
  expect(evidence.curve).toEqual([]);
  expect(evidence.elapsed).toBe(0);
  evidence = evidenceReducer(evidence, {
    type: 'model-ready',
    restored: true,
    snapshot: { version: 1, kind: 'linear', preset: 'perceptron', units: 12, weights: [] },
    inspection: null,
    inspected: { sample, source: 'training' },
  });
  expect(evidence.curve).toEqual([]);
  expect(evidence.curveEpochs).toBe(1);
  expect(evidence.elapsed).toBe(0);
});

it('keeps the current training run curve when its own trained model becomes ready', () => {
  const epoch = { epoch: 1, loss: 1, accuracy: 0.5, valLoss: 2, valAccuracy: 0.25 };
  const measured = evidenceReducer(
    { ...freshEvidence(), curveEpochs: 3 },
    { type: 'epoch', epoch },
  );
  const completed = evidenceReducer(measured, {
    type: 'model-ready',
    restored: false,
    inspection: null,
    inspected: null,
    snapshot: {
      version: 1,
      kind: 'linear',
      preset: 'perceptron',
      units: 12,
      weights: [],
      provenance: { status: 'known', augmented: false, repairs: 0, epochs: 1, trainingMs: 20 },
    },
  });
  expect(completed.curve).toEqual([epoch]);
  expect(completed.curveEpochs).toBe(3);
  expect(completed.elapsed).toBe(20);
});
