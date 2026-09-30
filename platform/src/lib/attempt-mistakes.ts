/** Parsed run metadata stored on LevelAttempt.mistakes (from Unity assessmentExtras). */
export type AttemptRunMeta = {
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
  playSlot: number | null;
};

export function parsePlaySlot(mistakes: unknown): number | null {
  const o = readMistakesObject(mistakes);
  return typeof o?.playSlot === "number" && o.playSlot >= 1 ? o.playSlot : null;
}

function readMistakesObject(mistakes: unknown): Record<string, unknown> | null {
  if (!mistakes || typeof mistakes !== "object" || Array.isArray(mistakes)) return null;
  return mistakes as Record<string, unknown>;
}

export function parseAttemptRunMeta(mistakes: unknown): AttemptRunMeta {
  const o = readMistakesObject(mistakes);
  const inLevelRunNumber =
    typeof o?.inLevelRunNumber === "number" && o.inLevelRunNumber >= 1
      ? o.inLevelRunNumber
      : null;
  const maxLevelRuns =
    typeof o?.maxLevelRuns === "number" && o.maxLevelRuns >= 1 ? o.maxLevelRuns : null;
  const playSlot = parsePlaySlot(mistakes);
  return { inLevelRunNumber, maxLevelRuns, playSlot };
}

type AttemptDisplayRow = {
  levelId: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  status: string;
  mistakes?: unknown;
};

export function attemptItemGroupKey(attempt: {
  levelId: string;
  mistakes?: unknown;
}): string {
  const slot = parsePlaySlot(attempt.mistakes);
  return slot != null ? `slot:${slot}` : `level:${attempt.levelId}`;
}

/** Hide orphan INCOMPLETE rows when the same item already has a scored ended run. */
export function filterSupersededIncompleteAttempts<T extends AttemptDisplayRow>(
  attempts: T[]
): T[] {
  const completedKeys = new Set<string>();
  for (const attempt of attempts) {
    if (
      attempt.endedAt != null &&
      attempt.status !== "INCOMPLETE"
    ) {
      completedKeys.add(attemptItemGroupKey(attempt));
    }
  }

  return attempts.filter((attempt) => {
    if (attempt.endedAt != null) return true;
    if (attempt.status !== "INCOMPLETE") return true;
    return !completedKeys.has(attemptItemGroupKey(attempt));
  });
}

/** Label for dashboard tables, e.g. "Try 1 of 2" or "Session #3". */
export function formatAttemptRunLabel(
  attemptNumber: number,
  meta: AttemptRunMeta
): string {
  if (meta.inLevelRunNumber != null) {
    if (meta.maxLevelRuns != null) {
      return `Try ${meta.inLevelRunNumber} of ${meta.maxLevelRuns}`;
    }
    return `Try ${meta.inLevelRunNumber}`;
  }
  return `#${attemptNumber}`;
}

/**
 * Yellow strip as the student built it (mistakes.programStructure from Unity).
 * Command Bags / Chunks stay single `bag:<id>` / `chunk:<id>` tokens; arrows and repeat tokens as-is.
 */
export type ProgramStructureTelemetry = {
  initial: string[];
  final: string[];
};

export function parseProgramStructureTelemetry(mistakes: unknown): ProgramStructureTelemetry | null {
  const o = readMistakesObject(mistakes);
  const ps = o?.programStructure;
  if (!ps || typeof ps !== "object" || Array.isArray(ps)) return null;
  const p = ps as Record<string, unknown>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && k.trim().length > 0) : [];
  return { initial: list(p.initial), final: list(p.final) };
}

/** One committed program edit on a debugging item (Unity edit log). */
export type DebuggingEditEvent = {
  /** 1-based RUN the edit was made before. */
  run: number;
  kind: string;
  itemType: string;
  detail: string;
};

/** An edit or RUN the game refused because of the item's Debugging Config. */
export type DebuggingBlockedEvent = {
  run: number;
  kind: string;
  itemType: string;
  reason: string;
};

/** Debugging Config usage stored under mistakes.debugging (cumulative for the item so far). */
export type DebuggingEditTelemetry = {
  editsUsed: number;
  editBudget: number | null;
  runsUsed: number;
  runBudget: number | null;
  edits: DebuggingEditEvent[];
  blocked: DebuggingBlockedEvent[];
};

function splitPipe(v: unknown): string[][] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string" && s.includes("|")).map((s) => s.split("|"));
}

/** Unity assessmentExtras (flat JsonUtility fields) → stored mistakes.debugging, or null. */
export function debuggingTelemetryFromExtras(extras: Record<string, unknown> | null): DebuggingEditTelemetry | null {
  if (!extras || extras.debuggingHasTelemetry !== true) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  const budget = (v: unknown) => (num(v) > 0 ? num(v) : null);
  return {
    editsUsed: num(extras.debuggingEditsUsed),
    editBudget: budget(extras.debuggingEditBudget),
    runsUsed: num(extras.debuggingRunsUsed),
    runBudget: budget(extras.debuggingRunBudget),
    edits: splitPipe(extras.debuggingEditLog).map(([run, kind, itemType, ...rest]) => ({
      run: Number(run) || 1,
      kind: kind ?? "",
      itemType: itemType ?? "",
      detail: rest.join("|"),
    })),
    blocked: splitPipe(extras.debuggingBlocked).map(([run, kind, itemType, reason]) => ({
      run: Number(run) || 1,
      kind: kind ?? "",
      itemType: itemType ?? "",
      reason: reason ?? "",
    })),
  };
}

export function parseDebuggingTelemetry(mistakes: unknown): DebuggingEditTelemetry | null {
  const o = readMistakesObject(mistakes);
  const d = o?.debugging;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const p = d as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const orNull = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  const events = <T,>(v: unknown, map: (e: Record<string, unknown>) => T): T[] =>
    Array.isArray(v) ? v.filter((e) => e && typeof e === "object").map((e) => map(e as Record<string, unknown>)) : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    editsUsed: num(p.editsUsed),
    editBudget: orNull(p.editBudget),
    runsUsed: num(p.runsUsed),
    runBudget: orNull(p.runBudget),
    edits: events(p.edits, (e) => ({ run: num(e.run) || 1, kind: str(e.kind), itemType: str(e.itemType), detail: str(e.detail) })),
    blocked: events(p.blocked, (e) => ({ run: num(e.run) || 1, kind: str(e.kind), itemType: str(e.itemType), reason: str(e.reason) })),
  };
}

/** Geometry Path telemetry stored under mistakes.geometryPath from Unity assessmentExtras. */
export type GeometryPathAttemptTelemetry = {
  traveledKeys: string[];
  completedKeys: string[];
  /** Ordered edges as traveled (used for “extra movement after shape”). */
  travelOrder: string[];
  finalCell: { x: number; y: number } | null;
  finalFacing: { x: number; y: number } | null;
};

export function parseGeometryPathTelemetry(
  mistakes: unknown
): GeometryPathAttemptTelemetry | null {
  const o = readMistakesObject(mistakes);
  const gp = o?.geometryPath;
  if (!gp || typeof gp !== "object" || Array.isArray(gp)) return null;
  const g = gp as Record<string, unknown>;
  const traveledKeys = Array.isArray(g.traveledKeys)
    ? g.traveledKeys.filter((k): k is string => typeof k === "string")
    : [];
  const completedKeys = Array.isArray(g.completedKeys)
    ? g.completedKeys.filter((k): k is string => typeof k === "string")
    : [];
  const travelOrder = Array.isArray(g.travelOrder)
    ? g.travelOrder.filter((k): k is string => typeof k === "string")
    : traveledKeys;
  const finalCell =
    g.finalCell && typeof g.finalCell === "object" && !Array.isArray(g.finalCell)
      ? (() => {
          const c = g.finalCell as Record<string, unknown>;
          return typeof c.x === "number" && typeof c.y === "number"
            ? { x: c.x, y: c.y }
            : null;
        })()
      : null;
  const finalFacing =
    g.finalFacing && typeof g.finalFacing === "object" && !Array.isArray(g.finalFacing)
      ? (() => {
          const c = g.finalFacing as Record<string, unknown>;
          return typeof c.x === "number" && typeof c.y === "number"
            ? { x: c.x, y: c.y }
            : null;
        })()
      : null;
  if (
    traveledKeys.length === 0 &&
    completedKeys.length === 0 &&
    !finalCell
  ) {
    return { traveledKeys, completedKeys, travelOrder, finalCell, finalFacing };
  }
  return { traveledKeys, completedKeys, travelOrder, finalCell, finalFacing };
}
