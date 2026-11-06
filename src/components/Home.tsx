import { useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, LockKeyhole } from 'lucide-react';
import type { GameId, MissionDefinition, ProgressData } from '../core/types';
import { isMissionUnlocked } from '../core/progress';
import { allMissions, missionsFor, sourceRepository } from '../core/registry';

interface Props {
  progress: ProgressData;
  onLaunch: (game: GameId, mission?: string) => void;
  onNotebook: () => void;
}

export default function Home({ progress, onLaunch, onNotebook }: Props) {
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
      40,
    );
  }
  return (
    <main className="home" id="main-content">
      <section className="hero" aria-label="A learning game collection">
        <h1>
          PLAY WITH
          <br />
          THE BIG IDEAS<span>.</span>
        </h1>
        <div className="hero-description">
          <h2>
            AN ORIGINAL LEARNING GAME COLLECTION <br />
            FOR IB-AGE STUDENTS.
          </h2>
          <p>
            Build, test, and explore real ideas from physics and computer science, with guided
            missions or free play.
          </p>
        </div>
      </section>
      <section className="workshop-index" aria-label="Workshops">
        <article className="workshop-story flight-story">
          <button
            className="workshop-preview"
            aria-label="Preview Flight Workshop"
            onClick={() => onLaunch('flight')}
          >
            <img
              src={`${import.meta.env.BASE_URL}art/flight-hangar.jpg`}
              alt="A modular ivory and red aircraft in an industrial hangar"
              fetchPriority="high"
              width="1895"
              height="830"
            />
            <span className="preview-play" aria-hidden="true">
              <ArrowUpRight size={23} />
            </span>
          </button>
          <div className="story-copy">
            <h2>
              FLIGHT <br />
              WORKSHOP
            </h2>
            <p>
              A 3D modular aircraft sandbox. Build your own aircraft and discover what keeps it in
              the sky.
            </p>
            <div className="story-meta">
              <button aria-label="Explore flight missions" onClick={() => select('flight')}>
                6 MISSIONS
              </button>
              <span>PHYSICS</span>
            </div>
            <button
              className="story-cta"
              aria-label="Flight free play"
              onClick={() => onLaunch('flight')}
            >
              BUILD AN AIRCRAFT <ArrowRight size={28} />
            </button>
            <button className="story-footnote" onClick={() => select('flight')}>
              Guided experiments <ArrowUpRight size={14} />
              <span>
                {missionsFor('flight').filter((m) => progress.missions[m.id]?.completed).length}/6
                completed
              </span>
            </button>
          </div>
        </article>
        <article className="workshop-story vision-story">
          <button
            className="workshop-preview"
            aria-label="Preview Robot Vision"
            onClick={() => onLaunch('vision')}
          >
            <img
              src={`${import.meta.env.BASE_URL}art/robot-conveyor.jpg`}
              alt="A mechanical robot learning to sort shapes on a conveyor"
              width="2172"
              height="724"
            />
            <span className="preview-play" aria-hidden="true">
              <ArrowUpRight size={23} />
            </span>
          </button>
          <div className="story-copy">
            <h2>ROBOT VISION</h2>
            <p>
              Train a robot with examples, teach it to recognize patterns, and find out where it
              goes wrong.
            </p>
            <div className="story-meta">
              <button aria-label="Explore vision missions" onClick={() => select('vision')}>
                6 MISSIONS
              </button>
              <span>COMPUTER SCIENCE</span>
            </div>
            <button
              className="story-cta"
              aria-label="Vision free play"
              onClick={() => onLaunch('vision')}
            >
              TRAIN A ROBOT <ArrowRight size={28} />
            </button>
            <button className="story-footnote" onClick={() => select('vision')}>
              Guided experiments <ArrowUpRight size={14} />
              <span>
                {missionsFor('vision').filter((m) => progress.missions[m.id]?.completed).length}/6
                completed
              </span>
            </button>
          </div>
        </article>
      </section>
      {selected && (
        <section className="missions-panel" ref={missionsRef} aria-label={`${selected} missions`}>
          <div className="missions-title">
            <div>
              <div className="eyebrow">
                {selected === 'flight'
                  ? 'PHYSICS / FIRST ASSESSMENT 2025'
                  : 'COMPUTER SCIENCE / FIRST ASSESSMENT 2027'}
              </div>
              <h2>{selected === 'flight' ? 'THE FLIGHT EXPERIMENTS' : 'TEACH IT SOMETHING NEW'}</h2>
              <p>
                Follow the experiments in order, or explore in free play. Concept checks are
                optional.
              </p>
            </div>
            <button className="button-secondary" onClick={() => onLaunch(selected)}>
              Open free play <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="mission-grid">
            {missionsFor(selected).map((mission) => (
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
        <span>INDEPENDENT EXPLORATION. REAL UNDERLYING IDEAS.</span>
        <div>
          <button onClick={onNotebook}>
            <BookOpen size={14} /> Curriculum & notebook
          </button>
          {sourceRepository && (
            <a href={sourceRepository} target="_blank" rel="noreferrer">
              Source code <ArrowUpRight size={14} />
            </a>
          )}
          <span>Progress stays in your browser.</span>
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
  return (
    <article className={`mission-card${unlocked ? '' : ' locked'}`} data-testid="mission-card">
      <div className="mission-card-top">
        <span className="mission-number">EXPERIMENT {String(mission.order).padStart(2, '0')}</span>
        <span className="scope-pill">{mission.curriculum[0]?.level ?? 'Enrichment'}</span>
      </div>
      <h3>{mission.title}</h3>
      <p>{mission.tagline}</p>
      <div className="mission-evidence">
        {evidence?.completed ? (
          <span>
            <Check size={13} /> Mission complete
          </span>
        ) : evidence?.explored ? (
          <span>Explored</span>
        ) : (
          <span>Ready to explore</span>
        )}
        {evidence?.demonstrated && (
          <span>
            <Check size={13} /> Concept checked
          </span>
        )}
      </div>
      <button
        className={unlocked ? 'button-primary' : 'button-secondary'}
        disabled={!unlocked}
        onClick={() => onLaunch(mission.game, mission.id)}
      >
        {unlocked ? (
          <>
            {evidence?.completed ? 'Try again' : 'Start mission'} <ArrowRight size={15} />
          </>
        ) : (
          <>
            Locked <LockKeyhole size={14} />
          </>
        )}
      </button>
    </article>
  );
}
