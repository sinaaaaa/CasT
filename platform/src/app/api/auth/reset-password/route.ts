import { z } from "zod";
import { completePasswordReset } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    await completePasswordReset(parsed.data.token, parsed.data.password);
    return Response.json({ ok: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 400 }
    );
  }
}
