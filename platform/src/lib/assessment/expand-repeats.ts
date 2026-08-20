/**
 * Expand Scratch-style repeat tokens in a program sequence.
 * Tokens: "repeat:N" / "repeat-start:N", body motions, "repeat-end".
 * Nested repeats are skipped (not supported).
 */

const MOTION = new Set(["forward", "backward", "turn left", "turn right", "left", "right"]);

export function normalizeMotionToken(raw: string): string | null {
  const t = raw
    .replace(/^\[a\d+\]\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (t === "left" || t === "rotate left") return "turn left";
  if (t === "right" || t === "rotate right") return "turn right";
  if (MOTION.has(t)) return t === "left" ? "turn left" : t === "right" ? "turn right" : t;
  return null;
}

export function parseRepeatStart(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/_/g, "-");
  if (t === "repeat" || t === "repeat-start") return 1;
  const m = t.match(/^repeat(?:-start)?:(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(9, Math.floor(n)));
}

export function isRepeatEnd(token: string): boolean {
  const t = token.trim().toLowerCase().replace(/_/g, "-");
  return t === "repeat-end" || t === "end-repeat";
}

export function formatRepeatStart(count: number): string {
  const n = Math.max(1, Math.min(9, Math.floor(count) || 1));
  return `repeat:${n}`;
}

/** Expand repeats; output is flat motion tokens (forward/backward/turn left/turn right). */
export function expandRepeatTokens(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const count = parseRepeatStart(tokens[i]);
    if (count != null) {
      i++;
      const body: string[] = [];
      while (i < tokens.length && !isRepeatEnd(tokens[i])) {
        const nested = parseRepeatStart(tokens[i]);
        if (nested != null) {
          i++;
          while (i < tokens.length && !isRepeatEnd(tokens[i])) i++;
          if (i < tokens.length) i++;
          continue;
        }
        const motion = normalizeMotionToken(tokens[i]);
        if (motion) body.push(motion);
        i++;
      }
      if (i < tokens.length && isRepeatEnd(tokens[i])) i++;
      for (let r = 0; r < count; r++) out.push(...body);
      continue;
    }
    if (isRepeatEnd(tokens[i])) {
      i++;
      continue;
    }
    const motion = normalizeMotionToken(tokens[i]);
    if (motion) out.push(motion);
    i++;
  }
  return out;
}

export function programsExpandedEqual(a: string[], b: string[]): boolean {
  const ea = expandRepeatTokens(a);
  const eb = expandRepeatTokens(b);
  // Both expand to nothing: only treat as equal when both inputs were truly empty.
  // Prevents false matches like count:3 vs "Level Completed" (both expand to []).
  if (ea.length === 0 && eb.length === 0) {
    const aHas = (a ?? []).some((t) => Boolean(t?.trim()));
    const bHas = (b ?? []).some((t) => Boolean(t?.trim()));
    return !aHas && !bHas;
  }
  if (ea.length !== eb.length) return false;
  for (let i = 0; i < ea.length; i++) {
    if (ea[i] !== eb[i]) return false;
  }
  return true;
}

/** True if student matches any accepted program (exact nested OR same expanded sequence). */
export function matchesAnyCorrectProgram(
  studentTokens: string[],
  correctPrograms: string[][] | undefined
): boolean {
  if (!correctPrograms?.length) return false;
  for (const prog of correctPrograms) {
    if (!prog?.length) continue;
    if (programsExpandedEqual(studentTokens, prog)) return true;
  }
  return false;
}

function sameMotionList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Detect repeating chunks and suggest accepted-program variants:
 * flat expanded + `repeat:N … repeat-end` forms.
 * Example: [F,R,F,R] → also [repeat:2, F, R, repeat-end].
 */
export function suggestProgramVariants(tokens: string[]): string[][] {
  const expanded = expandRepeatTokens(tokens)
    .map((t) => normalizeMotionToken(t) ?? t)
    .filter(Boolean);
  const variants: string[][] = [];
  const seen = new Set<string>();

  const pushUnique = (prog: string[]) => {
    if (!prog.length) return;
    const key = prog.join("|");
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(prog);
  };

  if (expanded.length > 0) pushUnique(expanded);

  for (let k = 1; k <= Math.floor(expanded.length / 2); k++) {
    if (expanded.length % k !== 0) continue;
    const times = expanded.length / k;
    if (times < 2) continue;
    const chunk = expanded.slice(0, k);
    let tiles = true;
    for (let t = 1; t < times; t++) {
      if (!sameMotionList(chunk, expanded.slice(t * k, t * k + k))) {
        tiles = false;
        break;
      }
    }
    if (tiles) {
      pushUnique([formatRepeatStart(times), ...chunk, "repeat-end"]);
    }
  }

  const hasRepeat = tokens.some((t) => parseRepeatStart(t) != null || isRepeatEnd(t));
  if (hasRepeat) {
    const nested = tokens
      .map((t) => {
        const c = parseRepeatStart(t);
        if (c != null) return formatRepeatStart(c);
        if (isRepeatEnd(t)) return "repeat-end";
        return normalizeMotionToken(t) ?? t.trim().toLowerCase();
      })
      .filter(Boolean);
    pushUnique(nested);
  }

  return variants;
}

/** Merge authored programs with smart Repeat ↔ expanded variants. */
export function enrichCorrectProgramsWithVariants(
  programs: string[][] | undefined
): string[][] {
  if (!programs?.length) return [];
  const out: string[][] = [];
  const seen = new Set<string>();
  for (const prog of programs) {
    for (const variant of suggestProgramVariants(prog)) {
      const key = variant.join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(variant);
    }
  }
  return out;
}
