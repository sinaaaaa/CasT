/**
 * Geometry Path program ↔ shape.
 * DRAW_PATH: the expected drawing is the path the shown program actually takes.
 * Teacher authoring can also go the other way: draw a shape, then generate arrows.
 */

import type { CommandBag, LevelGameplayConfig } from "@/lib/level-config";
import {
  formatCommandChunkToken,
  resolveCommandBagProgramTokens,
} from "@/lib/level-config";
import { expandGuidedActions } from "@/lib/assessment/resolve-program";
import { simulateProgram } from "@/lib/assessment/routeAnalysis";
import {
  expandRepeatTokens,
  formatRepeatStart,
  parseRepeatStart,
  suggestProgramVariants,
} from "@/lib/assessment/expand-repeats";
import {
  areAdjacent,
  DEFAULT_GEOMETRY_PATH,
  isGeometryDrawPath,
  segmentKey,
  syncGeometryPathToolsToConfig,
  type PathSegment,
} from "@/lib/geometry-path";

type Cell = { x: number; y: number };

export type ShapeProgramResult = {
  tokens: string[];
  /** Directed covering walk used to emit the tokens. */
  walk: PathSegment[];
  unusedEdgeCount: number;
  startOnShape: boolean;
};

function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

function parseCell(key: string): Cell {
  const [x, y] = key.split(",").map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

function eq(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function rotateLeft(f: Cell): Cell {
  return { x: -f.y, y: f.x };
}

function rotateRight(f: Cell): Cell {
  return { x: f.y, y: -f.x };
}

function normalizeFacing(f: Cell | null | undefined): Cell {
  const x = f?.x ?? 0;
  const y = f?.y ?? 0;
  if (x === 1 && y === 0) return { x: 1, y: 0 };
  if (x === -1 && y === 0) return { x: -1, y: 0 };
  if (x === 0 && y === -1) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function dirFromTo(from: Cell, to: Cell): Cell {
  return { x: to.x - from.x, y: to.y - from.y };
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function turnsToFace(facing: Cell, want: Cell): string[] {
  if (eq(facing, want)) return [];
  if (eq(rotateLeft(facing), want)) return ["turn left"];
  if (eq(rotateRight(facing), want)) return ["turn right"];
  return ["turn left", "turn left"];
}

function turnRank(facing: Cell, want: Cell): number {
  if (eq(facing, want)) return 0;
  if (eq(rotateLeft(facing), want)) return 1;
  if (eq(rotateRight(facing), want)) return 2;
  return 3;
}

function sameTokens(a: string[] | null | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function buildAdjacency(segments: PathSegment[]): {
  adj: Map<string, Cell[]>;
  unused: Set<string>;
} {
  const adj = new Map<string, Cell[]>();
  const unused = new Set<string>();

  const add = (from: Cell, to: Cell) => {
    const k = cellKey(from);
    const list = adj.get(k) ?? [];
    if (!list.some((n) => eq(n, to))) list.push(to);
    adj.set(k, list);
  };

  for (const seg of segments) {
    if (!areAdjacent(seg.from, seg.to)) continue;
    const key = segmentKey(seg.from, seg.to);
    if (unused.has(key)) continue;
    unused.add(key);
    add(seg.from, seg.to);
    add(seg.to, seg.from);
  }

  return { adj, unused };
}

function firstStepTowardUnused(
  start: Cell,
  adj: Map<string, Cell[]>,
  unused: Set<string>,
  facing: Cell
): Cell | null {
  const startKey = cellKey(start);
  const prev = new Map<string, string | null>([[startKey, null]]);
  const queue: Cell[] = [start];
  let found: string | null = null;

  while (queue.length && !found) {
    const u = queue.shift()!;
    const uk = cellKey(u);
    const neighbors = adj.get(uk) ?? [];
    if (uk !== startKey && neighbors.some((n) => unused.has(segmentKey(u, n)))) {
      found = uk;
      break;
    }
    const sorted = [...neighbors].sort(
      (a, b) => turnRank(facing, dirFromTo(u, a)) - turnRank(facing, dirFromTo(u, b))
    );
    for (const n of sorted) {
      const nk = cellKey(n);
      if (prev.has(nk)) continue;
      prev.set(nk, uk);
      queue.push(n);
    }
  }

  if (!found) return null;
  let cur = found;
  while (prev.get(cur) && prev.get(cur) !== startKey) {
    cur = prev.get(cur)!;
  }
  return parseCell(cur);
}

/**
 * Walk the drawn undirected shape from the robot start and emit
 * forward / turn left / turn right tokens that cover every edge.
 */
export function programTokensFromGeometryShape(
  config: Pick<LevelGameplayConfig, "geometryPath" | "robotStartPosition" | "robotStartFacing">
): ShapeProgramResult {
  const empty: ShapeProgramResult = {
    tokens: [],
    walk: [],
    unusedEdgeCount: 0,
    startOnShape: false,
  };
  const segments = config.geometryPath?.segments ?? [];
  if (!segments.length) return empty;

  const { adj, unused } = buildAdjacency(segments);
  const total = unused.size;
  if (total === 0) return empty;

  const robot = config.robotStartPosition ?? { x: 1, y: 1 };
  let facing = normalizeFacing(config.robotStartFacing);
  const originalFacing = facing;
  let pos = robot;
  const startOnShape = adj.has(cellKey(robot));
  if (!startOnShape) {
    let best: Cell | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const key of adj.keys()) {
      const cell = parseCell(key);
      const d = manhattan(robot, cell);
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    if (!best) return empty;
    pos = best;
  }
  const walkStart = { ...pos };

  const tokens: string[] = [];
  const walk: PathSegment[] = [];
  const maxSteps = total * 8 + adj.size * 2 + 8;
  let steps = 0;

  while (unused.size > 0 && steps < maxSteps) {
    steps += 1;
    const neighbors = adj.get(cellKey(pos)) ?? [];
    const unusedNeighbors = neighbors.filter((n) => unused.has(segmentKey(pos, n)));
    let next: Cell | null = null;
    let consume = false;

    if (unusedNeighbors.length) {
      unusedNeighbors.sort(
        (a, b) => turnRank(facing, dirFromTo(pos, a)) - turnRank(facing, dirFromTo(pos, b))
      );
      next = unusedNeighbors[0] ?? null;
      consume = true;
    } else {
      next = firstStepTowardUnused(pos, adj, unused, facing);
    }

    if (!next) break;

    const want = dirFromTo(pos, next);
    tokens.push(...turnsToFace(facing, want), "forward");
    walk.push({ from: { ...pos }, to: { ...next } });
    facing = want;
    if (consume) unused.delete(segmentKey(pos, next));
    pos = next;
  }

  if (unused.size === 0 && eq(pos, walkStart)) {
    tokens.push(...turnsToFace(facing, originalFacing));
  }

  return {
    tokens,
    walk,
    unusedEdgeCount: unused.size,
    startOnShape,
  };
}

export function geometryProgramPathSegments(config: LevelGameplayConfig): PathSegment[] {
  const guided = resolveCommandBagProgramTokens(
    config.guidedActions ?? [],
    config.commandBags
  );
  const tokens = expandGuidedActions(guided);
  if (tokens.length === 0) return [];

  const sim = simulateProgram(config, tokens);
  const segs: PathSegment[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < sim.path.length; i++) {
    const from = sim.path[i - 1]!;
    const to = sim.path[i]!;
    if (from.x === to.x && from.y === to.y) continue;
    if (!areAdjacent(from, to)) continue;
    const key = segmentKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    segs.push({ from: { ...from }, to: { ...to } });
  }
  return segs;
}

/** Replace guidedActions with arrows generated from the drawn shape (DRAW_PATH only). */
export function withGeometryShapeProgram(config: LevelGameplayConfig): LevelGameplayConfig {
  if (!isGeometryDrawPath(config.geometryPath)) return config;
  const { tokens } = programTokensFromGeometryShape(config);
  if (sameTokens(config.guidedActions, tokens)) return config;
  return { ...config, guidedActions: tokens };
}

function compressRunsIntoRepeats(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    let n = 1;
    while (i + n < tokens.length && tokens[i + n] === token) n += 1;
    const canCompress = token === "forward" || token === "backward";
    if (canCompress && n >= 2) {
      let left = n;
      while (left >= 2) {
        const take = Math.min(9, left);
        out.push(formatRepeatStart(take), token, "repeat-end");
        left -= take;
      }
      while (left > 0) {
        out.push(token);
        left -= 1;
      }
    } else {
      for (let k = 0; k < n; k++) out.push(token);
    }
    i += n;
  }
  return out;
}

/** Prefer a high-count tiled Repeat, otherwise wrap consecutive forwards. */
export function foldGeometryProgramIntoRepeat(tokens: string[]): string[] {
  const expanded = expandRepeatTokens(tokens).filter(Boolean);
  if (expanded.length < 2) return tokens;
  const variants = suggestProgramVariants(expanded);
  const tiled = variants
    .map((variant) => ({
      variant,
      times: parseRepeatStart(variant[0] ?? "") ?? 0,
    }))
    .filter((item) => item.times >= 2);
  const highCount = [...tiled].sort((a, b) => b.times - a.times).find((item) => item.times >= 3);
  if (highCount) return highCount.variant;
  const compressed = compressRunsIntoRepeats(expanded);
  if (compressed.length && !sameTokens(compressed, expanded)) return compressed;
  const twice = tiled.find((item) => item.times === 2);
  if (twice && twice.variant.length < expanded.length) return twice.variant;
  return expanded;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Put the current (expanded) program into a new Action Chunk and show that chunk in the strip. */
export function wrapGeometryProgramAsChunk(config: LevelGameplayConfig): LevelGameplayConfig {
  const generated = programTokensFromGeometryShape(config);
  const guided = resolveCommandBagProgramTokens(
    config.guidedActions ?? [],
    config.commandBags
  );
  const expanded = expandGuidedActions(guided);
  const tokens = expanded.length > 0 ? [...expanded] : generated.tokens;
  if (!tokens.length) return config;

  const chunkId = newId("geo_chunk");
  const chunk = {
    id: chunkId,
    name: "Shape program",
    color: "#9E66EB",
    tokens,
  };

  let bags: CommandBag[] = [...(config.commandBags ?? [])];
  if (bags.length === 0) {
    bags = [{ id: newId("geo_bag"), name: "Chunks", color: "#E8D4F0", chunks: [chunk] }];
  } else {
    const first = bags[0]!;
    bags[0] = { ...first, chunks: [...(first.chunks ?? []), chunk] };
  }

  const tools = {
    individualCommands: true,
    repeat: false,
    actionChunks: false,
    commandBags: false,
    ...DEFAULT_GEOMETRY_PATH.tools,
    ...config.geometryPath?.tools,
    actionChunks: true,
  };
  const synced = syncGeometryPathToolsToConfig(tools);

  return {
    ...config,
    commandBags: bags,
    guidedActions: [formatCommandChunkToken(chunkId)],
    geometryPath: {
      ...DEFAULT_GEOMETRY_PATH,
      ...config.geometryPath,
      seedStarterProgram: true,
      tools,
    },
    enabledActionButtons: synced.enabledActionButtons,
    commandBagMode: synced.commandBagMode,
  };
}

export function withGeometryRepeatProgram(config: LevelGameplayConfig): LevelGameplayConfig {
  const guided = resolveCommandBagProgramTokens(
    config.guidedActions ?? [],
    config.commandBags
  );
  const folded = foldGeometryProgramIntoRepeat(guided);
  const tools = {
    individualCommands: true,
    repeat: false,
    actionChunks: false,
    commandBags: false,
    ...DEFAULT_GEOMETRY_PATH.tools,
    ...config.geometryPath?.tools,
    individualCommands: true,
    repeat: true,
  };
  const synced = syncGeometryPathToolsToConfig(tools);
  return {
    ...config,
    guidedActions: folded,
    geometryPath: {
      ...DEFAULT_GEOMETRY_PATH,
      ...config.geometryPath,
      seedStarterProgram: true,
      tools,
    },
    enabledActionButtons: synced.enabledActionButtons,
    commandBagMode: synced.commandBagMode,
  };
}
