import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveTeacherScope, getScopedAttemptCountsByLevel } from "@/lib/class-access";
import { fetchTeacherVisibleLevels } from "@/lib/level-customization";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { LevelsHub, type LevelHubRow } from "@/components/teacher/levels-hub";
import { LevelType } from "@prisma/client";
import { INTRO_LEVEL_KEY, levelGameplayConfigSchema } from "@/lib/level-config";
import { assertLevelEditAccess } from "@/lib/class-access";

export default async function TeacherLevelsPage() {
  const session = await getServerSession(authOptions);
  const scope = await resolveTeacherScope(session!.user);

  const [levels, attemptCounts] = await Promise.all([
    fetchTeacherVisibleLevels(scope),
    getScopedAttemptCountsByLevel(scope),
  ]);

  const intro = levels.find((l) => l.levelType === LevelType.INTRO || l.levelKey === INTRO_LEVEL_KEY);
  const playableLevels: LevelHubRow[] = levels
    .filter((l) => l.levelType !== LevelType.INTRO && l.levelKey !== INTRO_LEVEL_KEY)
    .map((l) => {
      const parsed = levelGameplayConfigSchema.safeParse(l.config);
      const visible = parsed.success ? (parsed.data.visible ?? true) : true;
      return {
        id: l.id,
        levelKey: l.levelKey,
        name: l.name,
        orderIndex: l.orderIndex,
        difficulty: l.difficulty,
        levelType: l.levelType,
        published: l.published,
        visible,
        attemptCount: attemptCounts.get(l.id) ?? 0,
        ownerTeacherId: l.ownerTeacherId,
        canEdit: assertLevelEditAccess(scope, l),
        isPlatformDefault: l.ownerTeacherId === null,
      };
    });

  const stats = {
    total: playableLevels.length,
    published: playableLevels.filter((l) => l.published).length,
    totalAttempts: playableLevels.reduce((s, l) => s + l.attemptCount, 0),
  };

  return (
    <TeacherShell title="Items" userName={session?.user.name}>
      <LevelsHub
        playableLevels={playableLevels}
        introLevel={
          intro
            ? {
                id: intro.id,
                name: intro.name,
                published: intro.published,
                attemptCount: attemptCounts.get(intro.id) ?? 0,
              }
            : null
        }
        stats={stats}
      />
    </TeacherShell>
  );
}
