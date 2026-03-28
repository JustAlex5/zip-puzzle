import { LevelDto } from '../../../core/models/level.model';

export interface GridPos {
  row: number;
  col: number;
}

export function barrierKey(r1: number, c1: number, r2: number, c2: number): string {
  return r1 > r2 || (r1 === r2 && c1 > c2)
    ? `${r2},${c2},${r1},${c1}`
    : `${r1},${c1},${r2},${c2}`;
}

export function buildBarrierSet(level: LevelDto): Set<string> {
  return new Set(level.barriers.map((b) => barrierKey(b.r1, b.c1, b.r2, b.c2)));
}

export function buildNumberMap(level: LevelDto): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of level.numbers) {
    m.set(`${n.row},${n.col}`, n.number);
  }
  return m;
}

/** Stable fingerprint of grid layout only (ignores name, scores, owner, etc.). */
export function levelPlaySignature(level: LevelDto): string {
  const numbers = [...level.numbers].sort(
    (a, b) => a.row - b.row || a.col - b.col || a.number - b.number
  );
  const barriers = [...level.barriers].sort(
    (a, b) => a.r1 - b.r1 || a.c1 - b.c1 || a.r2 - b.r2 || a.c2 - b.c2
  );
  return JSON.stringify({
    id: level.id,
    size: level.size,
    numbers,
    barriers,
  });
}

export function maxNumberInLevel(level: LevelDto): number {
  if (level.numbers.length === 0) {
    return 0;
  }
  return Math.max(...level.numbers.map((x) => x.number));
}

export function walkPath(
  path: GridPos[],
  numberMap: Map<string, number>
): { valid: boolean; lastHit: number } {
  let lastHit = 0;
  const visited = new Set<string>();
  for (const p of path) {
    const key = `${p.row},${p.col}`;
    if (visited.has(key)) {
      return { valid: false, lastHit: 0 };
    }
    visited.add(key);
    const num = numberMap.get(key);
    if (num !== undefined) {
      if (num !== lastHit + 1) {
        return { valid: false, lastHit: 0 };
      }
      lastHit = num;
    }
  }
  return { valid: true, lastHit };
}

export function canExtendPath(
  path: GridPos[],
  next: GridPos,
  level: LevelDto,
  barrierSet: Set<string>,
  numberMap: Map<string, number>
): boolean {
  const n = level.size;
  if (next.row < 0 || next.row >= n || next.col < 0 || next.col >= n) {
    return false;
  }
  if (path.some((p) => p.row === next.row && p.col === next.col)) {
    return false;
  }
  if (path.length === 0) {
    return numberMap.get(`${next.row},${next.col}`) === 1;
  }
  const last = path[path.length - 1];
  const dr = Math.abs(next.row - last.row);
  const dc = Math.abs(next.col - last.col);
  if (dr + dc !== 1) {
    return false;
  }
  if (barrierSet.has(barrierKey(last.row, last.col, next.row, next.col))) {
    return false;
  }
  const trial = [...path, next];
  return walkPath(trial, numberMap).valid;
}

export function isSolved(path: GridPos[], level: LevelDto, numberMap: Map<string, number>): boolean {
  const n = level.size;
  if (path.length !== n * n) {
    return false;
  }
  const { valid, lastHit } = walkPath(path, numberMap);
  if (!valid) {
    return false;
  }
  return lastHit === maxNumberInLevel(level);
}
