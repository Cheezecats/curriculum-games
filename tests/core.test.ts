import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  recordAttempt,
  recordCheck,
  isMissionUnlocked,
  parseProgress,
  exportProgress,
} from '../src/core/progress';
import { readRecord, writeRecord } from '../src/core/storage';
import type { AttemptResult, MissionDefinition } from '../src/core/types';

const attempt = (overrides: Partial<AttemptResult> = {}): AttemptResult => ({
  id: 'attempt-1',
  game: 'flight',
  missionId: 'flight-1',
  completed: false,
  createdAt: 1000,
  metrics: { distance: 42 },
  summary: 'A short flight.',
  ...overrides,
});
const mission = (game: 'flight' | 'vision', order: number) =>
  ({ id: `${game}-${order}`, game, order }) as MissionDefinition;
const missions = [
  mission('flight', 1),
  mission('flight', 2),
  mission('vision', 1),
  mission('vision', 2),
];

describe('progression evidence', () => {
  it('records a failed attempt as exploration without granting completion', () => {
    const original = emptyProgress();
    const next = recordAttempt(original, attempt());
    expect(next.missions['flight-1']).toMatchObject({
      explored: true,
      completed: false,
      demonstrated: false,
      attempts: 1,
    });
    expect(original.missions).toEqual({});
  });
  it('keeps earned completion when a subsequent attempt fails', () => {
    const won = recordAttempt(emptyProgress(), attempt({ completed: true }));
    const next = recordAttempt(won, attempt({ id: 'attempt-2', metrics: { distance: 7 } }));
    expect(next.missions['flight-1'].completed).toBe(true);
    expect(next.missions['flight-1'].attempts).toBe(2);
    expect(next.missions['flight-1'].bestMetrics.distance).toBe(42);
  });
  it('keeps smaller error, energy, tilt and model cost without ranking mass', () => {
    const first = recordAttempt(
      emptyProgress(),
      attempt({
        metrics: {
          distance: 42,
          energyUsed: 5000,
          balanceError: 0.02,
          maxRoll: 0.5,
          parameters: 1400,
          mass: 8,
        },
      }),
    );
    const next = recordAttempt(
      first,
      attempt({
        id: 'attempt-2',
        metrics: {
          distance: 35,
          energyUsed: 3000,
          balanceError: 0.01,
          maxRoll: 0.2,
          parameters: 900,
          mass: 12,
        },
      }),
    );
    expect(next.missions['flight-1'].bestMetrics).toEqual({
      distance: 42,
      energyUsed: 3000,
      balanceError: 0.01,
      maxRoll: 0.2,
      parameters: 900,
    });
  });
  it('does not invent gameplay completion from a correct concept check', () => {
    const explored = recordAttempt(emptyProgress(), attempt());
    const next = recordCheck(explored, 'flight-1', true);
    expect(next.missions['flight-1'].demonstrated).toBe(true);
    expect(next.missions['flight-1'].completed).toBe(false);
    expect(isMissionUnlocked(next, mission('flight', 2), missions)).toBe(false);
  });
  it('requires the preceding mission in the same game, not another game', () => {
    const next = recordAttempt(emptyProgress(), attempt({ completed: true }));
    expect(isMissionUnlocked(next, mission('flight', 2), missions)).toBe(true);
    expect(isMissionUnlocked(next, mission('vision', 2), missions)).toBe(false);
    expect(isMissionUnlocked(next, mission('vision', 1), missions)).toBe(true);
  });
  it('bounds saved attempt history and deduplicates repeated callbacks', () => {
    let progress = emptyProgress();
    for (let i = 0; i < 40; i++) progress = recordAttempt(progress, attempt({ id: `run-${i}` }));
    const duplicate = recordAttempt(progress, attempt({ id: 'run-39' }));
    expect(progress.recentAttempts).toHaveLength(30);
    expect(progress.recentAttempts[0].id).toBe('run-39');
    expect(duplicate.missions['flight-1'].attempts).toBe(40);
  });
});

describe('save boundaries', () => {
  it('round-trips records through IndexedDB', async () => {
    await writeRecord('test-blueprint', { name: 'Kestrel', parts: 14 });
    expect(await readRecord('test-blueprint', null)).toEqual({ name: 'Kestrel', parts: 14 });
    expect(await readRecord('missing', { version: 1 })).toEqual({ version: 1 });
  });
  it('round-trips legitimate progress without changing its evidence', () => {
    const progress = recordAttempt(emptyProgress(), attempt({ completed: true }));
    expect(
      parseProgress(
        exportProgress(progress),
        missions.map((m) => m.id),
      ),
    ).toEqual(progress);
  });
  it('round-trips objective evidence and the configuration that produced it', () => {
    const run = attempt({
      criteria: [
        {
          id: 'range',
          label: 'Distance',
          actual: '42 m',
          target: '45 m',
          passed: false,
          hint: 'Try a gentler pitch input.',
        },
      ],
      configuration: { task: 'flight', aircraft: 'Valley glider', parts: 15, motor: false },
    });
    const progress = recordAttempt(emptyProgress(), run);
    expect(parseProgress(exportProgress(progress), ['flight-1'])).toEqual(progress);
  });
  it.each([
    { criteria: null },
    {
      criteria: [{ id: 'range', label: 'Distance', actual: '42 m', target: '45 m', passed: 'no' }],
    },
    {
      criteria: [
        {
          id: 'range',
          label: 'Distance',
          actual: '42 m',
          target: '45 m',
          passed: false,
          hint: 'x'.repeat(501),
        },
      ],
    },
    {
      criteria: Array.from({ length: 21 }, (_, i) => ({
        id: `c${i}`,
        label: 'Distance',
        actual: '0 m',
        target: '45 m',
        passed: false,
      })),
    },
    {
      criteria: [0, 1].map(() => ({
        id: 'same',
        label: 'Distance',
        actual: '0 m',
        target: '45 m',
        passed: false,
      })),
    },
    { configuration: { task: ['flight'] } },
    { configuration: { task: 'x'.repeat(241) } },
    { configuration: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`key${i}`, true])) },
  ])('rejects malformed or unbounded optional attempt details: %j', (details) => {
    const raw = { version: 1, missions: {}, recentAttempts: [{ ...attempt(), ...details }] };
    expect(() => parseProgress(JSON.stringify(raw), ['flight-1'])).toThrow();
  });
  it.each([
    '{broken',
    JSON.stringify({ version: 2, missions: {}, recentAttempts: [] }),
    JSON.stringify({
      version: 1,
      missions: { 'unknown-1': { explored: true } },
      recentAttempts: [],
    }),
    JSON.stringify({
      version: 1,
      missions: {
        'flight-1': {
          explored: true,
          completed: true,
          demonstrated: true,
          attempts: -1,
          bestMetrics: {},
        },
      },
      recentAttempts: [],
    }),
    '{"version":1,"missions":{},"recentAttempts":[{"id":"x","game":"flight","missionId":"flight-1","completed":true,"createdAt":1,"metrics":{"distance":1e999},"summary":"x"}]}',
  ])('rejects malformed imports before live state can be replaced', (text) => {
    const live = recordAttempt(emptyProgress(), attempt());
    expect(() =>
      parseProgress(
        text,
        missions.map((m) => m.id),
      ),
    ).toThrow();
    expect(live.missions['flight-1'].completed).toBe(false);
  });
});
