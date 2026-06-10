import { NextRequest } from "next/server";
import {
  applyLevelTypeDefaults,
  levelGameplayConfigSchema,
  syncNumberLineGridPositions,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import type { LevelType } from "@prisma/client";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import { getActiveDirectAssignmentLevelIds } from "@/lib/level-student-assignments";
import { requireStudentSession } from "@/lib/student-api-auth";

export async function GET(request: NextRequest) {
  const { error, session } = await requireStudentSession(request);
  if (error) return error;

  const studentCode = session!.studentCode;
  const levels = await getPlayableLevelsForStudent(studentCode);

  const directActive = await getActiveDirectAssignmentLevelIds(session!.studentProfileId);
  const hasCustomAssignments = directActive.size > 0;

  const validated = levels.map((l, index) => {
    const parsed = levelGameplayConfigSchema.safeParse(l.config);
    const raw = (parsed.success ? parsed.data : l.config) as LevelGameplayConfig;
    const config = syncNumberLineGridPositions(
      applyLevelTypeDefaults(l.levelType as LevelType, raw)
    );
    return {
      levelNumber: index + 1,
      id: l.id,
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
    hasCustomAssignments,
    assignmentRestricted: hasCustomAssignments,
  });
}
