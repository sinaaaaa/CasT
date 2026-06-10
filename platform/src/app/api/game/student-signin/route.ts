import { NextRequest } from "next/server";
import {
  findOrCreateStudentByCode,
  StudentLoginError,
} from "@/lib/student-login";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";

/**
 * Unity main-menu sign-in / sign-up.
 * Accepts a student ID (e.g. "1001" or "STU-1001"), creates the student if missing.
 * Response shape matches the legacy Flask endpoint for LoginManager.cs.
 */
export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  try {
    const body = await request.json();
    const rawId = String(body.studentId ?? body.studentCode ?? "").trim();
    const displayName = body.displayName?.trim();

    if (!rawId) {
      return Response.json({ status: "error", message: "studentId is required" }, { status: 400 });
    }

    const result = await findOrCreateStudentByCode({
      studentCode: rawId,
      displayName,
    });

    return Response.json(
      {
        status: "success",
        message: result.created ? "New student created" : "Student found",
        student: {
          id: result.studentCode,
          username: result.displayName,
          profileId: result.profileId,
        },
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof StudentLoginError) {
      return Response.json({ status: "error", message: error.message }, { status: error.status });
    }
    console.error("[student-signin]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ status: "error", message }, { status: 500 });
  }
}
