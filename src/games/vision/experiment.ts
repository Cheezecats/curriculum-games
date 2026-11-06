import type { ObjectiveEvidence } from '../../core/types';
import type { DataKind, Sample } from './datasets';
import type { Epoch, Inspection, Preset, Snapshot } from './engine';

export function trainingFingerprint(samples: Sample[]) {
  let hash = 2166136261;
  const text = JSON.stringify(samples.map(({ id, label, input }) => [id, label, input]));
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function linearDecision(weights: Snapshot['weights'], input: number[]) {
  const w = weights[0]!.values,
    biasValues = weights[1]!.values;
  const a = w[1]! - w[0]!,
    b = w[3]! - w[2]!,
    bias = biasValues[1]! - biasValues[0]!;
  return { a, b, bias, score: a * input[0]! + b * input[1]! + bias };
}
export interface TrainingDraft {
  kind: DataKind;
  preset: Preset;
  units: number;
  epochs: number;
  rate: number;
  augmentation: boolean;
  train: Sample[];
}
export function draftStatus(model: Snapshot | null, draft: TrainingDraft) {
  if (!model) return 'untrained';
  if (
    model.kind !== draft.kind ||
    model.preset !== draft.preset ||
    (model.preset === 'mlp' && model.units !== draft.units)
  )
    return 'changed';
  const p = model.provenance;
  if (p?.status !== 'known' || p.learningRate === undefined || p.fingerprint === undefined)
    return 'unknown';
  return p.epochs === draft.epochs &&
    p.learningRate === draft.rate &&
    p.augmented === draft.augmentation &&
    p.fingerprint === trainingFingerprint(draft.train)
    ? 'current'
    : 'changed';
}
export interface InspectedPart {
  sample: Sample;
  source: 'training' | 'held-out';
}
export interface Decision {
  sample: Sample;
  prediction: number;
  scores: number[];
  correct: boolean;
}
export interface TaskEvidence {
  curve: Epoch[];
  curveEpochs: number;
  inspection: Inspection | null;
  inspected: InspectedPart | null;
  elapsed: number;
  lastAccuracy: number | null;
  mistakes: { sample: Sample; prediction: number }[];
  resultMessage: string;
  paused: boolean;
  inspectorOpen: boolean;
  lastDecision: Decision | null;
  binCounts: number[];
  criteria: ObjectiveEvidence[];
}
export function freshEvidence(): TaskEvidence {
  return {
    curve: [],
    curveEpochs: 1,
    inspection: null,
    inspected: null,
    elapsed: 0,
    lastAccuracy: null,
    mistakes: [],
    resultMessage: '',
    paused: false,
    inspectorOpen: false,
    lastDecision: null,
    binCounts: [0, 0, 0],
    criteria: [],
  };
}
type EvidenceAction =
  | { type: 'reset' }
  | { type: 'cancelled' }
  | { type: 'hidden' }
  | { type: 'restore-started' }
  | {
      type: 'model-ready';
      restored: boolean;
      snapshot?: Snapshot;
      inspection: Inspection | null;
      inspected: InspectedPart | null;
    }
  | { type: 'patch'; values: Partial<TaskEvidence> }
  | { type: 'epoch'; epoch: Epoch }
  | { type: 'decision'; decision: Decision }
  | { type: 'toggle-pause' };
export function evidenceReducer(state: TaskEvidence, action: EvidenceAction): TaskEvidence {
  if (action.type === 'reset') return freshEvidence();
  if (action.type === 'cancelled' || action.type === 'hidden' || action.type === 'restore-started')
    return { ...state, curve: [], curveEpochs: 1, inspection: null, inspected: null, elapsed: 0 };
  if (action.type === 'model-ready') {
    const provenance = action.snapshot?.provenance;
    return {
      ...state,
      ...(action.restored ? { curve: [], curveEpochs: 1 } : {}),
      inspection: action.inspection,
      inspected: action.inspected,
      elapsed: provenance?.status === 'known' ? provenance.trainingMs : 0,
    };
  }
  if (action.type === 'patch') return { ...state, ...action.values };
  if (action.type === 'epoch') return { ...state, curve: [...state.curve, action.epoch] };
  if (action.type === 'toggle-pause') return { ...state, paused: !state.paused };
  const { decision } = action;
  return {
    ...state,
    lastDecision: decision,
    binCounts: state.binCounts.map((n, i) => n + Number(i === decision.prediction)),
    mistakes: decision.correct
      ? state.mistakes
      : [
          ...state.mistakes,
          {
            sample: decision.sample,
            prediction: decision.prediction,
          },
        ],
  };
}
