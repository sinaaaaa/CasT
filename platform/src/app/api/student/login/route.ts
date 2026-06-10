import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  findOrCreateStudentByCode,
  StudentLoginError,
} from "@/lib/student-login";
import {
  createStudentSession,
  sessionCookieOptions,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentCode = String(body.studentCode ?? body.studentId ?? "").trim();
    const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
    const classCode = typeof body.classCode === "string" ? body.classCode : undefined;

    const result = await findOrCreateStudentByCode({
      studentCode,
      displayName,
      classCode,
    });

    const { token, expiresAt } = await createStudentSession(result.profileId);
    const cookieStore = await cookies();
    cookieStore.set(STUDENT_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    return Response.json(
      {
        studentId: result.profileId,
        studentCode: result.studentCode,
        displayName: result.displayName,
        sessionToken: token,
        created: result.created,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof StudentLoginError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[student/login]", error);
    return Response.json({ error: "Could not sign in. Please try again." }, { status: 500 });
  }
}
