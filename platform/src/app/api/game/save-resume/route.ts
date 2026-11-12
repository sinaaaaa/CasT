import { NextRequest } from "next/server";
import { gameApiUnauthorized, verifyGameApiKey } from "@/lib/game-api";
import { resolveStudentProfileId } from "@/lib/level-assignments";
import {
  ensureStudentResumeColumns,
  saveStudentResumeCursor,
} from "@/lib/student-resume-cursor";

/**
 * Unity calls this when Continue advances to the next item (pass or fail).
 * Does not require an active attempt id.
 */
export async function POST(request: NextRequest) {
  if (!verifyGameApiKey(request)) return gameApiUnauthorized();

  const body = await request.json();
  const {
    studentId,
    resumeLevelKey,
    resumeSlot,
  } = body as {
    studentId?: string;
    resumeLevelKey?: string;
    resumeSlot?: number;
  };

  if (!studentId?.trim()) {
    return Response.json({ error: "studentId is required" }, { status: 400 });
  }
  if (!resumeLevelKey?.trim() || resumeSlot == null || resumeSlot < 1) {
    return Response.json(
      { error: "resumeLevelKey and resumeSlot (>= 1) are required" },
      { status: 400 }
    );
  }

  const profileId = await resolveStudentProfileId(studentId);
  if (!profileId) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  await ensureStudentResumeColumns();

  const saved = await saveStudentResumeCursor(profileId, {
    resumeLevelKey: resumeLevelKey.trim(),
    resumeSlot: Math.floor(resumeSlot),
  });

  return Response.json({ success: true, resume: saved });
}
