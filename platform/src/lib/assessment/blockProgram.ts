/**
 * Strip-block programs (arrows, Repeat, Command Bags, Chunks) → robot commands,
 * keeping which block produced each command so reports can point at a block.
 */

import { LevelType } from "@prisma/client";
import type { CommandBag, LevelGameplayConfig } from "@/lib/level-config";
import {
  parseCommandBagToken,
  parseCommandChunkToken,
  resolveCommandBagProgramTokens,
} from "@/lib/level-config";
import {
  expandRepeatTokens,
  isRepeatEnd,
  normalizeMotionToken,
  parseRepeatStart,
} from "@/lib/assessment/expand-repeats";
import { buildTaskAssessmentConfig } from "@/lib/assessment/assessmentConfig";
import { programStopsOnGoalStrict, simulateProgram } from "@/lib/assessment/routeAnalysis";
import type { RobotCommand, SimulationResult, TaskAssessmentConfig } from "@/lib/assessment/assessmentTypes";
import {
  geometryRequiresDestination,
  geometryRequiresFinishFacing,
  segmentKey,
} from "@/lib/geometry-path";

export type ExpandedBlockProgram = {
  commands: RobotCommand[];
  /** Strip block index (0-based) that produced each command. */
  blockOfCommand: number[];
};

function macroCommands(token: string, bags: CommandBag[]): RobotCommand[] {
  return expandRepeatTokens(resolveCommandBagProgramTokens([token], bags)) as RobotCommand[];
}

export function expandBlockProgram(tokens: string[], bags: CommandBag[]): ExpandedBlockProgram {
  const commands: RobotCommand[] = [];
  const blockOfCommand: number[] = [];
  const emit = (token: string, block: number) => {
    if (parseCommandBagToken(token) || parseCommandChunkToken(token)) {
      for (const c of macroCommands(token, bags)) {
        commands.push(c);
        blockOfCommand.push(block);
      }
      return;
    }
    const motion = normalizeMotionToken(token);
    if (motion) {
      commands.push(motion as RobotCommand);
      blockOfCommand.push(block);
    }
  };

  let i = 0;
  while (i < tokens.length) {
    const count = parseRepeatStart(tokens[i]!);
    if (count != null) {
      i++;
      const body: number[] = [];
      while (i < tokens.length && !isRepeatEnd(tokens[i]!)) {
        if (parseRepeatStart(tokens[i]!) == null) body.push(i);
        i++;
      }
      if (i < tokens.length) i++;
      for (let r = 0; r < count; r++) for (const b of body) emit(tokens[b]!, b);
      continue;
    }
    if (isRepeatEnd(tokens[i]!)) {
      i++;
      continue;
    }
    emit(tokens[i]!, i);
    i++;
  }
  return { commands, blockOfCommand };
}

export type GeometryRunCheck = {
  sim: SimulationResult;
  /** Edge key per command (null when the robot turned or was blocked). */
  edgeOfCommand: (string | null)[];
  traveled: Set<string>;
  target: Set<string>;
  shapeComplete: boolean;
  extraEdges: string[];
  finishCellOk: boolean | null;
  finishFacingOk: boolean | null;
  succeeded: boolean;
};

export function checkGeometryRun(config: LevelGameplayConfig, commands: RobotCommand[]): GeometryRunCheck {
  const gp = config.geometryPath;
  const sim = simulateProgram(config, commands);
  const target = new Set((gp?.segments ?? []).map((s) => segmentKey(s.from, s.to)));
  const traveled = new Set<string>();
  const edgeOfCommand = sim.steps.map((s) => {
    const moved = s.positionBefore.x !== s.positionAfter.x || s.positionBefore.y !== s.positionAfter.y;
    if (!moved) return null;
    const key = segmentKey(s.positionBefore, s.positionAfter);
    traveled.add(key);
    return key;
  });
  const shapeComplete = target.size > 0 && [...target].every((k) => traveled.has(k));
  const extraEdges = [...traveled].filter((k) => !target.has(k));

  const finish = gp?.finishCell ?? null;
  const finishCellOk = finish
    ? finish.x === sim.finalPosition.x && finish.y === sim.finalPosition.y
    : null;
  const needsFacing = geometryRequiresFinishFacing(gp);
  const ff = gp?.finishFacing ?? null;
  const finishFacingOk =
    needsFacing && ff ? ff.x === sim.finalDirection.x && ff.y === sim.finalDirection.y : null;

  const mode = gp?.validationMode ?? "TRACE_TARGET";
  const destinationOk = !geometryRequiresDestination(gp) || (finishCellOk === true && finishFacingOk !== false);
  let succeeded: boolean;
  if (mode === "FINAL_POSITION") succeeded = finishCellOk === true;
  else if (mode === "FINAL_POSITION_DIRECTION") succeeded = finishCellOk === true && finishFacingOk !== false;
  else if (mode === "EXACT_PATH" || mode === "SHAPE_MATCH") {
    succeeded = shapeComplete && extraEdges.length === 0 && destinationOk;
  } else succeeded = shapeComplete && destinationOk;

  return {
    sim,
    edgeOfCommand,
    traveled,
    target,
    shapeComplete,
    extraEdges,
    finishCellOk,
    finishFacingOk,
    succeeded,
  };
}

/** Goal check for any supported item type; null when the item can't be simulated. */
export function buildProgramGoalChecker(
  config: LevelGameplayConfig,
  levelType: LevelType | null | undefined
): ((commands: RobotCommand[]) => boolean) | null {
  if (levelType === LevelType.GEOMETRY_PATH) {
    if (!config.geometryPath?.segments?.length) return null;
    return (commands) => checkGeometryRun(config, commands).succeeded;
  }
  if (levelType === LevelType.DRAG_ACTIONS || levelType === LevelType.DRAG_EDIT_PROGRAM) {
    if (config.layoutMode === "CANVAS") return null;
    let task: TaskAssessmentConfig;
    try {
      task = buildTaskAssessmentConfig("live", config, [], levelType);
    } catch {
      return null;
    }
    return (commands) => commands.length > 0 && programStopsOnGoalStrict(task, simulateProgram(task, commands));
  }
  return null;
}
