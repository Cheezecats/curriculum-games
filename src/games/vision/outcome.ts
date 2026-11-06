import type { ObjectiveEvidence } from '../../core/types';
import type { DataKind } from './datasets';
import type { Preset } from './engine';
export interface VisionMetrics {
  kind: DataKind;
  preset: Preset;
  augmented: boolean;
  repairs: number;
  accuracy: number;
  parameters: number;
  correct?: number;
  total?: number;
}
export function evaluateVisionMission(
  order: number,
  m: VisionMetrics,
): {
  completed: boolean;
  criteria: ObjectiveEvidence[];
} {
  if (!Number.isInteger(order) || order < 1 || order > 6) return { completed: false, criteria: [] };
  const task = order >= 4 ? 'image' : order === 2 ? 'xor' : 'linear';
  const threshold = order === 5 ? 0.65 : order >= 4 ? 0.75 : 0.8;
  const counts =
    Number.isInteger(m.correct) &&
    Number.isInteger(m.total) &&
    m.total! > 0 &&
    m.correct! >= 0 &&
    m.correct! <= m.total!;
  const hasCounts = m.correct !== undefined || m.total !== undefined;
  const measured =
    Number.isFinite(m.accuracy) &&
    m.accuracy >= 0 &&
    m.accuracy <= 1 &&
    Number.isInteger(m.parameters) &&
    m.parameters >= 0 &&
    (!hasCounts || (counts && Math.abs(m.accuracy - m.correct! / m.total!) < 1e-9));
  const criteria: ObjectiveEvidence[] = [
    {
      id: 'task',
      label: 'Input task',
      actual: m.kind,
      target: task,
      passed: m.kind === task,
      hint: `Choose the ${task === 'image' ? 'grayscale shapes' : task === 'xor' ? 'opposite-corner sensors' : 'straight-boundary sensors'} task.`,
    },
  ];
  const architecture =
    order === 1 ? 'perceptron' : order === 2 ? 'mlp' : order === 4 ? 'cnn' : null;
  if (architecture)
    criteria.push({
      id: 'architecture',
      label: 'Trained architecture',
      actual: m.preset,
      target: architecture,
      passed: m.preset === architecture,
      hint: `Train a ${architecture.toUpperCase()} before deploying.`,
    });
  if (order === 3)
    criteria.push({
      id: 'repairs',
      label: 'Verified training-label repairs',
      actual: `${m.repairs} included in training`,
      target: 'At least 3',
      passed: m.repairs >= 3,
      hint: 'Correct corrupted training labels, include those examples, and retrain.',
    });
  if (order === 5)
    criteria.push({
      id: 'augmentation',
      label: 'Training-family augmentation',
      actual: m.augmented ? 'Used by this model' : 'Not used by this model',
      target: 'Used during training',
      passed: m.augmented,
      hint: 'Enable translated and dimmed training examples, then retrain.',
    });
  criteria.push({
    id: 'accuracy',
    label: 'Held-out comparison accuracy',
    actual: measured
      ? counts
        ? `${m.correct} / ${m.total} correct (${(m.accuracy * 100).toFixed(1)}%)`
        : `${(m.accuracy * 100).toFixed(1)}%`
      : 'Measurement unavailable',
    target: counts
      ? `At least ${Math.ceil(threshold * m.total!)} / ${m.total} (threshold ${threshold * 100}%)`
      : `At least ${threshold * 100}%`,
    passed:
      measured &&
      m.accuracy >= threshold &&
      (!counts || m.correct! >= Math.ceil(threshold * m.total!)),
    hint: measured
      ? 'Inspect the mistakes, change one training choice, and compare the next run.'
      : 'Restore or retrain a model before evaluating.',
  });
  if (order === 6)
    criteria.push({
      id: 'parameters',
      label: 'Learned parameters',
      actual: Number.isFinite(m.parameters) ? `${m.parameters}` : 'Unknown',
      target: 'At most 1,500',
      passed: Number.isFinite(m.parameters) && m.parameters <= 1500,
      hint: 'Compare the linear model, smaller hidden layers, and the compact CNN.',
    });
  return { completed: criteria.every((c) => c.passed), criteria };
}
export function missionComplete(order: number, m: VisionMetrics) {
  return evaluateVisionMission(order, m).completed;
}
