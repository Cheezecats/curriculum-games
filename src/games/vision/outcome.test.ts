import { it, expect } from 'vitest';
import { missionComplete, evaluateVisionMission } from './outcome';
it('requires actual task, architecture, label repairs and held-out outcomes for each contract', () => {
  const good = {
    kind: 'image' as const,
    preset: 'cnn' as const,
    augmented: true,
    repairs: 3,
    accuracy: 0.9,
    parameters: 631,
  };
  expect(missionComplete(4, good)).toBe(true);
  expect(missionComplete(4, { ...good, preset: 'mlp' })).toBe(false);
  expect(missionComplete(5, good)).toBe(true);
  expect(missionComplete(5, { ...good, augmented: false })).toBe(false);
  expect(missionComplete(6, good)).toBe(true);
  expect(missionComplete(6, { ...good, parameters: 1501 })).toBe(false);
  expect(missionComplete(1, { ...good, kind: 'linear', preset: 'perceptron' })).toBe(true);
  expect(missionComplete(1, good)).toBe(false);
  expect(missionComplete(2, { ...good, kind: 'xor', preset: 'mlp' })).toBe(true);
  expect(missionComplete(2, { ...good, kind: 'linear', preset: 'mlp' })).toBe(false);
  expect(missionComplete(3, good)).toBe(false);
  expect(missionComplete(3, { ...good, kind: 'linear' })).toBe(true);
  expect(missionComplete(3, { ...good, kind: 'linear', repairs: 2 })).toBe(false);
  for (let order = 1; order <= 6; order++)
    expect(missionComplete(order, { ...good, accuracy: 0.2 })).toBe(false);
});

it('explains which requirement failed and uses whole-part targets', () => {
  const measured = {
    kind: 'image' as const,
    preset: 'cnn' as const,
    augmented: false,
    repairs: 0,
    accuracy: 16 / 24,
    correct: 16,
    total: 24,
    parameters: 631,
  };
  const night = evaluateVisionMission(5, measured);
  expect(night.completed).toBe(false);
  expect(night.criteria.find((c) => c.id === 'accuracy')).toMatchObject({
    passed: true,
    target: 'At least 16 / 24 (threshold 65%)',
  });
  expect(night.criteria.find((c) => c.id === 'augmentation')).toMatchObject({ passed: false });
  expect(evaluateVisionMission(5, { ...measured, augmented: true }).completed).toBe(true);
  expect(evaluateVisionMission(4, { ...measured, accuracy: 17 / 24, correct: 17 }).completed).toBe(
    false,
  );
  expect(evaluateVisionMission(4, { ...measured, accuracy: 18 / 24, correct: 18 }).completed).toBe(
    true,
  );
  expect(
    evaluateVisionMission(6, {
      ...measured,
      accuracy: 1,
      correct: 24,
      parameters: 1501,
    }).criteria.find((c) => c.id === 'parameters')?.passed,
  ).toBe(false);
});

it('rejects invalid mission identifiers and inconsistent part-count evidence', () => {
  const measured = {
    kind: 'linear' as const,
    preset: 'perceptron' as const,
    augmented: false,
    repairs: 0,
    accuracy: 1,
    parameters: 6,
    correct: 24,
    total: 24,
  };
  for (const order of [NaN, 0, 1.5, 7])
    expect(evaluateVisionMission(order, measured).completed).toBe(false);
  expect(evaluateVisionMission(1, { ...measured, correct: -1 }).completed).toBe(false);
  expect(evaluateVisionMission(1, { ...measured, correct: 20 }).completed).toBe(false);
  expect(evaluateVisionMission(1, { ...measured, parameters: -1 }).completed).toBe(false);
});
