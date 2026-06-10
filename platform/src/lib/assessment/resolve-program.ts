/**
 * Resolve the command program used for route simulation (all level types including edit-starter).
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { CommandAction } from "@prisma/client";
import { normalizeCommandToken, type CommandToken } from "@/lib/command-icons";

export function expandGuidedActions(
  guided: string[],
  blanks?: LevelGameplayConfig["blanks"],
  resolvedBlanks?: string[]
): CommandToken[] {
  const out: CommandToken[] = [];
  let blankIdx = 0;
  for (const step of guided) {
    if (step === "blank") {
      const answer = resolvedBlanks?.[blankIdx] ?? blanks?.[blankIdx]?.correctAnswer;
      blankIdx++;
      const tok = answer ? normalizeCommandToken(answer) : null;
      if (tok) out.push(tok);
    } else {
      const tok = normalizeCommandToken(step);
      if (tok) out.push(tok);
    }
  }
  return out;
}

function parseCommandString(raw: string): CommandToken[] {
  return raw
    .split(/[;,]/)
    .map((s) => normalizeCommandToken(s.trim()))
    .filter((c): c is CommandToken => c != null);
}

/** Unity may send placeholder text when no RUN was captured. */
function isRecordedProgramString(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const lower = raw.trim().toLowerCase();
  if (
    lower === "level completed" ||
    lower === "level complete" ||
    lower === "completed" ||
    lower === "n/a"
  ) {
    return false;
  }
  return parseCommandString(raw).length > 0;
}

function isSubmittedAction(action: string): boolean {
  const a = action.toLowerCase();
  return a === "submitted" || a === CommandAction.SUBMITTED.toLowerCase();
}

/** Prefer the longest submitted program (full RUN), not the last single-command event. */
export function parseLastSubmittedProgramFromHistory(history: unknown): CommandToken[] {
  if (!Array.isArray(history)) return [];
  let best: CommandToken[] = [];
  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const action = String(o.action ?? "");
    if (!isSubmittedAction(action)) continue;
    if (typeof o.command !== "string" || !o.command.trim()) continue;
    const parsed = parseCommandString(o.command.trim());
    if (parsed.length > best.length) best = parsed;
  }
  return best;
}

/** Longest submitted command string from platform command events. */
export function parseBestSubmittedProgramFromEvents(
  events: { command: string; action: string }[] | undefined
): CommandToken[] {
  if (!events?.length) return [];
  let best: CommandToken[] = [];
  for (const e of events) {
    if (!isSubmittedAction(e.action)) continue;
    const parsed = parseCommandString(e.command);
    if (parsed.length > best.length) best = parsed;
  }
  return best;
}

export function isEditableProgramLevelType(levelType?: LevelType): boolean {
  return (
    levelType === LevelType.DRAG_EDIT_PROGRAM || levelType === LevelType.DRAG_ACTIONS
  );
}

/** Starter program shown at level load (before student edits). */
export function resolveStarterProgram(params: {
  initialCommand?: string | null;
  levelConfig: LevelGameplayConfig;
}): CommandToken[] {
  const { initialCommand, levelConfig } = params;
  if (initialCommand?.trim()) {
    const fromInitial = parseCommandString(initialCommand);
    if (fromInitial.length > 0) return fromInitial;
  }
  if (levelConfig.guidedActions?.length) {
    return expandGuidedActions(levelConfig.guidedActions, levelConfig.blanks);
  }
  return [];
}

export function resolveAttemptProgram(params: {
  finalCommand: string | null;
  initialCommand?: string | null;
  levelConfig: LevelGameplayConfig;
  levelType?: LevelType;
  commandEvents?: { command: string; action: string }[];
  commandHistory?: unknown;
}): CommandToken[] {
  const { finalCommand, initialCommand, levelConfig, levelType, commandEvents, commandHistory } =
    params;

  const editable = isEditableProgramLevelType(levelType);

  if (isRecordedProgramString(finalCommand)) {
    return parseCommandString(finalCommand!);
  }

  if (editable) {
    const fromHistory = parseLastSubmittedProgramFromHistory(commandHistory);
    if (fromHistory.length > 0) return fromHistory;

    const fromEvents = parseBestSubmittedProgramFromEvents(commandEvents);
    if (fromEvents.length > 0) return fromEvents;
  }

  if (commandEvents?.length) {
    const submitted = commandEvents
      .filter((e) => e.action === CommandAction.SUBMITTED || e.action === CommandAction.ADDED)
      .map((e) => normalizeCommandToken(e.command))
      .filter((c): c is CommandToken => c != null);
    if (submitted.length > 0) return submitted;
  }

  if (!editable && levelConfig.guidedActions?.length) {
    const fromGuided = expandGuidedActions(levelConfig.guidedActions, levelConfig.blanks);
    if (fromGuided.length > 0) return fromGuided;
  }

  if (initialCommand?.trim() && !editable) {
    const fromInitial = parseCommandString(initialCommand);
    if (fromInitial.length > 0) return fromInitial;
  }

  if (editable && levelConfig.guidedActions?.length) {
    return expandGuidedActions(levelConfig.guidedActions, levelConfig.blanks);
  }

  return [];
}

export function programSupportsRouteAnalysis(
  levelConfig: LevelGameplayConfig,
  levelType?: LevelType
): boolean {
  if (levelType === LevelType.INTRO) return false;
  if (levelType === LevelType.DRAG_EDIT_PROGRAM || levelType === LevelType.DRAG_ACTIONS) {
    return levelConfig.layoutMode !== "NUMBER_LINE";
  }
  if (levelConfig.layoutMode === "NUMBER_LINE") return false;
  const hasGoals =
    (levelConfig.goalCell != null) ||
    levelConfig.gridObjects.some((o) => o.isEndObject || o.isStartObject || o.visitOrder) ||
    levelConfig.gridObjects.length > 0;
  return hasGoals || (levelConfig.guidedActions?.length ?? 0) > 0;
}
