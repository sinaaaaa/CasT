import { NextRequest } from "next/server";
import { assertClassAccess, studentScopeWhere } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { normalizeExternalStudentId } from "@/lib/game-service";
import { AttemptStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createStudentSchema = z.object({
  displayName: z.string().min(1).max(120),
  externalId: z.string().min(1).max(64),
  classId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export async function GET(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const classId = searchParams.get("classId");

  const includeArchived = searchParams.get("archived") === "1";

  const scopeFilter = studentScopeWhere(scope!);
  const students = await prisma.studentProfile.findMany({
    where: {
      ...(includeArchived
        ? scopeFilter.classMemberships
          ? { classMemberships: scopeFilter.classMemberships }
          : scopeFilter.id
            ? { id: scopeFilter.id }
            : {}
        : scopeFilter),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { externalId: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(classId
        ? { classMemberships: { some: { classId } } }
        : {}),
    },
    include: {
      user: { select: { email: true } },
      classMemberships: { include: { class: true } },
      levelAttempts: {
        select: { passed: true, status: true, score: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const data = students.map((s) => {
    const passed = s.levelAttempts.filter((a) => a.passed).length;
    const failed = s.levelAttempts.filter((a) => a.status === AttemptStatus.INCORRECT).length;
    const avgScore =
      s.levelAttempts.length > 0
        ? Math.round(
            s.levelAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / s.levelAttempts.length
          )
        : 0;
    return {
      id: s.id,
      displayName: s.displayName,
      externalId: s.externalId,
      email: s.user.email,
      classes: s.classMemberships.map((c) => ({ id: c.class.id, name: c.class.name })),
      passedLevels: passed,
      failedLevels: failed,
      totalAttempts: s.levelAttempts.length,
      avgScore,
    };
  });

  return Response.json({ students: data });
}

export async function POST(request: NextRequest) {
  const { error, scope } = await requireTeacher();
  if (error) return error;

  const body = await request.json();
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classId = parsed.data.classId?.trim();
  if (!scope!.isAdmin) {
    if (!scope!.teacherProfileId || (scope!.classIds?.length ?? 0) === 0) {
      return Response.json(
        { error: "Create a class first, then add students to it." },
        { status: 400 }
      );
    }
    if (!classId) {
      return Response.json(
        { error: "Class is required when adding a student." },
        { status: 400 }
      );
    }
    if (!assertClassAccess(scope!, classId)) {
      return Response.json({ error: "You do not have access to this class" }, { status: 403 });
    }
  } else if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });
  }

  const externalId = normalizeExternalStudentId(parsed.data.externalId);
  const email =
    parsed.data.email?.trim().toLowerCase() ??
    `${externalId.toLowerCase().replace(/[^a-z0-9]/g, "")}@sparc.local`;
  const password = parsed.data.password ?? "student123";

  const existing = await prisma.studentProfile.findFirst({
    where: { OR: [{ externalId }, { user: { email } }] },
  });
  if (existing) {
    return Response.json({ error: "Student ID or email already exists" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.studentProfile.create({
      data: {
        displayName: parsed.data.displayName,
        externalId,
        user: {
          create: {
            email,
            password: hashed,
            role: UserRole.STUDENT,
          },
        },
      },
      include: { user: { select: { email: true } } },
    });

    if (classId) {
      await tx.classStudent.create({
        data: { classId, studentId: created.id },
      });
    }

    return created;
  });

  return Response.json({ student }, { status: 201 });
}
