import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { setClassStudents } from "@/lib/class-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  studentProfileIds: z.array(z.string()),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cls = await setClassStudents(id, parsed.data.studentProfileIds);
    return Response.json({ class: cls });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
