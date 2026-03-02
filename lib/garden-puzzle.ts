import type { IsoBoardTheme } from '@/components/IsoBoard';

export type Direction = 'N' | 'E' | 'S' | 'W';
export type PuzzleKind = 'straight' | 'corner';
export type Point = { x: number; y: number };

export type PerspectiveLink = {
  a: Point;
  b: Point;
  requiredSwitch?: {
    tile: Point;
    rotations: number[];
  };
};

type LevelTheme = IsoBoardTheme;

export type PuzzleLevel = {
  id: number;
  name: string;
  vibe: string;
  expectedMoves: number;
  layout: PuzzleKind[][];
  initialRotations: number[][];
  start: Point;
  goal: Point;
  perspectiveLinks: PerspectiveLink[];
  theme: LevelTheme;
  flowerTileKeys: string[];
  obstacleTileKeys: string[];
  seed: number;
};

type GeneratedLevelCandidate = {
  level: PuzzleLevel;
  solvedRotations: number[][];
};

const ADDITIONAL_LEVEL_COUNT = 11;
const LEVEL_NAMES = [
  'Garden Walk',
  'Sky Terrace',
  'Canopy Towers',
  'Moss Maze',
  'Moon Fern Route',
  'Stone Brook',
  'Glade Crossing',
  'Quiet Canals',
  'Bamboo Spiral',
  'Pond Weave',
  'Cloud Roots',
  'Night Petals',
  'Cedar Verge',
  'Golden Gate',
];

const LEVEL_VIBES = [
  'Gentle intro to rotation and flow',
  'Floating garden paths',
  'Multi-layer route with bridge crossings',
  'Dense foliage and winding channels',
  'Calm moonlit route through soft turns',
  'Cross-stream puzzle with hidden shortcuts',
  'Balanced turns and fast directional shifts',
  'Quiet path with deceptive turns',
  'Layered grid with fast correction loops',
  'Steady pond route with long segments',
  'Cloud deck puzzle with bridge toggles',
  'Night garden with tight switch choices',
  'Long calm route with varied corners',
  'Victory lap through sunlit stone',
];

const LEVEL_THEMES: LevelTheme[] = [
  {
    skyColors: ['#7fb5b5', '#5a9a9a', '#4a8a8a'],
    stoneColors: ['#6a7c62', '#5a6b52', '#4a5a42'],
    tileActive: ['#8ab89a', '#6a9a7a', '#5a8a6a'],
    tileInactive: ['#7a8c6e', '#6a7c5e', '#5a6c4e'],
    pipeActive: '#4a9e6e',
    pipeGlow: '#00d2c8',
    groundColor: '#C9E8CE',
    starOpacity: 0.28,
  },
  {
    skyColors: ['#b8d4f0', '#7fb5c8', '#5a9aaa'],
    stoneColors: ['#8a9c82', '#7a8c72', '#6a7c62'],
    tileActive: ['#a0c8a0', '#80aa80', '#60906a'],
    tileInactive: ['#8a9c7e', '#7a8c6e', '#6a7c5e'],
    pipeActive: '#3a8e5e',
    pipeGlow: '#60d890',
    groundColor: '#b8d8be',
    starOpacity: 0.1,
    inactivePipeOpacity: 0.9,
    inactivePipeStrokeBonus: 3,
  },
  {
    skyColors: ['#1a1a2e', '#16213e', '#0f3460'],
    stoneColors: ['#3a4a5a', '#2a3a4a', '#1a2a3a'],
    tileActive: ['#2a6a8a', '#1a5a7a', '#0a4a6a'],
    tileInactive: ['#2a3a4a', '#1a2a3a', '#0a1a2a'],
    pipeActive: '#00d2c8',
    pipeGlow: '#00ffff',
    groundColor: '#1a3a5a',
    starOpacity: 0.8,
  },
  {
    skyColors: ['#99c9a4', '#6ea88a', '#4f886f'],
    stoneColors: ['#74896b', '#62765a', '#4e5f47'],
    tileActive: ['#98d2b3', '#72b593', '#548d75'],
    tileInactive: ['#739273', '#617c61', '#4f654f'],
    pipeActive: '#2c8f63',
    pipeGlow: '#6adfac',
    groundColor: '#bedfb8',
    starOpacity: 0.14,
  },
  {
    skyColors: ['#ffd8a8', '#f7b267', '#e76f51'],
    stoneColors: ['#7f6a58', '#6b5849', '#544437'],
    tileActive: ['#e9b872', '#d39a55', '#b67e3f'],
    tileInactive: ['#9d846c', '#846e59', '#6a5948'],
    pipeActive: '#7fb069',
    pipeGlow: '#b7f58e',
    groundColor: '#f4d5ad',
    starOpacity: 0.2,
  },
  {
    skyColors: ['#d6e2ff', '#9fb3f6', '#6f87d9'],
    stoneColors: ['#8290a8', '#6d7890', '#566078'],
    tileActive: ['#b8c8ff', '#8ea4ef', '#6f88d6'],
    tileInactive: ['#8f97b2', '#787f98', '#606781'],
    pipeActive: '#5073d6',
    pipeGlow: '#8dadff',
    groundColor: '#d5def6',
    starOpacity: 0.38,
  },
  {
    skyColors: ['#F5E6C8', '#E8D4A3', '#D4AF37'],
    stoneColors: ['#8B7355', '#6B5344', '#4A3C31'],
    tileActive: ['#E8D4A3', '#D4B853', '#C9A227'],
    tileInactive: ['#B8A060', '#9A8B4A', '#7A6B3A'],
    pipeActive: '#2E7D32',
    pipeGlow: '#7FFF8F',
    groundColor: '#F5E6C8',
    starOpacity: 0.22,
  },
];

type RNG = () => number;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFrom<T>(rng: RNG, values: T[]): T {
  return values[randomInt(rng, 0, values.length - 1)];
}

function createSessionSeed(): number {
  const debugSeed = (globalThis as Record<string, unknown>).__KHIDO_GARDEN_SEED__;
  if (typeof debugSeed === 'number' && Number.isFinite(debugSeed)) {
    return Math.floor(debugSeed);
  }
  if (typeof debugSeed === 'string' && debugSeed.trim().length > 0) {
    return hashSeed(debugSeed.trim());
  }
  return hashSeed(`${Date.now()}`);
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function directionBetween(from: Point, to: Point): Direction {
  if (to.x > from.x) return 'E';
  if (to.x < from.x) return 'W';
  if (to.y > from.y) return 'S';
  return 'N';
}

function normalizeDirPair(a: Direction, b: Direction): string {
  return [a, b].sort().join('');
}

function dirsToTile(d1: Direction, d2: Direction): { kind: PuzzleKind; rotation: number } {
  const pair = normalizeDirPair(d1, d2);
  if (pair === 'NS') return { kind: 'straight', rotation: 0 };
  if (pair === 'EW') return { kind: 'straight', rotation: 90 };
  if (pair === normalizeDirPair('N', 'E')) return { kind: 'corner', rotation: 0 };
  if (pair === normalizeDirPair('E', 'S')) return { kind: 'corner', rotation: 90 };
  if (pair === normalizeDirPair('S', 'W')) return { kind: 'corner', rotation: 180 };
  return { kind: 'corner', rotation: 270 };
}

type PathDirection = 'left_to_right' | 'right_to_left' | 'top_to_bottom' | 'bottom_to_top';

type BuildPathOptions = {
  forwardBias: number;
  wanderBias: number;
  revisitPenalty: number;
  maxStepsMultiplier: number;
};

type LevelGenerationConfig = {
  cols: number;
  rows: number;
  directions: PathDirection[];
  minTurns: number;
  targetLength: number;
  scrambleBoost: number;
  perspectiveLinks: number;
  decorDensity: number;
};

const LEVEL_GENERATION_CONFIGS: LevelGenerationConfig[] = [
  { cols: 3, rows: 3, directions: ['left_to_right'], minTurns: 1, targetLength: 4, scrambleBoost: 0, perspectiveLinks: 0, decorDensity: 0.34 },
  { cols: 4, rows: 3, directions: ['top_to_bottom', 'right_to_left'], minTurns: 2, targetLength: 6, scrambleBoost: 0, perspectiveLinks: 0, decorDensity: 0.36 },
  { cols: 4, rows: 4, directions: ['right_to_left', 'bottom_to_top'], minTurns: 3, targetLength: 7, scrambleBoost: 0, perspectiveLinks: 1, decorDensity: 0.38 },
  { cols: 5, rows: 4, directions: ['bottom_to_top', 'left_to_right'], minTurns: 4, targetLength: 8, scrambleBoost: 1, perspectiveLinks: 1, decorDensity: 0.4 },
  { cols: 5, rows: 4, directions: ['top_to_bottom', 'left_to_right', 'right_to_left'], minTurns: 4, targetLength: 9, scrambleBoost: 1, perspectiveLinks: 1, decorDensity: 0.42 },
  { cols: 5, rows: 5, directions: ['right_to_left', 'top_to_bottom'], minTurns: 5, targetLength: 10, scrambleBoost: 1, perspectiveLinks: 1, decorDensity: 0.45 },
  { cols: 6, rows: 5, directions: ['left_to_right', 'bottom_to_top'], minTurns: 6, targetLength: 12, scrambleBoost: 1, perspectiveLinks: 2, decorDensity: 0.46 },
  { cols: 6, rows: 5, directions: ['top_to_bottom', 'right_to_left'], minTurns: 6, targetLength: 13, scrambleBoost: 1, perspectiveLinks: 2, decorDensity: 0.46 },
  { cols: 6, rows: 6, directions: ['bottom_to_top', 'left_to_right'], minTurns: 7, targetLength: 14, scrambleBoost: 2, perspectiveLinks: 2, decorDensity: 0.48 },
  { cols: 6, rows: 6, directions: ['right_to_left', 'top_to_bottom', 'left_to_right'], minTurns: 8, targetLength: 15, scrambleBoost: 2, perspectiveLinks: 2, decorDensity: 0.5 },
  { cols: 6, rows: 6, directions: ['left_to_right', 'bottom_to_top', 'top_to_bottom'], minTurns: 8, targetLength: 16, scrambleBoost: 2, perspectiveLinks: 2, decorDensity: 0.52 },
  { cols: 6, rows: 6, directions: ['top_to_bottom', 'right_to_left'], minTurns: 9, targetLength: 17, scrambleBoost: 2, perspectiveLinks: 3, decorDensity: 0.54 },
  { cols: 6, rows: 6, directions: ['bottom_to_top', 'left_to_right'], minTurns: 9, targetLength: 18, scrambleBoost: 2, perspectiveLinks: 3, decorDensity: 0.56 },
  { cols: 6, rows: 6, directions: ['right_to_left', 'top_to_bottom'], minTurns: 10, targetLength: 19, scrambleBoost: 3, perspectiveLinks: 3, decorDensity: 0.58 },
];

function chooseWeightedPoint(rng: RNG, candidates: { point: Point; score: number }[]): Point {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0.1, candidate.score), 0);
  let threshold = rng() * total;
  for (const candidate of candidates) {
    threshold -= Math.max(0.1, candidate.score);
    if (threshold <= 0) return candidate.point;
  }
  return candidates[candidates.length - 1].point;
}

function countTurns(path: Point[]): number {
  if (path.length < 3) return 0;
  let turns = 0;
  for (let i = 2; i < path.length; i += 1) {
    const prevDir = directionBetween(path[i - 2], path[i - 1]);
    const nextDir = directionBetween(path[i - 1], path[i]);
    if (prevDir !== nextDir) turns += 1;
  }
  return turns;
}

function buildPath(
  cols: number,
  rows: number,
  rng: RNG,
  direction: PathDirection = 'left_to_right',
  options?: Partial<BuildPathOptions>
): Point[] {
  const forwardBias = options?.forwardBias ?? 2.8;
  const wanderBias = options?.wanderBias ?? 1.4;
  const revisitPenalty = options?.revisitPenalty ?? 2.2;
  const maxStepsMultiplier = options?.maxStepsMultiplier ?? 9;

  let start: Point;
  let isAtGoal: (p: Point) => boolean;
  let isForwardMove: (from: Point, to: Point) => boolean;
  let goal: Point;

  switch (direction) {
    case 'right_to_left':
      start = { x: cols - 1, y: randomInt(rng, 0, rows - 1) };
      goal = { x: 0, y: start.y };
      isAtGoal = (p) => p.x <= 0;
      isForwardMove = (from, to) => to.x < from.x;
      break;
    case 'top_to_bottom':
      start = { x: randomInt(rng, 0, cols - 1), y: 0 };
      goal = { x: start.x, y: rows - 1 };
      isAtGoal = (p) => p.y >= rows - 1;
      isForwardMove = (from, to) => to.y > from.y;
      break;
    case 'bottom_to_top':
      start = { x: randomInt(rng, 0, cols - 1), y: rows - 1 };
      goal = { x: start.x, y: 0 };
      isAtGoal = (p) => p.y <= 0;
      isForwardMove = (from, to) => to.y < from.y;
      break;
    default:
      start = { x: 0, y: randomInt(rng, 0, rows - 1) };
      goal = { x: cols - 1, y: start.y };
      isAtGoal = (p) => p.x >= cols - 1;
      isForwardMove = (from, to) => to.x > from.x;
  }

  const path: Point[] = [start];
  const visited = new Set([pointKey(start)]);
  const maxSteps = cols * rows * maxStepsMultiplier;
  let steps = 0;

  while (!isAtGoal(path[path.length - 1]) && steps < maxSteps) {
    steps += 1;
    const current = path[path.length - 1];
    const candidates: Point[] = [];
    if (current.x > 0) candidates.push({ x: current.x - 1, y: current.y });
    if (current.x < cols - 1) candidates.push({ x: current.x + 1, y: current.y });
    if (current.y > 0) candidates.push({ x: current.x, y: current.y - 1 });
    if (current.y < rows - 1) candidates.push({ x: current.x, y: current.y + 1 });

    const scoredCandidates = candidates.map((candidate) => {
      const manhattan = Math.abs(goal.x - candidate.x) + Math.abs(goal.y - candidate.y);
      const visitedPenalty = visited.has(pointKey(candidate)) ? revisitPenalty : 0;
      const forward = isForwardMove(current, candidate) ? forwardBias : 0;
      const lateral = !isForwardMove(current, candidate) ? wanderBias : 0;
      const distanceBias = Math.max(0, cols + rows - manhattan);
      return {
        point: candidate,
        score: 1 + forward + lateral + distanceBias - visitedPenalty,
      };
    });
    const next = chooseWeightedPoint(rng, scoredCandidates);

    if (!next) break;

    path.push(next);
    visited.add(pointKey(next));
  }

  while (!isAtGoal(path[path.length - 1])) {
    const current = path[path.length - 1];
    let next = current;
    if (direction === 'left_to_right' && current.x < cols - 1) next = { x: current.x + 1, y: current.y };
    if (direction === 'right_to_left' && current.x > 0) next = { x: current.x - 1, y: current.y };
    if (direction === 'top_to_bottom' && current.y < rows - 1) next = { x: current.x, y: current.y + 1 };
    if (direction === 'bottom_to_top' && current.y > 0) next = { x: current.x, y: current.y - 1 };
    if (next.x === current.x && next.y === current.y) break;
    path.push(next);
  }

  return path;
}

function buildProceduralLevel(levelId: number, sessionSeed: number): GeneratedLevelCandidate {
  const rng = createSeededRandom(sessionSeed + levelId * 104729);
  const generationConfig = LEVEL_GENERATION_CONFIGS[levelId - 1] ?? LEVEL_GENERATION_CONFIGS[LEVEL_GENERATION_CONFIGS.length - 1];
  const cols = generationConfig.cols;
  const rows = generationConfig.rows;
  const layout: PuzzleKind[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (rng() > 0.5 ? 'corner' : 'straight'))
  );
  const solvedRotations: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => randomInt(rng, 0, 3) * 90)
  );

  const pathAttempts: Point[][] = [];
  const attempts = 18;
  for (let i = 0; i < attempts; i += 1) {
    const pathDirection = randomFrom(rng, generationConfig.directions);
    const path = buildPath(cols, rows, rng, pathDirection, {
      forwardBias: 2.2 + levelId * 0.08 + rng() * 0.6,
      wanderBias: 0.9 + levelId * 0.05 + rng() * 1.2,
      revisitPenalty: 1.2 + rng() * 1.6,
      maxStepsMultiplier: 7 + levelId * 0.45,
    });
    pathAttempts.push(path);
  }
  const path = pathAttempts.sort((a, b) => {
    const score = (candidate: Point[]) => {
      const turns = countTurns(candidate);
      const turnDelta = Math.abs(turns - generationConfig.minTurns);
      const lengthDelta = Math.abs(candidate.length - generationConfig.targetLength);
      return turnDelta * 1.8 + lengthDelta;
    };
    return score(a) - score(b);
  })[0];
  const start = path[0];
  const goal = path[path.length - 1];
  const pathSet = new Set(path.map(pointKey));

  for (let i = 0; i < path.length; i += 1) {
    const current = path[i];
    const prev = i > 0 ? path[i - 1] : null;
    const next = i < path.length - 1 ? path[i + 1] : null;

    let firstDir: Direction;
    let secondDir: Direction;
    if (!prev && next) {
      firstDir = directionBetween(current, next);
      secondDir = oppositeDirection(firstDir);
    } else if (prev && !next) {
      firstDir = directionBetween(current, prev);
      secondDir = oppositeDirection(firstDir);
    } else if (prev && next) {
      firstDir = directionBetween(current, prev);
      secondDir = directionBetween(current, next);
    } else {
      firstDir = 'E';
      secondDir = 'W';
    }

    const tile = dirsToTile(firstDir, secondDir);
    layout[current.y][current.x] = tile.kind;
    solvedRotations[current.y][current.x] = tile.rotation;
  }

  const extraScramble = generationConfig.scrambleBoost;
  const initialRotationsCandidate = solvedRotations.map((row) =>
    row.map((rotation) => {
      const offset = randomInt(rng, 0, 3) * 90;
      const base = (rotation + (offset === 0 ? 90 : offset)) % 360;
      const extra = extraScramble ? randomInt(rng, 0, 3) * 90 : 0;
      return (base + extra) % 360;
    })
  );

  const nonPathTiles = Array.from({ length: rows * cols }, (_, idx) => ({
    x: idx % cols,
    y: Math.floor(idx / cols),
  })).filter((point) => !pathSet.has(pointKey(point)) && pointKey(point) !== pointKey(start) && pointKey(point) !== pointKey(goal));

  const flowerTileKeys = nonPathTiles
    .filter(() => rng() > (0.9 - generationConfig.decorDensity))
    .map((point) => `${point.x},${point.y}`);

  const obstacleTileKeys = nonPathTiles
    .filter(() => rng() > (1.05 - generationConfig.decorDensity))
    .map((point) => `${point.x},${point.y}`);

  const perspectiveLinks: PerspectiveLink[] = [];
  const maxLinks = Math.min(generationConfig.perspectiveLinks, Math.max(0, Math.floor(path.length / 5)));
  for (let linkIndex = 0; linkIndex < maxLinks; linkIndex += 1) {
    const aIndex = randomInt(rng, 1, Math.max(1, Math.floor(path.length / 3)));
    const bIndex = randomInt(rng, Math.floor(path.length / 2), path.length - 2);
    const switchTile = nonPathTiles[linkIndex % Math.max(1, nonPathTiles.length)];
    if (!path[aIndex] || !path[bIndex]) continue;
    perspectiveLinks.push({
      a: path[aIndex],
      b: path[bIndex],
      requiredSwitch: switchTile
        ? {
            tile: switchTile,
            rotations: rng() > 0.5 ? [0, 180] : [90, 270],
          }
        : undefined,
    });
  }

  const theme =
    levelId === 14 ? LEVEL_THEMES[LEVEL_THEMES.length - 1] : randomFrom(rng, LEVEL_THEMES);

  const level: PuzzleLevel = {
    id: levelId,
    name: LEVEL_NAMES[levelId - 1] ?? `Garden ${levelId}`,
    vibe: LEVEL_VIBES[levelId - 1] ?? 'Procedurally generated path challenge',
    expectedMoves: Math.max(6, path.length + countTurns(path) + randomInt(rng, 1, 6)),
    layout,
    initialRotations: initialRotationsCandidate,
    start,
    goal,
    perspectiveLinks,
    theme,
    flowerTileKeys,
    obstacleTileKeys,
    seed: sessionSeed + levelId * 104729,
  };

  // Guard against accidental pre-solved boards at generation time.
  level.initialRotations = ensureUnsolvedBoard(level, level.initialRotations);
  return {
    level,
    solvedRotations: cloneRotations(solvedRotations),
  };
}

function isValidCandidate(candidate: GeneratedLevelCandidate): boolean {
  const hasCanonicalSolution = isPuzzleSolved(candidate.level, candidate.solvedRotations);
  const startsSolved = isPuzzleSolved(candidate.level, candidate.level.initialRotations);
  return hasCanonicalSolution && !startsSolved;
}

function buildValidatedProceduralLevel(levelId: number, sessionSeed: number): PuzzleLevel {
  const maxAttempts = 28;
  let fallback: GeneratedLevelCandidate | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateSeed = sessionSeed + attempt * 8191;
    const candidate = buildProceduralLevel(levelId, candidateSeed);
    if (!fallback) fallback = candidate;
    if (isValidCandidate(candidate)) return candidate.level;
  }

  if (!fallback) {
    throw new Error(`Unable to generate puzzle level ${levelId}`);
  }

  fallback.level.initialRotations = ensureUnsolvedBoard(
    fallback.level,
    fallback.level.initialRotations
  );
  return fallback.level;
}

export const GARDEN_SESSION_SEED = createSessionSeed();
export const PUZZLE_LEVELS: PuzzleLevel[] = Array.from(
  { length: 3 + ADDITIONAL_LEVEL_COUNT },
  (_, index) => buildValidatedProceduralLevel(index + 1, GARDEN_SESSION_SEED)
);

/** Consistent key for tile at (col, row) - matches layout[row][col] and Point {x, y} where x=col, y=row */
export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function oppositeDirection(dir: Direction): Direction {
  if (dir === 'N') return 'S';
  if (dir === 'S') return 'N';
  if (dir === 'E') return 'W';
  return 'E';
}

export function getTileOpenDirections(kind: PuzzleKind, rotation: number): Direction[] {
  const normalized = ((rotation % 360) + 360) % 360;

  if (kind === 'straight') {
    return normalized % 180 === 0 ? ['N', 'S'] : ['E', 'W'];
  }

  if (normalized === 0) return ['N', 'E'];
  if (normalized === 90) return ['E', 'S'];
  if (normalized === 180) return ['S', 'W'];
  return ['W', 'N'];
}

export function isPerspectiveLinkActive(link: PerspectiveLink, rotations: number[][]): boolean {
  if (!link.requiredSwitch) return true;
  const { tile, rotations: required } = link.requiredSwitch;
  const r = rotations[tile.y]?.[tile.x];
  if (r === undefined) return false;
  const normalized = ((r % 360) + 360) % 360;
  const snapped = Math.round(normalized / 90) * 90 % 360;
  return required.includes(snapped);
}

/**
 * Strict directional BFS from Spring tile ONLY.
 * - Starts exclusively at level.start (Spring). No other starting point.
 * - Spring is only considered reachable if its pipe actually connects to at least one neighbor.
 * - If Spring's pipe doesn't connect outward, return empty — Spring stays dark, no path exists.
 * - Only tiles reachable by following pipes from Spring are added.
 */
export function findReachableNodes(level: PuzzleLevel, rotations: number[][]): Set<string> {
  const rowCount = level.layout.length;
  const colCount = level.layout[0].length;
  const visited = new Set<string>();

  // Only seed Spring if its pipe actually connects to a neighbor — otherwise path is invalid
  const springDirs = getTileOpenDirections(
    level.layout[level.start.y][level.start.x],
    rotations[level.start.y][level.start.x]
  );
  let springHasConnection = false;
  for (const dir of springDirs) {
    let nextX = level.start.x;
    let nextY = level.start.y;
    if (dir === 'N') nextY -= 1;
    if (dir === 'S') nextY += 1;
    if (dir === 'W') nextX -= 1;
    if (dir === 'E') nextX += 1;
    if (nextX >= 0 && nextY >= 0 && nextX < colCount && nextY < rowCount) {
      const nextDirs = getTileOpenDirections(
        level.layout[nextY][nextX],
        rotations[nextY][nextX]
      );
      if (nextDirs.includes(oppositeDirection(dir))) {
        springHasConnection = true;
        break;
      }
    }
  }
  // Check perspective links: Spring might connect via a bridge
  for (const link of level.perspectiveLinks) {
    if (!isPerspectiveLinkActive(link, rotations)) continue;
    const atStart =
      (link.a.x === level.start.x && link.a.y === level.start.y) ||
      (link.b.x === level.start.x && link.b.y === level.start.y);
    if (atStart) {
      springHasConnection = true;
      break;
    }
  }
  if (!springHasConnection) return visited;

  visited.add(tileKey(level.start.x, level.start.y));
  const queue: Point[] = [level.start];

  while (queue.length) {
    const current = queue.shift()!;
    const currentDirs = getTileOpenDirections(
      level.layout[current.y][current.x],
      rotations[current.y][current.x]
    );

    for (const dir of currentDirs) {
      let nextX = current.x;
      let nextY = current.y;

      if (dir === 'N') nextY -= 1;
      if (dir === 'S') nextY += 1;
      if (dir === 'W') nextX -= 1;
      if (dir === 'E') nextX += 1;

      if (nextX < 0 || nextY < 0 || nextX >= colCount || nextY >= rowCount) {
        continue;
      }

      const nextDirs = getTileOpenDirections(level.layout[nextY][nextX], rotations[nextY][nextX]);
      if (!nextDirs.includes(oppositeDirection(dir))) {
        continue;
      }

      const key = tileKey(nextX, nextY);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: nextX, y: nextY });
      }
    }

    for (const link of level.perspectiveLinks) {
      if (!isPerspectiveLinkActive(link, rotations)) continue;

      const atA = link.a.x === current.x && link.a.y === current.y;
      const atB = link.b.x === current.x && link.b.y === current.y;
      if (!atA && !atB) continue;

      const next = atA ? link.b : link.a;
      const key = tileKey(next.x, next.y);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return visited;
}

/**
 * Win validation: ALL four conditions must be true.
 * 1. Path begins at Spring's pipe exit
 * 2. Path is one continuous unbroken chain (no gaps)
 * 3. Path ends at Gate's pipe entry
 * 4. Every tile in the chain has matched entry/exit with neighbors
 *
 * Uses explicit path trace: BFS from Spring, Gate is only "reached" if we
 * entered it through a valid pipe connection from a reachable neighbor.
 */
export function isPuzzleSolved(level: PuzzleLevel, rotations: number[][]): boolean {
  const rowCount = level.layout.length;
  const colCount = level.layout[0].length;
  const goalKey = tileKey(level.goal.x, level.goal.y);

  // Condition 1: Spring must have at least one pipe that exits to a connected neighbor
  const springDirs = getTileOpenDirections(
    level.layout[level.start.y][level.start.x],
    rotations[level.start.y][level.start.x]
  );
  let springHasValidExit = false;
  for (const dir of springDirs) {
    let nextX = level.start.x;
    let nextY = level.start.y;
    if (dir === 'N') nextY -= 1;
    if (dir === 'S') nextY += 1;
    if (dir === 'W') nextX -= 1;
    if (dir === 'E') nextX += 1;
    if (nextX >= 0 && nextY >= 0 && nextX < colCount && nextY < rowCount) {
      const nextDirs = getTileOpenDirections(level.layout[nextY][nextX], rotations[nextY][nextX]);
      if (nextDirs.includes(oppositeDirection(dir))) {
        springHasValidExit = true;
        break;
      }
    }
  }
  for (const link of level.perspectiveLinks) {
    if (!isPerspectiveLinkActive(link, rotations)) continue;
    const atStart =
      (link.a.x === level.start.x && link.a.y === level.start.y) ||
      (link.b.x === level.start.x && link.b.y === level.start.y);
    if (atStart) {
      springHasValidExit = true;
      break;
    }
  }
  if (!springHasValidExit) return false;

  // Conditions 2–4: BFS from Spring; Gate must be reachable via valid pipe chain
  const reachable = findReachableNodes(level, rotations);

  const startKey = tileKey(level.start.x, level.start.y);
  // Path must flow THROUGH Spring — Spring must be part of the connected chain
  if (!reachable.has(startKey)) return false;

  // Condition 2 & 3: Gate must be in reachable set (continuous chain from Spring)
  if (!reachable.has(goalKey)) return false;

  // Condition 4: Gate must have a pipe that connects TO a reachable neighbor
  // (we entered the Gate through that pipe; neighbor is in direction of Gate's pipe)
  const gateDirs = getTileOpenDirections(
    level.layout[level.goal.y][level.goal.x],
    rotations[level.goal.y][level.goal.x]
  );
  let gateHasValidEntry = false;
  for (const dir of gateDirs) {
    let neighborX = level.goal.x;
    let neighborY = level.goal.y;
    if (dir === 'N') neighborY -= 1;
    if (dir === 'S') neighborY += 1;
    if (dir === 'W') neighborX -= 1;
    if (dir === 'E') neighborX += 1;
    if (neighborX >= 0 && neighborY >= 0 && neighborX < colCount && neighborY < rowCount) {
      const neighborDirs = getTileOpenDirections(
        level.layout[neighborY][neighborX],
        rotations[neighborY][neighborX]
      );
      if (neighborDirs.includes(oppositeDirection(dir)) && reachable.has(tileKey(neighborX, neighborY))) {
        gateHasValidEntry = true;
        break;
      }
    }
  }
  for (const link of level.perspectiveLinks) {
    if (!isPerspectiveLinkActive(link, rotations)) continue;
    const atGoal =
      (link.a.x === level.goal.x && link.a.y === level.goal.y) ||
      (link.b.x === level.goal.x && link.b.y === level.goal.y);
    if (atGoal) {
      const other = link.a.x === level.goal.x && link.a.y === level.goal.y ? link.b : link.a;
      if (reachable.has(tileKey(other.x, other.y))) {
        gateHasValidEntry = true;
        break;
      }
    }
  }
  if (!gateHasValidEntry) return false;

  return true;
}

export function cloneRotations(input: number[][]): number[][] {
  return input.map((row) => [...row]);
}

export function tileSizeForLevel(level: PuzzleLevel) {
  const cols = level.layout[0].length;
  if (cols <= 3) return 86;
  if (cols === 4) return 70;
  return 60;
}

/**
 * Ensures initial board is not solved before presenting it.
 * If solved, rotates tiles in deterministic order until unsolved.
 */
export function ensureUnsolvedBoard(level: PuzzleLevel, rotations: number[][]): number[][] {
  const candidate = cloneRotations(rotations);
  if (!isPuzzleSolved(level, candidate)) return candidate;

  const rowCount = level.layout.length;
  const colCount = level.layout[0].length;
  const tileCount = rowCount * colCount;
  const startOffset = Math.abs(level.seed) % tileCount;

  for (let indexOffset = 0; indexOffset < tileCount; indexOffset += 1) {
    const index = (startOffset + indexOffset) % tileCount;
    const row = Math.floor(index / colCount);
    const col = index % colCount;
    const original = candidate[row][col];

    for (const delta of [90, 180, 270]) {
      candidate[row][col] = (original + delta) % 360;
      if (!isPuzzleSolved(level, candidate)) {
        return candidate;
      }
    }

    candidate[row][col] = original;
  }

  // Fallback pass: rotate two tiles together to escape multi-solution solved states.
  for (let firstOffset = 0; firstOffset < tileCount; firstOffset += 1) {
    const firstIndex = (startOffset + firstOffset) % tileCount;
    const firstRow = Math.floor(firstIndex / colCount);
    const firstCol = firstIndex % colCount;
    const firstOriginal = candidate[firstRow][firstCol];

    for (const firstDelta of [90, 180, 270]) {
      candidate[firstRow][firstCol] = (firstOriginal + firstDelta) % 360;

      for (let secondOffset = firstOffset + 1; secondOffset < tileCount; secondOffset += 1) {
        const secondIndex = (startOffset + secondOffset) % tileCount;
        const secondRow = Math.floor(secondIndex / colCount);
        const secondCol = secondIndex % colCount;
        const secondOriginal = candidate[secondRow][secondCol];

        for (const secondDelta of [90, 180, 270]) {
          candidate[secondRow][secondCol] = (secondOriginal + secondDelta) % 360;
          if (!isPuzzleSolved(level, candidate)) return candidate;
        }

        candidate[secondRow][secondCol] = secondOriginal;
      }
    }

    candidate[firstRow][firstCol] = firstOriginal;
  }

  return candidate;
}

export function getInitiallySolvedLevelIds(levels: PuzzleLevel[] = PUZZLE_LEVELS): number[] {
  return levels
    .filter((level) => isPuzzleSolved(level, level.initialRotations))
    .map((level) => level.id);
}
