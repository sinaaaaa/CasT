import type { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { parseCommandBagToken, parseCommandChunkToken } from "@/lib/level-config";
import {
  DEBUG_EDIT_KINDS,
  DEBUG_EDIT_KIND_LABELS,
  DEBUG_ITEM_TYPES,
  DEBUG_ITEM_TYPE_LABELS,
  describeDebuggingConfig,
  resolveDebuggingConfig,
  type DebugEditKind,
  type DebugItemType,
  type DebuggingConfig,
} from "@/lib/debugging-config";
import {
  parseDebuggingTelemetry,
  parseProgramStructureTelemetry,
  type DebuggingEditEvent,
} from "@/lib/attempt-mistakes";
import { isRepeatEnd, parseRepeatStart } from "@/lib/assessment/expand-repeats";
import {
  diffStructureTokens,
  normalizeStructureToken,
  resolveStudentPalette,
} from "@/lib/assessment/programStructureAnalysis";
import { alignBlockPrograms, compareBlockProgram } from "@/lib/assessment/blockProgramComparison";

export const BLOCKED_REASON_LABELS: Record<string, string> = {
  notAllowed: "edit type not allowed",
  typeLocked: "block type locked",
  budget: "edit budget used up",
  minItems: "would go below the minimum number of blocks",
  preserve: "would remove too much of the starter",
  runBudget: "no runs left",
};

export function debugItemTypeOfToken(token: string): DebugItemType {
  if (parseCommandBagToken(token)) return "commandBag";
  if (parseCommandChunkToken(token)) return "actionChunk";
  if (parseRepeatStart(token) != null || isRepeatEnd(token)) return "repeat";
  return "arrows";
}

/** Program items as students see them: a Repeat pair counts once (the end marker is not an item). */
export function countProgramItems(tokens: string[]): number {
  return tokens.filter((t) => !isRepeatEnd(t)).length;
}

function normalizeTokens(raw: readonly string[] | null | undefined): string[] {
  return (raw ?? []).map(normalizeStructureToken).filter((t): t is string => t != null && t !== "blank");
}

export type RequiredEdit = { kind: DebugEditKind; itemType: DebugItemType; fromType?: DebugItemType };

/** The block edits that turn `from` into `to`, in the student's edit vocabulary. */
export function requiredEditsBetween(from: string[], to: string[], config: LevelGameplayConfig): RequiredEdit[] {
  if (from.length === to.length) {
    const diff = from.map((t, i) => (t !== to[i] ? i : -1)).filter((i) => i >= 0);
    if (diff.length === 2 && diff[1] === diff[0]! + 1 && from[diff[0]!] === to[diff[1]!] && from[diff[1]!] === to[diff[0]!]) {
      return [{ kind: "reorder", itemType: debugItemTypeOfToken(from[diff[0]!]!) }];
    }
  }
  const out: RequiredEdit[] = [];
  for (const r of alignBlockPrograms(from, to, config)) {
    if (r.op === "changed" && r.student && r.expected) {
      if (r.student.kind === "repeat-start" && r.expected.kind === "repeat-start") {
        out.push({ kind: "editRepeat", itemType: "repeat" });
      } else {
        out.push({
          kind: "replace",
          itemType: debugItemTypeOfToken(r.expected.token),
          fromType: debugItemTypeOfToken(r.student.token),
        });
      }
    } else if (r.op === "extra" && r.student) {
      out.push({ kind: "remove", itemType: debugItemTypeOfToken(r.student.token) });
    } else if (r.op === "missing" && r.expected) {
      out.push({ kind: "add", itemType: debugItemTypeOfToken(r.expected.token) });
    }
  }
  return out;
}

/** Edits needed under the item's rules (a disallowed replace can still be remove + add), or null if impossible. */
export function costUnderRules(edits: RequiredEdit[], dc: DebuggingConfig): { cost: number; blockedBy: string | null } {
  const can = (k: DebugEditKind) => dc.allowedEdits.includes(k);
  const editable = (t: DebugItemType) => dc.editableItemTypes.includes(t);
  let cost = 0;
  for (const e of edits) {
    if (!editable(e.itemType) || (e.fromType && !editable(e.fromType))) {
      return { cost: 0, blockedBy: `${DEBUG_ITEM_TYPE_LABELS[e.fromType && !editable(e.fromType) ? e.fromType : e.itemType]} can't be edited` };
    }
    if (can(e.kind)) {
      cost += 1;
    } else if (e.kind === "replace" && can("remove") && can("add")) {
      cost += 2;
    } else if (e.kind === "reorder" && can("remove") && can("add")) {
      cost += 2;
    } else {
      return { cost: 0, blockedBy: `the fix needs “${DEBUG_EDIT_KIND_LABELS[e.kind]}”, which is turned off` };
    }
  }
  return { cost, blockedBy: null };
}

export type DebuggingFeasibility = {
  /** Smallest block fix of the starter (1 or 2), null when none was found within two edits. */
  minimalEdits: number | null;
  /** Edits the smallest allowed fix costs under the rules. */
  costUnderRules: number | null;
  feasible: boolean | null;
  issue: string | null;
  fixDescription: string | null;
};

/** Can the starter be repaired within the item's Debugging Config? */
export function checkDebuggingFeasibility(
  config: LevelGameplayConfig,
  levelType: LevelType | null | undefined,
  budget = 1500
): DebuggingFeasibility | null {
  const dc = resolveDebuggingConfig(levelType, config);
  if (!dc) return null;
  const starter = normalizeTokens(config.guidedActions);
  if (starter.length === 0) return null;
  const cmp = compareBlockProgram({
    config,
    levelType,
    blockTokens: starter,
    palette: resolveStudentPalette(config, levelType),
    budget,
  });
  if (!cmp.supported || cmp.studentWorks || !cmp.available) {
    return { minimalEdits: null, costUnderRules: null, feasible: null, issue: null, fixDescription: null };
  }
  if (!cmp.fixes.length) {
    return {
      minimalEdits: null,
      costUnderRules: null,
      feasible: null,
      issue: "No fix within two block edits was found, so the budget can't be checked.",
      fixDescription: null,
    };
  }
  let best: { cost: number; description: string } | null = null;
  let firstBlock: string | null = null;
  for (const fix of cmp.fixes) {
    const r = costUnderRules(requiredEditsBetween(starter, fix.tokens, config), dc);
    if (r.blockedBy) {
      firstBlock ??= r.blockedBy;
      continue;
    }
    const after = countProgramItems(fix.tokens);
    if (after < dc.minProgramItems) {
      firstBlock ??= `the fix leaves ${after} blocks, below the minimum of ${dc.minProgramItems}`;
      continue;
    }
    if (!best || r.cost < best.cost) best = { cost: r.cost, description: fix.description };
  }
  const minimalEdits = cmp.fixes[0]!.editCount;
  if (!best) {
    return { minimalEdits, costUnderRules: null, feasible: false, issue: `Students can't make the fix: ${firstBlock}.`, fixDescription: cmp.fixes[0]!.description };
  }
  const withinBudget = dc.editBudget == null || best.cost <= dc.editBudget;
  return {
    minimalEdits,
    costUnderRules: best.cost,
    feasible: withinBudget,
    issue: withinBudget ? null : `The smallest allowed fix needs ${best.cost} edits but the budget is ${dc.editBudget}.`,
    fixDescription: best.description,
  };
}

/** Teacher-facing report lines + publish checks for the Debugging Config. */
export function describeDebuggingReport(
  levelType: LevelType,
  config: LevelGameplayConfig
): { lines: string[]; checks: { ok: boolean; label: string }[] } {
  const dc = resolveDebuggingConfig(levelType, config);
  if (!dc) return { lines: [], checks: [] };
  const lines = [
    "Edit budget use: how many edits and RUNs each student used, which edits (add, remove, replace, reorder, Repeat) on which blocks, edits later undone, and edits the rules refused.",
  ];
  const checks: { ok: boolean; label: string }[] = [];
  const starter = normalizeTokens(config.guidedActions);
  const starterItems = countProgramItems(starter);
  if (dc.allowedEdits.length === 0 || dc.editableItemTypes.length === 0) {
    checks.push({ ok: false, label: "Students can make at least one kind of edit" });
  }
  if (dc.minProgramItems > 0) {
    checks.push({
      ok: dc.minProgramItems <= starterItems,
      label: `Minimum blocks (${dc.minProgramItems}) is not more than the starter has (${starterItems})`,
    });
  }
  if (dc.runBudget != null && config.maxAttempts != null && dc.runBudget > config.maxAttempts) {
    lines.push(`Note: the run budget (${dc.runBudget}) is higher than Maximum attempts (${config.maxAttempts}); failed runs still end the item after ${config.maxAttempts}.`);
  }
  const f = checkDebuggingFeasibility(config, levelType);
  if (f && f.feasible != null) {
    checks.push({
      ok: f.feasible,
      label:
        f.feasible && f.costUnderRules != null
          ? `Starter can be fixed within the rules (smallest fix: ${f.costUnderRules} edit${f.costUnderRules === 1 ? "" : "s"})`
          : `Starter can be fixed within the rules — ${f.issue ?? "not possible"}`,
    });
  }
  return { lines, checks };
}

/**
 * Unity edit detail formats (positions are 1-based strip positions):
 *   add / remove: "token@pos"   replace: "old>new@pos"   reorder: "token@from>to"   editRepeat: "old>new@pos"
 */
export function describeEditEvent(e: DebuggingEditEvent, config: LevelGameplayConfig): string {
  const bags = config.commandBags ?? [];
  const name = (token: string) => {
    const t = token.trim();
    const bagId = parseCommandBagToken(t);
    if (bagId) return `“${bags.find((b) => b.id === bagId)?.name ?? "Bag"}”`;
    const chunkId = parseCommandChunkToken(t);
    if (chunkId) {
      for (const b of bags) {
        const c = (b.chunks ?? []).find((x) => x.id === chunkId);
        if (c) return `“${c.name ?? "Chunk"}”`;
      }
      return "“Chunk”";
    }
    const count = parseRepeatStart(t);
    if (count != null) return `Repeat ×${count}`;
    return t.replace(/^turn /, "turn ");
  };
  const [body, at] = e.detail.split("@");
  const pos = at ?? "";
  switch (e.kind) {
    case "add":
      return `Added ${name(body ?? "")}${pos ? ` at block ${pos}` : ""}`;
    case "remove":
      return `Removed ${name(body ?? "")}${pos ? ` (block ${pos})` : ""}`;
    case "replace": {
      const [from, to] = (body ?? "").split(">");
      return `Replaced ${name(from ?? "")} with ${name(to ?? "")}${pos ? ` (block ${pos})` : ""}`;
    }
    case "reorder": {
      const [from, to] = pos.split(">");
      return `Moved ${name(body ?? "")}${from && to ? ` from block ${from} to ${to}` : ""}`;
    }
    case "editRepeat": {
      const [from, to] = (body ?? "").split(">");
      return `Changed Repeat ×${from} to ×${to}${pos ? ` (block ${pos})` : ""}`;
    }
    default:
      return e.detail || e.kind;
  }
}

export type DebuggingEditAnalysis = {
  available: boolean;
  config: DebuggingConfig;
  rules: string[];
  hasTelemetry: boolean;
  editsUsed: number;
  editBudget: number | null;
  editsLeft: number | null;
  runsUsed: number;
  runBudget: number | null;
  runsLeft: number | null;
  /** Edits made before this RUN (this attempt row). */
  editsThisRun: number;
  runNumber: number | null;
  byKind: { kind: DebugEditKind; label: string; count: number }[];
  byItemType: { itemType: DebugItemType; label: string; count: number }[];
  edits: (DebuggingEditEvent & { label: string })[];
  blocked: { reason: string; label: string; count: number }[];
  blockedTotal: number;
  /** Net block changes between the starter and the final program. */
  netChanges: number | null;
  /** Edits that were later undone (edits used − net changes). */
  undoneEdits: number | null;
  minimalEdits: number | null;
  efficiency: "minimal" | "near_minimal" | "extra" | "out_of_edits" | "no_edits" | null;
  budgetExhausted: boolean;
  runBudgetExhausted: boolean;
  headline: string;
  insights: string[];
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function analyzeDebuggingEdits(args: {
  config: LevelGameplayConfig;
  levelType: LevelType | null | undefined;
  mistakes: unknown;
  passed: boolean | null | undefined;
  runNumber?: number | null;
  /** Skip the starter replay search (bulk exports). */
  skipMinimalSearch?: boolean;
}): DebuggingEditAnalysis | null {
  const dc = resolveDebuggingConfig(args.levelType, args.config);
  if (!dc) return null;
  const tel = parseDebuggingTelemetry(args.mistakes);
  const structure = parseProgramStructureTelemetry(args.mistakes);
  const starter = normalizeTokens(structure?.initial?.length ? structure.initial : args.config.guidedActions);
  const final = normalizeTokens(structure?.final);

  const netChanges =
    structure && final.length + starter.length > 0
      ? requiredEditsBetween(starter, final, args.config).length
      : null;

  const editsUsed = tel?.editsUsed ?? 0;
  const editBudget = tel?.editBudget ?? dc.editBudget ?? null;
  const runsUsed = tel?.runsUsed ?? 0;
  const runBudget = tel?.runBudget ?? dc.runBudget ?? null;
  const edits = tel?.edits ?? [];
  const runNumber = args.runNumber ?? (runsUsed > 0 ? runsUsed : null);
  const editsThisRun = runNumber != null ? edits.filter((e) => e.run === runNumber).length : edits.length;

  const byKind = DEBUG_EDIT_KINDS.map((kind) => ({
    kind,
    label: DEBUG_EDIT_KIND_LABELS[kind],
    count: edits.filter((e) => e.kind === kind).length,
  })).filter((r) => r.count > 0);
  const byItemType = DEBUG_ITEM_TYPES.map((itemType) => ({
    itemType,
    label: DEBUG_ITEM_TYPE_LABELS[itemType],
    count: edits.filter((e) => e.itemType === itemType).length,
  })).filter((r) => r.count > 0);

  const blockedCounts = new Map<string, number>();
  for (const b of tel?.blocked ?? []) blockedCounts.set(b.reason, (blockedCounts.get(b.reason) ?? 0) + 1);
  const blocked = [...blockedCounts.entries()]
    .map(([reason, count]) => ({ reason, label: BLOCKED_REASON_LABELS[reason] ?? reason, count }))
    .sort((a, b) => b.count - a.count);
  const blockedTotal = blocked.reduce((n, b) => n + b.count, 0);

  let minimalEdits: number | null = null;
  if (!args.skipMinimalSearch && starter.length) {
    const cmp = compareBlockProgram({
      config: args.config,
      levelType: args.levelType,
      blockTokens: starter,
      palette: resolveStudentPalette(args.config, args.levelType),
      budget: 1500,
    });
    if (cmp.available && !cmp.studentWorks && cmp.fixes[0]) {
      const r = costUnderRules(requiredEditsBetween(starter, cmp.fixes[0].tokens, args.config), dc);
      minimalEdits = r.blockedBy ? cmp.fixes[0].editCount : r.cost;
    }
  }

  const budgetExhausted = editBudget != null && editsUsed >= editBudget;
  const runBudgetExhausted = runBudget != null && runsUsed >= runBudget;
  const undoneEdits = tel && netChanges != null ? Math.max(0, editsUsed - netChanges) : null;

  let efficiency: DebuggingEditAnalysis["efficiency"] = null;
  if (tel) {
    if (editsUsed === 0) efficiency = "no_edits";
    else if (args.passed === true && minimalEdits != null && editsUsed <= minimalEdits) efficiency = "minimal";
    else if (args.passed === true && minimalEdits != null && editsUsed <= minimalEdits + 2) efficiency = "near_minimal";
    else if (args.passed === true && minimalEdits != null) efficiency = "extra";
    else if (budgetExhausted) efficiency = "out_of_edits";
  }

  const budgetText = editBudget != null ? `${editsUsed} of ${editBudget} edits` : plural(editsUsed, "edit");
  let headline: string;
  if (!tel) headline = "Edit rules applied — no edit log was recorded for this run.";
  else if (efficiency === "minimal") headline = `Fixed with the fewest edits possible (${budgetText}).`;
  else if (efficiency === "near_minimal") headline = `Fixed using ${budgetText} — close to the smallest fix.`;
  else if (efficiency === "extra") headline = `Fixed, but used ${budgetText}${minimalEdits != null ? ` (smallest fix: ${minimalEdits})` : ""}.`;
  else if (efficiency === "out_of_edits") headline = `Ran out of edits (${budgetText}) before the program worked.`;
  else if (efficiency === "no_edits") headline = "Made no edits to the starter program.";
  else if (args.passed === true) headline = `Fixed using ${budgetText}.`;
  else headline = `Used ${budgetText} so far.`;

  const insights: string[] = [];
  if (tel) {
    if (byKind.length) {
      insights.push(`Edits: ${byKind.map((k) => `${k.label.toLowerCase()} ×${k.count}`).join(", ")}${byItemType.length ? ` — on ${byItemType.map((t) => `${t.label.toLowerCase()} ×${t.count}`).join(", ")}` : ""}.`);
    }
    if (undoneEdits != null && undoneEdits > 0) {
      insights.push(`${plural(undoneEdits, "edit")} ${undoneEdits === 1 ? "was" : "were"} later undone or replaced — a sign of trial and error.`);
    }
    if (minimalEdits != null && args.passed !== true && !budgetExhausted) {
      insights.push(`The smallest fix needs ${plural(minimalEdits, "edit")}.`);
    }
    if (blockedTotal > 0) {
      insights.push(`The rules refused ${plural(blockedTotal, "action")}: ${blocked.map((b) => `${b.label} (${b.count})`).join(", ")}.`);
    }
    if (runBudget != null) {
      insights.push(
        runBudgetExhausted
          ? `Used all ${plural(runBudget, "run")}.`
          : `Used ${runsUsed} of ${plural(runBudget, "run")}.`
      );
    } else if (runsUsed > 1) {
      insights.push(`Pressed RUN ${runsUsed} times.`);
    }
    if (runNumber != null && runNumber > 1 && editsThisRun > 0) {
      insights.push(`${plural(editsThisRun, "edit")} made between run ${runNumber - 1} and run ${runNumber}.`);
    }
  } else if (netChanges != null) {
    insights.push(`At least ${plural(netChanges, "block change")} between the starter and the final program.`);
  }

  return {
    available: true,
    config: dc,
    rules: describeDebuggingConfig(dc),
    hasTelemetry: !!tel,
    editsUsed,
    editBudget,
    editsLeft: editBudget != null ? Math.max(0, editBudget - editsUsed) : null,
    runsUsed,
    runBudget,
    runsLeft: runBudget != null ? Math.max(0, runBudget - runsUsed) : null,
    editsThisRun,
    runNumber,
    byKind,
    byItemType,
    edits: edits.map((e) => ({ ...e, label: describeEditEvent(e, args.config) })),
    blocked,
    blockedTotal,
    netChanges,
    undoneEdits,
    minimalEdits,
    efficiency,
    budgetExhausted,
    runBudgetExhausted,
    headline,
    insights,
  };
}