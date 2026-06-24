import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTeacher } from "@/lib/api-auth";
import { findAvailableStudentSlotInRange } from "@/lib/student-id-utils";

const querySchema = z.object({
  from: z.coerce.number().int().min(1).max(999999),
  to: z.coerce.number().int().min(1).max(999999),
  namePrefix: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const { error } = await requireTeacher();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    namePrefix: searchParams.get("namePrefix") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Provide numeric from and to (max span 2000)." },
      { status: 400 }
    );
  }

  const namePrefix = parsed.data.namePrefix?.trim();
  if (!namePrefix) {
    return Response.json({ error: "Name prefix is required for generation." }, { status: 400 });
  }

  const slot = await findAvailableStudentSlotInRange(
    parsed.data.from,
    parsed.data.to,
    namePrefix
  );
  if (!slot) {
    return Response.json(
      { error: "No available names or IDs in that range. Try a different range." },
      { status: 404 }
    );
  }

  return Response.json(slot);
}
