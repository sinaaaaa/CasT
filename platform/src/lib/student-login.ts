import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
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

/**
 * Find or create a student by external student code (STU-XXXX).
 * Safe for concurrent requests — does not overwrite existing profiles.
 */
export async function findOrCreateStudentByCode(
  input: StudentLoginInput
): Promise<StudentLoginResult> {
  const validated = validateStudentCode(input.studentCode);
  if (!validated.ok) {
    throw new StudentLoginError(validated.error, 400);
  }

  const externalId = validated.code;
  const rawDisplay = input.displayName?.trim();

  let existing = await resolveStudent(externalId);
  if (existing) {
    const account = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { isActive: true },
    });
    if (!account?.isActive || existing.isArchived) {
      throw new StudentLoginError("This student account is disabled.", 403);
    }

    if (input.classCode?.trim()) {
      await enrollInClassByCode(existing.id, input.classCode);
    }

    return {
      profileId: existing.id,
      studentCode: externalId,
      displayName: existing.displayName?.trim() || `Student ${externalId}`,
      created: false,
    };
  }

  const rawId = externalId.replace(/^STU-/i, "");
  const email = `student.${rawId.toLowerCase()}@game.sparc.local`;
  const passwordHash = await bcrypt.hash(rawId, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            displayName: rawDisplay || `Student ${rawId}`,
            externalId,
          },
        },
      },
      include: { studentProfile: true },
    });

    const profile = user.studentProfile!;
    const defaultClass = await prisma.class.findFirst({ orderBy: { createdAt: "asc" } });
    if (defaultClass) {
      await prisma.classStudent.upsert({
        where: {
          classId_studentId: { classId: defaultClass.id, studentId: profile.id },
        },
        create: { classId: defaultClass.id, studentId: profile.id },
        update: {},
      });
    }

    if (input.classCode?.trim()) {
      await enrollInClassByCode(profile.id, input.classCode);
    }

    return {
      profileId: profile.id,
      studentCode: externalId,
      displayName: profile.displayName,
      created: true,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      existing = await resolveStudent(externalId);
      if (existing) {
        return {
          profileId: existing.id,
          studentCode: externalId,
          displayName: existing.displayName?.trim() || `Student ${externalId}`,
          created: false,
        };
      }
    }
    throw error;
  }
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
