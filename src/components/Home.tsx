import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  FlaskConical,
  LockKeyhole,
  MousePointer2,
  Plane,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import type { GameId, MissionDefinition, ProgressData } from '../core/types';
import { isMissionUnlocked } from '../core/progress';
import { allMissions, missionsFor } from '../core/registry';
import { FlightArt, VisionArt } from './WorkshopArt';

interface Props {
  progress: ProgressData;
  onLaunch: (game: GameId, mission?: string) => void;
  onNotebook: () => void;
}

export default function Home({ progress, onLaunch, onNotebook }: Props) {
  const [course, setCourse] = useState<GameId | 'all'>('all');
  const [selected, setSelected] = useState<GameId | null>(null);
  const missionsRef = useRef<HTMLElement>(null);
  function select(game: GameId) {
    setSelected(game);
    window.setTimeout(
      () =>
        missionsRef.current?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        }),
      50,
    );
  }
  const completed = (game: GameId) =>
    missionsFor(game).filter((m) => progress.missions[m.id]?.completed).length;
  const chapter = selected ? missionsFor(selected) : [];
  return (
    <main className="home" id="main-content">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="dot" /> A learning arcade · open for exploration
          </div>
          <h1>
            What happens if
            <br />
            you <em>try it?</em>
          </h1>
          <p>
            Build a flying machine. Teach a robot to see. Explore physics and machine learning
            through experiments you can actually play.
          </p>
        </div>
        <aside className="hero-aside" aria-label="How the workshops work">
          <div className="mini-heading">Bring your curiosity</div>
          <div className="method-row">
            <span>01</span>
            <div>
              <strong>Make something work</strong>
              <p>Start with a challenge or follow your own idea.</p>
            </div>
          </div>
          <div className="method-row">
            <span>02</span>
            <div>
              <strong>See what changed</strong>
              <p>Look inside the forces, data, and decisions.</p>
            </div>
          </div>
          <div className="method-row">
            <span>03</span>
            <div>
              <strong>Try a better question</strong>
              <p>One more experiment is always welcome.</p>
            </div>
          </div>
        </aside>
      </section>
      <section aria-label="Workshops">
        <div className="workshop-heading">
          <h2>
            Find your workshop <span className="section-count">/ 02</span>
          </h2>
          <div className="course-tabs" aria-label="Filter workshops">
            {(
              [
                ['all', 'All workshops'],
                ['flight', 'Physics'],
                ['vision', 'Computer science'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={course === id ? 'selected' : ''}
                aria-pressed={course === id}
                onClick={() => {
                  setCourse(id);
                  if (id !== 'all') setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="workshop-grid">
          {(course === 'all' || course === 'flight') && (
            <article className="workshop-card">
              <div className="workshop-art">
                <FlightArt />
                <span className="art-tag">
                  <Plane size={12} /> BUILD · FLY · EXPERIMENT
                </span>
                <span className="art-corner">A LITTLE HANGAR. A LOT OF POSSIBILITIES.</span>
              </div>
              <div className="card-body">
                <div className="card-label-row">
                  <span className="card-course">01 / Physics</span>
                  <span className="card-level">IB · 2025 syllabus</span>
                </div>
                <h2>Flight Workshop</h2>
                <p>
                  A few wings, a little thrust, and an idea. Build your own aircraft and discover
                  what keeps it in the sky.
                </p>
                <div className="topic-pills">
                  <span>Forces & motion</span>
                  <span>Energy</span>
                  <span>Balance & rotation</span>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button-primary"
                    aria-label="Explore flight missions"
                    onClick={() => select('flight')}
                  >
                    Explore the missions <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="button-text"
                    aria-label="Flight free play"
                    onClick={() => onLaunch('flight')}
                  >
                    Just build <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="workshop-footer">
                  <span>
                    <FlaskConical size={12} /> 6 experiments
                  </span>
                  <span>
                    <MousePointer2 size={12} /> 3D sandbox
                  </span>
                  <span
                    className="progress-track"
                    aria-label={`${completed('flight')} of 6 flight missions complete`}
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <i key={i} className={i < completed('flight') ? 'done' : ''} />
                    ))}
                  </span>
                </div>
              </div>
            </article>
          )}
          {(course === 'all' || course === 'vision') && (
            <article className="workshop-card">
              <div className="workshop-art vision-art">
                <VisionArt />
                <span className="art-tag">
                  <ScanLine size={12} /> TRAIN · SORT · DISCOVER
                </span>
                <span className="art-corner">A ROBOT WITH SOMETHING TO LEARN.</span>
              </div>
              <div className="card-body">
                <div className="card-label-row">
                  <span className="card-course">02 / Computer science</span>
                  <span className="card-level">IB · 2027 topic pack</span>
                </div>
                <h2>Robot Vision</h2>
                <p>
                  Your robot has a job to do. Give it examples, teach it to recognize patterns, and
                  find out where it goes wrong.
                </p>
                <div className="topic-pills">
                  <span>Neural networks</span>
                  <span>Convolution</span>
                  <span>Learning from data</span>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button-primary"
                    aria-label="Explore vision missions"
                    onClick={() => select('vision')}
                  >
                    Explore the missions <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="button-text"
                    aria-label="Vision free play"
                    onClick={() => onLaunch('vision')}
                  >
                    Meet your robot <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="workshop-footer">
                  <span>
                    <FlaskConical size={12} /> 6 experiments
                  </span>
                  <span>
                    <ScanLine size={12} /> Machine learning
                  </span>
                  <span
                    className="progress-track"
                    aria-label={`${completed('vision')} of 6 vision missions complete`}
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <i key={i} className={i < completed('vision') ? 'done' : ''} />
                    ))}
                  </span>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>
      {selected && (
        <section className="missions-panel" ref={missionsRef} aria-label={`${selected} missions`}>
          <div className="missions-title">
            <div>
              <div className="eyebrow">
                Your field guide · {selected === 'flight' ? 'Physics' : 'Computer science'}
              </div>
              <h2>
                {selected === 'flight'
                  ? 'A little understanding goes a long way.'
                  : 'Teach it something new.'}
              </h2>
              <p>
                Follow the experiments in order, or use free play to explore. Every attempt adds to
                your notebook; concept checks are optional.
              </p>
            </div>
            <button type="button" className="button-secondary" onClick={() => onLaunch(selected)}>
              Open free play <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="mission-grid">
            {chapter.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                progress={progress}
                onLaunch={onLaunch}
              />
            ))}
          </div>
        </section>
      )}
      <footer className="field-note">
        <div className="field-note-left">
          <Sparkles size={13} />
          <span>Curiosity needs room to wander. Free play is always open.</span>
        </div>
        <div className="field-note-right">
          <span>Progress stays in this browser</span>
          <button type="button" onClick={onNotebook}>
            Curriculum & field notes <ArrowDown size={10} style={{ verticalAlign: 'middle' }} />
          </button>
        </div>
      </footer>
    </main>
  );
}

function MissionCard({
  mission,
  progress,
  onLaunch,
}: {
  mission: MissionDefinition;
  progress: ProgressData;
  onLaunch: Props['onLaunch'];
}) {
  const unlocked = isMissionUnlocked(progress, mission, allMissions);
  const evidence = progress.missions[mission.id];
  const scope = mission.curriculum[0]?.level ?? 'Enrichment';
  return (
    <article className={`mission-card${unlocked ? '' : ' locked'}`} data-testid="mission-card">
      <div className="mission-card-top">
        <span className="mission-number">EXPERIMENT {String(mission.order).padStart(2, '0')}</span>
        <span className="scope-pill">{scope}</span>
      </div>
      <h3>{mission.title}</h3>
      <p>{mission.tagline}</p>
      <div className="mission-evidence">
        {evidence?.completed ? (
          <span>
            <Check size={10} /> Mission complete
          </span>
        ) : evidence?.explored ? (
          <span>
            <Circle size={9} /> Explored
          </span>
        ) : (
          <span>Ready for a new question</span>
        )}
        {evidence?.demonstrated && (
          <span>
            <Check size={10} /> Concept checked
          </span>
        )}
      </div>
      <button
        type="button"
        className={unlocked ? 'button-primary' : 'button-secondary'}
        disabled={!unlocked}
        onClick={() => onLaunch(mission.game, mission.id)}
      >
        {unlocked ? (
          <>
            {evidence?.completed ? 'Try again' : 'Start mission'} <ArrowRight size={12} />
          </>
        ) : (
          <>
            Locked <LockKeyhole size={11} />
          </>
        )}
      </button>
    </article>
  );
}
