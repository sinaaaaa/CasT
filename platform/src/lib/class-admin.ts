import { prisma } from "@/lib/prisma";
import { generateUniqueClassCode } from "@/lib/class-utils";

export type AdminClassRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: Date;
  studentCount: number;
  teacherCount: number;
  teachers: { id: string; displayName: string; email: string }[];
  students: { id: string; displayName: string; externalId: string | null; email: string }[];
};

export type AdminClassTeacherOption = {
  id: string;
  displayName: string;
  email: string;
  role: string;
};

export type AdminClassStudentOption = {
  id: string;
  displayName: string;
  externalId: string | null;
  email: string;
};

export async function listAdminClasses(): Promise<AdminClassRow[]> {
  const classes = await prisma.class.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { students: true, teachers: true } },
      teachers: {
        include: {
          teacher: {
            include: { user: { select: { email: true, role: true } } },
          },
        },
      },
      students: {
        include: {
          student: {
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description,
    createdAt: c.createdAt,
    studentCount: c._count.students,
    teacherCount: c._count.teachers,
    teachers: c.teachers.map((t) => ({
      id: t.teacher.id,
      displayName: t.teacher.displayName,
      email: t.teacher.user.email,
    })),
    students: c.students.map((m) => ({
      id: m.student.id,
      displayName: m.student.displayName,
      externalId: m.student.externalId,
      email: m.student.user.email,
    })),
  }));
}

export async function listAdminTeacherOptions(): Promise<AdminClassTeacherOption[]> {
  const teachers = await prisma.teacherProfile.findMany({
    include: { user: { select: { email: true, role: true, isActive: true } } },
    orderBy: { displayName: "asc" },
  });

  return teachers
    .filter((t) => t.user.isActive)
    .map((t) => ({
      id: t.id,
      displayName: t.displayName,
      email: t.user.email,
      role: t.user.role,
    }));
}

export async function listAdminStudentOptions(): Promise<AdminClassStudentOption[]> {
  const students = await prisma.studentProfile.findMany({
    where: { isArchived: false },
    include: { user: { select: { email: true } } },
    orderBy: { displayName: "asc" },
  });

  return students.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    externalId: s.externalId,
    email: s.user.email,
  }));
}

export async function createAdminClass(input: {
  name: string;
  code?: string;
  description?: string;
  teacherProfileIds?: string[];
}) {
  const code =
    input.code?.trim().toUpperCase() ?? (await generateUniqueClassCode(input.name));

  const existingCode = await prisma.class.findUnique({ where: { code } });
  if (existingCode) throw new Error("Class code already in use.");

  return prisma.class.create({
    data: {
      name: input.name.trim(),
      code,
      description: input.description?.trim() || null,
      ...(input.teacherProfileIds?.length
        ? {
            teachers: {
              create: input.teacherProfileIds.map((teacherId) => ({ teacherId })),
            },
          }
        : {}),
    },
  });
}

export async function updateAdminClass(
  classId: string,
  input: { name?: string; code?: string; description?: string | null }
) {
  const existing = await prisma.class.findUnique({ where: { id: classId } });
  if (!existing) throw new Error("Class not found.");

  if (input.code) {
    const code = input.code.trim().toUpperCase();
    const clash = await prisma.class.findFirst({
      where: { code, NOT: { id: classId } },
    });
    if (clash) throw new Error("Class code already in use.");
  }

  return prisma.class.update({
    where: { id: classId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
  });
}

export async function setClassTeachers(classId: string, teacherProfileIds: string[]) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found.");

  const validTeachers = await prisma.teacherProfile.findMany({
    where: { id: { in: teacherProfileIds } },
    select: { id: true },
  });
  const validIds = new Set(validTeachers.map((t) => t.id));

  return prisma.$transaction(async (tx) => {
    await tx.classTeacher.deleteMany({ where: { classId } });
    if (validIds.size > 0) {
      await tx.classTeacher.createMany({
        data: [...validIds].map((teacherId) => ({ classId, teacherId })),
      });
    }
    return tx.class.findUnique({
      where: { id: classId },
      include: {
        teachers: {
          include: { teacher: { include: { user: { select: { email: true } } } } },
        },
      },
    });
  });
}

export async function setClassStudents(classId: string, studentProfileIds: string[]) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found.");

  const validStudents = await prisma.studentProfile.findMany({
    where: { id: { in: studentProfileIds }, isArchived: false },
    select: { id: true },
  });
  const validIds = new Set(validStudents.map((s) => s.id));

  return prisma.$transaction(async (tx) => {
    await tx.classStudent.deleteMany({ where: { classId } });
    if (validIds.size > 0) {
      await tx.classStudent.createMany({
        data: [...validIds].map((studentId) => ({ classId, studentId })),
      });
    }
    return tx.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            student: { include: { user: { select: { email: true } } } },
          },
        },
      },
    });
  });
}

export async function deleteAdminClass(classId: string) {
  const existing = await prisma.class.findUnique({
    where: { id: classId },
    include: { _count: { select: { students: true } } },
  });
  if (!existing) throw new Error("Class not found.");
  await prisma.class.delete({ where: { id: classId } });
  return existing;
}
