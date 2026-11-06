import type { Snapshot } from './engine';
export type TrainingProvenance =
  | { status: 'unknown' }
  | {
      status: 'known';
      augmented: boolean;
      repairs: number;
      epochs: number;
      trainingMs: number;
      learningRate?: number;
      examples?: number;
      fingerprint?: string;
    };
export function validProvenance(value: unknown): value is TrainingProvenance {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    p.status === 'unknown' ||
    (p.status === 'known' &&
      typeof p.augmented === 'boolean' &&
      typeof p.repairs === 'number' &&
      Number.isInteger(p.repairs) &&
      p.repairs >= 0 &&
      p.repairs <= 9 &&
      typeof p.epochs === 'number' &&
      Number.isInteger(p.epochs) &&
      p.epochs >= 1 &&
      p.epochs <= 60 &&
      typeof p.trainingMs === 'number' &&
      Number.isFinite(p.trainingMs) &&
      p.trainingMs >= 0 &&
      p.trainingMs <= 86400000 &&
      (p.learningRate === undefined ||
        (typeof p.learningRate === 'number' &&
          Number.isFinite(p.learningRate) &&
          p.learningRate >= 0.001 &&
          p.learningRate <= 0.1)) &&
      (p.examples === undefined ||
        (typeof p.examples === 'number' &&
          Number.isInteger(p.examples) &&
          p.examples >= 6 &&
          p.examples <= 360)) &&
      (p.fingerprint === undefined ||
        (typeof p.fingerprint === 'string' && /^[0-9a-f]{8}$/.test(p.fingerprint))))
  );
}
export function modelEvidence(snapshot: Snapshot) {
  const p = snapshot.provenance;
  return {
    kind: snapshot.kind,
    preset: snapshot.preset,
    augmented: p?.status === 'known' ? p.augmented : false,
    repairs: p?.status === 'known' ? p.repairs : 0,
  };
}
export function provenanceMetrics(snapshot: Snapshot): Record<string, number> {
  const p = snapshot.provenance;
  return p?.status === 'known'
    ? {
        provenanceKnown: 1,
        augmented: Number(p.augmented),
        repairs: p.repairs,
        epochs: p.epochs,
        trainingMs: p.trainingMs,
      }
    : { provenanceKnown: 0 };
}
