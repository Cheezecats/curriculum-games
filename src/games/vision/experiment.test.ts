import { expect, it } from 'vitest';
import { dataset } from './datasets';
import type { Snapshot } from './engine';
import {
  draftStatus,
  freshEvidence,
  evidenceReducer,
  trainingFingerprint,
  linearDecision,
} from './experiment';

it('detects edited data and settings without assigning the draft to trained weights', () => {
  const train = dataset('linear', 'train', 6);
  const model: Snapshot = {
    version: 1,
    kind: 'linear',
    preset: 'perceptron',
    units: 12,
    weights: [],
    provenance: {
      status: 'known',
      epochs: 45,
      augmented: false,
      repairs: 0,
      trainingMs: 10,
      learningRate: 0.025,
      examples: 6,
      fingerprint: trainingFingerprint(train),
    },
  };
  const draft = {
    kind: 'linear' as const,
    preset: 'perceptron' as const,
    units: 12,
    epochs: 45,
    rate: 0.025,
    augmentation: false,
    train,
  };
  expect(draftStatus(model, draft)).toBe('current');
  expect(draftStatus(model, { ...draft, rate: 0.05 })).toBe('changed');
  expect(draftStatus(model, { ...draft, train: train.slice(1) })).toBe('changed');
  expect(
    draftStatus(model, {
      ...draft,
      train: train.map((s, i) => (i ? s : { ...s, label: 1 - s.label })),
    }),
  ).toBe('changed');
  expect(draftStatus({ ...model, provenance: { status: 'unknown' } }, draft)).toBe('unknown');
  expect(model.provenance).toMatchObject({ epochs: 45, learningRate: 0.025 });
});

it('explains a two-output softmax using class-one minus class-zero weights and biases', () => {
  expect(
    linearDecision(
      [
        { shape: [2, 2], values: [1, 3, 5, 2] },
        { shape: [2], values: [2, -1] },
      ],
      [0.25, 0.5],
    ),
  ).toEqual({ a: 2, b: -3, bias: -3, score: -4 });
});

it('resets every result and inspection when loading a different task', () => {
  const sample = dataset('linear', 'test', 1)[0]!;
  const stale = {
    ...freshEvidence(),
    lastAccuracy: 1,
    elapsed: 900,
    paused: true,
    resultMessage: 'Old task complete',
    inspectorOpen: true,
    inspected: { sample, source: 'held-out' as const },
    mistakes: [{ sample, prediction: 1 }],
    binCounts: [4, 5, 0],
    lastDecision: { sample, prediction: 1, scores: [0.1, 0.9], correct: false },
    inspection: {
      scores: [0.1, 0.9],
      weights: [],
      activations: [],
      activationShape: [],
      boundary: [0.9],
      parameters: 6,
    },
    curve: [{ epoch: 1, loss: 1, accuracy: 0.5, valLoss: 2, valAccuracy: 0.25 }],
    criteria: [{ id: 'accuracy', label: 'Accuracy', actual: '100%', target: '80%', passed: true }],
  };
  const clean = evidenceReducer(stale, { type: 'reset' });
  expect(clean.lastAccuracy).toBeNull();
  expect(clean.inspection).toBeNull();
  expect(clean.inspected).toBeNull();
  expect(clean.mistakes).toEqual([]);
  expect(clean.binCounts).toEqual([0, 0, 0]);
  expect(clean.lastDecision).toBeNull();
  expect(clean.elapsed).toBe(0);
  expect(clean.paused).toBe(false);
  expect(clean.resultMessage).toBe('');
  expect(clean.inspectorOpen).toBe(false);
  expect(clean.curve).toEqual([]);
  expect(clean.criteria).toEqual([]);
});
