import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { StudentPlayClient } from "@/components/student/student-play-client";
import {
  buildStudentGameConfig,
  getStudentSessionFromCookies,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import { resolveGameResumeLevel } from "@/lib/game-resume-level";
import { resolveUnityGameUrl } from "@/lib/unity-game-url";

type Props = {
  loginNext?: string;
  homeHref?: string;
};

export async function StudentPlayView({
  loginNext = "/student/play",
  homeHref = "/student/home",
}: Props) {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    redirect(`/student/login?next=${encodeURIComponent(loginNext)}`);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDENT_SESSION_COOKIE)?.value ?? "";
  const playableLevels = await getPlayableLevelsForStudent(session.studentCode);
  const resume = await resolveGameResumeLevel(
    session.studentProfileId,
    playableLevels.map((level) => ({ id: level.id, levelKey: level.levelKey }))
  );
  const config = {
    ...buildStudentGameConfig(session, sessionToken),
    resumeLevelKey: resume?.resumeLevelKey ?? null,
    resumeSlot: resume?.resumeSlot ?? null,
  };

  const unityGameUrl = resolveUnityGameUrl();

  return (
    <StudentPlayClient
      config={config}
      unityGameUrl={unityGameUrl}
      displayName={session.displayName}
      homeHref={homeHref}
    />
  );
}
