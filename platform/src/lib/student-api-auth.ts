import type { NextRequest } from "next/server";
import {
  getStudentSessionFromCookies,
  getStudentSessionFromRequest,
  type StudentSessionPayload,
} from "@/lib/student-session";

export async function requireStudentSession(request?: NextRequest): Promise<{
  error: Response | null;
  session: StudentSessionPayload | null;
}> {
  const session = request
    ? await getStudentSessionFromRequest(request)
    : await getStudentSessionFromCookies();

  if (!session) {
    return {
      error: Response.json({ error: "Not signed in. Please enter your Student ID." }, { status: 401 }),
      session: null,
    };
  }

  return { error: null, session };
}
