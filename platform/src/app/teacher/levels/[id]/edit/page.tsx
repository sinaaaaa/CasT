import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { assertLevelEditAccess, resolveTeacherScope } from "@/lib/class-access";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { LevelEditTabs } from "@/components/teacher/level-edit-tabs";
import { levelGameplayConfigSchema } from "@/lib/level-config";

type Props = { params: Promise<{ id: string }> };

export default async function EditLevelPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const scope = await resolveTeacherScope(session!.user);

  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) notFound();
  if (!assertLevelEditAccess(scope, level)) notFound();

  const configParsed = levelGameplayConfigSchema.safeParse(level.config);
  const config = configParsed.success
    ? configParsed.data
    : (level.config as Record<string, unknown>);

  const initial = {
    id: level.id,
    levelKey: level.levelKey,
    name: level.name,
    description: level.description,
    orderIndex: level.orderIndex,
    difficulty: level.difficulty,
    levelType: level.levelType,
    published: level.published,
    config: config as import("@/lib/level-config").LevelGameplayConfig,
  };

  return (
    <TeacherShell title={`Edit: ${level.name}`} userName={session?.user.name}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading editor…</p>}>
        <LevelEditTabs level={initial} />
      </Suspense>
    </TeacherShell>
  );
}
