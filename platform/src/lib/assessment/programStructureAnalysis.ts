/**
 * Program-structure report — how the student built / edited the yellow strip,
 * with Command Bags and Chunks kept as single blocks (not exploded into arrows).
 *
 * Used for:
 *  - Geometry Path items that seed a starter program
 *  - Edit Starter (and Drag Action) items that use Command Bags / Chunks
 *  - Geometry Path items with Bag / Chunk tools
 */

import { LevelType } from "@prisma/client";
import type { CommandBag, LevelGameplayConfig } from "@/lib/level-config";
import {
  isCanvasLayout,
  parseCommandBagToken,
  parseCommandChunkToken,
  resolveCommandBagProgramTokens,
} from "@/lib/level-config";
import { parseProgramStructureTelemetry } from "@/lib/attempt-mistakes";
import { buildProgramGoalChecker, expandBlockProgram } from "@/lib/assessment/blockProgram";
import {
  expandRepeatTokens,
  formatRepeatStart,
  isRepeatEnd,
  normalizeMotionToken,
  parseRepeatStart,
} from "@/lib/assessment/expand-repeats";

export type StructureBlockKind = "bag" | "chunk" | "motion" | "repeat-start" | "repeat-end";

export type StructureBlock = {
  token: string;
  kind: StructureBlockKind;
  label: string;
  color?: string;
  /** Motion steps this block runs (bags / chunks expanded). */
  steps: number;
  /** Robot moves inside a bag / chunk, in order. */
  inner?: string[];
  repeatCount?: number;
  /** Bag / chunk id no longer exists in the item. */
  missing?: boolean;
};

export type StructureDiffOp = { op: "keep" | "add" | "remove"; block: StructureBlock };

export type MacroUsageRow = {
  token: string;
  kind: "bag" | "chunk";
  name: string;
  color?: string;
  steps: number;
  inStarter: number;
  inFinal: number;
};

export type ProgramStructureContext =
  | "edit_starter"
  | "geometry_starter"
  | "geometry"
  | "path_building";

export type StarterEditStrategy =
  | "unchanged"
  | "reordered_only"
  | "small_fix"
  | "moderate_edit"
  | "rewrote";

export type ProgramStructureRequirement = { label: string; met: boolean | null };

export type ProgramStructureAnalysis = {
  available: boolean;
  context: ProgramStructureContext | null;
  /** unity = macro-level strip telemetry; reconstructed = older build, expanded arrows only. */
  source: "unity" | "reconstructed";
  hasStarter: boolean;
  starter: StructureBlock[];
  final: StructureBlock[];
  ops: StructureDiffOp[];
  keptCount: number;
  addedCount: number;
  removedCount: number;
  starterUnchanged: boolean;
  editStrategy: StarterEditStrategy | null;
  editStrategyLabel: string | null;
  usesMacros: boolean;
  macroRows: MacroUsageRow[];
  bagsAvailable: number;
  chunksAvailable: number;
  bagsUsed: number;
  chunksUsed: number;
  macroBlocksInFinal: number;
  looseMotionBlocksInFinal: number;
  usedRepeat: boolean;
  expandedStepCount: number;
  /** Share of executed robot moves that came from Bags / Chunks (0–100), or null when unknown. */
  macroSharePct: number | null;
  requirements: ProgramStructureRequirement[];
  headline: string;
  insights: string[];
};

const MOTION_LABELS: Record<string, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn left",
  "turn right": "Turn right",
};

/** Normalize a raw strip token; null for placeholders ("Level Completed", blanks, …). */
export function normalizeStructureToken(raw: string): string | null {
  const t = raw.replace(/^\[a\d+\]\s*/i, "").trim();
  if (!t) return null;
  if (parseCommandBagToken(t) || parseCommandChunkToken(t)) return t;
  const count = parseRepeatStart(t);
  if (count != null) return formatRepeatStart(count);
  if (isRepeatEnd(t)) return "repeat-end";
  return normalizeMotionToken(t);
}

function macroMoves(token: string, bags: CommandBag[]): string[] {
  return expandRepeatTokens(resolveCommandBagProgramTokens([token], bags));
}

export function describeStructureBlock(token: string, bags: CommandBag[]): StructureBlock {
  const bagId = parseCommandBagToken(token);
  if (bagId) {
    const bag = bags.find((b) => b.id === bagId);
    const inner = bag ? macroMoves(token, bags) : [];
    return {
      token,
      kind: "bag",
      label: bag?.name ?? "Deleted bag",
      color: bag?.color,
      steps: inner.length,
      inner,
      missing: !bag,
    };
  }
  const chunkId = parseCommandChunkToken(token);
  if (chunkId) {
    for (const bag of bags) {
      const chunk = bag.chunks?.find((c) => c.id === chunkId);
      if (chunk) {
        const inner = macroMoves(token, bags);
        return {
          token,
          kind: "chunk",
          label: chunk.name,
          color: chunk.color ?? bag.color,
          steps: inner.length,
          inner,
        };
      }
    }
    return { token, kind: "chunk", label: "Deleted chunk", steps: 0, missing: true };
  }
  const count = parseRepeatStart(token);
  if (count != null) {
    return { token, kind: "repeat-start", label: `Repeat ×${count}`, steps: 0, repeatCount: count };
  }
  if (token === "repeat-end") return { token, kind: "repeat-end", label: "End repeat", steps: 0 };
  return { token, kind: "motion", label: MOTION_LABELS[token] ?? token, steps: 1 };
}

/** Longest-common-subsequence alignment: keep / add / remove in reading order. */
export function diffStructureTokens(starter: string[], final: string[]): { op: StructureDiffOp["op"]; token: string }[] {
  const n = starter.length;
  const m = final.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        starter[i] === final[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: { op: StructureDiffOp["op"]; token: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (starter[i] === final[j]) {
      ops.push({ op: "keep", token: starter[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ op: "remove", token: starter[i]! });
      i++;
    } else {
      ops.push({ op: "add", token: final[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ op: "remove", token: starter[i++]! });
  while (j < m) ops.push({ op: "add", token: final[j++]! });
  return ops;
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

function resolveContext(
  config: LevelGameplayConfig,
  levelType: LevelType | null | undefined
): ProgramStructureContext | null {
  if (levelType === LevelType.GEOMETRY_PATH) {
    return config.geometryPath?.seedStarterProgram ? "geometry_starter" : "geometry";
  }
  if (levelType === LevelType.DRAG_EDIT_PROGRAM) return "edit_starter";
  if (levelType === LevelType.DRAG_ACTIONS && !isCanvasLayout(config)) return "path_building";
  return null;
}

function macroKindsFor(
  config: LevelGameplayConfig,
  context: ProgramStructureContext
): { bags: boolean; chunks: boolean } {
  if (!(config.commandBags?.length)) return { bags: false, chunks: false };
  if (context === "geometry" || context === "geometry_starter") {
    const tools = config.geometryPath?.tools;
    return { bags: !!tools?.commandBags, chunks: !!tools?.actionChunks };
  }
  const mode = config.commandBagMode;
  if (mode === "BAG") return { bags: true, chunks: false };
  if (mode === "CHUNK") return { bags: false, chunks: true };
  if (mode === "MIXED") return { bags: true, chunks: true };
  return { bags: false, chunks: false };
}

/** Blocks students can place for this item (mirrors the Unity palette). */
export function resolveStudentPalette(
  config: LevelGameplayConfig,
  levelType: LevelType | null | undefined
): { arrows: boolean; repeat: boolean; bags: boolean; chunks: boolean } {
  const context = resolveContext(config, levelType);
  if (context === "geometry" || context === "geometry_starter") {
    const tools = config.geometryPath?.tools;
    return {
      arrows: !!(tools?.individualCommands || tools?.repeat),
      repeat: !!tools?.repeat,
      bags: !!tools?.commandBags && !!config.commandBags?.length,
      chunks: !!tools?.actionChunks && !!config.commandBags?.length,
    };
  }
  const kinds = context ? macroKindsFor(config, context) : { bags: false, chunks: false };
  const bagOnly = config.commandBagMode === "BAG" || config.commandBagMode === "CHUNK";
  return {
    arrows: !(bagOnly && (kinds.bags || kinds.chunks)),
    repeat: !(bagOnly && (kinds.bags || kinds.chunks)),
    bags: kinds.bags,
    chunks: kinds.chunks,
  };
}

/**
 * The student's final program as strip blocks (bag:/chunk: kept whole when the game recorded them).
 * Falls back to the recorded (expanded) command string for older builds.
 */
export function resolveStudentBlockTokens(args: {
  mistakes: unknown;
  finalCommand?: string | null;
}): { tokens: string[]; source: "unity" | "reconstructed" } {
  const tel = parseProgramStructureTelemetry(args.mistakes);
  const telFinal = (tel?.final ?? []).map(normalizeStructureToken).filter((t): t is string => t != null);
  const commandFinal = (args.finalCommand ?? "")
    .split(/[;,]/)
    .map(normalizeStructureToken)
    .filter((t): t is string => t != null);
  if (tel && (telFinal.length || !commandFinal.length)) return { tokens: telFinal, source: "unity" };
  return { tokens: commandFinal, source: "reconstructed" };
}

const STRATEGY_LABELS: Record<StarterEditStrategy, string> = {
  unchanged: "Ran the starter unchanged",
  reordered_only: "Reordered blocks only",
  small_fix: "Small, targeted fix",
  moderate_edit: "Moderate edit",
  rewrote: "Rewrote most of the starter",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function quoteNames(blocks: StructureBlock[]): string {
  const names = [...new Set(blocks.map((b) => `“${b.label}”`))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function buildProgramStructureAnalysis(args: {
  config: LevelGameplayConfig;
  levelType?: LevelType | null;
  mistakes: unknown;
  finalCommand?: string | null;
  passed?: boolean | null;
}): ProgramStructureAnalysis {
  const { config, levelType, mistakes, finalCommand, passed } = args;
  const bags = config.commandBags ?? [];
  const context = resolveContext(config, levelType);
  const kinds = context ? macroKindsFor(config, context) : { bags: false, chunks: false };
  const usesMacros = kinds.bags || kinds.chunks;
  const hasStarter = context === "edit_starter" || context === "geometry_starter";

  const tel = parseProgramStructureTelemetry(mistakes);
  const configStarter = (config.guidedActions ?? [])
    .map(normalizeStructureToken)
    .filter((t): t is string => t != null);
  const telStarter = (tel?.initial ?? [])
    .map(normalizeStructureToken)
    .filter((t): t is string => t != null);
  let starterTokens = hasStarter ? (telStarter.length ? telStarter : configStarter) : [];

  const { tokens: finalTokens, source } = resolveStudentBlockTokens({ mistakes, finalCommand });
  // Older builds only recorded expanded arrows — compare the starter at the same level.
  if (source === "reconstructed" && starterTokens.length) {
    starterTokens = resolveCommandBagProgramTokens(starterTokens, bags)
      .map(normalizeStructureToken)
      .filter((t): t is string => t != null);
  }

  const starter = starterTokens.map((t) => describeStructureBlock(t, bags));
  const final = finalTokens.map((t) => describeStructureBlock(t, bags));
  const ops: StructureDiffOp[] = hasStarter
    ? diffStructureTokens(starterTokens, finalTokens).map((o) => ({
        op: o.op,
        block: describeStructureBlock(o.token, bags),
      }))
    : [];
  const keptCount = ops.filter((o) => o.op === "keep").length;
  const addedCount = ops.filter((o) => o.op === "add").length;
  const removedCount = ops.filter((o) => o.op === "remove").length;
  const starterUnchanged =
    hasStarter && starterTokens.length > 0 && addedCount === 0 && removedCount === 0;

  let editStrategy: StarterEditStrategy | null = null;
  if (hasStarter && starterTokens.length > 0 && finalTokens.length > 0) {
    const edits = addedCount + removedCount;
    if (starterUnchanged) editStrategy = "unchanged";
    else if (sameMultiset(starterTokens, finalTokens)) editStrategy = "reordered_only";
    else if (keptCount < Math.ceil(starterTokens.length / 2)) editStrategy = "rewrote";
    else if (edits <= 2) editStrategy = "small_fix";
    else editStrategy = "moderate_edit";
  }

  // ── Command Bag / Chunk usage ──
  const macroRows: MacroUsageRow[] = [];
  const countIn = (list: string[], token: string) => list.filter((t) => t === token).length;
  const bagTokensSeen = new Set(
    [...starterTokens, ...finalTokens].filter((t) => parseCommandBagToken(t) != null)
  );
  const chunkTokensSeen = new Set(
    [...starterTokens, ...finalTokens].filter((t) => parseCommandChunkToken(t) != null)
  );
  if (kinds.bags || bagTokensSeen.size) {
    for (const bag of bags) {
      const token = `bag:${bag.id}`;
      bagTokensSeen.delete(token);
      macroRows.push({
        token,
        kind: "bag",
        name: bag.name,
        color: bag.color,
        steps: macroMoves(token, bags).length,
        inStarter: countIn(starterTokens, token),
        inFinal: countIn(finalTokens, token),
      });
    }
  }
  if (kinds.chunks || chunkTokensSeen.size) {
    for (const bag of bags) {
      for (const chunk of bag.chunks ?? []) {
        const token = `chunk:${chunk.id}`;
        chunkTokensSeen.delete(token);
        macroRows.push({
          token,
          kind: "chunk",
          name: chunk.name,
          color: chunk.color ?? bag.color,
          steps: macroMoves(token, bags).length,
          inStarter: countIn(starterTokens, token),
          inFinal: countIn(finalTokens, token),
        });
      }
    }
  }
  for (const token of [...bagTokensSeen, ...chunkTokensSeen]) {
    const block = describeStructureBlock(token, bags);
    macroRows.push({
      token,
      kind: block.kind === "bag" ? "bag" : "chunk",
      name: block.label,
      steps: 0,
      inStarter: countIn(starterTokens, token),
      inFinal: countIn(finalTokens, token),
    });
  }

  const bagsAvailable = kinds.bags ? bags.length : 0;
  const chunksAvailable = kinds.chunks ? bags.reduce((n, b) => n + (b.chunks?.length ?? 0), 0) : 0;
  const bagsUsed = macroRows.filter((r) => r.kind === "bag" && r.inFinal > 0).length;
  const chunksUsed = macroRows.filter((r) => r.kind === "chunk" && r.inFinal > 0).length;
  const macroBlocksInFinal = final.filter((b) => b.kind === "bag" || b.kind === "chunk").length;
  const looseMotionBlocksInFinal = final.filter((b) => b.kind === "motion").length;
  const usedRepeat = final.some((b) => b.kind === "repeat-start");
  const expandedStepCount = expandRepeatTokens(resolveCommandBagProgramTokens(finalTokens, bags)).length;
  const macroStepTotal = final
    .filter((b) => b.kind === "bag" || b.kind === "chunk")
    .reduce((n, b) => n + b.steps, 0);
  const macroSharePct =
    usesMacros && source === "unity" && expandedStepCount > 0
      ? Math.min(100, Math.round((macroStepTotal / expandedStepCount) * 100))
      : null;

  // ── Structure requirements (Geometry Path) ──
  const requirements: ProgramStructureRequirement[] = [];
  const gp = config.geometryPath;
  if (context === "geometry" || context === "geometry_starter") {
    if (gp?.requireRepeat) requirements.push({ label: "Use Repeat", met: usedRepeat });
    if (gp?.requireActionChunk) {
      requirements.push({ label: "Use an Action Chunk", met: source === "unity" ? chunksUsed > 0 : null });
    }
    if (gp?.requireCommandBag) {
      requirements.push({ label: "Use a Command Bag", met: source === "unity" ? bagsUsed > 0 : null });
    }
  }

  // ── Teacher-facing insights ──
  const insights: string[] = [];
  if (hasStarter && starterTokens.length > 0) {
    if (finalTokens.length === 0) {
      insights.push("No program was recorded for this run.");
    } else if (starterUnchanged) {
      insights.push(
        passed === true
          ? "Ran the starter program exactly as given, and it already reached the goal. If this is a debugging item, the starter has no bug to fix."
          : "Ran the starter program without changing it. The student may not have spotted what needed fixing yet."
      );
    } else if (editStrategy === "reordered_only") {
      insights.push("Only moved blocks around. Nothing was added or removed.");
    } else {
      insights.push(
        `Kept ${keptCount} of ${plural(starterTokens.length, "starter block")}, removed ${removedCount}, added ${addedCount}.`
      );
      if (editStrategy === "rewrote") {
        insights.push(
          keptCount === 0
            ? "Replaced the whole starter. Nothing from the original program was kept."
            : "Rewrote most of the starter instead of making a targeted fix."
        );
      } else if (editStrategy === "small_fix" && passed === true) {
        insights.push("Found and fixed the problem with a small, targeted change.");
      }
    }
    const removedMacros = ops.filter((o) => o.op === "remove" && (o.block.kind === "bag" || o.block.kind === "chunk"));
    const addedMacros = ops.filter((o) => o.op === "add" && (o.block.kind === "bag" || o.block.kind === "chunk"));
    const starterMacros = starter.filter((b) => b.kind === "bag" || b.kind === "chunk");
    if (removedMacros.length) insights.push(`Removed ${quoteNames(removedMacros.map((o) => o.block))} from the starter.`);
    if (addedMacros.length) insights.push(`Added ${quoteNames(addedMacros.map((o) => o.block))}.`);
    if (starterMacros.length && !removedMacros.length && !starterUnchanged) {
      insights.push("Kept every starter Bag / Chunk and fixed the program around them.");
    }
  }

  if (usesMacros && source === "unity" && finalTokens.length > 0) {
    if (macroBlocksInFinal === 0) {
      insights.push(
        looseMotionBlocksInFinal > 0
          ? "Did not use any Command Bags or Chunks. Built the program from single arrows."
          : "Did not use any Command Bags or Chunks."
      );
    } else {
      const parts: string[] = [];
      if (kinds.bags) parts.push(`${bagsUsed} of ${plural(bagsAvailable, "Command Bag")}`);
      if (kinds.chunks) parts.push(`${chunksUsed} of ${plural(chunksAvailable, "Chunk")}`);
      if (parts.length) insights.push(`Used ${parts.join(" and ")}.`);
      // Only credit reuse the student added themselves, not copies already in the starter.
      const reused = macroRows
        .filter((r) => r.inFinal >= 2 && r.inFinal > r.inStarter)
        .sort((a, b) => b.inFinal - a.inFinal)[0];
      if (reused) {
        insights.push(
          `Reused “${reused.name}” ${reused.inFinal} times, which suggests the student spotted a repeating pattern.`
        );
      }
      // An unchanged starter's Bag / Chunk share reflects the teacher's program, not the student's.
      if (!starterUnchanged && macroSharePct != null && macroSharePct >= 75) {
        insights.push(`${macroSharePct}% of the robot's moves came from Bags / Chunks (strong reuse).`);
      } else if (!starterUnchanged && macroSharePct != null && macroSharePct > 0 && looseMotionBlocksInFinal > 0) {
        insights.push(
          `Mixed Bags / Chunks with ${plural(looseMotionBlocksInFinal, "single arrow")} (${macroSharePct}% of moves from Bags / Chunks).`
        );
      }
    }
  }
  for (const req of requirements) {
    if (req.met === false) insights.push(`This item requires the student to ${req.label.toLowerCase()}, but they didn't.`);
  }
  if (usesMacros && source === "reconstructed") {
    insights.push(
      "This run came from an older game build, so it did not record which Bags / Chunks were used. Showing the expanded arrow program instead."
    );
  }

  let headline: string;
  if (hasStarter && editStrategy) {
    headline =
      editStrategy === "unchanged"
        ? STRATEGY_LABELS.unchanged
        : `${STRATEGY_LABELS[editStrategy]} (+${addedCount} / −${removedCount})`;
  } else if (usesMacros && source === "unity") {
    headline =
      macroBlocksInFinal === 0
        ? "No Bags or Chunks used"
        : [
            kinds.bags ? plural(bagsUsed, "bag") : null,
            kinds.chunks ? plural(chunksUsed, "chunk") : null,
          ]
            .filter(Boolean)
            .join(" · ") + " used";
  } else {
    headline = `${plural(final.length, "block")} in the final program`;
  }

  const available = !!context && (context === "geometry_starter" || usesMacros);

  return {
    available,
    context,
    source,
    hasStarter,
    starter,
    final,
    ops,
    keptCount,
    addedCount,
    removedCount,
    starterUnchanged,
    editStrategy,
    editStrategyLabel: editStrategy ? STRATEGY_LABELS[editStrategy] : null,
    usesMacros,
    macroRows,
    bagsAvailable,
    chunksAvailable,
    bagsUsed,
    chunksUsed,
    macroBlocksInFinal,
    looseMotionBlocksInFinal,
    usedRepeat,
    expandedStepCount,
    macroSharePct,
    requirements,
    headline,
    insights,
  };
}

/**
 * Authoring preview: what the teacher report will show for this item, plus
 * pre-publish checks for the starter program and Bags / Chunks.
 */
export function describeProgramStructureReport(
  levelType: LevelType,
  config: LevelGameplayConfig
): { lines: string[]; checks: { ok: boolean; label: string }[] } {
  const context = resolveContext(config, levelType);
  if (!context) return { lines: [], checks: [] };
  const kinds = macroKindsFor(config, context);
  const usesMacros = kinds.bags || kinds.chunks;
  const hasStarter = context === "edit_starter" || context === "geometry_starter";
  const bags = config.commandBags ?? [];
  const lines: string[] = [];
  const checks: { ok: boolean; label: string }[] = [];

  if (context === "edit_starter") {
    lines.push("Repair analysis: whether the student's fix reaches the goal, the first mistake, and how close it is to a minimal fix.");
  }
  if (hasStarter) {
    lines.push("Starter edits: what each student kept, removed, and added compared with your starter program.");
    lines.push("Flags students who ran the starter unchanged, and compares pass rates for edited vs unchanged runs.");
  }
  if (usesMacros) {
    const what = [kinds.bags ? `${bags.length} bag${bags.length === 1 ? "" : "s"}` : null, kinds.chunks ? "chunks" : null]
      .filter(Boolean)
      .join(" and ");
    lines.push(
      `Bag & Chunk usage: which of your ${what} each student used (as whole blocks, not arrows), how often they reused them, and the share of robot moves that came from them.`
    );
  }
  if (context === "geometry" || context === "geometry_starter") {
    const gp = config.geometryPath;
    const req = [
      gp?.requireRepeat ? "Repeat" : null,
      gp?.requireActionChunk ? "an Action Chunk" : null,
      gp?.requireCommandBag ? "a Command Bag" : null,
    ].filter(Boolean);
    if (req.length) lines.push(`Structure check: marks whether the student used ${req.join(", ")}.`);
    lines.push(
      "Edge-by-edge check: which edges of the shape each student met, and for missed edges what happened (wrong turn, missed corner, stopped short, wrong Repeat count, missed destination)."
    );
  }
  if (context === "geometry" || context === "geometry_starter" || usesMacros) {
    lines.push(
      "Block-by-block comparison: for failed runs, the first block that went wrong and the smallest block change (swap a Chunk / Bag, fix a Repeat count, add or remove a block) that makes the program work."
    );
  }

  if (hasStarter) {
    const starter = (config.guidedActions ?? []).map(normalizeStructureToken).filter((t): t is string => t != null);
    checks.push({ ok: starter.length > 0, label: "Starter program has at least one block" });
    const missing = starter.filter((t) => describeStructureBlock(t, bags).missing);
    if (starter.some((t) => parseCommandBagToken(t) || parseCommandChunkToken(t))) {
      checks.push({ ok: missing.length === 0, label: "Starter uses only Bags / Chunks that still exist" });
    }
    if (context === "edit_starter" && starter.length > 0 && missing.length === 0) {
      const reachesGoal = buildProgramGoalChecker(config, levelType);
      if (reachesGoal) {
        checks.push({
          ok: !reachesGoal(expandBlockProgram(starter, bags).commands),
          label: "Starter program has a bug to fix (it doesn't already reach the goal)",
        });
      }
    }
  }
  if (usesMacros) {
    const chunkCount = bags.reduce((n, b) => n + (b.chunks?.length ?? 0), 0);
    checks.push({
      ok: kinds.chunks ? chunkCount > 0 : bags.length > 0,
      label: kinds.chunks ? "At least one Chunk is defined" : "At least one Command Bag is defined",
    });
  }
  return { lines, checks };
}

/** Strip-level structure flags for pass checks; null when this run has no structure telemetry. */
export function resolveProgramStructureFlags(mistakes: unknown): {
  hasRepeat: boolean;
  hasBag: boolean;
  hasChunk: boolean;
} | null {
  const tel = parseProgramStructureTelemetry(mistakes);
  if (!tel) return null;
  const tokens = tel.final.map(normalizeStructureToken).filter((t): t is string => t != null);
  return {
    hasRepeat: tokens.some((t) => parseRepeatStart(t) != null),
    hasBag: tokens.some((t) => parseCommandBagToken(t) != null),
    hasChunk: tokens.some((t) => parseCommandChunkToken(t) != null),
  };
}
