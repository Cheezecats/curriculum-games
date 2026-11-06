import { useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { AttemptResult, MissionDefinition } from '../core/types';
import {
  attemptConfiguration,
  attemptMeasurements,
  nextExperiment,
} from '../core/attempt-feedback';
import Modal from './Modal';
import ObjectiveChecklist from './ObjectiveChecklist';

export default function Debrief({
  attempt,
  mission,
  onClose,
  onCheck,
  onNext,
  previousAttempt,
}: {
  attempt: AttemptResult;
  mission: MissionDefinition | null;
  onClose: () => void;
  onCheck: (correct: boolean) => void;
  onNext?: () => void;
  previousAttempt?: AttemptResult;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const metrics = attemptMeasurements(attempt, previousAttempt);
  const configuration = attemptConfiguration(attempt, previousAttempt);
  return (
    <Modal
      title={attempt.completed ? 'That idea worked.' : 'An observation worth keeping.'}
      eyebrow={
        attempt.completed
          ? 'Mission complete · recorded in your notebook'
          : 'Attempt recorded · a new starting point'
      }
      onClose={onClose}
      footer={
        <div className="debrief-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            <RotateCcw size={13} /> Back to the workshop
          </button>
          {onNext && attempt.completed && (
            <button type="button" className="button-primary" onClick={onNext}>
              Next experiment <ArrowRight size={13} />
            </button>
          )}
        </div>
      }
    >
      <p className="debrief-summary">{attempt.summary}</p>
      {!!attempt.criteria?.length && <ObjectiveChecklist criteria={attempt.criteria} />}
      <div className="next-experiment">
        <h3>Try one change</h3>
        <p>{nextExperiment(attempt)}</p>
      </div>
      <h3>Run measurements</h3>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric-cell" key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      {previousAttempt && (
        <section className="attempt-comparison" aria-label="Attempt comparison">
          <h3>Previous comparable attempt</h3>
          <p>
            Same workshop, mission and task. Differences describe these runs; they do not isolate a
            cause.
          </p>
          <div className="comparison-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Measurement</th>
                  <th scope="col">Previous</th>
                  <th scope="col">Now</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics
                  .filter((metric) => metric.previous !== undefined)
                  .map((metric) => (
                    <tr key={metric.key}>
                      <th scope="row">{metric.label}</th>
                      <td>{metric.previous}</td>
                      <td>{metric.value}</td>
                      <td>{metric.delta ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {configuration.length > 0 && (
        <details className="attempt-configuration">
          <summary>
            Setup used for this attempt{previousAttempt ? ' · includes changes' : ''}
          </summary>
          <dl>
            {configuration.map((item) => (
              <div key={item.key}>
                <dt>{item.label}</dt>
                <dd>{item.changed ?? item.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {mission && (
        <section className="check-panel">
          <div className="check-title">
            <h3>A question to take with you</h3>
            <span>Optional · keeps gameplay open</span>
          </div>
          <p className="question">{mission.check.question}</p>
          <div className="check-options">
            {mission.check.options.map((option, index) => (
              <button
                type="button"
                key={option}
                className={`check-option${answer === index ? (index === mission.check.correctIndex ? ' correct' : ' incorrect') : ''}`}
                onClick={() => {
                  setAnswer(index);
                  onCheck(index === mission.check.correctIndex);
                }}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
                {answer === index && index === mission.check.correctIndex && <Check size={14} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <p role="status">
              {answer === mission.check.correctIndex ? 'Yes. ' : 'Try thinking about it this way. '}
              {mission.check.explanation}
            </p>
          )}
        </section>
      )}
    </Modal>
  );
}
