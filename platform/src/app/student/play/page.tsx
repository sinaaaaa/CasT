import { redirect } from "next/navigation";
import { StudentPlayClient } from "@/components/student/student-play-client";
import {
  buildStudentGameConfig,
  getStudentSessionFromCookies,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";
import { cookies } from "next/headers";

export const metadata = {
  title: "Play — Robot Coding",
};

export default async function StudentPlayPage() {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    redirect("/student/login?next=/student/play");
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
    />
  );
}
