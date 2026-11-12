import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { StudentPlayClient } from "@/components/student/student-play-client";
import {
  buildStudentGameConfig,
  getStudentSessionFromCookies,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";
import { getPlayableLevelsForStudent } from "@/lib/level-assignments";
import {
  resolveGameResumeLevel,
  resolveRequestedPlayLevel,
} from "@/lib/game-resume-level";
import { resolveUnityGameUrl } from "@/lib/unity-game-url";

type Props = {
  loginNext?: string;
  homeHref?: string;
  itemKey?: string;
};

export async function StudentPlayView({
  loginNext = "/student/play",
  homeHref = "/student/home",
  itemKey,
}: Props) {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    redirect(`/student/login?next=${encodeURIComponent(loginNext)}`);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDENT_SESSION_COOKIE)?.value ?? "";
  const playableLevels = await getPlayableLevelsForStudent(session.studentCode);
  const playableRefs = playableLevels.map((level) => ({
    id: level.id,
    levelKey: level.levelKey,
    config: level.config,
  }));

  const requestedKey = itemKey?.trim();
  const requested = requestedKey
    ? await resolveRequestedPlayLevel(session.studentProfileId, playableRefs, requestedKey)
    : null;
  if (requestedKey && !requested) {
    redirect(homeHref);
  }
  const resume =
    requested ?? (await resolveGameResumeLevel(session.studentProfileId, playableRefs));

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
