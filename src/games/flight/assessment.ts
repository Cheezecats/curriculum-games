import type { ObjectiveEvidence } from '../../core/types';

type Metrics = Record<string, number>;
const measured = (value: number, unit = '', digits = 2) =>
  Number.isFinite(value) ? `${value.toFixed(digits)}${unit ? ' ' + unit : ''}` : 'Not measured';

export function evaluateFlightMission(
  id: string,
  m: Metrics,
): { completed: boolean; criteria: ObjectiveEvidence[] } {
  const criteria: ObjectiveEvidence[] = [],
    add = (
      id: string,
      label: string,
      actual: string,
      target: string,
      passed: boolean,
      hint: string,
    ) => criteria.push({ id, label, actual, target, passed, hint }),
    flight = (seconds: number, distance: number) => {
      add(
        'airtime',
        'Flight time',
        measured(m.time, 's', 1),
        `At least ${seconds} s`,
        m.time >= seconds,
        'Keep flying until the required time has elapsed.',
      );
      add(
        'downrange',
        'Downrange distance',
        measured(m.distance, 'm', 1),
        `At least ${distance} m`,
        m.distance >= distance,
        'Keep the aircraft moving forward through the valley.',
      );
    },
    safe = () =>
      add(
        'safe-flight',
        'Aircraft intact',
        !Number.isFinite(m.crashed) ? 'Not measured' : m.crashed ? 'Crashed' : 'No crash',
        'No crash',
        m.crashed === 0,
        'Try a smaller control input or adjust the aircraft, then fly again.',
      ),
    bench = (runs: number) =>
      add(
        'bench-runs',
        'Bench measurements',
        measured(m.benchRuns, '', 0),
        `At least ${runs}`,
        m.benchRuns >= runs,
        runs === 2 ? 'Run the equal-mass courier example.' : 'Run the force and torque bench.',
      );
  switch (id) {
    case 'flight-1':
      flight(4, 45);
      safe();
      break;
    case 'flight-2': {
      bench(1);
      const error = Math.abs(m.acceleration / m.expectedAcceleration - 1);
      add(
        'force-agreement',
        'Measured acceleration vs F/m',
        measured(error * 100, '% difference'),
        'Less than 3% difference',
        error < 0.03,
        'Compare the measured acceleration with 10 N divided by the measured aircraft mass.',
      );
      break;
    }
    case 'flight-3':
      flight(4, 65);
      add(
        'delivery',
        'Delivery gate',
        m.delivered === undefined
          ? 'Not measured'
          : m.delivered === 1
            ? 'Parcel through gate'
            : 'Not crossed',
        'Carry cargo through the circular opening',
        m.delivered === 1,
        'Aim the aircraft through the orange ring 65 m downrange.',
      );
      add(
        'payload',
        'Cargo carried',
        measured(m.payload, 'kg', 1),
        'At least 3 kg',
        m.payload >= 3,
        'Attach one cargo block, or start with the Cargo courier.',
      );
      add(
        'tilt',
        'Maximum tilt',
        measured((m.maxRoll * 180) / Math.PI, '°', 1),
        'Less than 34.4° (0.60 rad)',
        m.maxRoll < 0.6,
        'Use smaller pitch and roll inputs and keep the aircraft close to level.',
      );
      safe();
      break;
    case 'flight-4':
      flight(5, 60);
      add(
        'energy',
        'Battery energy used',
        measured(m.energyUsed / 1000, 'kJ'),
        'Less than 6 kJ',
        m.energyUsed < 6000,
        'Try less throttle, a lighter aircraft, or an unpowered glide.',
      );
      safe();
      break;
    case 'flight-5':
      bench(1);
      add(
        'centred-force',
        'Centred-force angular acceleration',
        measured(m.balanceError, 'rad/s²', 5),
        'Less than 0.01 rad/s²',
        m.balanceError < 0.01,
        'Use the bench to compare the offset force with the same force through the centre of mass.',
      );
      break;
    case 'flight-6': {
      bench(2);
      add(
        'inertia-change',
        'Nose-load / compact inertia',
        measured(m.inertiaRatio),
        'Greater than 1.20',
        m.inertiaRatio > 1.2,
        'Run the courier example to compare the same cargo at two distances from the rotation axis.',
      );
      const error = Math.abs(m.angularRatio * m.inertiaRatio - 1);
      add(
        'inverse-response',
        'Inverse angular response',
        measured(error * 100, '% difference'),
        'Less than 8% difference',
        error < 0.08,
        'With the same torque, compare how the larger inertia reduces angular acceleration.',
      );
      break;
    }
    default:
      return { completed: false, criteria: [] };
  }
  return { completed: criteria.every((c) => c.passed), criteria };
}

export const missionPassed = (id: string, metrics: Metrics) =>
  evaluateFlightMission(id, metrics).completed;
