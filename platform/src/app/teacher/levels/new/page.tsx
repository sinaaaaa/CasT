import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { LevelEditorForm } from "@/components/teacher/level-editor-form";

export default async function NewLevelPage() {
  const session = await getServerSession(authOptions);
  return (
    <TeacherShell title="Create item" userName={session?.user.name} immersive>
      <LevelEditorForm />
    </TeacherShell>
  );
}
