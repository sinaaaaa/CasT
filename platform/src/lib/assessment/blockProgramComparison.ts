/**
 * Block-level comparison — like the arrow comparison, but Command Bags, Chunks and
 * Repeat stay as single blocks. Finds the closest working program by trying small
 * block edits (swap a block, change a Repeat count, add / remove a block) and
 * points at the first block that needs to change.
 */

import { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  formatCommandBagToken,
  formatCommandChunkToken,
  parseCommandBagToken,
  parseCommandChunkToken,
} from "@/lib/level-config";
import { formatRepeatStart, isRepeatEnd, parseRepeatStart } from "@/lib/assessment/expand-repeats";
import { buildProgramGoalChecker, expandBlockProgram } from "@/lib/assessment/blockProgram";
import {
  describeStructureBlock,
  diffStructureTokens,
  type StructureBlock,
} from "@/lib/assessment/programStructureAnalysis";

export type BlockPalette = { arrows: boolean; repeat: boolean; bags: boolean; chunks: boolean };

export type BlockStatus = "ok" | "first_mistake" | "change" | "extra" | "unchecked";

export type BlockAlignRow = {
  op: "same" | "changed" | "extra" | "missing";
  /** 1-based student block (null for a missing block). */
  studentIndex: number | null;
  /** For missing blocks: inserted after this student block (0 = at the start). */
  afterStudentIndex: number;
  student: StructureBlock | null;
  expected: StructureBlock | null;
};

export type BlockFix = {
  editCount: number;
  tokens: string[];
  blocks: StructureBlock[];
  steps: string[];
  description: string;
};

export type BlockProgramComparison = {
  available: boolean;
  /** The item can be replayed on the server (route / geometry). */
  supported: boolean;
  studentWorks: boolean;
  /** Program works but misses a block the item requires (Repeat / Bag / Chunk). */
  missingRequired: string[];
  blocks: { index: number; block: StructureBlock; status: BlockStatus; note: string | null }[];
  firstMistakeBlock: number | null;
  firstMistakeText: string | null;
  fixes: BlockFix[];
  closest: StructureBlock[] | null;
  comparison: BlockAlignRow[];
  /** Nothing found within two block edits. */
  noSmallFix: boolean;
  summary: string;
};

const EVAL_BUDGET = 5000;

function blockAlphabet(config: LevelGameplayConfig, palette: BlockPalette, studentTokens: string[]): string[] {
  const out: string[] = [];
  if (palette.arrows) {
    out.push("forward", "turn left", "turn right");
    if (studentTokens.includes("backward")) out.push("backward");
  }
  for (const bag of config.commandBags ?? []) {
    if (palette.bags) out.push(formatCommandBagToken(bag.id));
    if (palette.chunks) for (const c of bag.chunks ?? []) out.push(formatCommandChunkToken(c.id));
  }
  for (const t of studentTokens) {
    if (parseRepeatStart(t) != null || isRepeatEnd(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function isBoundary(t: string): boolean {
  return parseRepeatStart(t) != null || isRepeatEnd(t);
}

/** Every program one block edit away. */
function neighbours(tokens: string[], alphabet: string[], palette: BlockPalette, anchor: number): string[][] {
  const out: { t: string[]; at: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i]!;
    const count = parseRepeatStart(cur);
    if (count != null) {
      for (let n = 1; n <= 9; n++) if (n !== count) out.push({ t: tokens.map((x, k) => (k === i ? formatRepeatStart(n) : x)), at: i });
      continue;
    }
    if (isRepeatEnd(cur)) continue;
    for (const a of alphabet) if (a !== cur) out.push({ t: tokens.map((x, k) => (k === i ? a : x)), at: i });
    out.push({ t: tokens.filter((_, k) => k !== i), at: i });
    const next = tokens[i + 1];
    if (next != null && next !== cur && !isBoundary(next)) {
      const s = [...tokens];
      s[i] = next;
      s[i + 1] = cur;
      out.push({ t: s, at: i });
    }
  }
  for (let i = 0; i <= tokens.length; i++) {
    for (const a of alphabet) out.push({ t: [...tokens.slice(0, i), a, ...tokens.slice(i)], at: i });
  }
  if (palette.repeat && !tokens.some((t) => parseRepeatStart(t) != null)) {
    // Wrap the whole program in a Repeat (common fix for "draw one side, then stop").
    for (let n = 2; n <= 6; n++) out.push({ t: [formatRepeatStart(n), ...tokens, "repeat-end"], at: 0 });
  }
  out.sort((a, b) => Math.abs(a.at - anchor) - Math.abs(b.at - anchor));
  return out.map((o) => o.t);
}

/** Align student vs working program; adjacent remove+add become "changed". */
export function alignBlockPrograms(
  student: string[],
  target: string[],
  config: LevelGameplayConfig
): BlockAlignRow[] {
  const bags = config.commandBags ?? [];
  const rows: BlockAlignRow[] = [];
  if (student.length === target.length && student.filter((t, i) => t !== target[i]).length <= 2) {
    return student.map((t, i) => ({
      op: t === target[i] ? "same" : "changed",
      studentIndex: i + 1,
      afterStudentIndex: i + 1,
      student: describeStructureBlock(t, bags),
      expected: describeStructureBlock(target[i]!, bags),
    }));
  }
  const ops = diffStructureTokens(student, target);
  let si = 0;
  let k = 0;
  while (k < ops.length) {
    const op = ops[k]!;
    if (op.op === "keep") {
      si++;
      rows.push({ op: "same", studentIndex: si, afterStudentIndex: si, student: describeStructureBlock(op.token, bags), expected: describeStructureBlock(op.token, bags) });
      k++;
      continue;
    }
    const removes: string[] = [];
    const adds: string[] = [];
    while (k < ops.length && ops[k]!.op !== "keep") {
      if (ops[k]!.op === "remove") removes.push(ops[k]!.token);
      else adds.push(ops[k]!.token);
      k++;
    }
    const pairs = Math.min(removes.length, adds.length);
    for (let p = 0; p < pairs; p++) {
      si++;
      rows.push({ op: "changed", studentIndex: si, afterStudentIndex: si, student: describeStructureBlock(removes[p]!, bags), expected: describeStructureBlock(adds[p]!, bags) });
    }
    for (let p = pairs; p < removes.length; p++) {
      si++;
      rows.push({ op: "extra", studentIndex: si, afterStudentIndex: si, student: describeStructureBlock(removes[p]!, bags), expected: null });
    }
    for (let p = pairs; p < adds.length; p++) {
      rows.push({ op: "missing", studentIndex: null, afterStudentIndex: si, student: null, expected: describeStructureBlock(adds[p]!, bags) });
    }
  }
  return rows;
}

function quote(b: StructureBlock | null): string {
  return b ? `“${b.label}”` : "";
}

function stepsFromRows(rows: BlockAlignRow[]): string[] {
  const steps: string[] = [];
  for (const r of rows) {
    if (r.op === "changed") steps.push(`Block ${r.studentIndex}: use ${quote(r.expected)} instead of ${quote(r.student)}.`);
    else if (r.op === "extra") steps.push(`Remove block ${r.studentIndex} (${quote(r.student)}).`);
    else if (r.op === "missing")
      steps.push(`Add ${quote(r.expected)} ${r.afterStudentIndex === 0 ? "at the start" : `after block ${r.afterStudentIndex}`}.`);
  }
  return steps;
}

function swapStep(a: string[], b: string[], config: LevelGameplayConfig): string | null {
  if (a.length !== b.length) return null;
  const diff = a.map((t, i) => (t !== b[i] ? i : -1)).filter((i) => i >= 0);
  if (diff.length !== 2 || diff[1] !== diff[0]! + 1) return null;
  const [i, j] = diff as [number, number];
  if (a[i] !== b[j] || a[j] !== b[i]) return null;
  const bags = config.commandBags ?? [];
  return `Swap block ${i + 1} (${quote(describeStructureBlock(a[i]!, bags))}) and block ${j + 1} (${quote(describeStructureBlock(a[j]!, bags))}).`;
}

function requiredBlocksMissing(config: LevelGameplayConfig, levelType: LevelType | null | undefined, tokens: string[]): string[] {
  if (levelType !== LevelType.GEOMETRY_PATH) return [];
  const gp = config.geometryPath;
  const missing: string[] = [];
  if (gp?.requireRepeat && !tokens.some((t) => parseRepeatStart(t) != null)) missing.push("a Repeat block");
  if (gp?.requireActionChunk && !tokens.some((t) => parseCommandChunkToken(t) != null)) missing.push("a Chunk");
  if (gp?.requireCommandBag && !tokens.some((t) => parseCommandBagToken(t) != null)) missing.push("a Command Bag");
  return missing;
}

export function compareBlockProgram(args: {
  config: LevelGameplayConfig;
  levelType: LevelType | null | undefined;
  blockTokens: string[];
  palette: BlockPalette;
  passed?: boolean | null;
  /** 1-based block the replay flagged first (collision / geometry issue); used when no fix is found. */
  anchorBlock?: number | null;
  anchorText?: string | null;
  /** Max programs to replay (bulk exports use a smaller budget). */
  budget?: number;
}): BlockProgramComparison {
  const { config, levelType, blockTokens, palette } = args;
  const budget = args.budget ?? EVAL_BUDGET;
  const bags = config.commandBags ?? [];
  const studentBlocks = blockTokens.map((t) => describeStructureBlock(t, bags));
  const check = buildProgramGoalChecker(config, levelType);
  const empty: BlockProgramComparison = {
    available: false,
    supported: !!check,
    studentWorks: false,
    missingRequired: [],
    blocks: studentBlocks.map((block, i) => ({ index: i + 1, block, status: "unchecked", note: null })),
    firstMistakeBlock: null,
    firstMistakeText: null,
    fixes: [],
    closest: null,
    comparison: [],
    noSmallFix: false,
    summary: "",
  };
  if (!check || blockTokens.length === 0) return empty;

  const works = (tokens: string[]) =>
    check(expandBlockProgram(tokens, bags).commands) && requiredBlocksMissing(config, levelType, tokens).length === 0;
  const motionWorks = check(expandBlockProgram(blockTokens, bags).commands);
  const missingRequired = requiredBlocksMissing(config, levelType, blockTokens);

  if (motionWorks && missingRequired.length === 0) {
    return {
      ...empty,
      available: true,
      studentWorks: true,
      blocks: studentBlocks.map((block, i) => ({ index: i + 1, block, status: "ok", note: null })),
      summary:
        args.passed === false
          ? "Replaying these blocks reaches the goal, so the failure came from something outside the program (for example the run was stopped early)."
          : "Every block is correct — the program reaches the goal.",
    };
  }

  const alphabet = blockAlphabet(config, palette, blockTokens);
  const anchor = Math.max(0, (args.anchorBlock ?? 1) - 1);
  let evals = 0;
  const seen = new Set<string>([blockTokens.join("\u0001")]);
  const found: string[][] = [];
  let foundDepth = 0;

  const level1 = neighbours(blockTokens, alphabet, palette, anchor).filter((t) => {
    const key = t.join("\u0001");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (const t of level1) {
    if (evals++ >= budget) break;
    if (works(t)) found.push(t);
  }
  if (found.length) foundDepth = 1;
  else {
    outer: for (const t1 of level1) {
      for (const t2 of neighbours(t1, alphabet, palette, anchor)) {
        const key = t2.join("\u0001");
        if (seen.has(key)) continue;
        seen.add(key);
        if (evals++ >= budget) break outer;
        if (works(t2)) {
          found.push(t2);
          if (found.length >= 6) break outer;
        }
      }
    }
    if (found.length) foundDepth = 2;
  }

  // Fewest changed blocks, then the shorter program, then the one that keeps more of the
  // student's opening blocks; one fix per kind of edit (Repeat ×4 / ×5 / ×6 → keep the smallest).
  const ranked = found
    .map((tokens, order) => {
      const rows = alignBlockPrograms(blockTokens, tokens, config);
      const changed = rows.filter((r) => r.op !== "same");
      return {
        tokens,
        order,
        edits: changed.length,
        firstChange: changed[0] ? (changed[0].studentIndex ?? changed[0].afterStudentIndex + 0.5) : 0,
      };
    })
    .sort(
      (a, b) =>
        a.edits - b.edits ||
        a.tokens.length - b.tokens.length ||
        b.firstChange - a.firstChange ||
        a.order - b.order
    );
  const signatures = new Set<string>();
  const fixes: BlockFix[] = [];
  for (const { tokens } of ranked) {
    const rows = alignBlockPrograms(blockTokens, tokens, config);
    const signature = rows
      .filter((r) => r.op !== "same")
      .map((r) => `${r.op}:${r.studentIndex ?? ""}:${r.afterStudentIndex}:${r.expected?.kind === "repeat-start" ? "repeat" : (r.expected?.token ?? "")}`)
      .join("|");
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    const swap = swapStep(blockTokens, tokens, config);
    const steps = swap ? [swap] : stepsFromRows(rows);
    fixes.push({
      editCount: foundDepth,
      tokens,
      blocks: tokens.map((t) => describeStructureBlock(t, bags)),
      steps,
      description: steps.join(" "),
    });
    if (fixes.length >= 3) break;
  }

  const best = fixes[0] ?? null;
  const comparison = best ? alignBlockPrograms(blockTokens, best.tokens, config) : [];

  const blocks: BlockProgramComparison["blocks"] = studentBlocks.map((block, i) => ({
    index: i + 1,
    block,
    status: best ? "ok" : "unchecked",
    note: null,
  }));
  let firstMistakeBlock: number | null = null;
  let firstMistakeText: string | null = null;

  if (best) {
    for (const r of comparison) {
      if (r.op === "changed" && r.studentIndex) {
        blocks[r.studentIndex - 1]!.status = "change";
        blocks[r.studentIndex - 1]!.note = `Should be ${quote(r.expected)}`;
      } else if (r.op === "extra" && r.studentIndex) {
        blocks[r.studentIndex - 1]!.status = "extra";
        blocks[r.studentIndex - 1]!.note = "Not needed";
      } else if (r.op === "missing") {
        const at = Math.min(Math.max(1, r.afterStudentIndex + (r.afterStudentIndex === 0 ? 1 : 0)), blocks.length);
        const b = blocks[at - 1]!;
        if (b.status === "ok") b.note = `${quote(r.expected)} missing ${r.afterStudentIndex === 0 ? "before" : "after"} this block`;
      }
    }
    const swap = swapStep(blockTokens, best.tokens, config);
    const firstRow = comparison.find((r) => r.op !== "same");
    if (swap) {
      const i = blockTokens.findIndex((t, k) => t !== best.tokens[k]);
      firstMistakeBlock = i + 1;
      firstMistakeText = swap;
      blocks[i]!.status = "change";
      blocks[i + 1]!.status = "change";
      blocks[i]!.note = "Wrong order";
      blocks[i + 1]!.note = "Wrong order";
    } else if (firstRow) {
      firstMistakeBlock =
        firstRow.studentIndex ?? Math.min(Math.max(1, firstRow.afterStudentIndex), blocks.length);
      firstMistakeText = stepsFromRows([firstRow])[0] ?? null;
    }
    if (firstMistakeBlock) blocks[firstMistakeBlock - 1]!.status = "first_mistake";
  } else if (args.anchorBlock) {
    firstMistakeBlock = Math.min(args.anchorBlock, blocks.length);
    firstMistakeText = args.anchorText ?? null;
    blocks.forEach((b, i) => {
      if (i + 1 < firstMistakeBlock!) b.status = "ok";
    });
    blocks[firstMistakeBlock - 1]!.status = "first_mistake";
  }

  let summary: string;
  if (motionWorks && missingRequired.length) {
    summary = `The moves reach the goal, but the item requires ${missingRequired.join(" and ")}.${best ? ` Closest fix: ${best.description}` : ""}`;
  } else if (best) {
    const n = best.steps.length;
    summary = `${n === 1 ? "One change" : n === 2 ? "Two changes" : `${n} small changes`} away from working. ${best.description}`;
  } else {
    summary = firstMistakeText
      ? `No working program is within two block changes of this one. First problem: ${firstMistakeText}`
      : "No working program is within two block changes of this one — the plan needs a bigger rethink.";
  }

  return {
    available: true,
    supported: true,
    studentWorks: false,
    missingRequired,
    blocks,
    firstMistakeBlock,
    firstMistakeText,
    fixes,
    closest: best?.blocks ?? null,
    comparison,
    noSmallFix: !best,
    summary,
  };
}
