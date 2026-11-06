import type {
  AttemptResult,
  MissionDefinition,
  MissionProgress,
  ObjectiveEvidence,
  ProgressData,
} from './types';

export const emptyProgress = (): ProgressData => ({ version: 1, missions: {}, recentAttempts: [] });

const lowerIsBetter = new Set([
  'energyUsed',
  'balanceError',
  'maxRoll',
  'parameters',
  'loss',
  'valLoss',
]);
const higherIsBetter = new Set(['distance', 'accuracy', 'correct']);

export function recordAttempt(progress: ProgressData, attempt: AttemptResult): ProgressData {
  if (progress.recentAttempts.some((item) => item.id === attempt.id)) return progress;
  const missions = { ...progress.missions };
  if (attempt.missionId) {
    const before = missions[attempt.missionId];
    const bestMetrics = Object.fromEntries(
      Object.entries(before?.bestMetrics ?? {}).filter(
        ([key]) => lowerIsBetter.has(key) || higherIsBetter.has(key),
      ),
    );
    for (const [key, value] of Object.entries(attempt.metrics)) {
      if (!Number.isFinite(value)) continue;
      if (lowerIsBetter.has(key)) bestMetrics[key] = Math.min(bestMetrics[key] ?? Infinity, value);
      else if (higherIsBetter.has(key))
        bestMetrics[key] = Math.max(bestMetrics[key] ?? -Infinity, value);
    }
    missions[attempt.missionId] = {
      explored: true,
      completed: (before?.completed ?? false) || attempt.completed,
      demonstrated: before?.demonstrated ?? false,
      attempts: (before?.attempts ?? 0) + 1,
      bestMetrics,
    };
  }
  return {
    version: 1,
    missions,
    recentAttempts: [attempt, ...progress.recentAttempts].slice(0, 30),
  };
}

export function recordCheck(
  progress: ProgressData,
  missionId: string,
  correct: boolean,
): ProgressData {
  const before = progress.missions[missionId];
  if (!correct || !before?.explored || before.demonstrated) return progress;
  return {
    ...progress,
    missions: { ...progress.missions, [missionId]: { ...before, demonstrated: true } },
  };
}

export function findPreviousComparableAttempt(
  current: AttemptResult,
  history: AttemptResult[],
): AttemptResult | undefined {
  return history.reduce<AttemptResult | undefined>((previous, item) => {
    if (
      item.id === current.id ||
      item.game !== current.game ||
      item.missionId !== current.missionId ||
      item.configuration?.task !== current.configuration?.task ||
      item.createdAt > current.createdAt
    )
      return previous;
    return !previous || item.createdAt > previous.createdAt ? item : previous;
  }, undefined);
}

export function isMissionUnlocked(
  progress: ProgressData,
  mission: MissionDefinition,
  missions: MissionDefinition[],
): boolean {
  if (mission.order === 1 || progress.missions[mission.id]?.completed) return true;
  const previous = missions.find(
    (item) => item.game === mission.game && item.order === mission.order - 1,
  );
  return !!previous && !!progress.missions[previous.id]?.completed;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function fail(): never {
  throw new Error(
    'This file is not a valid Fieldwork progress backup. Your current progress has not changed.',
  );
}
function metrics(value: unknown): Record<string, number> {
  if (!object(value) || Object.keys(value).length > 100) return fail();
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_ -]{0,63}$/.test(key) ||
      typeof item !== 'number' ||
      !Number.isFinite(item)
    )
      return fail();
    result[key] = item;
  }
  return result;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function criteria(value: unknown): ObjectiveEvidence[] {
  if (!Array.isArray(value) || value.length > 20) return fail();
  const result = value.map((item) => {
    if (
      !object(item) ||
      !boundedText(item.id, 64) ||
      !boundedText(item.label, 160) ||
      !boundedText(item.actual, 240) ||
      !boundedText(item.target, 240) ||
      typeof item.passed !== 'boolean' ||
      (item.hint !== undefined && !boundedText(item.hint, 500))
    )
      return fail();
    return {
      id: item.id,
      label: item.label,
      actual: item.actual,
      target: item.target,
      passed: item.passed,
      ...(item.hint !== undefined ? { hint: item.hint } : {}),
    };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length) return fail();
  return result;
}

function configuration(value: unknown): Record<string, string | number | boolean> {
  if (!object(value) || Object.keys(value).length > 24) return fail();
  const result: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_ -]{0,63}$/.test(key) ||
      !(
        typeof item === 'boolean' ||
        (typeof item === 'number' && Number.isFinite(item)) ||
        boundedText(item, 240)
      )
    )
      return fail();
    result[key] = item;
  }
  return result;
}

export function parseProgress(text: string, knownIds: string[]): ProgressData {
  if (text.length > 2 * 1024 * 1024) return fail();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail();
  }
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.missions) ||
    !Array.isArray(value.recentAttempts) ||
    value.recentAttempts.length > 30
  )
    return fail();
  const known = new Set(knownIds);
  const missions: Record<string, MissionProgress> = {};
  for (const [id, item] of Object.entries(value.missions)) {
    if (
      !known.has(id) ||
      !object(item) ||
      typeof item.explored !== 'boolean' ||
      typeof item.completed !== 'boolean' ||
      typeof item.demonstrated !== 'boolean' ||
      !Number.isSafeInteger(item.attempts) ||
      (item.attempts as number) < 0
    )
      return fail();
    if ((item.completed || item.demonstrated) && !item.explored) return fail();
    missions[id] = {
      explored: item.explored,
      completed: item.completed,
      demonstrated: item.demonstrated,
      attempts: item.attempts as number,
      bestMetrics: metrics(item.bestMetrics),
    };
  }
  const recentAttempts: AttemptResult[] = value.recentAttempts.map((item) => {
    if (
      !object(item) ||
      typeof item.id !== 'string' ||
      item.id.length > 128 ||
      !item.id ||
      (item.game !== 'flight' && item.game !== 'vision') ||
      (item.missionId !== null &&
        (typeof item.missionId !== 'string' ||
          !known.has(item.missionId) ||
          !item.missionId.startsWith(`${item.game}-`))) ||
      typeof item.completed !== 'boolean' ||
      typeof item.createdAt !== 'number' ||
      !Number.isFinite(item.createdAt) ||
      item.createdAt < 0 ||
      typeof item.summary !== 'string' ||
      item.summary.length > 4000
    )
      return fail();
    return {
      id: item.id,
      game: item.game,
      missionId: item.missionId as string | null,
      completed: item.completed,
      createdAt: item.createdAt,
      metrics: metrics(item.metrics),
      summary: item.summary,
      ...(item.criteria !== undefined ? { criteria: criteria(item.criteria) } : {}),
      ...(item.configuration !== undefined
        ? { configuration: configuration(item.configuration) }
        : {}),
    };
  });
  if (new Set(recentAttempts.map((item) => item.id)).size !== recentAttempts.length) return fail();
  return { version: 1, missions, recentAttempts };
}

export const exportProgress = (progress: ProgressData): string => JSON.stringify(progress, null, 2);
