/**
 * Command icon paths for dashboard (served from /public/command-icons).
 * Update paths here if you replace artwork.
 */

export type CommandToken = "forward" | "backward" | "turn left" | "turn right";

export const COMMAND_ICON_PATHS: Record<CommandToken, string> = {
  forward: "/command-icons/forward.png",
  backward: "/command-icons/backward.png",
  "turn left": "/command-icons/turn-left.png",
  "turn right": "/command-icons/turn-right.png",
};

export const COMMAND_ARIA_LABELS: Record<CommandToken, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn left",
  "turn right": "Turn right",
};

/** Normalize raw command strings from Unity / DB. */
export function normalizeCommandToken(raw: string): CommandToken | null {
  const c = raw
    .replace(/^\[a\d+\]\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (c === "forward" || c === "backward" || c === "turn left" || c === "turn right") {
    return c;
  }
  return null;
}

export function parseCommandSequence(raw: string | null | undefined): CommandToken[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[;,]/)
    .map((s) => normalizeCommandToken(s))
    .filter((c): c is CommandToken => c != null);
}
