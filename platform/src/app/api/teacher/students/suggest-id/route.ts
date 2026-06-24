import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTeacher } from "@/lib/api-auth";
import { findAvailableStudentIdInRange } from "@/lib/student-id-utils";

const querySchema = z.object({
  from: z.coerce.number().int().min(1).max(999999),
  to: z.coerce.number().int().min(1).max(999999),
});

export async function GET(request: NextRequest) {
  const { error } = await requireTeacher();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Provide numeric from and to (max range 500)." },
      { status: 400 }
    );
  }

  const externalId = await findAvailableStudentIdInRange(parsed.data.from, parsed.data.to);
  if (!externalId) {
    return Response.json(
      { error: "No available student IDs in that range." },
      { status: 404 }
    );
  }

  return Response.json({ externalId });
}
