import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import {
  createStudentAccount,
  createTeacherAccount,
  listAdminUsers,
} from "@/lib/user-admin";

export const dynamic = "force-dynamic";

const createTeacherSchema = z.object({
  role: z.enum(["TEACHER", "ADMIN"]).default("TEACHER"),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120),
});

const createStudentSchema = z.object({
  displayName: z.string().max(120).optional(),
  externalId: z.string().min(1).max(64),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const roleParam = request.nextUrl.searchParams.get("role");
  const role =
    roleParam === "TEACHER" || roleParam === "STUDENT" || roleParam === "ADMIN"
      ? (roleParam as UserRole)
      : undefined;

  const users = await listAdminUsers(role);
  return Response.json(
    { users },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const kind = body?.kind as string;

  try {
    if (kind === "teacher") {
      const parsed = createTeacherSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const user = await createTeacherAccount({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        role: parsed.data.role === "ADMIN" ? UserRole.ADMIN : UserRole.TEACHER,
      });
      return Response.json({ user }, { status: 201 });
    }

    if (kind === "student") {
      const parsed = createStudentSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const student = await createStudentAccount(parsed.data);
      return Response.json({ student }, { status: 201 });
    }

    return Response.json({ error: "kind must be teacher or student" }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
