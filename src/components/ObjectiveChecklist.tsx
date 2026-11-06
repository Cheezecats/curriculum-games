import type { ObjectiveEvidence } from '../core/types';

export default function ObjectiveChecklist({
  criteria,
  compact = false,
}: {
  criteria: ObjectiveEvidence[];
  compact?: boolean;
}) {
  if (!criteria.length) return null;
  const ordered = [
    ...criteria.filter((item) => !item.passed),
    ...criteria.filter((item) => item.passed),
  ];
  return (
    <ul
      className={`objective-checklist${compact ? ' compact' : ''}`}
      aria-label="Objective evidence"
    >
      {ordered.map((item) => (
        <li key={item.id} className={item.passed ? 'criterion-met' : 'criterion-unmet'}>
          <div className="criterion-heading">
            <strong>{item.label}</strong>
            <span>{item.passed ? 'Met' : 'To reach'}</span>
          </div>
          <div className="criterion-measurement">
            <span>
              Measured <b>{item.actual}</b>
            </span>
            <span>
              Target <b>{item.target}</b>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
