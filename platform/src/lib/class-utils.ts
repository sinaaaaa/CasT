import { prisma } from "@/lib/prisma";

/** Build a unique class code from the display name (e.g. "Period 3" → "PERIOD-3-A1B2"). */
export async function generateUniqueClassCode(name: string): Promise<string> {
  const base =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "CLASS";

  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${base}-${suffix}`;
    const exists = await prisma.class.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }

  return `${base}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
