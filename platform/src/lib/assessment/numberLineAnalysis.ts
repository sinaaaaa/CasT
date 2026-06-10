/**
 * Number-line ECD evidence — movement along ticks, not grid route efficiency.
 */

import { gridPositionToTick } from "@/lib/level-config";
import {
  clampScore,
  resolveRouteEndObject,
  resolveRouteStartVisitObject,
  resolveRouteWinCell,
} from "@/lib/assessment/assessmentConfig";
import type {
  NumberLineEvidence,
  NumberLineMovementStep,
  NumberLineVisitTarget,
  RobotCommand,
  SimulationResult,
  TaskAssessmentConfig,
  Vec2,
} from "@/lib/assessment/assessmentTypes";
import { facingToLabel, normalizeFacing } from "@/lib/assessment/routeAnalysis";

function vecEqual(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

function tickLabel(tick: number): string {
  return `Tick ${tick + 1}`;
}

export function resolveNumberLineGoalTick(
  task: TaskAssessmentConfig
): number | null {
  const config = task.levelConfig;
  const lineRow = config.numberLine?.lineRow ?? 2;
  if (config.visitObjectSequence) {
    const end = resolveRouteEndObject(config);
    if (end) return gridPositionToTick(end.position, lineRow).tick;
  }
  const win = resolveRouteWinCell(config);
  if (!win) return null;
  return gridPositionToTick(win.position, lineRow).tick;
}

export function resolveNumberLineVisitTargets(
  task: TaskAssessmentConfig
): { visit1: NumberLineVisitTarget | null; visit2: NumberLineVisitTarget | null } {
  const config = task.levelConfig;
  if (!config.visitObjectSequence) {
    return { visit1: null, visit2: null };
  }
  const lineRow = config.numberLine?.lineRow ?? 2;

  const toTarget = (
    obj: { position: { x: number; y: number }; label: string } | null,
    reached: boolean,
    reachedAtStep: number | null
  ): NumberLineVisitTarget | null => {
    if (!obj) return null;
    return {
      tick: gridPositionToTick(obj.position, lineRow).tick,
      label: obj.label,
      reached,
      reachedAtStep,
    };
  };

  const v1Obj = resolveRouteStartVisitObject(config);
  const v2Obj = resolveRouteEndObject(config);

  return {
    visit1: toTarget(v1Obj, false, null),
    visit2: toTarget(v2Obj, false, null),
  };
}

function firstStepIndexAtTick(simulation: SimulationResult, tick: number): number | null {
  for (let i = 0; i < simulation.steps.length; i++) {
    if (simulation.steps[i]!.positionAfter.x === tick) return i;
  }
  return null;
}

/** Minimum moves along the line: start → visit1 → visit2 (or start → goal). */
export function numberLineOptimalMoveCountForVisits(
  startTick: number,
  visit1Tick: number | null,
  visit2Tick: number | null,
  goalTick: number | null
): number {
  if (visit1Tick != null && visit2Tick != null) {
    return (
      Math.abs(visit1Tick - startTick) + Math.abs(visit2Tick - visit1Tick)
    );
  }
  if (goalTick != null) {
    return Math.abs(goalTick - startTick);
  }
  return 0;
}

function activeTargetTick(
  visit1: NumberLineVisitTarget | null,
  visit2: NumberLineVisitTarget | null,
  visit1Reached: boolean,
  singleGoalTick: number | null
): number | null {
  if (visit1 && visit2) {
    return visit1Reached ? visit2.tick : visit1.tick;
  }
  return visit2?.tick ?? visit1?.tick ?? singleGoalTick;
}

function expectedDelta(cmd: RobotCommand, facing: Vec2): Vec2 {
  if (cmd === "forward") return { x: facing.x, y: facing.y };
  if (cmd === "backward") return { x: -facing.x, y: -facing.y };
  return { x: 0, y: 0 };
}

function isMovementCommand(cmd: RobotCommand): boolean {
  return cmd === "forward" || cmd === "backward";
}

/** Minimum forward/backward steps to reach the goal tick from start. */
export function numberLineOptimalMoveCount(startTick: number, goalTick: number): number {
  return Math.abs(goalTick - startTick);
}

export function buildNumberLineEvidence(
  task: TaskAssessmentConfig,
  simulation: SimulationResult,
  attemptPassed: boolean
): NumberLineEvidence {
  const config = task.levelConfig;
  const lineRow = config.numberLine?.lineRow ?? 2;
  const startTick = config.robotStartPosition.x;
  const visitObjectSequence = Boolean(config.visitObjectSequence);
  const goalTick = resolveNumberLineGoalTick(task);

  const reachedVisit1 = simulation.reachedGoals.includes("visit-1");
  const reachedVisit2 = simulation.reachedGoals.includes("visit-2");

  const visit1Obj = resolveRouteStartVisitObject(config);
  const visit2Obj = resolveRouteEndObject(config);
  const visit1: NumberLineVisitTarget | null = visit1Obj
    ? {
        tick: gridPositionToTick(visit1Obj.position, lineRow).tick,
        label: visit1Obj.label,
        reached: reachedVisit1,
        reachedAtStep: null,
      }
    : null;
  const visit2: NumberLineVisitTarget | null = visit2Obj
    ? {
        tick: gridPositionToTick(visit2Obj.position, lineRow).tick,
        label: visit2Obj.label,
        reached: reachedVisit2,
        reachedAtStep: null,
      }
    : null;

  if (visit1) {
    visit1.reachedAtStep = firstStepIndexAtTick(simulation, visit1.tick);
  }
  if (visit2) {
    visit2.reachedAtStep = firstStepIndexAtTick(simulation, visit2.tick);
  }

  const visit1Step = visit1?.reachedAtStep ?? null;
  const visit2Step = visit2?.reachedAtStep ?? null;

  const correctVisitOrder =
    !visitObjectSequence ||
    !visit1 ||
    !visit2 ||
    (reachedVisit1 &&
      reachedVisit2 &&
      visit1Step != null &&
      visit2Step != null &&
      visit1Step <= visit2Step);

  const endTick =
    simulation.pathStates[simulation.pathStates.length - 1]?.position.x ??
    simulation.finalPosition.x;

  const startFacing = facingToLabel(normalizeFacing(config.robotStartFacing));
  const endFacing = facingToLabel(simulation.finalDirection);

  const movementSteps: NumberLineMovementStep[] = [];
  let correspondenceOk = 0;
  let correspondenceTotal = 0;
  let towardGoalCount = 0;
  let towardGoalTotal = 0;
  let studentMoveCount = 0;
  let visit1ReachedDuringRun = false;

  for (const step of simulation.steps) {
    const tickBefore = step.positionBefore.x;
    const tickAfter = step.positionAfter.x;
    const delta = {
      x: tickAfter - tickBefore,
      y: step.positionAfter.y - step.positionBefore.y,
    };
    const expected = expectedDelta(step.command, step.facingBefore);

    let stepCorrespondence = true;
    if (isMovementCommand(step.command)) {
      correspondenceTotal++;
      stepCorrespondence =
        vecEqual(delta, expected) && !step.collision;
      if (stepCorrespondence) correspondenceOk++;
      if (tickAfter !== tickBefore) studentMoveCount++;
    } else {
      stepCorrespondence = delta.x === 0 && delta.y === 0;
    }

    if (visit1 && tickAfter === visit1.tick) {
      visit1ReachedDuringRun = true;
    }

    const targetTick = activeTargetTick(
      visit1,
      visit2,
      visit1ReachedDuringRun,
      goalTick
    );
    const dist = (tick: number) =>
      targetTick == null ? 0 : Math.abs(targetTick - tick);

    if (isMovementCommand(step.command) && targetTick != null) {
      towardGoalTotal++;
      const beforeDist = dist(tickBefore);
      const afterDist = dist(tickAfter);
      if (afterDist <= beforeDist) towardGoalCount++;
    }

    movementSteps.push({
      command: step.command,
      tickBefore,
      tickAfter,
      correspondenceOk: stepCorrespondence,
      towardGoal:
        targetTick == null ||
        !isMovementCommand(step.command) ||
        dist(tickAfter) <= dist(tickBefore),
    });
  }

  const optimalMoveCount = numberLineOptimalMoveCountForVisits(
    startTick,
    visit1?.tick ?? null,
    visit2?.tick ?? null,
    goalTick
  );

  const startPositionRecognition =
    simulation.pathStates[0]?.position.x === startTick ? 100 : 40;

  const arrowToMovementCorrespondence =
    correspondenceTotal > 0
      ? clampScore((correspondenceOk / correspondenceTotal) * 100)
      : simulation.commandCount === 0
        ? 0
        : 85;

  const directionAccuracy = clampScore(
    arrowToMovementCorrespondence * 0.7 +
      (100 - simulation.wrongTurns * 22 - simulation.collisions.length * 15) * 0.3
  );

  const finalGoalTick = visit2?.tick ?? visit1?.tick ?? goalTick;
  const atFinalGoal = finalGoalTick != null && endTick === finalGoalTick;
  let stepCountingAccuracy = 100;
  if (optimalMoveCount > 0) {
    if (studentMoveCount === optimalMoveCount && atFinalGoal) {
      stepCountingAccuracy = 100;
    } else if (studentMoveCount < optimalMoveCount) {
      stepCountingAccuracy = clampScore((studentMoveCount / optimalMoveCount) * 85);
    } else {
      const extra = studentMoveCount - optimalMoveCount;
      stepCountingAccuracy = clampScore(100 - extra * 18);
    }
  } else if (finalGoalTick != null && studentMoveCount === 0) {
    stepCountingAccuracy = 0;
  }

  let movementSequencing =
    towardGoalTotal > 0
      ? clampScore((towardGoalCount / towardGoalTotal) * 100)
      : clampScore(stepCountingAccuracy * 0.85);

  if (visitObjectSequence && visit1 && visit2) {
    let visitSeqScore = 0;
    if (correctVisitOrder && reachedVisit2) visitSeqScore = 100;
    else if (reachedVisit2 && !reachedVisit1) visitSeqScore = 35;
    else if (reachedVisit1 && !reachedVisit2) visitSeqScore = 55;
    else if (visit1Step != null && visit2Step != null && visit2Step < visit1Step) visitSeqScore = 15;
    else visitSeqScore = 20;
    movementSequencing = clampScore(movementSequencing * 0.5 + visitSeqScore * 0.5);
  }

  const facing = normalizeFacing(config.robotStartFacing);
  const towardGoalSign =
    finalGoalTick != null && finalGoalTick !== startTick
      ? Math.sign(finalGoalTick - startTick)
      : 0;
  const startOrientationOk =
    towardGoalSign === 0 ||
    (facing.x !== 0 && Math.sign(facing.x) === towardGoalSign) ||
    (facing.y !== 0 && Math.sign(facing.y) === towardGoalSign);

  const orientationUnderstanding = clampScore(
    (startOrientationOk ? 55 : 25) + directionAccuracy * 0.45
  );

  const teacherNotes = buildNumberLineTeacherNotes({
    startTick,
    endTick,
    goalTick: finalGoalTick,
    visitObjectSequence,
    visit1,
    visit2,
    correctVisitOrder,
    startFacing,
    endFacing,
    optimalMoveCount,
    studentMoveCount,
    directionAccuracy,
    stepCountingAccuracy,
    arrowToMovementCorrespondence,
    movementSequencing,
    orientationUnderstanding,
    passed: attemptPassed || simulation.passed || atFinalGoal,
    wrongTurns: simulation.wrongTurns,
    collisions: simulation.collisions.length,
  });

  return {
    startTick,
    endTick,
    goalTick: finalGoalTick,
    visitObjectSequence,
    visit1,
    visit2,
    correctVisitOrder,
    startFacing,
    endFacing,
    commands: simulation.commands,
    movementSteps,
    startPositionRecognition,
    directionAccuracy,
    stepCountingAccuracy,
    arrowToMovementCorrespondence,
    movementSequencing,
    orientationUnderstanding,
    optimalMoveCount,
    studentMoveCount,
    passed: attemptPassed || simulation.passed || atFinalGoal,
    teacherNotes,
  };
}

function buildNumberLineTeacherNotes(params: {
  startTick: number;
  endTick: number;
  goalTick: number | null;
  visitObjectSequence: boolean;
  visit1: NumberLineVisitTarget | null;
  visit2: NumberLineVisitTarget | null;
  correctVisitOrder: boolean;
  startFacing: string;
  endFacing: string;
  optimalMoveCount: number;
  studentMoveCount: number;
  directionAccuracy: number;
  stepCountingAccuracy: number;
  arrowToMovementCorrespondence: number;
  movementSequencing: number;
  orientationUnderstanding: number;
  passed: boolean;
  wrongTurns: number;
  collisions: number;
}): NumberLineEvidence["teacherNotes"] {
  const notes: NumberLineEvidence["teacherNotes"] = {};

  if (params.visitObjectSequence && params.visit1 && params.visit2) {
    if (!params.visit1.reached) {
      notes.movementConsistency = `Visit sequence: did not reach first object (${params.visit1.label}) at ${tickLabel(params.visit1.tick)}.`;
    } else if (!params.visit2.reached) {
      notes.movementConsistency = `Visit sequence: reached ${params.visit1.label} but not second object (${params.visit2.label}) at ${tickLabel(params.visit2.tick)}.`;
    } else if (!params.correctVisitOrder) {
      notes.movementConsistency = `Visit sequence: reached ${params.visit2.label} before or without properly visiting ${params.visit1.label} — order should be visit 1, then visit 2.`;
    } else {
      notes.movementConsistency = `Visit sequence: visited ${params.visit1.label} (${tickLabel(params.visit1.tick)}) then ${params.visit2.label} (${tickLabel(params.visit2.tick)}) in the correct order.`;
    }
  }

  if (params.directionAccuracy < 65 || params.wrongTurns > 0 || params.collisions > 0) {
    notes.directionConfusion =
      params.collisions > 0
        ? "Direction confusion: moves bumped the line edge — forward/backward may not match where the robot was facing."
        : "Direction confusion: some steps did not match the arrow pressed (forward vs backward along the line).";
  } else {
    notes.directionConfusion =
      "Direction sense is solid — forward and backward matched movement along the number line.";
  }

  if (params.stepCountingAccuracy < 70) {
    const extra = Math.max(0, params.studentMoveCount - params.optimalMoveCount);
    const pathDesc =
      params.visitObjectSequence && params.visit1 && params.visit2
        ? `${tickLabel(params.startTick)} → ${tickLabel(params.visit1.tick)} → ${tickLabel(params.visit2.tick)}`
        : params.goalTick != null
          ? `${tickLabel(params.startTick)} → ${tickLabel(params.goalTick)}`
          : "the goal";
    notes.countingErrors =
      extra > 0
        ? `Counting / distance: used ${params.studentMoveCount} moves along the line; about ${params.optimalMoveCount} steps for ${pathDesc} (${extra} extra).`
        : `Counting / distance: only ${params.studentMoveCount} move step${params.studentMoveCount === 1 ? "" : "s"} — may have stopped short (${pathDesc}).`;
  } else {
    const pathDesc =
      params.visitObjectSequence && params.visit1 && params.visit2
        ? `visit ${params.visit1.label} then ${params.visit2.label}`
        : params.goalTick != null
          ? `${tickLabel(params.startTick)} to ${tickLabel(params.goalTick)}`
          : "this layout";
    notes.countingErrors = `Step count fits the path along the line (${pathDesc}).`;
  }

  if (!notes.movementConsistency) {
    if (params.movementSequencing < 70) {
      notes.movementConsistency =
        "Movement consistency: several steps moved away from the current target or backtracked before finishing.";
    } else {
      notes.movementConsistency =
        "Movement consistency: steps generally progressed along the line toward each target.";
    }
  }

  if (params.orientationUnderstanding < 65) {
    notes.orientationUnderstanding = `Orientation: started at ${tickLabel(params.startTick)} facing ${params.startFacing} — check whether that facing matches the direction toward the goal.`;
  } else {
    notes.orientationUnderstanding = `Orientation: started at ${tickLabel(params.startTick)} (${params.startFacing}) and finished at ${tickLabel(params.endTick)} (${params.endFacing}) with coherent line movement.`;
  }

  return notes;
}

export function buildNumberLineInterpretation(
  evidence: NumberLineEvidence | null,
  passed: boolean
): string {
  if (!evidence) {
    return "Number-line movement data is not available for this attempt.";
  }
  if (evidence.commands.length === 0) {
    return "No command program was recorded. Number-line assessment needs the student's final program.";
  }

  const parts: string[] = [];
  if (evidence.visitObjectSequence && evidence.visit1 && evidence.visit2) {
    parts.push(
      `Visit route: ${tickLabel(evidence.startTick)} → ${evidence.visit1.label} (${tickLabel(evidence.visit1.tick)}) → ${evidence.visit2.label} (${tickLabel(evidence.visit2.tick)}) · ended ${tickLabel(evidence.endTick)} · ${evidence.studentMoveCount} move step${evidence.studentMoveCount === 1 ? "" : "s"}.`
    );
    if (evidence.correctVisitOrder && evidence.visit2.reached) {
      parts.push("Visited both objects in the correct order.");
    } else if (!evidence.visit1.reached) {
      parts.push(`Did not reach the first object (${evidence.visit1.label}).`);
    } else if (!evidence.visit2.reached) {
      parts.push(`Reached ${evidence.visit1.label} but not the second object (${evidence.visit2.label}).`);
    } else {
      parts.push("Visit order was incorrect (object 2 before object 1 or skipped).");
    }
  } else {
    parts.push(
      `Line journey: ${tickLabel(evidence.startTick)} → ${tickLabel(evidence.endTick)}` +
        (evidence.goalTick != null ? ` (goal ${tickLabel(evidence.goalTick)})` : "") +
        ` · ${evidence.studentMoveCount} move step${evidence.studentMoveCount === 1 ? "" : "s"}.`
    );
    if (passed || evidence.passed) {
      parts.push("Reached the level goal on the number line.");
    } else {
      parts.push("Did not fully reach the goal tick on the final run.");
    }
  }

  if (evidence.stepCountingAccuracy >= 85) {
    parts.push("Step counting aligns well with the distance along the line.");
  } else if (evidence.teacherNotes.countingErrors) {
    parts.push(evidence.teacherNotes.countingErrors);
  }

  return parts.join(" ");
}

export function numberLineMetricRows(evidence: NumberLineEvidence): {
  label: string;
  value: number;
  key: string;
}[] {
  return [
    { key: "start", label: "Start position", value: evidence.startPositionRecognition },
    { key: "direction", label: "Direction accuracy", value: evidence.directionAccuracy },
    { key: "counting", label: "Step counting", value: evidence.stepCountingAccuracy },
    { key: "correspondence", label: "Arrow ↔ movement", value: evidence.arrowToMovementCorrespondence },
    { key: "sequencing", label: "Movement sequence", value: evidence.movementSequencing },
    { key: "orientation", label: "Orientation", value: evidence.orientationUnderstanding },
  ];
}
