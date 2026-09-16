/**
 * Geometry Path — edge-based target routes for programming + geometry levels.
 * Segments are undirected for matching (A→B ≡ B→A) but stored ordered for authoring.
 */

import { z } from "zod";
import { GRID_COLS, GRID_ROWS } from "@/lib/level-editor-constants";

export const geometryShapeTypeSchema = z.enum([
  "SQUARE",
  "RECTANGLE",
  "L_SHAPE",
  "ZIGZAG",
  "STAIRCASE",
  "CUSTOM",
]);
export type GeometryShapeType = z.infer<typeof geometryShapeTypeSchema>;

export const geometryValidationModeSchema = z.enum([
  "TRACE_TARGET",
  "EXACT_PATH",
  "FINAL_POSITION",
  "FINAL_POSITION_DIRECTION",
  "SHAPE_MATCH",
  "PROGRAM_STRUCTURE",
]);
export type GeometryValidationMode = z.infer<typeof geometryValidationModeSchema>;

/** What happens after the student finishes tracing the target shape. */
export const geometryAfterShapeBehaviorSchema = z.enum([
  "SHAPE_COMPLETE",
  "CONTINUE_TO_DESTINATION",
]);
export type GeometryAfterShapeBehavior = z.infer<typeof geometryAfterShapeBehaviorSchema>;

export const pathSegmentSchema = z.object({
  from: z.object({ x: z.number().int(), y: z.number().int() }),
  to: z.object({ x: z.number().int(), y: z.number().int() }),
});
export type PathSegment = z.infer<typeof pathSegmentSchema>;

export const geometryPathToolsSchema = z.object({
  individualCommands: z.boolean().default(true),
  repeat: z.boolean().default(false),
  actionChunks: z.boolean().default(false),
  commandBags: z.boolean().default(false),
});
export type GeometryPathTools = z.infer<typeof geometryPathToolsSchema>;

export const geometryPathConfigSchema = z.object({
  enabled: z.boolean().default(true),
  shapeType: geometryShapeTypeSchema.default("SQUARE"),
  /** Ordered edge list (adjacent cells only). */
  segments: z.array(pathSegmentSchema).default([]),
  /** Draw solid trail behind the robot while it moves. */
  drawRobotTrail: z.boolean().default(true),
  /**
   * If true, keep the target shape visible while the robot runs.
   * If false, hide the shape during run (only robot path shows).
   */
  keepShapeVisibleDuringRun: z.boolean().default(false),
  /** Target / guide shape color (hex). */
  targetColor: z.string().default("#9E61FA"),
  /** Robot-drawn path color (hex). */
  trailColor: z.string().default("#0DC7FF"),
  validationMode: geometryValidationModeSchema.default("TRACE_TARGET"),
  /**
   * Finish when the shape is traced, or require navigating to a final destination afterward.
   * Destination is AND-ed with edge grading (except pure FINAL_POSITION* modes).
   */
  afterShapeBehavior: geometryAfterShapeBehaviorSchema.default("SHAPE_COMPLETE"),
  /** Final destination cell (required when continuing to a destination). */
  finishCell: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  /** Optional required facing at the destination. */
  finishFacing: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  /** When true, finishFacing must match (also implied by FINAL_POSITION_DIRECTION). */
  requireFinishFacing: z.boolean().default(false),
  /** Optional grid object type at the destination (synced to gridObjects isEndObject). */
  finishObjectType: z.string().optional(),
  /** Which student tools are available (synced to enabledActionButtons / commandBagMode). */
  tools: geometryPathToolsSchema.default({
    individualCommands: true,
    repeat: false,
    actionChunks: false,
    commandBags: false,
  }),
  /** Optional structure requirements (used with PROGRAM_STRUCTURE / teacher summary). */
  requireRepeat: z.boolean().default(false),
  requireActionChunk: z.boolean().default(false),
  requireCommandBag: z.boolean().default(false),
  /** Template size knobs (cells along an edge). */
  templateSize: z.number().int().min(1).max(5).default(2),
  templateWidth: z.number().int().min(1).max(5).default(3),
  templateHeight: z.number().int().min(1).max(5).default(2),
  /** Bottom-left origin of the last placed template (for reposition). */
  templateOrigin: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
});
export type GeometryPathConfig = z.infer<typeof geometryPathConfigSchema>;

export const DEFAULT_GEOMETRY_COLORS = {
  targetColor: "#9E61FA",
  trailColor: "#0DC7FF",
} as const;

export const GEOMETRY_SHAPE_LABELS: Record<GeometryShapeType, string> = {
  SQUARE: "Square",
  RECTANGLE: "Rectangle",
  L_SHAPE: "L shape",
  ZIGZAG: "Zigzag",
  STAIRCASE: "Staircase",
  CUSTOM: "Custom",
};

export const GEOMETRY_VALIDATION_LABELS: Record<GeometryValidationMode, string> = {
  TRACE_TARGET: "Trace target — travel every required edge",
  EXACT_PATH: "Exact path — no extra edges",
  FINAL_POSITION: "Final position only",
  FINAL_POSITION_DIRECTION: "Final position + direction",
  SHAPE_MATCH: "Shape match — drawn edges match target",
  PROGRAM_STRUCTURE: "Program structure — require Repeat / Chunk / Bag",
};

/** Short teacher-facing explanation under “How to grade”. */
export const GEOMETRY_VALIDATION_HELP: Record<GeometryValidationMode, string> = {
  TRACE_TARGET: "Students must travel every required target edge. Extra edges are allowed unless you also require an exact path.",
  EXACT_PATH: "Students must cover every target edge and must not travel any extra edges.",
  FINAL_POSITION: "Only the robot’s finishing cell matters — not which edges were traced.",
  FINAL_POSITION_DIRECTION: "Robot must finish on the target cell and face the required direction.",
  SHAPE_MATCH: "The set of edges the robot traveled must match the target shape.",
  PROGRAM_STRUCTURE: "Students must also use the programming tools you mark as required (Repeat, Chunk, or Bag).",
};

export const GEOMETRY_AFTER_SHAPE_LABELS: Record<GeometryAfterShapeBehavior, string> = {
  SHAPE_COMPLETE: "Finish when shape is complete",
  CONTINUE_TO_DESTINATION: "Continue to a final destination",
};

/** True when this activity requires a post-shape destination cell. */
export function geometryRequiresDestination(
  gp: Pick<GeometryPathConfig, "afterShapeBehavior" | "validationMode"> | null | undefined
): boolean {
  if (!gp) return false;
  if (gp.afterShapeBehavior === "CONTINUE_TO_DESTINATION") return true;
  return (
    gp.validationMode === "FINAL_POSITION" || gp.validationMode === "FINAL_POSITION_DIRECTION"
  );
}

export function geometryRequiresFinishFacing(
  gp: Pick<
    GeometryPathConfig,
    "requireFinishFacing" | "validationMode" | "finishFacing" | "afterShapeBehavior"
  > | null | undefined
): boolean {
  if (!gp) return false;
  if (gp.validationMode === "FINAL_POSITION_DIRECTION") return true;
  if (gp.requireFinishFacing) return true;
  return false;
}

export const GEOMETRY_TOOL_PRESETS = {
  beginner: {
    label: "Beginner",
    description: "Commands only",
    tools: { individualCommands: true, repeat: false, actionChunks: false, commandBags: false },
  },
  patterns: {
    label: "Patterns",
    description: "Commands + Repeat",
    tools: { individualCommands: true, repeat: true, actionChunks: false, commandBags: false },
  },
  chunks: {
    label: "Chunks",
    description: "Action Chunks",
    tools: { individualCommands: false, repeat: false, actionChunks: true, commandBags: false },
  },
  advanced: {
    label: "Advanced",
    description: "Chunks + Bags",
    tools: { individualCommands: false, repeat: false, actionChunks: true, commandBags: true },
  },
} as const;

export type GeometryToolPresetId = keyof typeof GEOMETRY_TOOL_PRESETS;

export const DEFAULT_GEOMETRY_PATH: GeometryPathConfig = {
  enabled: true,
  shapeType: "SQUARE",
  segments: [],
  drawRobotTrail: true,
  keepShapeVisibleDuringRun: false,
  targetColor: DEFAULT_GEOMETRY_COLORS.targetColor,
  trailColor: DEFAULT_GEOMETRY_COLORS.trailColor,
  validationMode: "TRACE_TARGET",
  afterShapeBehavior: "SHAPE_COMPLETE",
  requireFinishFacing: false,
  tools: {
    individualCommands: true,
    repeat: false,
    actionChunks: false,
    commandBags: false,
  },
  requireRepeat: false,
  requireActionChunk: false,
  requireCommandBag: false,
  templateSize: 2,
  templateWidth: 3,
  templateHeight: 2,
  templateOrigin: { x: 1, y: 1 },
};

function inBounds(x: number, y: number) {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

/** Undirected edge key for set membership. */
export function segmentKey(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const aFirst = a.x < b.x || (a.x === b.x && a.y <= b.y);
  const from = aFirst ? a : b;
  const to = aFirst ? b : a;
  return `${from.x},${from.y}|${to.x},${to.y}`;
}

export function areAdjacent(
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export function normalizeSegment(seg: PathSegment): PathSegment {
  return { from: { ...seg.from }, to: { ...seg.to } };
}

export function segmentsEqual(a: PathSegment, b: PathSegment): boolean {
  return segmentKey(a.from, a.to) === segmentKey(b.from, b.to);
}

export function hasSegment(segments: PathSegment[], seg: PathSegment): boolean {
  const k = segmentKey(seg.from, seg.to);
  return segments.some((s) => segmentKey(s.from, s.to) === k);
}

export function addSegment(segments: PathSegment[], seg: PathSegment): PathSegment[] {
  if (!areAdjacent(seg.from, seg.to)) return segments;
  if (!inBounds(seg.from.x, seg.from.y) || !inBounds(seg.to.x, seg.to.y)) return segments;
  if (hasSegment(segments, seg)) return segments;
  return [...segments, normalizeSegment(seg)];
}

export function removeSegment(segments: PathSegment[], seg: PathSegment): PathSegment[] {
  const k = segmentKey(seg.from, seg.to);
  return segments.filter((s) => segmentKey(s.from, s.to) !== k);
}

/** Build a closed square: size = cells per edge (number of edges per side). */
export function buildSquare(origin: { x: number; y: number }, size: number): PathSegment[] {
  const s = Math.max(1, size);
  const o = origin;
  const segs: PathSegment[] = [];
  for (let i = 0; i < s; i++) {
    segs.push({ from: { x: o.x + i, y: o.y }, to: { x: o.x + i + 1, y: o.y } });
    segs.push({ from: { x: o.x + s, y: o.y + i }, to: { x: o.x + s, y: o.y + i + 1 } });
    segs.push({ from: { x: o.x + s - i, y: o.y + s }, to: { x: o.x + s - i - 1, y: o.y + s } });
    segs.push({ from: { x: o.x, y: o.y + s - i }, to: { x: o.x, y: o.y + s - i - 1 } });
  }
  return segs.filter(
    (seg) => inBounds(seg.from.x, seg.from.y) && inBounds(seg.to.x, seg.to.y)
  );
}

export function buildRectangle(
  origin: { x: number; y: number },
  width: number,
  height: number
): PathSegment[] {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const o = origin;
  const segs: PathSegment[] = [];
  for (let i = 0; i < w; i++) {
    segs.push({ from: { x: o.x + i, y: o.y }, to: { x: o.x + i + 1, y: o.y } });
    segs.push({ from: { x: o.x + w - i, y: o.y + h }, to: { x: o.x + w - i - 1, y: o.y + h } });
  }
  for (let i = 0; i < h; i++) {
    segs.push({ from: { x: o.x + w, y: o.y + i }, to: { x: o.x + w, y: o.y + i + 1 } });
    segs.push({ from: { x: o.x, y: o.y + h - i }, to: { x: o.x, y: o.y + h - i - 1 } });
  }
  return segs.filter(
    (seg) => inBounds(seg.from.x, seg.from.y) && inBounds(seg.to.x, seg.to.y)
  );
}

/** L: vertical then horizontal from origin. */
export function buildLShape(
  origin: { x: number; y: number },
  height: number,
  width: number
): PathSegment[] {
  const h = Math.max(1, height);
  const w = Math.max(1, width);
  const o = origin;
  const segs: PathSegment[] = [];
  for (let i = 0; i < h; i++) {
    segs.push({ from: { x: o.x, y: o.y + i }, to: { x: o.x, y: o.y + i + 1 } });
  }
  for (let i = 0; i < w; i++) {
    segs.push({ from: { x: o.x + i, y: o.y }, to: { x: o.x + i + 1, y: o.y } });
  }
  return segs.filter(
    (seg) => inBounds(seg.from.x, seg.from.y) && inBounds(seg.to.x, seg.to.y)
  );
}

/** Alternating right/up steps. */
export function buildZigzag(origin: { x: number; y: number }, steps: number): PathSegment[] {
  const n = Math.max(1, steps);
  const segs: PathSegment[] = [];
  let x = origin.x;
  let y = origin.y;
  for (let i = 0; i < n; i++) {
    const next = i % 2 === 0 ? { x: x + 1, y } : { x, y: y + 1 };
    if (!inBounds(next.x, next.y)) break;
    segs.push({ from: { x, y }, to: next });
    x = next.x;
    y = next.y;
  }
  return segs;
}

/** Stair: right then up, repeated. */
export function buildStaircase(origin: { x: number; y: number }, steps: number): PathSegment[] {
  const n = Math.max(1, steps);
  const segs: PathSegment[] = [];
  let x = origin.x;
  let y = origin.y;
  for (let i = 0; i < n; i++) {
    const right = { x: x + 1, y };
    if (!inBounds(right.x, right.y)) break;
    segs.push({ from: { x, y }, to: right });
    x = right.x;
    const up = { x, y: y + 1 };
    if (!inBounds(up.x, up.y)) break;
    segs.push({ from: { x, y }, to: up });
    y = up.y;
  }
  return segs;
}

export function generateShapeSegments(
  shape: GeometryShapeType,
  origin: { x: number; y: number },
  size: number,
  width: number,
  height: number
): PathSegment[] {
  switch (shape) {
    case "SQUARE":
      return buildSquare(origin, size);
    case "RECTANGLE":
      return buildRectangle(origin, width, height);
    case "L_SHAPE":
      return buildLShape(origin, height, width);
    case "ZIGZAG":
      return buildZigzag(origin, size + 1);
    case "STAIRCASE":
      return buildStaircase(origin, size);
    case "CUSTOM":
    default:
      return [];
  }
}

/**
 * Map Geometry Path tool checkboxes → existing palette fields.
 * Bags + chunks without arrows → BAG/CHUNK mode.
 * Arrows + chunks → MIXED (Unity still supports it for this level type).
 */
export function syncGeometryPathToolsToConfig(tools: GeometryPathTools): {
  enabledActionButtons: ("forward" | "backward" | "turn left" | "turn right" | "repeat")[] | undefined;
  commandBagMode: "BAG" | "CHUNK" | "MIXED" | undefined;
} {
  const buttons: ("forward" | "backward" | "turn left" | "turn right" | "repeat")[] = [];
  if (tools.individualCommands || tools.repeat) {
    buttons.push("forward", "backward", "turn left", "turn right");
    if (tools.repeat) buttons.push("repeat");
  }

  let commandBagMode: "BAG" | "CHUNK" | "MIXED" | undefined;
  if (tools.commandBags) {
    commandBagMode = tools.individualCommands || tools.repeat ? "MIXED" : "BAG";
  } else if (tools.actionChunks) {
    commandBagMode = tools.individualCommands || tools.repeat ? "MIXED" : "CHUNK";
  } else {
    commandBagMode = undefined;
  }

  return {
    enabledActionButtons: buttons.length ? buttons : undefined,
    commandBagMode,
  };
}

export function geometryPathReady(config: { geometryPath?: GeometryPathConfig | null }): boolean {
  const gp = config.geometryPath;
  if (!gp?.enabled) return false;
  if ((gp.segments?.length ?? 0) === 0) return false;
  if (gp.afterShapeBehavior === "CONTINUE_TO_DESTINATION" && !gp.finishCell) return false;
  return true;
}

function facingToLabel(facing: { x: number; y: number } | null | undefined): string {
  const f = facing ?? { x: 1, y: 0 };
  if (f.x === 1 && f.y === 0) return "Right";
  if (f.x === -1 && f.y === 0) return "Left";
  if (f.x === 0 && f.y === 1) return "Up";
  if (f.x === 0 && f.y === -1) return "Down";
  return `${f.x},${f.y}`;
}

/** Live teacher summary lines for Assessment Summary card / preview. */
export function buildGeometryAuthoringSummary(config: {
  geometryPath?: GeometryPathConfig | null;
  robotStartPosition?: { x: number; y: number } | null;
  robotStartFacing?: { x: number; y: number } | null;
}): {
  shapeLabel: string;
  edgeCount: number;
  toolsLabel: string;
  gradeLabel: string;
  goalLabel: string;
  requirements: string[];
  trailOn: boolean;
  keepShape: boolean;
  startLabel: string;
  facingLabel: string;
  destinationLabel: string | null;
  requiresDestination: boolean;
} {
  const gp = config.geometryPath;
  const tools = gp?.tools;
  const toolParts: string[] = [];
  if (tools?.individualCommands) toolParts.push("Commands");
  if (tools?.repeat) toolParts.push("Repeat");
  if (tools?.actionChunks) toolParts.push("Action Chunks");
  if (tools?.commandBags) toolParts.push("Command Bags");

  const requiresDestination = geometryRequiresDestination(gp);
  const destObj = gp?.finishObjectType?.trim() || null;
  const destCell = gp?.finishCell
    ? `(${gp.finishCell.x}, ${gp.finishCell.y})`
    : null;
  const destinationLabel = requiresDestination
    ? destObj && destCell
      ? `${destObj} at ${destCell}`
      : destCell
        ? `cell ${destCell}`
        : "destination not set"
    : null;

  const requirements: string[] = [];
  if (gp?.validationMode !== "FINAL_POSITION" && gp?.validationMode !== "FINAL_POSITION_DIRECTION") {
    requirements.push("Trace all target edges");
  }
  if (requiresDestination) {
    requirements.push(
      destObj ? `Reach the ${destObj}` : destCell ? `Reach ${destCell}` : "Reach the final destination"
    );
    if (geometryRequiresFinishFacing(gp) && gp?.finishFacing) {
      requirements.push(`Face ${facingToLabel(gp.finishFacing)} at the destination`);
    }
  }
  if (gp?.requireRepeat) requirements.push("Use Repeat at least once");
  if (gp?.requireActionChunk) requirements.push("Use an Action Chunk");
  if (gp?.requireCommandBag) requirements.push("Use a Command Bag");
  if (gp?.validationMode === "EXACT_PATH") requirements.push("No extra path segments");

  const shapeLabel = gp?.shapeType ? GEOMETRY_SHAPE_LABELS[gp.shapeType] : "Custom";
  const goalLabel = requiresDestination
    ? `Trace the ${shapeLabel.toLowerCase()}, then reach ${
        destObj ? `the ${destObj}` : destCell ? destCell : "the destination"
      }`
    : `Trace the ${shapeLabel.toLowerCase()}`;

  const gradeLabel = requiresDestination
    ? gp?.validationMode === "FINAL_POSITION" || gp?.validationMode === "FINAL_POSITION_DIRECTION"
      ? GEOMETRY_VALIDATION_LABELS[gp.validationMode]
      : "Geometry + Final Destination"
    : gp?.validationMode
      ? GEOMETRY_VALIDATION_LABELS[gp.validationMode]
      : GEOMETRY_VALIDATION_LABELS.TRACE_TARGET;

  const start = config.robotStartPosition ?? { x: 0, y: 0 };

  return {
    shapeLabel,
    edgeCount: gp?.segments?.length ?? 0,
    toolsLabel: toolParts.length ? toolParts.join(" + ") : "None selected",
    gradeLabel,
    goalLabel,
    requirements,
    trailOn: gp?.drawRobotTrail !== false,
    keepShape: !!gp?.keepShapeVisibleDuringRun,
    startLabel: `(${start.x}, ${start.y})`,
    facingLabel: facingToLabel(config.robotStartFacing),
    destinationLabel,
    requiresDestination,
  };
}
