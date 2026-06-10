import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const STUDENT_SESSION_COOKIE = "sparc_student_session";
const SESSION_DAYS = 30;

export type StudentSessionPayload = {
  sessionId: string;
  studentProfileId: string;
  studentCode: string;
  displayName: string;
  expiresAt: Date;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createStudentSession(
  studentProfileId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.studentSession.create({
    data: {
      studentId: studentProfileId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function resolveStudentSessionFromToken(
  token: string | undefined | null
): Promise<StudentSessionPayload | null> {
  if (!token?.trim()) return null;

  const row = await prisma.studentSession.findUnique({
    where: { tokenHash: hashToken(token.trim()) },
    include: {
      student: {
        include: {
          user: { select: { isActive: true } },
        },
      },
    },
  });

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.studentSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (row.student.isArchived || !row.student.user.isActive) return null;

  return {
    sessionId: row.id,
    studentProfileId: row.studentId,
    studentCode: row.student.externalId ?? row.studentId,
    displayName: row.student.displayName,
    expiresAt: row.expiresAt,
  };
}

export async function getStudentSessionFromCookies(): Promise<StudentSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  return resolveStudentSessionFromToken(token);
}

export async function getStudentSessionFromRequest(
  request: NextRequest
): Promise<StudentSessionPayload | null> {
  const cookieToken = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  const headerToken = request.headers.get("x-student-session");
  return resolveStudentSessionFromToken(headerToken ?? cookieToken);
}

export async function revokeStudentSession(token: string | undefined | null) {
  if (!token?.trim()) return;
  await prisma.studentSession
    .deleteMany({ where: { tokenHash: hashToken(token.trim()) } })
    .catch(() => {});
}

export type StudentGameConfig = {
  studentId: string;
  studentCode: string;
  sessionToken: string;
  apiBaseUrl: string;
  gameApiKey: string;
};

export function buildStudentGameConfig(
  session: StudentSessionPayload,
  sessionToken: string
): StudentGameConfig {
  const apiBaseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    studentId: session.studentProfileId,
    studentCode: session.studentCode,
    sessionToken,
    apiBaseUrl,
    gameApiKey: process.env.GAME_API_KEY ?? "",
  };
}
