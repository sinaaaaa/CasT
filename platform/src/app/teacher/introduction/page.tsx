import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { IntroductionEditor } from "@/components/teacher/introduction-editor";
import { LevelType } from "@prisma/client";
import {
  INTRO_LEVEL_KEY,
  applyLevelTypeDefaults,
  defaultConfigForType,
  levelGameplayConfigSchema,
} from "@/lib/level-config";

export default async function IntroductionPage() {
  const session = await getServerSession(authOptions);

  let level = await prisma.level.findUnique({ where: { levelKey: INTRO_LEVEL_KEY } });

  if (!level) {
    const cfg = defaultConfigForType(LevelType.INTRO, "Block introduction");
    level = await prisma.level.create({
      data: {
        levelKey: INTRO_LEVEL_KEY,
        name: "Block introduction (Item 0)",
        orderIndex: 0,
        difficulty: 1,
        levelType: LevelType.INTRO,
        published: true,
        config: applyLevelTypeDefaults(LevelType.INTRO, cfg) as object,
      },
    });
  }

  const configParsed = levelGameplayConfigSchema.safeParse(level.config);
  const config = configParsed.success
    ? configParsed.data
    : defaultConfigForType(LevelType.INTRO, level.name);

  return (
    <TeacherShell title="Introduction builder" userName={session?.user.name}>
      <IntroductionEditor
        initial={{
          id: level.id,
          levelKey: level.levelKey,
          name: level.name,
          published: level.published,
          config,
        }}
      />
    </TeacherShell>
  );
}
