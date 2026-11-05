export type GameId = 'flight' | 'vision';

export interface SourceReference {
  title: string;
  url: string;
}

export interface CurriculumMapping {
  course: 'IB Physics' | 'IB Computer Science';
  firstAssessment: 2025 | 2027;
  topic: string;
  level: 'SL + HL' | 'HL' | 'Enrichment' | 'Scope review pending';
  verification: 'public-guide' | 'topic-overview';
}

export interface ConceptCheck {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MissionDefinition {
  id: string;
  game: GameId;
  order: number;
  title: string;
  tagline: string;
  brief: string;
  objective: string;
  concepts: string[];
  curriculum: CurriculumMapping[];
  sources: SourceReference[];
  check: ConceptCheck;
}

export interface AttemptResult {
  id: string;
  game: GameId;
  missionId: string | null;
  completed: boolean;
  createdAt: number;
  metrics: Record<string, number>;
  summary: string;
}

export interface ControlSettings {
  pitchUp: string;
  pitchDown: string;
  rollLeft: string;
  rollRight: string;
  yawLeft: string;
  yawRight: string;
  throttleUp: string;
  throttleDown: string;
  invertPitch: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_CONTROLS: ControlSettings = {
  pitchUp: 'KeyS',
  pitchDown: 'KeyW',
  rollLeft: 'KeyA',
  rollRight: 'KeyD',
  yawLeft: 'KeyQ',
  yawRight: 'KeyE',
  throttleUp: 'ShiftLeft',
  throttleDown: 'ControlLeft',
  invertPitch: false,
  reducedMotion: false,
};

export interface GameProps {
  mission: MissionDefinition | null;
  onAttempt: (result: AttemptResult) => void;
  onExit: () => void;
  settings: ControlSettings;
  onSettingsChange: (settings: ControlSettings) => void;
}

export interface GameLifecycle {
  pause(): void;
  resume(): void;
  reset(): void;
  dispose(): void;
}

export interface MissionProgress {
  explored: boolean;
  completed: boolean;
  demonstrated: boolean;
  attempts: number;
  bestMetrics: Record<string, number>;
}

export interface ProgressData {
  version: 1;
  missions: Record<string, MissionProgress>;
  recentAttempts: AttemptResult[];
}
