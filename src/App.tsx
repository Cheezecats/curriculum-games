import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import Home from './components/Home';
import Notebook from './components/Notebook';
import Debrief from './components/Debrief';
import GameBoundary from './components/GameBoundary';
import { allMissions, sourceRepository } from './core/registry';
import {
  emptyProgress,
  isMissionUnlocked,
  parseProgress,
  recordAttempt,
  recordCheck,
} from './core/progress';
import { readRecord, writeRecord } from './core/storage';
import { DEFAULT_CONTROLS } from './core/types';
import type { AttemptResult, ControlSettings, GameId, ProgressData } from './core/types';

const Flight = lazy(() => import('./games/flight/FlightWorkshop'));
const Vision = lazy(() => import('./games/vision/VisionWorkshop'));
function readRoute(): { game: GameId; missionId: string | null } | null {
  const [pathname, query] = location.hash.replace(/^#\/?/, '').split('?');
  if (pathname !== 'flight' && pathname !== 'vision') return null;
  return { game: pathname, missionId: new URLSearchParams(query).get('mission') };
}
function restoreControls(value: unknown): ControlSettings {
  if (!value || typeof value !== 'object') return DEFAULT_CONTROLS;
  const fields = value as Record<string, unknown>;
  const next = { ...DEFAULT_CONTROLS };
  for (const key of Object.keys(DEFAULT_CONTROLS) as (keyof ControlSettings)[]) {
    if (key === 'invertPitch' || key === 'reducedMotion') {
      if (typeof fields[key] === 'boolean') next[key] = fields[key] as boolean;
    } else if (
      typeof fields[key] === 'string' &&
      /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Space)$/.test(
        fields[key] as string,
      )
    )
      next[key] = fields[key] as string;
  }
  return next;
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [progress, setProgress] = useState<ProgressData>(emptyProgress);
  const [settings, setSettings] = useState<ControlSettings>(DEFAULT_CONTROLS);
  const [loaded, setLoaded] = useState(false);
  const [notebook, setNotebook] = useState(false);
  const [debrief, setDebrief] = useState<AttemptResult | null>(null);
  const [notice, setNotice] = useState('');
  const key = route ? `${route.game}:${route.missionId ?? 'free'}` : 'home';
  const activeKey = useRef(key);
  activeKey.current = key;
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setDebrief(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    let current = true;
    void Promise.all([
      readRecord<unknown>('progress', emptyProgress()),
      readRecord<unknown>('controls', DEFAULT_CONTROLS),
    ]).then(([stored, controls]) => {
      if (!current) return;
      try {
        setProgress(
          parseProgress(
            JSON.stringify(stored),
            allMissions.map((m) => m.id),
          ),
        );
      } catch {
        setNotice('The saved notebook could not be read. A fresh notebook is ready.');
      }
      setSettings(restoreControls(controls));
      setLoaded(true);
    });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    void writeRecord('progress', progress).catch(() =>
      setNotice(
        'This browser could not save your notebook. Export a backup from the notebook to keep it.',
      ),
    );
  }, [progress, loaded]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 8500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const launch = useCallback((game: GameId, missionId?: string) => {
    setDebrief(null);
    location.hash = `/${game}${missionId ? `?mission=${encodeURIComponent(missionId)}` : ''}`;
  }, []);
  const exit = useCallback(() => {
    setDebrief(null);
    location.hash = '';
  }, []);
  const mission = route?.missionId
    ? (allMissions.find((m) => m.id === route.missionId && m.game === route.game) ?? null)
    : null;
  const locked = !!mission && !isMissionUnlocked(progress, mission, allMissions);
  const onAttempt = useCallback(
    (result: AttemptResult) => {
      if (
        activeKey.current !== key ||
        !route ||
        result.game !== route.game ||
        result.missionId !== (mission?.id ?? null)
      )
        return;
      setProgress((previous) => recordAttempt(previous, result));
      setDebrief(result);
    },
    [key, route, mission],
  );
  const changeSettings = useCallback((next: ControlSettings) => {
    setSettings(next);
    void writeRecord('controls', next).catch(() =>
      setNotice('Your control settings could not be saved.'),
    );
  }, []);
  const nextMission = mission
    ? allMissions.find((m) => m.game === mission.game && m.order === mission.order + 1)
    : undefined;
  const completedCount = Object.values(progress.missions).filter((m) => m.completed).length;
  return (
    <div className="site-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          const main = document.querySelector<HTMLElement>('main');
          if (main) {
            main.tabIndex = -1;
            main.focus({ preventScroll: true });
          }
        }}
      >
        Skip to content
      </a>
      <header className={`site-header${route ? ' game-header' : ''}`}>
        <button type="button" className="brand" aria-label="Fieldwork home" onClick={exit}>
          <span className="brand-symbol">f</span>
          <span className="brand-word">
            fieldwork<span style={{ color: 'var(--teal)' }}>.</span>
          </span>
          {!route && <span className="brand-tag">a playground for understanding</span>}
        </button>
        {route ? (
          <div className="game-crumb">
            <span>WORKSHOPS</span>
            <ChevronRight size={12} />
            <span>{route.game === 'flight' ? 'FLIGHT WORKSHOP' : 'ROBOT VISION'}</span>
            <ChevronRight size={12} />
            <span>
              {mission ? `EXPERIMENT ${String(mission.order).padStart(2, '0')}` : 'FREE PLAY'}
            </span>
          </div>
        ) : (
          <nav className="header-right" aria-label="Main navigation">
            <a className="header-link active" href="#main-content">
              The workshops
            </a>
            {sourceRepository && (
              <a className="header-link" href={sourceRepository} target="_blank" rel="noreferrer">
                Open source <ArrowUpRight size={12} />
              </a>
            )}
            <button
              type="button"
              className="notebook-button"
              aria-label="Open notebook"
              onClick={() => setNotebook(true)}
            >
              <BookOpen size={14} /> Your notebook{' '}
              <span className="count">{completedCount}/12</span>
            </button>
          </nav>
        )}
      </header>
      {!route ? (
        <Home progress={progress} onLaunch={launch} onNotebook={() => setNotebook(true)} />
      ) : !loaded ? (
        <Loading text="Opening your notebook…" />
      ) : locked ? (
        <main className="locked-route">
          <h1>One experiment at a time.</h1>
          <p>Complete the previous mission to unlock this one. Free play is always open.</p>
          <button type="button" className="button-primary" onClick={() => launch(route.game)}>
            Open free play <ArrowUpRight size={13} />
          </button>
          <button type="button" className="button-text" onClick={exit}>
            <ArrowLeft size={13} /> Back to the workshops
          </button>
        </main>
      ) : (
        <GameBoundary key={key} onExit={exit}>
          <Suspense
            fallback={
              <Loading
                text={route.game === 'flight' ? 'Opening the hangar…' : 'Waking up your robot…'}
              />
            }
          >
            {route.game === 'flight' ? (
              <Flight
                key={key}
                mission={mission}
                settings={settings}
                onSettingsChange={changeSettings}
                onAttempt={onAttempt}
                onExit={exit}
              />
            ) : (
              <Vision
                key={key}
                mission={mission}
                settings={settings}
                onSettingsChange={changeSettings}
                onAttempt={onAttempt}
                onExit={exit}
              />
            )}
          </Suspense>
        </GameBoundary>
      )}
      {notebook && (
        <Notebook
          progress={progress}
          onClose={() => setNotebook(false)}
          onImport={async (next) => {
            await writeRecord('progress', next);
            setProgress(next);
          }}
        />
      )}
      {debrief && (
        <Debrief
          key={debrief.id}
          attempt={debrief}
          mission={allMissions.find((m) => m.id === debrief.missionId) ?? null}
          onClose={() => setDebrief(null)}
          onCheck={(correct) => {
            if (debrief.missionId)
              setProgress((previous) => recordCheck(previous, debrief.missionId!, correct));
          }}
          onNext={nextMission ? () => launch(nextMission.game, nextMission.id) : undefined}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <main className="game-loading">
      <span className="loading-spinner" aria-hidden="true" />
      <p>{text}</p>
    </main>
  );
}
