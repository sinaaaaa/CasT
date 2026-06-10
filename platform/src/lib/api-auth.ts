import { getServerSession } from "next-auth";
import { authOptions, isAdminRole, isTeacherRole } from "@/lib/auth";
import { resolveTeacherScope, type TeacherScope } from "@/lib/class-access";
import { UserRole } from "@prisma/client";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireTeacher() {
  const { error, session } = await requireSession();
  if (error) return { error, session: null, scope: null };
  if (!isTeacherRole(session!.user.role)) {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      scope: null,
    };
  }
  const scope = await resolveTeacherScope(session!.user);
  return { error: null, session: session!, scope };
}

export async function requireStudent() {
  const { error, session } = await requireSession();
  if (error) return { error, session: null };
  if (session!.user.role !== UserRole.STUDENT) {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session: session! };
}

export async function requireAdmin() {
  const { error, session } = await requireSession();
  if (error) return { error, session: null };
  if (!isAdminRole(session!.user.role)) {
    return {
      error: Response.json({ error: "Forbidden — admin only" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session: session! };
}
