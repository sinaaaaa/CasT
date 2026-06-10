import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeExternalStudentId } from "@/lib/game-service";
import { hashPassword, validatePassword } from "@/lib/password";

export type AdminAccountSource = "unity" | "admin" | "teacher";

export type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  displayName: string;
  profileId: string | null;
  externalId: string | null;
  isArchived: boolean;
  accountSource: AdminAccountSource;
  isPlaceholderEmail: boolean;
  isPlaceholderName: boolean;
};

function classifyAdminUser(u: {
  email: string;
  role: UserRole;
  studentProfile: { displayName: string; externalId: string | null } | null;
}): Pick<AdminUserRow, "accountSource" | "isPlaceholderEmail" | "isPlaceholderName"> {
  const email = u.email.toLowerCase();
  const isPlaceholderEmail =
    email.endsWith("@game.sparc.local") || email.endsWith("@sparc.local");

  let isPlaceholderName = false;
  if (u.studentProfile) {
    const name = u.studentProfile.displayName.trim();
    const id = u.studentProfile.externalId;
    if (id) {
      const bare = id.replace(/^STU-/i, "");
      isPlaceholderName =
        !name ||
        name === `Student ${bare}` ||
        name === `Student ${id}` ||
        /^Student\s+\d+$/i.test(name);
    } else {
      isPlaceholderName = !name;
    }
  }

  let accountSource: AdminAccountSource = "teacher";
  if (u.role === UserRole.STUDENT) {
    accountSource = email.endsWith("@game.sparc.local") ? "unity" : "admin";
  }

  return { accountSource, isPlaceholderEmail, isPlaceholderName };
}

export function isPlaceholderLoginEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@game.sparc.local") || normalized.endsWith("@sparc.local");
}

type UserWithProfiles = Awaited<
  ReturnType<
    typeof prisma.user.findMany<{
      include: { studentProfile: true; teacherProfile: true };
    }>
  >
>[number];

type StudentWithUser = Awaited<
  ReturnType<
    typeof prisma.studentProfile.findMany<{
      include: { user: true };
    }>
  >
>[number];

function mapUserRow(u: UserWithProfiles): AdminUserRow {
  const classified = classifyAdminUser({
    email: u.email,
    role: u.role,
    studentProfile: u.studentProfile,
  });

  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    displayName:
      u.studentProfile?.displayName ??
      u.teacherProfile?.displayName ??
      u.email,
    profileId: u.studentProfile?.id ?? u.teacherProfile?.id ?? null,
    externalId: u.studentProfile?.externalId ?? null,
    isArchived: u.studentProfile?.isArchived ?? false,
    ...classified,
  };
}

function mapStudentProfileRow(sp: StudentWithUser): AdminUserRow {
  const classified = classifyAdminUser({
    email: sp.user.email,
    role: sp.user.role,
    studentProfile: sp,
  });

  return {
    id: sp.user.id,
    email: sp.user.email,
    role: sp.user.role,
    isActive: sp.user.isActive,
    createdAt: sp.createdAt,
    displayName: sp.displayName,
    profileId: sp.id,
    externalId: sp.externalId,
    isArchived: sp.isArchived,
    ...classified,
  };
}

export async function listAdminUsers(roleFilter?: UserRole): Promise<AdminUserRow[]> {
  if (roleFilter === UserRole.STUDENT) {
    const students = await prisma.studentProfile.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return students.map(mapStudentProfileRow);
  }

  if (roleFilter === UserRole.TEACHER || roleFilter === UserRole.ADMIN) {
    const users = await prisma.user.findMany({
      where: { role: roleFilter },
      include: { studentProfile: true, teacherProfile: true },
      orderBy: { createdAt: "desc" },
    });
    return users.map(mapUserRow);
  }

  const [staff, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [UserRole.TEACHER, UserRole.ADMIN] } },
      include: { studentProfile: true, teacherProfile: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentProfile.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [...staff.map(mapUserRow), ...students.map(mapStudentProfileRow)];
}

export async function createTeacherAccount(input: {
  email: string;
  password: string;
  displayName: string;
  role?: "TEACHER" | "ADMIN";
}) {
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use.");

  const role = input.role ?? "TEACHER";
  if (role !== "TEACHER" && role !== "ADMIN") {
    throw new Error("Invalid role for teacher account.");
  }

  const hashed = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email,
      password: hashed,
      role: role === "ADMIN" ? UserRole.ADMIN : UserRole.TEACHER,
      teacherProfile: {
        create: { displayName: input.displayName.trim() },
      },
    },
    include: { teacherProfile: true },
  });
}

export async function createStudentAccount(input: {
  displayName?: string;
  externalId: string;
  email?: string;
  password: string;
}) {
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);

  const externalId = normalizeExternalStudentId(input.externalId);
  const email =
    input.email?.trim().toLowerCase() ??
    `${externalId.toLowerCase().replace(/[^a-z0-9]/g, "")}@sparc.local`;

  const existing = await prisma.studentProfile.findFirst({
    where: { OR: [{ externalId }, { user: { email } }] },
  });
  if (existing) throw new Error("Student ID or email already exists.");

  const displayName =
    input.displayName?.trim() || `Student ${externalId.replace(/^STU-/i, "")}`;

  const hashed = await hashPassword(input.password);
  return prisma.studentProfile.create({
    data: {
      displayName,
      externalId,
      user: {
        create: {
          email,
          password: hashed,
          role: UserRole.STUDENT,
        },
      },
    },
    include: { user: { select: { email: true, id: true, isActive: true } } },
  });
}

export async function updateAdminUser(
  userId: string,
  input: {
    email?: string;
    password?: string;
    displayName?: string;
    isActive?: boolean;
    externalId?: string;
    isArchived?: boolean;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true, teacherProfile: true },
  });
  if (!user) throw new Error("User not found.");

  if (input.password) {
    const passwordError = validatePassword(input.password);
    if (passwordError) throw new Error(passwordError);
  }

  if (input.email) {
    const email = input.email.trim().toLowerCase();
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (taken) throw new Error("Email already in use.");
  }

  if (input.externalId && user.studentProfile) {
    const externalId = normalizeExternalStudentId(input.externalId);
    const taken = await prisma.studentProfile.findFirst({
      where: { externalId, NOT: { id: user.studentProfile.id } },
    });
    if (taken) throw new Error("Student ID already in use.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.password ? { password: await hashPassword(input.password) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (user.teacherProfile && input.displayName) {
      await tx.teacherProfile.update({
        where: { id: user.teacherProfile.id },
        data: { displayName: input.displayName.trim() },
      });
    }

    if (user.studentProfile) {
      await tx.studentProfile.update({
        where: { id: user.studentProfile.id },
        data: {
          ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
          ...(input.externalId
            ? { externalId: normalizeExternalStudentId(input.externalId) }
            : {}),
          ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
        },
      });
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, teacherProfile: true },
    });
  });
}
