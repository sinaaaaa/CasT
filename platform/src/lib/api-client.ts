import { displayNameFromPrefix, studentIdFromNumber } from "@/lib/student-id-utils";

export type StudentSlotPreview = {
  displayName: string;
  externalId: string;
  number: number;
};

/** Build preview rows client-side so the API does not return huge JSON arrays. */
export function buildStudentSlotPreviews(
  from: number,
  to: number,
  namePrefix: string
): { head: StudentSlotPreview[]; tail: StudentSlotPreview[]; count: number } {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const count = hi - lo + 1;
  const prefix = namePrefix.trim();

  const head: StudentSlotPreview[] = [];
  for (let n = lo; n <= hi && head.length < 4; n++) {
    head.push({
      number: n,
      externalId: studentIdFromNumber(n),
      displayName: displayNameFromPrefix(prefix, n),
    });
  }

  const tail: StudentSlotPreview[] = [];
  if (count > 6) {
    for (let n = Math.max(hi - 1, lo); n <= hi; n++) {
      tail.push({
        number: n,
        externalId: studentIdFromNumber(n),
        displayName: displayNameFromPrefix(prefix, n),
      });
    }
  }

  return { head, tail, count };
}

export async function readApiJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(
        res.status === 504
          ? "Server timed out — try a smaller range."
          : `Request failed (${res.status}).`
      );
    }
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid response from server."
        : `Request failed (${res.status}). Try a smaller range.`
    );
  }
}

export function parseApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const formErrors = (record.error as { formErrors?: string[] }).formErrors;
    if (formErrors?.length) return formErrors.join(" ");
  }
  return fallback;
}
