import { LevelDto } from '../models/level.model';

export type LevelDifficulty = 'easy' | 'medium' | 'hard';

/** Infers difficulty from generated names like "(hard 6×6)" or falls back to grid size. */
export function inferDifficulty(level: LevelDto): LevelDifficulty {
  const m = /\b(easy|medium|hard)\b/i.exec(level.name);
  if (m) {
    return m[1].toLowerCase() as LevelDifficulty;
  }
  const n = level.size;
  if (n <= 4) {
    return 'easy';
  }
  if (n <= 6) {
    return 'medium';
  }
  return 'hard';
}

/** Rough “points” for level cards (mock UI). */
export function levelPoints(level: LevelDto): number {
  const base = level.size * level.size * 10;
  const mult = inferDifficulty(level) === 'hard' ? 1.5 : inferDifficulty(level) === 'medium' ? 1.2 : 1;
  return Math.round(base * mult);
}
