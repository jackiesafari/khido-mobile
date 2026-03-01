import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { IsoBoard, type BridgeDotData, type IsoBoardTheme, type TileData } from '@/components/IsoBoard';
import { ThemedView } from '@/components/themed-view';
import { logGardenEvent } from '@/lib/garden-analytics';
import { markFeatureUsed, recordGameCompletion } from '@/lib/profile-sync';
import { Routes } from '@/types/navigation';

type GameType = 'breathing' | 'ripples' | 'puzzle';

type Ripple = {
  id: number;
  x: number;
  y: number;
  progress: Animated.Value;
};

type Direction = 'N' | 'E' | 'S' | 'W';
type PuzzleKind = 'straight' | 'corner';
type Point = { x: number; y: number };

type PerspectiveLink = {
  a: Point;
  b: Point;
  requiredSwitch?: {
    tile: Point;
    rotations: number[];
  };
};

type LevelTheme = IsoBoardTheme;

type PuzzleLevel = {
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

const ADDITIONAL_LEVEL_COUNT = 11;
const IDLE_WINDOW_MS = 12_000;

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

function buildProceduralLevel(levelId: number, sessionSeed: number): PuzzleLevel {
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
  const initialRotations = solvedRotations.map((row) =>
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

  return {
    id: levelId,
    name: LEVEL_NAMES[levelId - 1] ?? `Garden ${levelId}`,
    vibe: LEVEL_VIBES[levelId - 1] ?? 'Procedurally generated path challenge',
    expectedMoves: Math.max(6, path.length + countTurns(path) + randomInt(rng, 1, 6)),
    layout,
    initialRotations,
    start,
    goal,
    perspectiveLinks,
    theme,
    flowerTileKeys,
    obstacleTileKeys,
    seed: sessionSeed + levelId * 104729,
  };
}

const GARDEN_SESSION_SEED = createSessionSeed();
const PUZZLE_LEVELS: PuzzleLevel[] = Array.from(
  { length: 3 + ADDITIONAL_LEVEL_COUNT },
  (_, index) => buildProceduralLevel(index + 1, GARDEN_SESSION_SEED)
);

/** Consistent key for tile at (col, row) - matches layout[row][col] and Point {x, y} where x=col, y=row */
function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function oppositeDirection(dir: Direction): Direction {
  if (dir === 'N') return 'S';
  if (dir === 'S') return 'N';
  if (dir === 'E') return 'W';
  return 'E';
}

function getTileOpenDirections(kind: PuzzleKind, rotation: number): Direction[] {
  const normalized = ((rotation % 360) + 360) % 360;

  if (kind === 'straight') {
    return normalized % 180 === 0 ? ['N', 'S'] : ['E', 'W'];
  }

  if (normalized === 0) return ['N', 'E'];
  if (normalized === 90) return ['E', 'S'];
  if (normalized === 180) return ['S', 'W'];
  return ['W', 'N'];
}

function isPerspectiveLinkActive(link: PerspectiveLink, rotations: number[][]): boolean {
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
function findReachableNodes(level: PuzzleLevel, rotations: number[][]): Set<string> {
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
function isPuzzleSolved(level: PuzzleLevel, rotations: number[][]): boolean {
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

function cloneRotations(input: number[][]): number[][] {
  return input.map((row) => [...row]);
}

function tileSizeForLevel(level: PuzzleLevel) {
  const cols = level.layout[0].length;
  if (cols <= 3) return 86;
  if (cols === 4) return 70;
  return 60;
}

export default function GamesScreen() {
  const [selectedGame, setSelectedGame] = useState<GameType>('breathing');
  const [isBreathing, setIsBreathing] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const activeLevel = PUZZLE_LEVELS[activeLevelIndex];

  const [puzzleRotations, setPuzzleRotations] = useState<number[][]>(
    cloneRotations(activeLevel.initialRotations)
  );
  const [moves, setMoves] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const orbScale = useRef(new Animated.Value(1)).current;
  const ambienceDrift = useRef(new Animated.Value(0)).current;
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastTileTapRef = useRef<{ row: number; col: number; time: number } | null>(null);
  const levelStartedAtRef = useRef(Date.now());
  const lastInteractionAtRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedLevelsRef = useRef<Set<number>>(new Set());
  const rewardScreenShownRef = useRef(false);

  const flowerTileKeySet = useMemo(() => new Set(activeLevel.flowerTileKeys), [activeLevel.flowerTileKeys]);
  const obstacleTileKeySet = useMemo(() => new Set(activeLevel.obstacleTileKeys), [activeLevel.obstacleTileKeys]);

  const logAnalytics = useCallback((
    eventType: 'level_started' | 'tile_tap_pattern' | 'level_restart' | 'level_time_spent' | 'level_completed' | 'idle_period',
    payload?: Record<string, unknown>
  ) => {
    logGardenEvent({
      sessionSeed: GARDEN_SESSION_SEED,
      levelId: activeLevel.id,
      eventType,
      payload: {
        levelSeed: activeLevel.seed,
        ...payload,
      },
    });
  }, [activeLevel.id, activeLevel.seed]);

  const scheduleIdleWindow = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const idleMs = Date.now() - lastInteractionAtRef.current;
      if (selectedGame === 'puzzle' && idleMs >= IDLE_WINDOW_MS) {
        logAnalytics('idle_period', { idleMs, moves });
        lastInteractionAtRef.current = Date.now();
      }
      scheduleIdleWindow();
    }, IDLE_WINDOW_MS);
  }, [logAnalytics, moves, selectedGame]);

  const markInteraction = useCallback((source: string, metadata?: Record<string, unknown>) => {
    const now = Date.now();
    const sinceLastTapMs = now - lastInteractionAtRef.current;
    lastInteractionAtRef.current = now;
    logAnalytics('tile_tap_pattern', {
      source,
      sinceLastTapMs,
      ...metadata,
    });
    scheduleIdleWindow();
  }, [logAnalytics, scheduleIdleWindow]);

  const recordLevelTimeSpent = useCallback((reason: 'switch' | 'restart' | 'complete' | 'leave_puzzle') => {
    const now = Date.now();
    logAnalytics('level_time_spent', {
      reason,
      durationMs: now - levelStartedAtRef.current,
      moves,
    });
  }, [logAnalytics, moves]);

  const puzzleSolved = useMemo(() => isPuzzleSolved(activeLevel, puzzleRotations), [activeLevel, puzzleRotations]);

  const reachableNodes = useMemo(
    () => findReachableNodes(activeLevel, puzzleRotations),
    [activeLevel, puzzleRotations]
  );

  const showComplete = puzzleSolved && reachableNodes.has(tileKey(activeLevel.goal.x, activeLevel.goal.y));
  const switchTileKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const link of activeLevel.perspectiveLinks) {
      if (link.requiredSwitch) set.add(tileKey(link.requiredSwitch.tile.x, link.requiredSwitch.tile.y));
    }
    return set;
  }, [activeLevel.perspectiveLinks]);
  const isoTiles = useMemo<TileData[]>(() => {
    return activeLevel.layout.flatMap((row, rowIndex) =>
      row.map((kind, colIndex) => {
        const isStart = rowIndex === activeLevel.start.y && colIndex === activeLevel.start.x;
        const isGoal = rowIndex === activeLevel.goal.y && colIndex === activeLevel.goal.x;
        const isSwitch = switchTileKeySet.has(tileKey(colIndex, rowIndex));

        // Glow ONLY for tiles reachable from Spring (strict BFS from level.start)
        const isReachable = reachableNodes.has(tileKey(colIndex, rowIndex));
        // Gate checkmark only when path is complete AND Gate is on the path (glowing)
        const gateConnected = isGoal && showComplete && isReachable;
        let label: 'Spring' | 'Gate' | 'Gate ✓' | 'Switch' | undefined;
        if (isStart) label = 'Spring';
        else if (isGoal) label = gateConnected ? 'Gate ✓' : 'Gate';
        else if (isSwitch) label = 'Switch';
        return {
          col: colIndex,
          row: rowIndex,
          isActive: isReachable, // Cyan glow only if reachable from Spring — else dark
          hasFlower: !isStart && !isGoal && flowerTileKeySet.has(tileKey(colIndex, rowIndex)),
          hasObstacle: obstacleTileKeySet.has(tileKey(colIndex, rowIndex)),
          hasSwitch: isSwitch,
          label,
          openDirections: getTileOpenDirections(kind, puzzleRotations[rowIndex][colIndex]),
        };
      })
    );
  }, [activeLevel, puzzleRotations, reachableNodes, showComplete, flowerTileKeySet, obstacleTileKeySet, switchTileKeySet]);
  const isoBridgeDots = useMemo<BridgeDotData[]>(() => {
    return activeLevel.perspectiveLinks.map((link, index) => ({
      id: `plink-${index}`,
      aCol: link.a.x,
      aRow: link.a.y,
      bCol: link.b.x,
      bRow: link.b.y,
      active: isPerspectiveLinkActive(link, puzzleRotations),
    }));
  }, [activeLevel, puzzleRotations]);

  const breathingLabel = useMemo(() => {
    if (!isBreathing) return 'Ready to breathe';
    return 'Inhale... Exhale...';
  }, [isBreathing]);

  const selectLevel = (index: number, reason: 'manual_select' | 'next_level' = 'manual_select') => {
    if (selectedGame === 'puzzle' && reason === 'manual_select') {
      recordLevelTimeSpent('switch');
    }
    setActiveLevelIndex(index);
    setPuzzleRotations(cloneRotations(PUZZLE_LEVELS[index].initialRotations));
    setMoves(0);
    setShowHint(false);
    levelStartedAtRef.current = Date.now();
    lastInteractionAtRef.current = Date.now();
    logGardenEvent({
      sessionSeed: GARDEN_SESSION_SEED,
      levelId: PUZZLE_LEVELS[index].id,
      eventType: 'level_started',
      payload: { levelSeed: PUZZLE_LEVELS[index].seed, via: reason },
    });
    scheduleIdleWindow();
  };

  const toggleBreathing = () => {
    if (isBreathing) {
      breathLoopRef.current?.stop();
      breathLoopRef.current = null;
      setIsBreathing(false);
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
      return;
    }

    const sequence = Animated.sequence([
      Animated.timing(orbScale, {
        toValue: 1.3,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 4800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(sequence);
    breathLoopRef.current = loop;
    setIsBreathing(true);
    loop.start();
  };

  const createRipple = (x: number, y: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const progress = new Animated.Value(0);
    const ripple: Ripple = { id, x, y, progress };

    setRipples((prev) => [...prev, ripple]);

    Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRipples((prev) => prev.filter((entry) => entry.id !== id));
    });
  };

  const rotatePuzzleTile = (row: number, col: number) => {
    const now = Date.now();
    const last = lastTileTapRef.current;
    if (last && last.row === row && last.col === col && now - last.time < 250) return;
    lastTileTapRef.current = { row, col, time: now };

    setPuzzleRotations((prev) =>
      prev.map((line, y) =>
        line.map((rotation, x) => {
          if (y !== row || x !== col) return rotation;
          return (rotation + 90) % 360;
        })
      )
    );
    setMoves((prev) => prev + 1);
    markInteraction('tile_rotate', {
      row,
      col,
      tileKey: tileKey(col, row),
      currentMove: moves + 1,
    });
  };

  const resetPuzzle = () => {
    logAnalytics('level_restart', { movesBeforeReset: moves });
    recordLevelTimeSpent('restart');
    setPuzzleRotations(cloneRotations(activeLevel.initialRotations));
    setMoves(0);
    levelStartedAtRef.current = Date.now();
    markInteraction('level_reset');
  };

  const goToNextLevel = () => {
    recordLevelTimeSpent('complete');
    const nextIndex = Math.min(activeLevelIndex + 1, PUZZLE_LEVELS.length - 1);
    selectLevel(nextIndex, 'next_level');
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambienceDrift, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambienceDrift, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      breathLoopRef.current?.stop();
      loop.stop();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [ambienceDrift, activeLevelIndex]);

  useEffect(() => {
    void markFeatureUsed('games').catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selectedGame !== 'puzzle') return;

    levelStartedAtRef.current = Date.now();
    lastInteractionAtRef.current = Date.now();
    logAnalytics('level_started', { levelName: activeLevel.name });
    scheduleIdleWindow();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [activeLevel.id, activeLevel.name, logAnalytics, scheduleIdleWindow, selectedGame]);

  useEffect(() => {
    if (selectedGame !== 'puzzle') return;
    if (!showComplete) return;
    if (completedLevelsRef.current.has(activeLevel.id)) return;

    completedLevelsRef.current.add(activeLevel.id);
    const completionMs = Date.now() - levelStartedAtRef.current;
    logAnalytics('level_completed', {
      completionMs,
      moves,
      expectedMoves: activeLevel.expectedMoves,
    });
    void recordGameCompletion().catch(() => undefined);
  }, [activeLevel.expectedMoves, activeLevel.id, logAnalytics, moves, selectedGame, showComplete]);

  useEffect(() => {
    const isFinalLevel = activeLevel.id === PUZZLE_LEVELS.length;
    if (!isFinalLevel || !showComplete) {
      rewardScreenShownRef.current = false;
      return;
    }
    if (rewardScreenShownRef.current) return;

    rewardScreenShownRef.current = true;
    router.push(Routes.GARDEN_REWARD);
  }, [activeLevel.id, showComplete]);

  const tileSize = tileSizeForLevel(activeLevel);
  const useIsoWorld = activeLevel.id >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push(Routes.DASHBOARD)} style={styles.backButton} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calm Games</Text>
        </View>

        <View style={styles.pickerWrap}>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'breathing' && styles.pickerButtonSelected]}
            onPress={() => {
              if (selectedGame === 'puzzle') {
                recordLevelTimeSpent('leave_puzzle');
              }
              setSelectedGame('breathing');
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Breathing Orb</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'ripples' && styles.pickerButtonSelected]}
            onPress={() => {
              if (selectedGame === 'puzzle') {
                recordLevelTimeSpent('leave_puzzle');
              }
              setSelectedGame('ripples');
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Zen Ripples</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'puzzle' && styles.pickerButtonSelected]}
            onPress={() => {
              setSelectedGame('puzzle');
              scheduleIdleWindow();
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Path Garden</Text>
          </TouchableOpacity>
        </View>

        {selectedGame === 'breathing' ? (
          <View style={styles.gameWrap}>
            <Text style={styles.gameTitle}>Breathing Orb</Text>
            <Text style={styles.gameDescription}>Follow the orb: grow with inhale, relax with exhale.</Text>
            <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]} />
            <Text style={styles.breathingStatus}>{breathingLabel}</Text>
            <TouchableOpacity style={styles.primaryCta} onPress={toggleBreathing} activeOpacity={0.75}>
              <Text style={styles.primaryCtaText}>{isBreathing ? 'Pause Session' : 'Start Session'}</Text>
            </TouchableOpacity>
          </View>
        ) : selectedGame === 'ripples' ? (
          <View style={styles.gameWrap}>
            <Text style={styles.gameTitle}>Zen Ripples</Text>
            <Text style={styles.gameDescription}>Tap anywhere to create gentle water ripples.</Text>
            <TouchableOpacity
              style={styles.rippleField}
              activeOpacity={1}
              onPress={(event) => createRipple(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
              {ripples.map((ripple) => (
                <Animated.View
                  key={ripple.id}
                  style={[
                    styles.ripple,
                    {
                      left: ripple.x - 20,
                      top: ripple.y - 20,
                      opacity: ripple.progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                      transform: [
                        {
                          scale: ripple.progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 5] }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gameWrapLarge}>
            <ScrollView
              style={styles.gameScroll}
              contentContainerStyle={styles.gameScrollContent}
              showsVerticalScrollIndicator={false}>
            <Text style={styles.gameTitle}>Path Garden</Text>
            <Text style={styles.gameDescription}>{activeLevel.vibe}</Text>

            <View style={styles.levelSelector}>
              {PUZZLE_LEVELS.map((level, index) => (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.levelChip, index === activeLevelIndex && styles.levelChipActive]}
                  onPress={() => selectLevel(index)}
                  activeOpacity={0.8}>
                  <Text style={[styles.levelChipText, index === activeLevelIndex && styles.levelChipTextActive]}>
                    L{level.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowHint((h) => !h)}
              style={styles.hintToggle}
              activeOpacity={0.8}>
              <MaterialIcons name={showHint ? 'expand-less' : 'help-outline'} size={20} color="#1D4ED8" />
              <Text style={styles.hintToggleText}>{showHint ? 'Hide directions' : 'Directions'}</Text>
            </TouchableOpacity>

            {showHint && (
              <View style={styles.goalPreview}>
                <Text style={styles.goalTitle}>How to play</Text>
                <Text style={styles.goalTextSimple}>
                  Tap any tile to rotate its pipes. Every tile rotates when you tap it.
                </Text>
                <Text style={styles.goalTextSimple}>
                  Connect the pipes from Spring to Gate. When pipes line up between two tiles, water flows — and that part of the path glows.
                </Text>
                <Text style={styles.goalTextSimple}>
                  You win when the whole path from Spring to Gate is glowing. Take your time.
                </Text>
                {activeLevel.perspectiveLinks.length > 0 && (
                  <Text style={styles.goalTextBridge}>
                    Stone bridges connect distant towers. Rotate the tile marked Switch (gold label) to activate the crossing.
                  </Text>
                )}
                <View style={styles.goalDiagram}>
                  <View style={styles.goalRow}>
                    <View style={styles.goalTileWrap}>
                      <Text style={styles.goalLabelSpring}>Spring</Text>
                      <View style={styles.goalTile}>
                        <View style={styles.goalChannelH} />
                      </View>
                    </View>
                    <View style={styles.goalArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4DB8C4" />
                    </View>
                    <View style={styles.goalTile}>
                      <View style={styles.goalChannelH} />
                    </View>
                    <View style={styles.goalArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4DB8C4" />
                    </View>
                    <View style={styles.goalTileWrap}>
                      <Text style={styles.goalLabelGate}>Gate</Text>
                      <View style={styles.goalTile}>
                        <View style={styles.goalChannelH} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.puzzleHeaderRow}>
              <View style={styles.puzzleBadge}>
                <Text style={styles.puzzleBadgeText}>Moves: {moves}</Text>
              </View>
              <View style={styles.puzzleBadgeMuted}>
                <Text style={styles.puzzleBadgeMutedText}>Suggested: {activeLevel.expectedMoves} moves</Text>
              </View>
              <TouchableOpacity onPress={resetPuzzle} activeOpacity={0.75} style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.gardenWorld,
                useIsoWorld && styles.gameBoardWrapper,
                useIsoWorld && {
                  backgroundColor: activeLevel.theme.skyColors[1],
                  borderColor: activeLevel.theme.stoneColors[1],
                },
              ]}>
              <Animated.View
                style={[
                  styles.ambientCloud,
                  {
                    transform: [
                      {
                        translateX: ambienceDrift.interpolate({ inputRange: [0, 1], outputRange: [-6, 8] }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.ambientCloud2,
                  {
                    transform: [
                      {
                        translateX: ambienceDrift.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }),
                      },
                    ],
                  },
                ]}
              />

              {!useIsoWorld && (
                <View style={styles.puzzleGridFlat}>
                  {activeLevel.layout.map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.puzzleRowFlat}>
                      {row.map((kind, colIndex) => {
                        const dirs = getTileOpenDirections(kind, puzzleRotations[rowIndex][colIndex]);
                        // Glow ONLY for tiles reachable from Spring (strict BFS)
                        const isReachable = reachableNodes.has(tileKey(colIndex, rowIndex));
                        const isStart = rowIndex === activeLevel.start.y && colIndex === activeLevel.start.x;
                        const isGoal = rowIndex === activeLevel.goal.y && colIndex === activeLevel.goal.x;
                        const gateConnected = isGoal && showComplete && isReachable;
                        const hasObstacle = obstacleTileKeySet.has(tileKey(colIndex, rowIndex));

                        return (
                          <TouchableOpacity
                            key={`tile-${rowIndex}-${colIndex}`}
                            style={[
                              styles.puzzleTileFlat,
                              { width: tileSize, height: tileSize },
                              isReachable && styles.puzzleTileReachable,
                              isStart && styles.tileStart,
                              isGoal && styles.tileGoal,
                            ]}
                            onPress={() => rotatePuzzleTile(rowIndex, colIndex)}
                            activeOpacity={0.85}
                            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                            <View style={styles.tileSurfaceFlat}>
                              {dirs.includes('N') && <View style={[styles.channel, styles.channelN]} />}
                              {dirs.includes('E') && <View style={[styles.channel, styles.channelE]} />}
                              {dirs.includes('S') && <View style={[styles.channel, styles.channelS]} />}
                              {dirs.includes('W') && <View style={[styles.channel, styles.channelW]} />}
                              <View style={styles.channelCenter} />
                              {hasObstacle && <View style={styles.tileObstacleFlat} />}
                              {isStart && (
                                <View style={[styles.flatTileLabel, styles.flatTileLabelSpring]}>
                                  <Text style={styles.flatTileLabelText}>Spring</Text>
                                </View>
                              )}
                              {isGoal && (
                                <View style={[
                                  styles.flatTileLabel,
                                  styles.flatTileLabelGate,
                                  gateConnected && styles.flatTileLabelGateConnected,
                                ]}>
                                  <Text style={styles.flatTileLabelText}>{gateConnected ? 'Gate ✓' : 'Gate'}</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

              {useIsoWorld && (
                <IsoBoard
                  tiles={isoTiles}
                  bridgeDots={isoBridgeDots}
                  theme={activeLevel.theme}
                  onTilePress={(col, row) => rotatePuzzleTile(row, col)}
                  labelsInsideTiles={true}
                />
              )}

              {activeLevel.perspectiveLinks.length > 0 && (
                <View style={styles.linkLegend}>
                  <MaterialIcons name="auto-awesome" size={14} color="#2E7CA3" />
                  <Text style={styles.linkLegendText}>The stone bridge connects two towers. Rotate the tile marked Switch to activate it.</Text>
                </View>
              )}

              <View style={[styles.worldGround, { backgroundColor: activeLevel.theme.groundColor }]}>
                <MaterialIcons name="park" size={18} color="#4C8E61" />
                <MaterialIcons name="local-florist" size={18} color="#769E43" />
                <MaterialIcons name="spa" size={18} color="#4F9C80" />
              </View>
            </View>

            <Text style={[styles.puzzleStatus, showComplete && styles.puzzleStatusSolved]}>
              {showComplete ? 'Path complete. Calm flow restored.' : 'Rotate tiles to connect Spring to Gate. The path glows when it connects.'}
            </Text>

            {showComplete && (
              <View style={styles.completionActions}>
                {activeLevelIndex < PUZZLE_LEVELS.length - 1 ? (
                  <TouchableOpacity onPress={goToNextLevel} style={styles.primaryCta} activeOpacity={0.8}>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryCtaText}>Unlock Next Level</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.allCompleteWrap}>
                    <MaterialIcons name="celebration" size={24} color="#1A6B4A" />
                    <Text style={styles.allCompleteText}>All 14 levels complete!</Text>
                  </View>
                )}
              </View>
            )}
            </ScrollView>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    color: '#FFFFFF',
    ...Platform.select({
      ios: { fontWeight: '800' },
      android: { fontFamily: 'sans-serif-medium', fontWeight: '700' },
      default: { fontWeight: '800' },
    }),
  },
  pickerWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  pickerButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8E8FF',
  },
  pickerButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    color: '#15356F',
    fontWeight: '700',
    fontSize: 12,
  },
  gameWrap: {
    flex: 1,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  gameWrapLarge: {
    flex: 1,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
  },
  gameScroll: {
    flex: 1,
    width: '100%',
  },
  gameScrollContent: {
    paddingBottom: 32,
    gap: 10,
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 26,
    color: '#15356F',
    fontWeight: '800',
  },
  gameDescription: {
    textAlign: 'center',
    color: '#35528E',
    fontSize: 15,
    paddingHorizontal: 4,
  },
  orb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#7BAEF9',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginTop: 6,
  },
  breathingStatus: {
    fontSize: 18,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  rippleField: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#D9EFFF',
    minHeight: 320,
    overflow: 'hidden',
  },
  ripple: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1D4ED8',
  },
  levelSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
  },
  levelChip: {
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
  },
  levelChipActive: {
    backgroundColor: '#1D4ED8',
  },
  levelChipText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
  },
  levelChipTextActive: {
    color: '#FFFFFF',
  },
  hintToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E8F0FF',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  hintToggleText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  goalPreview: {
    width: '100%',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C5E1F5',
    gap: 6,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15356F',
  },
  goalText: {
    fontSize: 14,
    color: '#35528E',
  },
  goalTextSimple: {
    fontSize: 15,
    color: '#35528E',
    lineHeight: 24,
  },
  goalTextBridge: {
    fontSize: 14,
    color: '#2E7CA3',
    fontWeight: '600',
    lineHeight: 22,
  },
  goalHint: {
    fontSize: 13,
    color: '#2B6E50',
    fontWeight: '600',
  },
  goalDiagram: {
    width: '100%',
    marginVertical: 8,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  goalTileWrap: {
    alignItems: 'center',
    gap: 4,
  },
  goalTile: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E8F5DF',
    borderWidth: 2,
    borderColor: '#B8D4B0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalChannelH: {
    width: 28,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4DB8C4',
  },
  goalArrow: {
    paddingHorizontal: 2,
  },
  goalLabelSpring: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A9B6E',
  },
  goalLabelGate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A8AB8',
  },
  puzzleHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  puzzleBadge: {
    backgroundColor: '#E6F6EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  puzzleBadgeText: {
    color: '#2B6E50',
    fontSize: 14,
    fontWeight: '700',
  },
  puzzleBadgeMuted: {
    backgroundColor: '#EEF2FB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  puzzleBadgeMutedText: {
    color: '#4B5E82',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryCta: {
    marginLeft: 'auto',
    backgroundColor: '#E8F0FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryCtaText: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  gardenWorld: {
    width: '100%',
    minHeight: 340,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C6E5D9',
    paddingTop: 20,
    backgroundColor: '#DDF3EA',
  },
  gameBoardWrapper: {
    backgroundColor: '#5a9a9a',
    borderColor: '#4a8a8a',
  },
  ambientCloud: {
    position: 'absolute',
    width: 88,
    height: 28,
    borderRadius: 14,
    top: 22,
    left: 22,
    backgroundColor: '#EFFAF4',
    opacity: 0.8,
  },
  ambientCloud2: {
    position: 'absolute',
    width: 62,
    height: 22,
    borderRadius: 12,
    top: 58,
    right: 30,
    backgroundColor: '#F3FBF7',
    opacity: 0.9,
  },
  puzzleGridFlat: {
    paddingHorizontal: 10,
    gap: 8,
    zIndex: 10,
  },
  puzzleRowFlat: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  puzzleTileFlat: {
    borderRadius: 10,
    backgroundColor: '#E5F2E0',
    borderWidth: 2,
    borderColor: '#B8D4B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSurfaceFlat: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#E8F5DF',
    overflow: 'hidden',
  },
  puzzleTileReachable: {
    borderColor: '#74B7A8',
  },
  channel: {
    position: 'absolute',
    backgroundColor: '#4DB8C4',
  },
  channelN: {
    width: 12,
    height: '45%',
    top: 0,
    left: '50%',
    marginLeft: -6,
  },
  channelE: {
    width: '45%',
    height: 12,
    right: 0,
    top: '50%',
    marginTop: -6,
  },
  channelS: {
    width: 12,
    height: '45%',
    bottom: 0,
    left: '50%',
    marginLeft: -6,
  },
  channelW: {
    width: '45%',
    height: 12,
    left: 0,
    top: '50%',
    marginTop: -6,
  },
  channelCenter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3CA8B5',
    top: '50%',
    left: '50%',
    marginTop: -7,
    marginLeft: -7,
  },
  tileObstacleFlat: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5E6B77',
    top: 6,
    right: 6,
  },
  tileStart: {
    borderColor: '#5CA67A',
  },
  tileGoal: {
    borderColor: '#4A8AB8',
  },
  flatTileLabel: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatTileLabelSpring: {
    backgroundColor: '#1e6e4a',
  },
  flatTileLabelGate: {
    backgroundColor: '#1a4a7a',
  },
  flatTileLabelGateConnected: {
    backgroundColor: '#1A6B4A',
    borderWidth: 2,
    borderColor: '#00d2c8',
  },
  flatTileLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  linkLegend: {
    marginTop: 4,
    alignSelf: 'center',
    backgroundColor: '#E6F5FB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkLegendText: {
    color: '#2E7CA3',
    fontSize: 12,
    fontWeight: '600',
  },
  worldGround: {
    marginTop: 6,
    marginHorizontal: 22,
    borderRadius: 14,
    paddingVertical: 8,
    backgroundColor: '#C9E8CE',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  puzzleStatus: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#2B4A6E',
    letterSpacing: 0.4,
    lineHeight: 24,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  puzzleStatusSolved: {
    color: '#1A6B4A',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  completionActions: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  allCompleteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F6EC',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#5A9B6E',
  },
  allCompleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A6B4A',
  },
});
