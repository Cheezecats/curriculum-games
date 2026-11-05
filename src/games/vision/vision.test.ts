import { describe, it, expect } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { dataset, augment } from './datasets';
import { VisionEngine } from './engine';
import { JobGate } from './protocol';

describe('vision data', () => {
  it('keeps families and augmentation parents disjoint and inputs bounded', () => {
    for (const kind of ['linear', 'xor', 'image'] as const) {
      const sets = ['train', 'validation', 'test'].map((split) =>
        dataset(kind, split as 'train', 30),
      );
      const families = sets.map(
        (set) => new Set(set.flatMap((s) => [s.family, ...augment(s).map((a) => a.family)])),
      );
      expect([...families[0]!].some((f) => families[1]!.has(f) || families[2]!.has(f))).toBe(false);
      sets.flat().forEach((s) => {
        expect(s.input.length).toBe(kind === 'image' ? 256 : 2);
        expect(s.input.every((x) => x >= 0 && x <= 1)).toBe(true);
      });
    }
  });
});
describe('genuine learning', () => {
  it('learns held-out sensor examples; inspectors and restoration use active weights', async () => {
    const engine = new VisionEngine();
    await engine.init('linear', 'perceptron', 8);
    const fixtures = dataset('linear', 'test', 60);
    const before = engine.evaluate(fixtures);
    await engine.train(
      dataset('linear', 'train', 96),
      dataset('linear', 'validation', 30),
      35,
      0.06,
      () => {},
    );
    const after = engine.evaluate(fixtures);
    expect(after.accuracy).toBeGreaterThan(0.85);
    expect(after.loss).toBeLessThan(before.loss);
    const inspection = engine.inspect(fixtures[0]!.input);
    const weights = engine.snapshot().weights;
    expect(inspection.weights[0]!.values).toEqual(weights[0]!.values);
    const restored = new VisionEngine();
    await restored.restore(engine.snapshot());
    expect(restored.predict(fixtures.map((s) => s.input))).toEqual(
      engine.predict(fixtures.map((s) => s.input)),
    );
    engine.dispose();
    restored.dispose();
  }, 30000);
  it('trains real CNN features, whose outputs equal the active model layer', async () => {
    const engine = new VisionEngine();
    await engine.init('image', 'cnn', 8);
    const samples = dataset('image', 'test', 18);
    const before = engine.evaluate(samples);
    await engine.train(
      dataset('image', 'train', 72),
      dataset('image', 'validation', 18),
      12,
      0.015,
      () => {},
    );
    expect(engine.evaluate(samples).loss).toBeLessThan(before.loss);
    const inspection = engine.inspect(samples[0]!.input);
    const input = tf.tensor4d(samples[0]!.input, [1, 16, 16, 1]);
    const intermediate = tf.model({
      inputs: engine.model!.inputs,
      outputs: engine.model!.layers[0]!.output,
    });
    const actual = intermediate.predict(input) as tf.Tensor;
    expect(inspection.activations).toEqual(Array.from(actual.dataSync()));
    actual.dispose();
    input.dispose();
    // The intermediate model shares the active layer weights; only the engine owns them.
    engine.dispose();
  }, 30000);
  it('releases tensors after cancelled training and disposal', async () => {
    const baseline = tf.memory().numTensors;
    const engine = new VisionEngine();
    await engine.init('xor', 'mlp', 8);
    let progress = 0;
    await engine.train(
      dataset('xor', 'train', 48),
      dataset('xor', 'validation', 12),
      30,
      0.04,
      () => {
        progress++;
        engine.cancel();
      },
    );
    expect(progress).toBe(1);
    engine.dispose();
    expect(tf.memory().numTensors).toBe(baseline);
  });
});
it('rejects stale job responses after cancel/reset', () => {
  const gate = new JobGate();
  const a = gate.next();
  expect(gate.accept(a)).toBe(true);
  gate.invalidate();
  expect(gate.accept(a)).toBe(false);
  expect(gate.accept(gate.next())).toBe(true);
});

it('learns the nonlinear opposite-corner task with the default MLP', async () => {
  const engine = new VisionEngine();
  await engine.init('xor', 'mlp', 12);
  await engine.train(
    dataset('xor', 'train', 72),
    dataset('xor', 'validation', 24),
    45,
    0.025,
    () => {},
  );
  expect(engine.evaluate(dataset('xor', 'test', 24)).accuracy).toBeGreaterThanOrEqual(0.8);
  engine.dispose();
}, 30000);
it('default CNN meets ordinary, shifted, and parameter-budget mission targets', async () => {
  const engine = new VisionEngine();
  await engine.init('image', 'cnn', 12);
  const train = dataset('image', 'train', 72);
  await engine.train(
    train.flatMap((s) => [s, ...augment(s)]),
    dataset('image', 'validation', 24),
    16,
    0.025,
    () => {},
  );
  expect(engine.evaluate(dataset('image', 'test', 24)).accuracy).toBeGreaterThanOrEqual(0.75);
  expect(engine.evaluate(dataset('image', 'test', 24, true)).accuracy).toBeGreaterThanOrEqual(0.65);
  expect(engine.inspect(train[0]!.input).parameters).toBeLessThanOrEqual(1500);
  engine.dispose();
}, 30000);

it('repeated snapshot/restore/retrain cycles dispose all owned tensors', async () => {
  const baseline = tf.memory().numTensors;
  const e = new VisionEngine();
  await e.init('linear', 'perceptron');
  const train = dataset('linear', 'train', 24),
    validation = dataset('linear', 'validation', 12);
  await e.train(train, validation, 2, 0.025, () => {});
  const state = e.snapshot();
  e.inspect(train[0]!.input);
  await e.restore(state);
  await e.train(train, validation, 2, 0.025, () => {});
  e.dispose();
  expect(tf.memory().numTensors).toBe(baseline);
});
it('rejects corrupt snapshots before allocating tensors or losing the active model', async () => {
  const engine = new VisionEngine();
  await engine.init('linear', 'perceptron');
  const baseline = tf.memory().numTensors;
  const saved = engine.snapshot();
  const corrupt = { ...saved, kind: 'invalid', weights: [{ shape: [100000000], values: [1] }] };
  await expect(engine.restore(corrupt as never)).rejects.toThrow('Invalid saved model');
  expect(tf.memory().numTensors).toBe(baseline);
  expect(engine.snapshot()).toEqual(saved);
  engine.dispose();
});
