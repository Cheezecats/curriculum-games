import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Debrief from '../src/components/Debrief';
import Notebook from '../src/components/Notebook';
import { attemptMeasurements, nextExperiment } from '../src/core/attempt-feedback';
import * as progress from '../src/core/progress';
import type { AttemptResult } from '../src/core/types';

const run = (overrides: Partial<AttemptResult> = {}): AttemptResult => ({
  id: 'now',
  game: 'flight',
  missionId: 'flight-4',
  completed: false,
  createdAt: 2000,
  metrics: {
    speed: 18,
    energy: 57000,
    throttle: 0.5,
    lift: 70,
    weight: 80,
    time: 5,
    distance: 60,
    altitude: 30,
    maxRoll: 0.1,
    energyUsed: 3000,
  },
  summary: 'Flight ended.',
  configuration: { task: 'flight', aircraft: 'Valley glider', parts: 15 },
  ...overrides,
});
const render = (attempt: AttemptResult, previousAttempt?: AttemptResult) =>
  renderToStaticMarkup(
    createElement(Debrief, {
      attempt,
      previousAttempt,
      mission: null,
      onClose: () => {},
      onCheck: () => {},
    }),
  );

describe('reviewing measured evidence', () => {
  it('keeps an inspectable notebook record of criteria, measurements and setup', () => {
    const recorded = run({
      criteria: [
        {
          id: 'energy',
          label: 'Battery energy used',
          actual: '3 kJ',
          target: 'less than 6 kJ',
          passed: true,
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(Notebook, {
        progress: progress.recordAttempt(progress.emptyProgress(), recorded),
        onClose: () => {},
        onImport: async () => {},
      }),
    );
    expect(html).toContain('Inspect this observation');
    expect(html).toContain('Battery energy used');
    expect(html).toContain('3 kJ');
    expect(html).toContain('Valley glider');
  });
  it('puts unmet objective evidence before met conditions and offers its actual hint', () => {
    const html = render(
      run({
        criteria: [
          {
            id: 'time',
            label: 'Airborne time',
            actual: '5 s',
            target: 'at least 5 s',
            passed: true,
          },
          {
            id: 'energy',
            label: 'Battery energy used',
            actual: '6.2 kJ',
            target: 'less than 6 kJ',
            passed: false,
            hint: 'Reduce motor throttle and repeat the same flight.',
          },
        ],
      }),
    );
    expect(html).toContain('Battery energy used');
    expect(html.indexOf('Battery energy used')).toBeLessThan(html.indexOf('Airborne time'));
    expect(html).toContain('6.2 kJ');
    expect(html).toContain('less than 6 kJ');
    expect(html).toContain('Reduce motor throttle and repeat the same flight.');
  });
  it('shows energy consumed with units even when it is beyond the first nine raw values', () => {
    const html = render(run());
    expect(html).toContain('Energy used');
    expect(html).toContain('3 kJ');
    expect(html).toContain('60 m');
    expect(html).not.toContain('>57000<');
  });
  it('formats accuracy as a percentage and tilt in degrees', () => {
    expect(
      render(
        run({
          game: 'vision',
          missionId: 'vision-1',
          metrics: { accuracy: 19 / 24, correct: 19, total: 24, parameters: 6 },
        }),
      ),
    ).toContain('79.2%');
    expect(render(run({ missionId: 'flight-3', metrics: { maxRoll: Math.PI / 6 } }))).toContain(
      '30°',
    );
  });
  it('shows measured differences and changed configuration without calling them improvements', () => {
    const previous = run({
      id: 'before',
      createdAt: 1000,
      metrics: { distance: 55, energyUsed: 4000 },
      configuration: { task: 'flight', aircraft: 'Valley glider', parts: 16 },
    });
    const html = render(run(), previous);
    expect(html).toContain('Previous comparable attempt');
    expect(html).toContain('+5 m');
    expect(html).toContain('−1 kJ');
    expect(html).toContain('16 → 15');
    expect(html).not.toContain('Improved');
  });
  it('suggests another controlled bench experiment after a successful force measurement', () => {
    const html = render(
      run({
        missionId: 'flight-2',
        completed: true,
        metrics: { mass: 8, acceleration: 1.25, expectedAcceleration: 1.25 },
        criteria: [],
      }),
    );
    expect(html).toContain('Add one cargo block, repeat the force bench');
    expect(html).toContain('same 10 N force');
  });
  it('identifies the fixed courier example before directing an edited-aircraft experiment', () => {
    const suggestion = nextExperiment(
      run({
        missionId: 'flight-6',
        completed: true,
        criteria: [],
        configuration: { task: 'bench', experiment: 'Equal-mass Cargo courier preset example' },
      }),
    );
    expect(suggestion).toContain('fixed preset');
    expect(suggestion).toContain('separate experiment');
    expect(suggestion).toContain('Test force & torque');
  });
  it('prioritizes the crash hint over an unmet flight-time hint', () => {
    const suggestion = nextExperiment(
      run({
        metrics: { time: 1.5, crashed: 1 },
        criteria: [
          {
            id: 'airtime',
            label: 'Flight time',
            actual: '1.5 s',
            target: 'At least 4 s',
            passed: false,
            hint: 'Keep flying until the required time has elapsed.',
          },
          {
            id: 'safe-flight',
            label: 'Aircraft intact',
            actual: 'Crashed',
            target: 'No crash',
            passed: false,
            hint: 'Try a smaller control input or adjust the aircraft, then fly again.',
          },
        ],
      }),
    );
    expect(suggestion).toContain('smaller control input');
    expect(suggestion).not.toContain('Keep flying');
  });
  it('retains measured force and torque when the glider mission records a bench run', () => {
    const measurements = attemptMeasurements(
      run({
        missionId: 'flight-1',
        configuration: { task: 'bench' },
        metrics: {
          benchRuns: 1,
          mass: 8,
          acceleration: 1.25,
          expectedAcceleration: 1.25,
          angularAcceleration: 2,
          balanceError: 0,
          inertia: 10,
        },
      }),
    );
    expect(measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'acceleration', value: '1.25 m/s²' }),
        expect.objectContaining({ key: 'angularAcceleration', value: '2 rad/s²' }),
        expect.objectContaining({ key: 'inertia', value: '10 kg·m²' }),
      ]),
    );
  });
  it('retains flight evidence when the inertia mission records a flight instead of its bench', () => {
    const measurements = attemptMeasurements(
      run({ missionId: 'flight-6', configuration: { task: 'flight' } }),
    );
    expect(measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'distance', value: '60 m' }),
        expect.objectContaining({ key: 'time', value: '5 s' }),
        expect.objectContaining({ key: 'energyUsed', value: '3 kJ' }),
      ]),
    );
  });
  it('keeps the mission criteria measurements ahead of other supported measurements', () => {
    const measurements = attemptMeasurements(run());
    expect(measurements.slice(0, 3).map((item) => item.key)).toEqual([
      'distance',
      'time',
      'energyUsed',
    ]);
    expect(measurements.some((item) => item.key === 'maxRoll')).toBe(true);
  });
  it('shows the denominator for both previous and current decision counts', () => {
    const measurements = attemptMeasurements(
      run({ game: 'vision', missionId: 'vision-1', metrics: { correct: 20, total: 24 } }),
      run({ game: 'vision', missionId: 'vision-1', metrics: { correct: 19, total: 24 } }),
    );
    expect(measurements.find((item) => item.key === 'correct')).toMatchObject({
      value: '20 / 24',
      previous: '19 / 24',
      delta: '+1',
    });
  });
});

describe('comparable attempt history', () => {
  it('selects the newest earlier attempt only for the same game, mission and task', () => {
    const current = run();
    const earlier = run({ id: 'earlier', createdAt: 1500 });
    const entries = [
      current,
      run({ id: 'later', createdAt: 2100 }),
      run({ id: 'bench', createdAt: 1900, configuration: { task: 'force-bench' } }),
      run({ id: 'other-mission', createdAt: 1800, missionId: 'flight-1' }),
      run({ id: 'other-game', createdAt: 1700, game: 'vision' }),
      run({ id: 'old', createdAt: 500 }),
      earlier,
    ];
    expect(progress.findPreviousComparableAttempt(current, entries)?.id).toBe('earlier');
  });
  it('does not assume an older backup without a task matches a known task', () => {
    expect(
      progress.findPreviousComparableAttempt(run(), [
        run({ id: 'legacy', createdAt: 1000, configuration: undefined }),
      ]),
    ).toBeUndefined();
    const legacy = run({ configuration: undefined });
    expect(
      progress.findPreviousComparableAttempt(legacy, [
        run({ id: 'legacy-before', createdAt: 1000, configuration: undefined }),
      ])?.id,
    ).toBe('legacy-before');
  });
});
