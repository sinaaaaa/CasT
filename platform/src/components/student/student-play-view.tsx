import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { StudentPlayClient } from "@/components/student/student-play-client";
import {
  buildStudentGameConfig,
  getStudentSessionFromCookies,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";

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
  const config = buildStudentGameConfig(session, sessionToken);

  const unityGameUrl =
    process.env.UNITY_WEBGL_URL?.trim() ||
    process.env.NEXT_PUBLIC_UNITY_WEBGL_URL?.trim() ||
    "/unity/index.html";

  return (
    <StudentPlayClient
      config={config}
      unityGameUrl={unityGameUrl}
      displayName={session.displayName}
      homeHref={homeHref}
    />
  );
}
