import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeExternalStudentId, resolveStudent } from "@/lib/game-service";

export type StudentLoginInput = {
  studentCode: string;
  displayName?: string;
  classCode?: string;
};

export type StudentLoginResult = {
  profileId: string;
  studentCode: string;
  displayName: string;
  created: boolean;
};

const STUDENT_CODE_CORE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;

export function validateStudentCode(raw: string): { ok: true; code: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter your Student ID." };
  }
  const core = trimmed.replace(/^STU-/i, "");
  if (core.length < 2) {
    return { ok: false, error: "Student ID must be at least 2 characters." };
  }
  if (!STUDENT_CODE_CORE_PATTERN.test(core)) {
    return {
      ok: false,
      error: "Student ID can only use letters, numbers, dots, dashes, and underscores.",
    };
  }
  return { ok: true, code: normalizeExternalStudentId(trimmed) };
}

async function enrollInClassByCode(studentProfileId: string, classCode: string) {
  const code = classCode.trim();
  if (!code) return;

  const cls = await prisma.class.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: { id: true },
  });
  if (!cls) return;

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: { classId: cls.id, studentId: studentProfileId },
    },
    create: { classId: cls.id, studentId: studentProfileId },
    update: {},
  });
}

function looksLikePlaceholderName(name: string, externalId: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (/^STU-/i.test(trimmed)) return true;
  const rawId = externalId.replace(/^STU-/i, "");
  return new RegExp(`^Student\\s+${rawId}$`, "i").test(trimmed);
}

/**
 * Sign in a student who already exists on the class list.
 * Unknown IDs are rejected. A nickname is saved when the student provides one.
 */
export async function signInExistingStudent(
  input: StudentLoginInput
): Promise<StudentLoginResult> {
  const validated = validateStudentCode(input.studentCode);
  if (!validated.ok) {
    throw new StudentLoginError(validated.error, 400);
  }

  const externalId = validated.code;
  const existing = await resolveStudent(externalId);
  if (!existing) {
    throw new StudentLoginError(
      "This Student ID is not on the class list. Ask your teacher to add you first.",
      404
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { isActive: true, role: true },
  });
  if (account?.role !== UserRole.STUDENT || !account.isActive || existing.isArchived) {
    throw new StudentLoginError("This student account is disabled.", 403);
  }

  const nickname = input.displayName?.trim();
  let displayName = existing.displayName?.trim() || `Student ${externalId}`;
  if (nickname && (nickname !== displayName || looksLikePlaceholderName(displayName, externalId))) {
    const updated = await prisma.studentProfile.update({
      where: { id: existing.id },
      data: { displayName: nickname },
      select: { displayName: true },
    });
    displayName = updated.displayName;
  }

  if (input.classCode?.trim()) {
    await enrollInClassByCode(existing.id, input.classCode);
  }

  return {
    profileId: existing.id,
    studentCode: externalId,
    displayName,
    created: false,
  };
}

export class StudentLoginError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "StudentLoginError";
  }
}
