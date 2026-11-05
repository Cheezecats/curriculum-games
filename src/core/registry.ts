import { flightMissions } from '../games/flight/missions';
import { visionMissions } from '../games/vision/missions';
import type { GameId } from './types';

export const allMissions = [...flightMissions, ...visionMissions];
export const missionsFor = (game: GameId) => allMissions.filter(mission => mission.game === game).sort((a, b) => a.order - b.order);
export const sourceRepository = import.meta.env.VITE_REPOSITORY_URL as string | undefined;
