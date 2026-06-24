import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTeacher } from "@/lib/api-auth";
import { planStudentRange } from "@/lib/student-id-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const querySchema = z.object({
  from: z.coerce.number().int().min(1).max(999999),
  to: z.coerce.number().int().min(1).max(999999),
  namePrefix: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
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

    const plan = await planStudentRange(parsed.data.from, parsed.data.to, namePrefix);
    if (!plan.ok) {
      return Response.json(
        { error: plan.message, conflicts: plan.conflicts },
        { status: 409 }
      );
    }

    return Response.json({
      count: plan.count,
      from: plan.from,
      to: plan.to,
      namePrefix,
    });
  } catch (e) {
    console.error("[suggest-id]", e);
    return Response.json({ error: "Could not validate student range." }, { status: 500 });
  }
}
