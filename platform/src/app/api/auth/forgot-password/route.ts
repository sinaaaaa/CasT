import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const result = await requestPasswordReset(parsed.data.email);

    if (result.reason === "placeholder") {
      return Response.json(
        {
          error:
            "This account uses a game-only email. Ask your teacher or admin to add your real email, or use admin password reset.",
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      message: "If an account exists for that email, we sent reset instructions.",
      ...(process.env.NODE_ENV === "development" && result.devLink
        ? { devResetLink: result.devLink }
        : {}),
    });
  } catch (error) {
    console.error("[forgot-password]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send reset email. Check RESEND_API_KEY and EMAIL_FROM.",
      },
      { status: 500 }
    );
  }
}
