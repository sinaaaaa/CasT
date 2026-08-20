/**
 * Canvas strip assessment — pattern programs, blanks, seed, and count-answer modes.
 * Safe for server and client.
 */

import { programsExpandedEqual } from "@/lib/assessment/expand-repeats";
import {
  isCountAnswerStrip,
  parseCountAnswerToken,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { isRecordedProgramString } from "@/lib/assessment/resolve-program";

export type CanvasStripKind = "pattern" | "count" | "blanks" | "seed" | "empty";

export type CanvasPatternMatchPayload = {
  stripKind: CanvasStripKind;
  studentTokens: string[];
  acceptedPrograms: string[][];
  matched: boolean;
  matchedProgramIndex: number | null;
  /** COUNT_ANSWER: parsed student number (null if missing / placeholder). */
  studentCount: number | null;
  /** COUNT_ANSWER: expected number. */
  expectedCount: number | null;
  /** True when finalCommand was a Unity placeholder, not a real strip answer. */
  answerMissing: boolean;
  /** Short teacher-facing explanation of the comparison. */
  explanation: string;
};

function resolveStripKind(config?: LevelGameplayConfig | null): CanvasStripKind {
  if (!config?.canvasLesson) return "pattern";
  const mode = (config.canvasLesson.stripMode ?? "EMPTY").toUpperCase();
  if (mode === "COUNT_ANSWER") return "count";
  if (mode === "BLANKS") return "blanks";
  if (mode === "SEED_PROGRAM") return "seed";
  if (mode === "EMPTY") return "empty";
  return "pattern";
}

function expectedCountFromConfig(config?: LevelGameplayConfig | null): number | null {
  if (!config?.canvasLesson) return null;
  if (typeof config.canvasLesson.correctCount === "number") {
    return config.canvasLesson.correctCount;
  }
  const programs = config.assessment?.correctPrograms ?? [];
  for (const prog of programs) {
    for (const tok of prog) {
      const n = parseCountAnswerToken(tok);
      if (n != null) return n;
    }
  }
  return null;
}

function parseStudentCount(tokens: string[]): number | null {
  if (tokens.length !== 1) {
    // Allow "count:3" mixed with noise only if one count token exists
    const counts = tokens
      .map((t) => parseCountAnswerToken(t))
      .filter((n): n is number => n != null);
    return counts.length === 1 ? counts[0]! : null;
  }
  return parseCountAnswerToken(tokens[0]!);
}

function isPlaceholderTokenList(tokens: string[]): boolean {
  if (!tokens.length) return true;
  const joined = tokens.join("; ");
  return !isRecordedProgramString(joined);
}

/**
 * Compare student strip to accepted answers.
 * COUNT_ANSWER uses numeric equality; pattern modes use Repeat-aware expansion.
 * Empty expansions of non-empty non-motion tokens (e.g. count:3 vs "Level Completed")
 * must never count as a match.
 */
export function buildCanvasPatternMatch(input: {
  studentTokens: string[];
  acceptedPrograms: string[][];
  levelConfig?: LevelGameplayConfig | null;
}): CanvasPatternMatchPayload {
  const studentTokens = input.studentTokens.filter(Boolean);
  const acceptedPrograms = input.acceptedPrograms.filter((p) => p?.length);
  const stripKind = resolveStripKind(input.levelConfig);
  const answerMissing = isPlaceholderTokenList(studentTokens);
  const expectedCount = expectedCountFromConfig(input.levelConfig);

  if (stripKind === "count" || isCountAnswerStrip(input.levelConfig)) {
    const studentCount = answerMissing ? null : parseStudentCount(studentTokens);
    const expected = expectedCount ?? 0;
    const matched =
      studentCount != null && expected != null && studentCount === expected;

    let explanation: string;
    if (answerMissing) {
      explanation =
        "The student’s numeric answer was not recorded for this attempt (Unity reported a completion placeholder instead of count:N). Treat the stored Incorrect status as authoritative.";
    } else if (studentCount == null) {
      explanation =
        "Could not read a count answer from the student strip. Expected a single count:N token.";
    } else if (matched) {
      explanation = `Student counted ${studentCount}. That matches the expected count of ${expected}.`;
    } else {
      explanation = `Student counted ${studentCount}, but the expected count is ${expected}. Counting pattern elements is a foundational CT skill (abstraction of quantity).`;
    }

    return {
      stripKind: "count",
      studentTokens,
      acceptedPrograms:
        acceptedPrograms.length > 0
          ? acceptedPrograms
          : expected != null
            ? [[`count:${expected}`]]
            : [],
      matched,
      matchedProgramIndex: matched ? 0 : null,
      studentCount,
      expectedCount: expected,
      answerMissing,
      explanation,
    };
  }

  // Pattern / blanks / seed / empty — motion programs with Repeat equivalence
  let matchedProgramIndex: number | null = null;
  if (!answerMissing) {
    for (let i = 0; i < acceptedPrograms.length; i++) {
      if (programsExpandedEqual(studentTokens, acceptedPrograms[i])) {
        matchedProgramIndex = i;
        break;
      }
    }
  }

  const matched = matchedProgramIndex != null;
  let explanation: string;
  if (answerMissing) {
    explanation =
      "No usable student program was recorded for this attempt, so it cannot match an accepted pattern.";
  } else if (matched) {
    explanation = `Student program matches accepted answer ${(matchedProgramIndex ?? 0) + 1} (exact Repeat form or same expanded motions).`;
  } else if (acceptedPrograms.length === 0) {
    explanation = "No accepted programs are configured on this canvas item.";
  } else {
    explanation =
      stripKind === "blanks"
        ? "The filled blank slots do not match an accepted program. Check order and which arrows were placed."
        : "The yellow-strip program does not match any accepted answer (including Repeat vs expanded equivalents).";
  }

  return {
    stripKind,
    studentTokens,
    acceptedPrograms,
    matched,
    matchedProgramIndex,
    studentCount: null,
    expectedCount: null,
    answerMissing,
    explanation,
  };
}
