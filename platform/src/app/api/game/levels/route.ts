import { NextRequest } from "next/server";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import {
  applyLevelTypeDefaults,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import type { LevelType } from "@prisma/client";
import {
  getPlayableLevelsForStudent,
  resolveStudentProfileId,
} from "@/lib/level-assignments";
import { getActiveDirectAssignmentLevelIds } from "@/lib/level-student-assignments";

export async function GET(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const studentId = request.nextUrl.searchParams.get("studentId")?.trim() || undefined;

  const levels = studentId
    ? await getPlayableLevelsForStudent(studentId)
    : await getPlayableLevelsForStudent(null);

  let hasCustomAssignments = false;
  if (studentId) {
    const profileId = await resolveStudentProfileId(studentId);
    if (profileId) {
      const active = await getActiveDirectAssignmentLevelIds(profileId);
      hasCustomAssignments = active.size > 0;
    }
  }

  const validated = levels.map((l, index) => {
    const parsed = levelGameplayConfigSchema.safeParse(l.config);
    const raw = (parsed.success ? parsed.data : l.config) as LevelGameplayConfig;
    const config = syncNumberLineGridPositions(applyLevelTypeDefaults(l.levelType as LevelType, raw));
    return {
      levelNumber: index + 1,
      levelKey: l.levelKey,
      name: l.name,
      description: l.description,
      orderIndex: l.orderIndex,
      difficulty: l.difficulty,
      levelType: l.levelType,
      visible: config.visible ?? true,
      config,
    };
  });

  return Response.json({
    levels: validated,
    filteredForStudent: Boolean(studentId),
    hasCustomAssignments,
    assignmentRestricted: hasCustomAssignments,
  });
}
