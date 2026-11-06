import type { AttemptResult } from './types';

interface MetricDefinition {
  label: string;
  unit?: string;
  scale?: number;
  digits?: number;
  flag?: boolean;
}

const definitions: Record<string, MetricDefinition> = {
  distance: { label: 'Distance', unit: 'm' },
  time: { label: 'Elapsed time', unit: 's' },
  speed: { label: 'Speed', unit: 'm/s' },
  altitude: { label: 'Altitude', unit: 'm' },
  energyUsed: { label: 'Energy used', unit: 'kJ', scale: 0.001 },
  energy: { label: 'Battery remaining', unit: 'kJ', scale: 0.001 },
  maxRoll: { label: 'Maximum tilt', unit: '°', scale: 180 / Math.PI },
  payload: { label: 'Payload', unit: 'kg' },
  mass: { label: 'Mass', unit: 'kg' },
  acceleration: { label: 'Measured acceleration', unit: 'm/s²', digits: 3 },
  expectedAcceleration: { label: 'Predicted acceleration', unit: 'm/s²', digits: 3 },
  angularAcceleration: { label: 'Off-centre angular acceleration', unit: 'rad/s²', digits: 3 },
  balanceError: { label: 'Centred angular acceleration', unit: 'rad/s²', digits: 5 },
  inertia: { label: 'Moment of inertia', unit: 'kg·m²' },
  compactInertia: { label: 'Compact layout inertia', unit: 'kg·m²' },
  wideInertia: { label: 'Nose-load inertia', unit: 'kg·m²' },
  compactAlpha: { label: 'Compact layout angular acceleration', unit: 'rad/s²', digits: 3 },
  wideAlpha: { label: 'Nose-load angular acceleration', unit: 'rad/s²', digits: 3 },
  inertiaRatio: { label: 'Inertia ratio', digits: 3 },
  angularRatio: { label: 'Angular acceleration ratio', digits: 3 },
  delivered: { label: 'Delivery gate crossed', flag: true },
  crashed: { label: 'Crashed', flag: true },
  accuracy: { label: 'Batch accuracy', unit: '%', scale: 100 },
  correct: { label: 'Correct decisions', digits: 0 },
  parameters: { label: 'Learned parameters', digits: 0 },
  repairs: { label: 'Verified label repairs', digits: 0 },
  augmented: { label: 'Trained with augmentation', flag: true },
  epochs: { label: 'Training epochs', digits: 0 },
  trainingMs: { label: 'Training time', unit: 's', scale: 0.001 },
};

const flightMetrics: Record<string, string[]> = {
  'flight-1': ['distance', 'time', 'speed', 'altitude', 'crashed'],
  'flight-2': ['mass', 'acceleration', 'expectedAcceleration'],
  'flight-3': ['distance', 'time', 'payload', 'maxRoll', 'delivered', 'crashed'],
  'flight-4': ['distance', 'time', 'energyUsed', 'energy', 'crashed'],
  'flight-5': ['angularAcceleration', 'balanceError', 'inertia', 'mass'],
  'flight-6': [
    'compactInertia',
    'wideInertia',
    'compactAlpha',
    'wideAlpha',
    'inertiaRatio',
    'angularRatio',
  ],
};

export function formatMetricValue(key: string, value: number, delta = false): string {
  const definition = definitions[key];
  if (!definition) return value.toLocaleString();
  if (definition.flag) return value ? 'Yes' : 'No';
  const scaled = value * (definition.scale ?? 1);
  const number = Math.abs(scaled).toLocaleString(undefined, {
    maximumFractionDigits: definition.digits ?? 1,
  });
  const sign = scaled < 0 ? '−' : delta && scaled > 0 ? '+' : '';
  const unit = delta && key === 'accuracy' ? ' percentage points' : definition.unit;
  const suffix = unit
    ? `${unit === '%' || unit === '°' || unit.startsWith(' ') ? '' : ' '}${unit}`
    : '';
  return `${sign}${number}${suffix}`;
}

export function attemptMeasurements(attempt: AttemptResult, previous?: AttemptResult) {
  const preferred =
    attempt.game === 'vision'
      ? ['accuracy', 'correct', 'parameters', 'repairs', 'augmented', 'epochs', 'trainingMs']
      : (flightMetrics[attempt.missionId ?? ''] ?? [
          'distance',
          'time',
          'energyUsed',
          'payload',
          'maxRoll',
          'acceleration',
          'expectedAcceleration',
          'balanceError',
          'inertiaRatio',
          'angularRatio',
          'mass',
        ]);
  const keys = [...new Set([...preferred, ...Object.keys(definitions)])];
  const recordedValue = (key: string, metrics: Record<string, number>) =>
    key === 'correct' && Number.isFinite(metrics.total)
      ? `${metrics[key]} / ${metrics.total}`
      : formatMetricValue(key, metrics[key]);
  return keys
    .filter((key) => Number.isFinite(attempt.metrics[key]))
    .map((key) => {
      const value = attempt.metrics[key];
      const before = previous?.metrics[key];
      return {
        key,
        label: definitions[key].label,
        value: recordedValue(key, attempt.metrics),
        previous:
          before !== undefined && Number.isFinite(before)
            ? recordedValue(key, previous?.metrics ?? {})
            : undefined,
        delta:
          before !== undefined && Number.isFinite(before) && !definitions[key].flag
            ? formatMetricValue(key, value - before, true)
            : undefined,
      };
    });
}

export const readableLabel = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
const configurationValue = (value: string | number | boolean | undefined) =>
  value === undefined
    ? 'Not recorded'
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : String(value);

export function attemptConfiguration(attempt: AttemptResult, previous?: AttemptResult) {
  const current = attempt.configuration ?? {};
  const before = previous?.configuration ?? {};
  const keys = [...new Set([...Object.keys(current), ...Object.keys(before)])];
  return keys.map((key) => ({
    key,
    label: readableLabel(key),
    value: configurationValue(current[key]),
    changed:
      previous && current[key] !== before[key]
        ? `${configurationValue(before[key])} → ${configurationValue(current[key])}`
        : undefined,
  }));
}

export function nextExperiment(attempt: AttemptResult): string {
  const crash = attempt.metrics.crashed
    ? attempt.criteria?.find((item) => item.id === 'safe-flight' && !item.passed)
    : undefined;
  const unmet = crash ?? attempt.criteria?.find((item) => !item.passed);
  if (unmet?.hint) return unmet.hint;
  if (unmet)
    return `Change one variable, then repeat the experiment and compare ${unmet.label.toLowerCase()} with the target.`;
  if (attempt.missionId === 'flight-2')
    return 'Add one cargo block, repeat the force bench, and compare mass with acceleration under the same 10 N force.';
  if (attempt.missionId === 'flight-5')
    return 'Rearrange one part, rerun Test force & torque, and compare the off-centre and centred angular accelerations.';
  if (attempt.missionId === 'flight-6')
    return 'The equal-mass courier comparison uses fixed preset layouts. For a separate experiment on your aircraft, use Test force & torque, rearrange the same parts, then run that bench again and compare inertia and angular acceleration.';
  return attempt.game === 'vision'
    ? 'Keep the training examples fixed, change one training setting, and compare the next batch.'
    : 'Keep the aircraft design, change one control input, and compare the next flight’s distance and tilt.';
}
