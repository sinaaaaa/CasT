import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { hashPassword, validatePassword } from "@/lib/password";
import { isPlaceholderLoginEmail } from "@/lib/user-admin";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export { isPlaceholderLoginEmail };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resetBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function requestPasswordReset(email: string): Promise<{
  sent: boolean;
  reason?: "placeholder" | "inactive" | "missing";
  devLink?: string;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { sent: false, reason: "missing" };

  if (isPlaceholderLoginEmail(normalized)) {
    return { sent: false, reason: "placeholder" };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.isActive) {
    // Do not reveal whether the account exists
    return { sent: true };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${resetBaseUrl()}/reset-password?token=${token}`;
  const result = await sendEmail({
    to: normalized,
    subject: "Reset your SPARC password",
    html: `
      <p>Hello,</p>
      <p>We received a request to reset your SPARC Assessment password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
    text: `Reset your SPARC password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });

  return { sent: true, devLink: result.devLink };
}

export async function completePasswordReset(token: string, password: string): Promise<void> {
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const tokenHash = hashToken(token.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new Error("This reset link is invalid or has expired.");
  }
  if (!record.user.isActive) {
    throw new Error("This account is inactive.");
  }

  const hashed = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}
