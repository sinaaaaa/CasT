/**
 * Block-level (Bags / Chunks kept whole) view model for the debugging program comparison.
 */

import type { BlockProgramComparison } from "@/lib/assessment/blockProgramComparison";
import {
  diffStructureTokens,
  type ProgramStructureAnalysis,
  type StructureBlock,
} from "@/lib/assessment/programStructureAnalysis";

export type BlockMark = "first_mistake" | "changed" | "extra" | "added" | null;

export type DebugBlockView = {
  starter: StructureBlock[];
  student: StructureBlock[];
  studentMarks: BlockMark[];
  studentNotes: (string | null)[];
  reference: StructureBlock[] | null;
  referenceMarks: BlockMark[];
  referenceLabel: string;
  referenceSublabel: string;
  /** Plain sentence for the banner above the blocks (null when nothing is wrong). */
  firstMistakeText: string | null;
  /** Suggested block edits, best first. */
  fixes: string[];
  studentWorks: boolean;
};

const MACRO_KINDS = new Set(["bag", "chunk", "repeat-start"]);

export function buildDebugBlockView(args: {
  programStructure: ProgramStructureAnalysis | null | undefined;
  blockComparison: BlockProgramComparison | null | undefined;
  bugFixed: boolean;
}): DebugBlockView | null {
  const ps = args.programStructure;
  if (!ps?.available || ps.source !== "unity" || !ps.hasStarter) return null;
  const usesBlocks = [...ps.starter, ...ps.final].some((b) => MACRO_KINDS.has(b.kind));
  if (!usesBlocks) return null;

  const studentMarks: BlockMark[] = ps.final.map(() => null);
  const studentNotes: (string | null)[] = ps.final.map(() => null);

  // What the student added compared with the starter.
  let fi = 0;
  for (const op of diffStructureTokens(
    ps.starter.map((b) => b.token),
    ps.final.map((b) => b.token)
  )) {
    if (op.op === "remove") continue;
    if (op.op === "add") {
      studentMarks[fi] = "added";
      studentNotes[fi] = "Added by the student";
    }
    fi++;
  }

  const bc = args.blockComparison;
  const studentWorks = args.bugFixed || !!bc?.studentWorks;
  let reference: StructureBlock[] | null = null;
  let referenceMarks: BlockMark[] = [];
  let referenceLabel = "How it should look";
  let referenceSublabel = "";
  let firstMistakeText: string | null = null;

  if (studentWorks) {
    reference = ps.final;
    referenceMarks = ps.final.map(() => null);
    referenceSublabel = "The student's own program already works";
  } else if (bc?.available) {
    for (const b of bc.blocks) {
      const i = b.index - 1;
      if (i < 0 || i >= studentMarks.length) continue;
      if (b.status === "first_mistake") studentMarks[i] = "first_mistake";
      else if (b.status === "change") studentMarks[i] = "changed";
      else if (b.status === "extra") studentMarks[i] = "extra";
      if (b.note) studentNotes[i] = b.note;
    }
    firstMistakeText = bc.firstMistakeBlock
      ? `First mistake — block ${bc.firstMistakeBlock}${bc.firstMistakeText ? `: ${bc.firstMistakeText.replace(/^Block \d+:\s*/, "")}` : ""}`
      : null;
    if (bc.closest) {
      reference = bc.closest;
      referenceSublabel = "Closest working program using the same blocks";
      referenceMarks = [];
      for (const r of bc.comparison) {
        if (!r.expected) continue;
        referenceMarks.push(r.op === "changed" ? "changed" : r.op === "missing" ? "added" : null);
      }
    } else {
      referenceSublabel = "No working program within two block changes";
    }
  }

  return {
    starter: ps.starter,
    student: ps.final,
    studentMarks,
    studentNotes,
    reference,
    referenceMarks,
    referenceLabel,
    referenceSublabel,
    firstMistakeText,
    fixes: studentWorks ? [] : (bc?.fixes ?? []).map((f) => f.description),
    studentWorks,
  };
}
