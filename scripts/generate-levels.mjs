#!/usr/bin/env node
/**
 * Generate Zip puzzle levels (JSON) matching backend LevelValidator / frontend rules.
 *
 * Usage:
 *   node scripts/generate-levels.mjs --count 200
 *   node scripts/generate-levels.mjs --post --token eyJhbG...
 *   node scripts/generate-levels.mjs --post --login-user alice --login-password secret
 *   node scripts/generate-levels.mjs --post --no-json
 *   node scripts/generate-levels.mjs --post --api-url http://localhost:5184   # direct Kestrel
 *
 * Default API base is http://localhost (Docker gateway: /auth, /levels). If your proxy uses a prefix
 * (e.g. /api), set --api-url http://localhost/api or ZIP_PUZZLE_API_URL.
 * Auth for --post: --token, env ZIP_PUZZLE_TOKEN, or --login-user + password (env ZIP_PUZZLE_PASSWORD).
 *
 * Modes:
 *   constructive (default) — solvable by design; O(n) verify (fast batch)
 *   brute                 — fully random layout; keep only if same backtracking check as API (smaller grids best)
 *
 * Difficulty (--difficulty, constructive only):
 *   easy   — row-wise snake path (or reversed); denser numbered cells; light walls
 *   medium — random Hamiltonian path + moderate random off-path walls (not an obvious “ladder”)
 *   hard   — random winding path + heavier off-path walls; fewer numbers → longer unclear segments (harder to plan)
 *   dense  — same path/walls as hard, but ~45–55% of cells numbered (Zip-app style: many checkpoints)
 *
 * Grids are always N×N (backend). For a 5×6 “phone” feel use --size-min 6 --size-max 6 (6×6 = 36 cells).
 * Example (post ~175 levels to production):
 *   node scripts/generate-levels.mjs --count 175 --size-min 6 --size-max 6 --difficulty dense --post \\
 *     --api-url http://zipgame.duckdns.org --prefix "Zip" --login-user YOUR_USER
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dirs = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function barrierKey(r1, c1, r2, c2) {
  return r1 > r2 || (r1 === r2 && c1 > c2)
    ? `${r2},${c2},${r1},${c1}`
    : `${r1},${c1},${r2},${c2}`;
}

/** Same semantics as Backend LevelValidator.IsSolvable; aborts after maxNodes expansions. */
function isSolvable(level, maxNodes = 4_000_000) {
  const n = level.size;
  const numberIndex = new Map();
  for (const nc of level.numbers) {
    numberIndex.set(`${nc.row},${nc.col}`, nc.number);
  }
  const barrierSet = new Set(level.barriers.map((b) => barrierKey(b.r1, b.c1, b.r2, b.c2)));

  const start = [...level.numbers].sort((a, b) => a.number - b.number)[0];
  const visited = Array.from({ length: n }, () => Array(n).fill(false));
  visited[start.row][start.col] = true;
  const totalNumbers = level.numbers.length;
  let nodes = 0;

  function backtrack(row, col, visitedCount, lastNumberHit) {
    if (++nodes > maxNodes) {
      return false;
    }
    if (visitedCount === n * n && lastNumberHit === totalNumbers) {
      return true;
    }
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (visited[nr][nc]) continue;
      if (barrierSet.has(barrierKey(row, col, nr, nc))) continue;
      const key = `${nr},${nc}`;
      if (numberIndex.has(key)) {
        if (numberIndex.get(key) !== lastNumberHit + 1) continue;
      }
      visited[nr][nc] = true;
      const nextNum = numberIndex.has(key) ? lastNumberHit + 1 : lastNumberHit;
      if (backtrack(nr, nc, visitedCount + 1, nextNum)) {
        return true;
      }
      visited[nr][nc] = false;
    }
    return false;
  }

  return backtrack(start.row, start.col, 1, 1);
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Consecutive 1..k on distinct cells (editor rule). */
function randomNumbers(size, k, rng) {
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells.push({ row: r, col: c });
    }
  }
  shuffleInPlace(cells, rng);
  const picked = cells.slice(0, k);
  return picked.map((cell, i) => ({ row: cell.row, col: cell.col, number: i + 1 }));
}

function randomBarriers(size, prob, rng) {
  const barriers = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c < size - 1 && rng() < prob) {
        barriers.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      }
      if (r < size - 1 && rng() < prob) {
        barriers.push({ r1: r, c1: c, r2: r + 1, c2: c });
      }
    }
  }
  return barriers;
}

/** Row-major snake: visits every cell exactly once (classic Hamiltonian path on a grid). */
function snakePath(size) {
  const path = [];
  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) path.push({ row: r, col: c });
    } else {
      for (let c = size - 1; c >= 0; c--) path.push({ row: r, col: c });
    }
  }
  return path;
}

function neighborCells(r, c, n) {
  const out = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
      out.push({ row: nr, col: nc });
    }
  }
  return out;
}

/**
 * Randomized DFS Hamiltonian path (visits each cell once). Falls back to null if budget exhausted.
 * Grids n≤9 usually succeed quickly; larger grids may need several start cells.
 */
function randomHamiltonianPath(n, rng, maxStarts = 120, maxDfsNodes = 12_000_000) {
  const total = n * n;
  let dfsNodes = 0;

  function orderedNextCells(r, c, visited) {
    const neigh = neighborCells(r, c, n).filter((x) => !visited[x.row][x.col]);
    const scored = neigh.map((cell) => {
      let w = 0;
      for (const x of neighborCells(cell.row, cell.col, n)) {
        if (!visited[x.row][x.col]) {
          w++;
        }
      }
      return { cell, w };
    });
    scored.sort((a, b) => {
      if (a.w !== b.w) {
        return a.w - b.w;
      }
      return rng() < 0.5 ? -1 : 1;
    });
    return scored.map((s) => s.cell);
  }

  function tryFrom(startRow, startCol) {
    const visited = Array.from({ length: n }, () => Array(n).fill(false));
    const stack = [];

    function dfs(r, c) {
      if (++dfsNodes > maxDfsNodes) {
        return false;
      }
      visited[r][c] = true;
      stack.push({ row: r, col: c });
      if (stack.length === total) {
        return true;
      }
      for (const { row: nr, col: nc } of orderedNextCells(r, c, visited)) {
        if (dfs(nr, nc)) {
          return true;
        }
      }
      visited[r][c] = false;
      stack.pop();
      return false;
    }

    if (dfs(startRow, startCol)) {
      return stack.slice();
    }
    return null;
  }

  const starts = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      starts.push([r, c]);
    }
  }
  shuffleInPlace(starts, rng);
  const limit = Math.min(maxStarts, starts.length);
  for (let i = 0; i < limit; i++) {
    dfsNodes = 0;
    const [sr, sc] = starts[i];
    const p = tryFrom(sr, sc);
    if (p) {
      return p;
    }
  }
  return null;
}

function pickConstructivePath(size, rng, difficulty) {
  if (difficulty === 'easy') {
    let path = snakePath(size);
    if (rng() < 0.5) {
      path = path.slice().reverse();
    }
    return path;
  }
  const winding = randomHamiltonianPath(size, rng);
  if (winding) {
    return winding;
  }
  let path = snakePath(size);
  if (rng() < 0.5) {
    path = path.slice().reverse();
  }
  return path;
}

function barrierProbForDifficulty(difficulty, rng) {
  if (difficulty === 'easy') {
    return 0.12 + rng() * 0.08;
  }
  if (difficulty === 'medium') {
    return 0.24 + rng() * 0.12;
  }
  // hard + dense: heavier walls
  return 0.38 + rng() * 0.14;
}

/** How many numbered checkpoints 1..k (capped). */
function pickK(size, rng, difficulty) {
  const cells = size * size;
  const maxK = Math.min(28, cells);
  if (difficulty === 'easy') {
    const lo = Math.max(3, Math.floor(cells * 0.55));
    const hi = Math.min(maxK, Math.max(lo + 1, cells - 1));
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  if (difficulty === 'medium') {
    return 3 + Math.floor(rng() * Math.max(1, maxK - 2));
  }
  if (difficulty === 'dense') {
    // ~half the cells numbered (Zip-style hard boards)
    const lo = Math.max(5, Math.floor(cells * 0.42));
    const hi = Math.min(maxK, Math.max(lo + 2, Math.floor(cells * 0.56)));
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  const lo = Math.max(4, Math.floor(cells * 0.28));
  const hi = Math.min(maxK, Math.max(lo + 2, Math.floor(cells * 0.58)));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Edge keys along a path (undirected). */
function pathEdgeKeys(path) {
  const keys = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    keys.add(barrierKey(a.row, a.col, b.row, b.col));
  }
  return keys;
}

/** O(n) proof that constructive generator produced a level solvable by walking `path`. */
function verifyConstructive(level, path) {
  const pathIndex = new Map();
  for (let i = 0; i < path.length; i++) {
    pathIndex.set(`${path[i].row},${path[i].col}`, i);
  }
  const nums = [...level.numbers].sort((a, b) => a.number - b.number);
  let lastIdx = -1;
  for (const nc of nums) {
    const ix = pathIndex.get(`${nc.row},${nc.col}`);
    if (ix === undefined || ix <= lastIdx) {
      return false;
    }
    lastIdx = ix;
  }
  const keep = pathEdgeKeys(path);
  for (const b of level.barriers) {
    const k = barrierKey(b.r1, b.c1, b.r2, b.c2);
    if (keep.has(k)) {
      return false;
    }
  }
  return true;
}

/**
 * Guaranteed solvable: Hamiltonian template path (snake or random winding),
 * walls only on edges not used by that path, numbers in order along the path.
 */
function generateConstructive(size, rng, difficulty) {
  const path = pickConstructivePath(size, rng, difficulty);
  const edgeKeep = pathEdgeKeys(path);
  const barrierP = barrierProbForDifficulty(difficulty, rng);

  const barriers = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c < size - 1) {
        const e = { r1: r, c1: c, r2: r, c2: c + 1 };
        const k = barrierKey(e.r1, e.c1, e.r2, e.c2);
        if (!edgeKeep.has(k) && rng() < barrierP) {
          barriers.push(e);
        }
      }
      if (r < size - 1) {
        const e = { r1: r, c1: c, r2: r + 1, c2: c };
        const k = barrierKey(e.r1, e.c1, e.r2, e.c2);
        if (!edgeKeep.has(k) && rng() < barrierP) {
          barriers.push(e);
        }
      }
    }
  }

  const k = pickK(size, rng, difficulty);
  const idx = [0];
  const interior = Array.from({ length: path.length - 2 }, (_, i) => i + 1);
  shuffleInPlace(interior, rng);
  const needExtra = k - 2;
  for (let i = 0; i < needExtra; i++) {
    idx.push(interior[i]);
  }
  idx.push(path.length - 1);
  idx.sort((a, b) => a - b);

  const numbers = idx.map((pi, i) => ({
    row: path[pi].row,
    col: path[pi].col,
    number: i + 1,
  }));

  return { size, barriers, numbers, path };
}

function generateBrute(size, barrierProb, rng) {
  const maxK = Math.min(18, size * size);
  const k = 3 + Math.floor(rng() * Math.max(1, maxK - 2));
  return {
    size,
    barriers: randomBarriers(size, barrierProb, rng),
    numbers: randomNumbers(size, k, rng),
  };
}

function parseArgs(argv) {
  const o = {
    count: 150,
    mode: 'constructive',
    seed: Date.now() % 1_000_000_000,
    sizeMin: 4,
    sizeMax: 8,
    barrierProb: 0.11,
    maxNodes: 4_000_000,
    out: join(__dirname, 'generated-levels.json'),
    prefix: 'Auto',
    post: false,
    apiUrl: process.env.ZIP_PUZZLE_API_URL || 'http://localhost',
    token: '',
    loginUser: '',
    loginPassword: '',
    noJson: false,
    difficulty: 'medium',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--count' && next) {
      o.count = parseInt(next, 10);
      i++;
    } else if (a === '--mode' && next) {
      o.mode = next;
      i++;
    } else if (a === '--seed' && next) {
      o.seed = parseInt(next, 10);
      i++;
    } else if (a === '--size-min' && next) {
      o.sizeMin = parseInt(next, 10);
      i++;
    } else if (a === '--size-max' && next) {
      o.sizeMax = parseInt(next, 10);
      i++;
    } else if (a === '--barrier-prob' && next) {
      o.barrierProb = parseFloat(next);
      i++;
    } else if (a === '--max-nodes' && next) {
      o.maxNodes = parseInt(next, 10);
      i++;
    } else if (a === '--out' && next) {
      o.out = next;
      i++;
    } else if (a === '--prefix' && next) {
      o.prefix = next;
      i++;
    } else if (a === '--api-url' && next) {
      o.apiUrl = next.replace(/\/$/, '');
      i++;
    } else if (a === '--token' && next) {
      o.token = next;
      i++;
    } else if (a === '--login-user' && next) {
      o.loginUser = next;
      i++;
    } else if (a === '--login-password' && next) {
      o.loginPassword = next;
      i++;
    } else if (a === '--post') {
      o.post = true;
    } else if (a === '--no-json') {
      o.noJson = true;
    } else if (a === '--difficulty' && next) {
      o.difficulty = next.toLowerCase();
      i++;
    } else if (a === '--help' || a === '-h') {
      o.help = true;
    }
  }
  return o;
}

async function loginForToken(apiUrl, username, password) {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json && (json.message || json.Message)) ||
      (json && json.data && json.data.error) ||
      res.statusText;
    throw new Error(`Login failed: ${msg}`);
  }
  const data = json.data ?? json.Data;
  const token = data?.token ?? data?.Token;
  if (!token) {
    throw new Error('Login response missing token');
  }
  return token;
}

function idFromLocation(loc) {
  if (!loc) return null;
  const s = String(loc);
  const m = s.match(/\/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

async function postLevel(apiUrl, token, payload) {
  const res = await fetch(`${apiUrl}/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  const data = json.data ?? json.Data;
  if (!res.ok) {
    const inner =
      (data && typeof data === 'object' && (data.error || data.Error)) || null;
    const msg =
      (typeof inner === 'string' && inner) ||
      json.message ||
      json.Message ||
      res.statusText;
    throw new Error(`POST /levels failed (${res.status}): ${msg}`);
  }
  const fromBody = data?.id ?? data?.Id;
  const loc = res.headers.get('Location');
  const id =
    fromBody != null && fromBody > 0 ? fromBody : idFromLocation(loc);
  if (id == null || id <= 0) {
    throw new Error('Create response missing id (check Location header / response body)');
  }
  return id;
}

async function resolveToken(opts) {
  if (opts.token) {
    return opts.token;
  }
  const envTok = process.env.ZIP_PUZZLE_TOKEN;
  if (envTok) {
    return envTok;
  }
  const user = opts.loginUser || process.env.ZIP_PUZZLE_LOGIN_USER;
  const pass = opts.loginPassword || process.env.ZIP_PUZZLE_PASSWORD || '';
  if (user && pass) {
    return loginForToken(opts.apiUrl, user, pass);
  }
  throw new Error(
    '--post requires --token, or env ZIP_PUZZLE_TOKEN, or --login-user with password (CLI or ZIP_PUZZLE_PASSWORD)',
  );
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(`See header comment in ${join(__dirname, 'generate-levels.mjs')}`);
    process.exit(0);
  }

  if (!['brute', 'constructive'].includes(opts.mode)) {
    console.error('mode must be brute or constructive');
    process.exit(1);
  }

  if (!['easy', 'medium', 'hard', 'dense'].includes(opts.difficulty)) {
    console.error('difficulty must be easy, medium, hard, or dense');
    process.exit(1);
  }

  let token = null;
  if (opts.post) {
    token = await resolveToken(opts);
    console.log(`Posting levels to ${opts.apiUrl}/levels`);
  }

  const rng = mulberry32(opts.seed);
  const levels = [];
  const createdIds = [];
  let attempts = 0;
  const t0 = Date.now();

  while (levels.length < opts.count) {
    attempts++;
    const size =
      opts.sizeMin + Math.floor(rng() * (opts.sizeMax - opts.sizeMin + 1));

    let body;
    let snakePathRef = null;
    if (opts.mode === 'constructive') {
      body = generateConstructive(size, rng, opts.difficulty);
      snakePathRef = body.path;
      body = { size: body.size, numbers: body.numbers, barriers: body.barriers };
    } else {
      body = generateBrute(size, opts.barrierProb, rng);
    }

    const level = {
      name: `${opts.prefix} ${levels.length + 1} (${opts.difficulty} ${size}×${size})`,
      size: body.size,
      numbers: body.numbers,
      barriers: body.barriers,
    };

    const ok =
      opts.mode === 'constructive'
        ? verifyConstructive(level, snakePathRef)
        : isSolvable(level, opts.maxNodes);
    if (!ok) {
      if (opts.mode === 'constructive') {
        console.error('constructive level failed verify (bug); retrying');
      }
      continue;
    }

    levels.push(level);

    if (opts.post) {
      const id = await postLevel(opts.apiUrl, token, level);
      createdIds.push(id);
      console.log(`  created id=${id} — ${level.name}`);
    }

    if (levels.length % 25 === 0 || levels.length === opts.count) {
      console.error(`… ${levels.length}/${opts.count} (attempts ${attempts})`);
    }
  }

  if (!opts.noJson) {
    writeFileSync(opts.out, JSON.stringify(levels, null, 2), 'utf8');
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const idTail =
    createdIds.length <= 40
      ? createdIds.join(', ')
      : `${createdIds.length} ids (first ${createdIds[0]}, last ${createdIds[createdIds.length - 1]})`;
  if (opts.noJson) {
    const verb = opts.post ? 'Posted' : 'Generated';
    console.log(
      `${verb} ${levels.length} levels in ${sec}s (${attempts} attempts, seed ${opts.seed})` +
        (opts.post && createdIds.length ? ` — ${idTail}` : ''),
    );
  } else {
    console.log(
      `Wrote ${levels.length} levels to ${opts.out} in ${sec}s (${attempts} attempts, seed ${opts.seed})` +
        (opts.post ? ` — posted: ${idTail}` : ''),
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
