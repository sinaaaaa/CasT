/**
 * Canvas pattern match helpers — safe for server and client.
 */

import { programsExpandedEqual } from "@/lib/assessment/expand-repeats";

export type CanvasPatternMatchPayload = {
  studentTokens: string[];
  acceptedPrograms: string[][];
  matched: boolean;
  matchedProgramIndex: number | null;
};

export function buildCanvasPatternMatch(input: {
  studentTokens: string[];
  acceptedPrograms: string[][];
}): CanvasPatternMatchPayload {
  const studentTokens = input.studentTokens.filter(Boolean);
  const acceptedPrograms = input.acceptedPrograms.filter((p) => p?.length);
  let matchedProgramIndex: number | null = null;
  for (let i = 0; i < acceptedPrograms.length; i++) {
    if (programsExpandedEqual(studentTokens, acceptedPrograms[i])) {
      matchedProgramIndex = i;
      break;
    }
  }
  return {
    studentTokens,
    acceptedPrograms,
    matched: matchedProgramIndex != null,
    matchedProgramIndex,
  };
}
