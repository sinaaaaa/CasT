import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import {
  createAdminClass,
  listAdminClasses,
  listAdminStudentOptions,
  listAdminTeacherOptions,
} from "@/lib/class-admin";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(64).optional(),
  description: z.string().max(500).optional(),
  teacherProfileIds: z.array(z.string()).optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [classes, teachers, students] = await Promise.all([
    listAdminClasses(),
    listAdminTeacherOptions(),
    listAdminStudentOptions(),
  ]);

  return Response.json(
    { classes, teachers, students },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cls = await createAdminClass(parsed.data);
    return Response.json({ class: cls }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
