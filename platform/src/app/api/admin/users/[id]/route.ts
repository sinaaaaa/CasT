import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { updateAdminUser } from "@/lib/user-admin";

const patchSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  displayName: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  externalId: z.string().min(1).max(64).optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (id === session!.user.id && parsed.data.isActive === false) {
    return Response.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  try {
    const user = await updateAdminUser(id, parsed.data);
    return Response.json({ user });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
