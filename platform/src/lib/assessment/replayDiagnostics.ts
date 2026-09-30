import type { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { isGeometryPathLevel } from "@/lib/assessment/assessmentConfig";
import { resolveStudentBlockTokens, resolveStudentPalette } from "@/lib/assessment/programStructureAnalysis";
import { diagnoseGeometryProgram, type GeometryEdgeDiagnosis } from "@/lib/assessment/geometryEdgeDiagnosis";
import { compareBlockProgram, type BlockProgramComparison } from "@/lib/assessment/blockProgramComparison";

/**
 * Replay-based checks for one attempt: geometry edge-by-edge diagnosis and the
 * block-level comparison (Bags / Chunks / Repeat kept whole).
 */
export function buildReplayDiagnostics(args: {
  config: LevelGameplayConfig;
  levelType: LevelType | null | undefined;
  mistakes: unknown;
  finalCommand: string | null | undefined;
  passed: boolean | null | undefined;
  budget?: number;
}): { geometryEdgeDiagnosis: GeometryEdgeDiagnosis | null; blockComparison: BlockProgramComparison | null } {
  const { config, levelType } = args;
  const { tokens } = resolveStudentBlockTokens({ mistakes: args.mistakes, finalCommand: args.finalCommand });
  if (!tokens.length) return { geometryEdgeDiagnosis: null, blockComparison: null };

  const isGeometry = isGeometryPathLevel(config, levelType ?? undefined);
  let geometryEdgeDiagnosis: GeometryEdgeDiagnosis | null = null;
  if (isGeometry) {
    const d = diagnoseGeometryProgram({ config, blockTokens: tokens, mistakes: args.mistakes, passed: args.passed });
    geometryEdgeDiagnosis = d.available ? d : null;
  }

  const palette = resolveStudentPalette(config, levelType);
  const usesBlocks =
    isGeometry || palette.bags || palette.chunks || tokens.some((t) => /^(bag:|chunk:|repeat)/.test(t));
  let blockComparison: BlockProgramComparison | null = null;
  if (usesBlocks && args.passed !== true) {
    const primary = geometryEdgeDiagnosis?.primaryIssue ?? null;
    const c = compareBlockProgram({
      config,
      levelType,
      blockTokens: tokens,
      palette,
      passed: args.passed,
      anchorBlock: primary?.block ?? null,
      anchorText: primary ? `${primary.title}. ${primary.message}` : null,
      budget: args.budget,
    });
    blockComparison = c.available ? c : null;
  }
  return { geometryEdgeDiagnosis, blockComparison };
}
