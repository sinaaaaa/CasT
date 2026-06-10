import { cookies } from "next/headers";
import {
  revokeStudentSession,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  await revokeStudentSession(token);
  cookieStore.delete(STUDENT_SESSION_COOKIE);
  return Response.json({ ok: true });
}
