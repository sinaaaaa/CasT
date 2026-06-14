/**
 * ECD assessment engine: evidence extraction → construct scoring.
 */

import { CommandAction, LevelType, type LevelCTConstruct, type CTConstruct } from "@prisma/client";
import { resolveAttemptProgram } from "@/lib/assessment/resolve-program";
import {
  buildTaskAssessmentConfig,
  CONSTRUCT_METRIC_WEIGHTS,
  clampScore,
  masteryFromScore,
  TASK_TYPE_CONSTRUCT_EMPHASIS,
} from "@/lib/assessment/assessmentConfig";
import { buildNumberLineEvidence } from "@/lib/assessment/numberLineAnalysis";
import {
  compareRoutes,
  findOptimalRoute,
  simulateProgram,
} from "@/lib/assessment/routeAnalysis";
import type {
  AttemptEvidenceInput,
  ConstructScore,
  ConstructSlug,
  GameplayEvidence,
  StealthAssessmentOutput,
  TaskAssessmentConfig,
} from "@/lib/assessment/assessmentTypes";
import { generateTeacherNarrative } from "@/lib/assessment/assessmentNarratives";
import { generateRecommendations } from "@/lib/assessment/teacherInterpretation";
import {
  isChooseActionLevel,
  isDebuggingLevel,
  isFlagPredictionLevel,
  isPathBuildingLevel,
} from "@/lib/assessment/assessmentConfig";
import { buildDebuggingFromAttempt } from "@/lib/assessment/debuggingAnalysis";
import { buildPathBuildingFromAttempt } from "@/lib/assessment/pathBuildingAnalysis";
import { buildChoiceActionFromAttempt } from "@/lib/assessment/choiceActionAnalysis";
import {
  buildPredictionFromAttempt,
  predictionResultLabel,
} from "@/lib/assessment/predictionAnalysis";

type MappingWithConstruct = LevelCTConstruct & { construct: CTConstruct };

function parseCommandsFromAttempt(
  attempt: AttemptEvidenceInput,
  task: TaskAssessmentConfig,
  levelType?: LevelType
): string[] {
  return resolveAttemptProgram({
    finalCommand: attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    levelConfig: task.levelConfig,
    levelType,
    commandEvents: attempt.commandEvents,
    commandHistory: attempt.commandHistory,
  });
}

function parseMistakes(mistakes: unknown): {
  count: number;
  visitPattern?: string;
  reachedStart?: boolean;
  reachedEnd?: boolean;
} {
  if (!mistakes) return { count: 0 };
  if (Array.isArray(mistakes)) return { count: mistakes.length };
  if (typeof mistakes === "object") {
    const o = mistakes as Record<string, unknown>;
    const messages = Array.isArray(o.messages) ? o.messages.length : 0;
    const v =
      o.objectVisit && typeof o.objectVisit === "object"
        ? (o.objectVisit as Record<string, unknown>)
        : null;
    return {
      count: messages,
      visitPattern: v?.visitPattern ? String(v.visitPattern) : undefined,
      reachedStart: v?.reachedStart != null ? Boolean(v.reachedStart) : undefined,
      reachedEnd: v?.reachedEnd != null ? Boolean(v.reachedEnd) : undefined,
    };
  }
  return { count: 0 };
}

function metricToScore(value: number, invert = false): number {
  const v = invert ? 100 - clampScore(value) : clampScore(value);
  return v;
}

/** Flag prediction evidence — no BFS / route comparison. */
function extractFlagPredictionEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  levelType?: LevelType
): GameplayEvidence {
  const predictionResult = buildPredictionFromAttempt({
    levelId: task.taskId,
    levelConfig: task.levelConfig,
    levelType,
    attempt,
  });

  const cmds = predictionResult.givenCommands;
  const simulation = simulateProgram(task, cmds);
  const mistakes = parseMistakes(attempt.mistakes);
  const resetCount = Math.max(
    attempt.resetCount ?? 0,
    attempt.commandEvents.filter((e) =>
      e.command.toLowerCase().includes("student_reset")
    ).length
  );

  const behaviors: string[] = [];
  behaviors.push("Task: Predicting Robot Movement (place flag).");
  if (predictionResult.studentFlagPosition && predictionResult.expectedFinalPosition) {
    behaviors.push(
      `Student flag: row ${predictionResult.studentFlagPosition.y + 1}, column ${predictionResult.studentFlagPosition.x + 1}.`
    );
    behaviors.push(
      `Expected cell: row ${predictionResult.expectedFinalPosition.y + 1}, column ${predictionResult.expectedFinalPosition.x + 1}.`
    );
  }
  behaviors.push(`Result: ${predictionResult.isCorrect ? "Correct" : predictionResultLabel(predictionResult)}.`);
  behaviors.push(predictionResult.teacherExplanation);
  if (resetCount > 0) behaviors.push(`Pressed Reset ${resetCount} time(s).`);
  if (attempt.robotTouched || attempt.robotTouchCount > 0) {
    behaviors.push(`Used robot touch: Yes (${attempt.robotTouchCount} time(s)).`);
  } else {
    behaviors.push("Used robot touch: No.");
  }

  return {
    commandCount: cmds.length,
    optimalCommandCount: cmds.length,
    efficiencyRatio: predictionResult.isCorrect ? 100 : 50,
    wrongTurns: 0,
    collisions: 0,
    unnecessaryMoves: 0,
    directionAccuracy: predictionResult.score,
    goalCompletion: predictionResult.isCorrect ? 100 : 0,
    subgoalCompletion: predictionResult.isCorrect ? 100 : 0,
    correctGoalOrder: predictionResult.isCorrect,
    sequenceCoherence: predictionResult.isCorrect ? 100 : 50,
    obstacleAvoidance: 100,
    routeRecovery: 50,
    routeDeviation: 0,
    predictionAccuracy: predictionResult.score,
    passed:
      predictionResult.studentFlagPosition != null
        ? predictionResult.isCorrect
        : attempt.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: 0,
    clearCount: 0,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison: null,
    numberLineEvidence: null,
    taskEnvironmentType: "grid",
    behaviors,
    predictionResult,
  };
}

/** Choose-action evidence — blank answers vs correct (no route comparison). */
function extractChoiceActionEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  levelType?: LevelType
): GameplayEvidence {
  const choiceResult = buildChoiceActionFromAttempt({
    levelConfig: task.levelConfig,
    levelType,
    attempt,
  });
  const cmds = choiceResult.programCommands;
  const simulation = simulateProgram(task, cmds);
  const mistakes = parseMistakes(attempt.mistakes);
  const resetCount = Math.max(
    attempt.resetCount ?? 0,
    attempt.commandEvents.filter((e) =>
      e.command.toLowerCase().includes("student_reset")
    ).length
  );

  const behaviors: string[] = [];
  behaviors.push("Task: Choose the correct action (guided blanks).");
  choiceResult.studentChoices.forEach((c, i) => {
    const correct = choiceResult.correctChoices[i] ?? "—";
    behaviors.push(`Blank ${i + 1}: student "${c}", correct "${correct}".`);
  });
  behaviors.push(`Result: ${choiceResult.isCorrect ? "Correct" : "Incorrect"}.`);
  behaviors.push(choiceResult.teacherExplanation);
  if (resetCount > 0) behaviors.push(`Pressed Reset ${resetCount} time(s).`);

  return {
    commandCount: cmds.length,
    optimalCommandCount: cmds.length,
    efficiencyRatio: choiceResult.isCorrect ? 100 : 40,
    wrongTurns: 0,
    collisions: 0,
    unnecessaryMoves: 0,
    directionAccuracy: choiceResult.score,
    goalCompletion: choiceResult.isCorrect ? 100 : 0,
    subgoalCompletion: choiceResult.isCorrect ? 100 : 0,
    correctGoalOrder: choiceResult.isCorrect,
    sequenceCoherence: choiceResult.isCorrect ? 100 : 45,
    obstacleAvoidance: 100,
    routeRecovery: 50,
    routeDeviation: 0,
    predictionAccuracy: choiceResult.score,
    passed:
      choiceResult.available && choiceResult.studentChoices.length > 0
        ? choiceResult.isCorrect
        : attempt.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: 0,
    clearCount: 0,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison: null,
    numberLineEvidence: null,
    taskEnvironmentType: "grid",
    behaviors,
    predictionResult: null,
    choiceActionResult: choiceResult,
  };
}

function extractPathBuildingEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  levelType?: LevelType
): GameplayEvidence {
  const pathResult = buildPathBuildingFromAttempt({
    levelConfig: task.levelConfig,
    levelType,
    attempt,
    task,
  });
  const simulation = simulateProgram(task, pathResult.studentCommands);
  const mistakes = parseMistakes(attempt.mistakes);
  const resetCount = Math.max(
    attempt.resetCount ?? 0,
    attempt.commandEvents.filter((e) =>
      e.command.toLowerCase().includes("student_reset")
    ).length
  );

  const behaviors: string[] = [];
  behaviors.push("Task: Building a Path (drag action blocks).");
  behaviors.push(`Route quality: ${pathResult.routeQuality}.`);
  behaviors.push(pathResult.whatHappened);
  behaviors.push(pathResult.exactIssue);
  if (pathResult.firstMistakeLabel) behaviors.push(pathResult.firstMistakeLabel);
  behaviors.push(pathResult.recommendation);
  if (resetCount > 0) behaviors.push(`Pressed Reset ${resetCount} time(s).`);

  return {
    commandCount: pathResult.commandCount,
    optimalCommandCount: pathResult.shortestCommandCount,
    efficiencyRatio: pathResult.score,
    wrongTurns: simulation.wrongTurns,
    collisions: pathResult.collisions,
    unnecessaryMoves: pathResult.extraCommands,
    directionAccuracy: pathResult.score,
    goalCompletion: simulation.goalCompletion,
    subgoalCompletion: simulation.subgoalCompletion,
    correctGoalOrder: pathResult.correctGoalOrder,
    sequenceCoherence: pathResult.score,
    obstacleAvoidance: pathResult.obstacleAvoided ? 100 : 40,
    routeRecovery: pathResult.score,
    routeDeviation: Math.max(0, 100 - pathResult.score),
    predictionAccuracy: pathResult.score,
    passed: pathResult.available ? pathResult.reachedGoal : attempt.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: 0,
    clearCount: 0,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison: null,
    numberLineEvidence: null,
    taskEnvironmentType: "grid",
    behaviors,
    predictionResult: null,
    choiceActionResult: null,
  };
}

function extractDebuggingEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  levelType?: LevelType
): GameplayEvidence {
  const debugResult = buildDebuggingFromAttempt({
    levelConfig: task.levelConfig,
    levelType,
    attempt,
    task,
  });
  const simulation = simulateProgram(task, debugResult.studentProgram);
  const mistakes = parseMistakes(attempt.mistakes);
  const resetCount = Math.max(
    attempt.resetCount ?? 0,
    attempt.commandEvents.filter((e) =>
      e.command.toLowerCase().includes("student_reset")
    ).length
  );

  const behaviors: string[] = [];
  behaviors.push("Task: Fixing a Program (debugging).");
  behaviors.push(`Strategy: ${debugResult.debuggingStrategy}.`);
  debugResult.whatStudentDid.forEach((line) => behaviors.push(line));
  behaviors.push(`Bug fixed: ${debugResult.bugFixedDetail}.`);
  behaviors.push(debugResult.teacherExplanation);
  if (resetCount > 0) behaviors.push(`Pressed Reset ${resetCount} time(s).`);

  return {
    commandCount: debugResult.studentProgram.length,
    optimalCommandCount: debugResult.correctProgram.length,
    efficiencyRatio: debugResult.score,
    wrongTurns: simulation.wrongTurns,
    collisions: simulation.collisions.length,
    unnecessaryMoves: debugResult.unnecessaryChanges ? 1 : 0,
    directionAccuracy: debugResult.score,
    goalCompletion: simulation.goalCompletion,
    subgoalCompletion: simulation.subgoalCompletion,
    correctGoalOrder: simulation.correctGoalOrder,
    sequenceCoherence: debugResult.score,
    obstacleAvoidance: clampScore(100 - simulation.collisions.length * 20),
    routeRecovery: 50,
    routeDeviation: 0,
    predictionAccuracy: debugResult.score,
    passed: debugResult.available ? debugResult.bugFixed : attempt.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: debugResult.editDistance,
    clearCount: 0,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison: null,
    numberLineEvidence: null,
    taskEnvironmentType: "grid",
    behaviors,
    predictionResult: null,
    choiceActionResult: null,
  };
}

/** Pull observable evidence from attempt + simulation (no construct scores). */
export function extractEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  levelType?: LevelType
): GameplayEvidence {
  if (isFlagPredictionLevel(task.levelConfig, levelType)) {
    return extractFlagPredictionEvidence(task, attempt, levelType);
  }

  if (isChooseActionLevel(task.levelConfig, levelType)) {
    return extractChoiceActionEvidence(task, attempt, levelType);
  }

  if (isDebuggingLevel(task.levelConfig, levelType)) {
    return extractDebuggingEvidence(task, attempt, levelType);
  }

  if (task.taskEnvironmentType === "number-line") {
    const cmds = parseCommandsFromAttempt(attempt, task, levelType);
    const simulation = simulateProgram(task, cmds);
    return extractNumberLineEvidence(task, attempt, simulation);
  }

  if (isPathBuildingLevel(task.levelConfig, levelType)) {
    return extractPathBuildingEvidence(task, attempt, levelType);
  }

  const cmds = parseCommandsFromAttempt(attempt, task, levelType);
  const simulation = simulateProgram(task, cmds);

  const optimal = task.compareWithOptimalRoute ? findOptimalRoute(task) : null;
  const routeComparison = task.compareWithOptimalRoute
    ? compareRoutes(simulation, optimal, task)
    : null;

  const mistakes = parseMistakes(attempt.mistakes);
  const edits = attempt.commandEvents.filter((e) =>
    ["REMOVED", "MODIFIED", "REORDERED"].includes(e.action)
  ).length;
  const clears = attempt.commandEvents.filter((e) => e.action === CommandAction.CLEARED).length;

  const optimalCommandCount = routeComparison?.optimalCommandCount ?? simulation.commandCount;
  const efficiencyRatio = routeComparison?.efficiencyRatio ?? (attempt.passed ? 85 : 50);
  const unnecessaryMoves = routeComparison?.unnecessaryMoves ?? 0;
  const routeDeviation = routeComparison?.routeDeviation ?? 0;

  const directionAccuracy = clampScore(
    100 - simulation.wrongTurns * 18 - simulation.collisions.length * 12
  );

  const obstacleAvoidance =
    !task.hasObstacle
      ? 100
      : clampScore(100 - simulation.collisions.length * 25);

  const sequenceCoherence = clampScore(
    100 -
      (cmds.filter((c, i) => i > 0 && c === cmds[i - 1]).length > 3 ? 15 : 0) -
      (simulation.commandCount < 1 ? 40 : 0)
  );

  const routeRecovery = clampScore(
    (edits > 0 || clears > 0 ? 55 : 35) +
      (attempt.passed && attempt.attemptNumber > 1 ? 25 : 0) -
      mistakes.count * 8
  );

  const predictionAccuracy = clampScore(
    directionAccuracy * 0.5 +
      (simulation.passed ? 35 : 0) +
      (simulation.correctGoalOrder ? 15 : 0)
  );

  const behaviors: string[] = [];
  if (attempt.passed) behaviors.push("Completed the level successfully.");
  else behaviors.push("Did not complete all goals on the final run.");

  if (routeComparison) {
    const rc = routeComparison;
    if (rc.extraTurns > 0 && simulation.passed) {
      behaviors.push(
        `Reached the goal with ${rc.extraTurns} extra turn${rc.extraTurns === 1 ? "" : "s"} compared with the best route.`
      );
    } else {
      behaviors.push(
        `Student program: ${rc.studentCommandCount} commands · Best route: ${rc.optimalCommandCount} commands.`
      );
    }
    if (unnecessaryMoves > 0) {
      behaviors.push(`Included ${unnecessaryMoves} extra command(s) compared to the best route.`);
    }
  }

  if (simulation.collisions.length > 0) {
    behaviors.push(
      `Bumped into blocked cells ${simulation.collisions.length} time(s) while running the program.`
    );
  }
  if (simulation.wrongTurns > 0) {
    behaviors.push(`Made ${simulation.wrongTurns} turn(s) that did not help reach the goal.`);
  }
  if (mistakes.reachedStart === false || mistakes.reachedEnd === false) {
    const parts: string[] = [];
    if (mistakes.reachedStart === false) parts.push("missed the first visit target");
    if (mistakes.reachedEnd === false) parts.push("missed the second visit target");
    if (parts.length) behaviors.push(`Visit sequence: ${parts.join("; ")}.`);
  } else if (mistakes.visitPattern === "both") {
    behaviors.push("Visited required objects in the correct order.");
  }
  if (task.hasObstacle && simulation.collisions.length === 0 && attempt.passed) {
    behaviors.push("Navigated around obstacles without collisions.");
  }
  if (edits + clears > 0) {
    behaviors.push(`Revised the program ${edits + clears} time(s) before or after running.`);
  }
  const resetFromEvents = attempt.commandEvents.filter((e) =>
    e.command.toLowerCase().includes("student_reset")
  ).length;
  const resetCount = Math.max(attempt.resetCount ?? 0, resetFromEvents);
  if (resetCount > 0) {
    behaviors.push(`Pressed Reset ${resetCount} time(s) during this attempt.`);
  }
  if (attempt.robotTouched || attempt.robotTouchCount > 0) {
    behaviors.push(
      `Used robot touch: Yes (${attempt.robotTouchCount} interaction${attempt.robotTouchCount === 1 ? "" : "s"}).`
    );
  } else {
    behaviors.push("Used robot touch: No.");
  }

  return {
    commandCount: simulation.commandCount,
    optimalCommandCount,
    efficiencyRatio,
    wrongTurns: simulation.wrongTurns,
    collisions: simulation.collisions.length,
    unnecessaryMoves,
    directionAccuracy,
    goalCompletion: simulation.goalCompletion,
    subgoalCompletion: simulation.subgoalCompletion,
    correctGoalOrder: simulation.correctGoalOrder,
    sequenceCoherence,
    obstacleAvoidance,
    routeRecovery,
    routeDeviation,
    predictionAccuracy,
    passed: attempt.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: edits,
    clearCount: clears,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison,
    numberLineEvidence: null,
    taskEnvironmentType: task.taskEnvironmentType,
    behaviors,
  };
}

function extractNumberLineEvidence(
  task: TaskAssessmentConfig,
  attempt: AttemptEvidenceInput,
  simulation: ReturnType<typeof simulateProgram>
): GameplayEvidence {
  const nl = buildNumberLineEvidence(task, simulation, attempt.passed);
  const mistakes = parseMistakes(attempt.mistakes);
  const edits = attempt.commandEvents.filter((e) =>
    ["REMOVED", "MODIFIED", "REORDERED"].includes(e.action)
  ).length;
  const clears = attempt.commandEvents.filter((e) => e.action === CommandAction.CLEARED).length;

  const behaviors: string[] = [];
  if (attempt.passed || nl.passed) {
    behaviors.push("Completed the number-line goal on the final run.");
  } else {
    behaviors.push("Did not reach the goal tick on the final run.");
  }
  if (nl.visitObjectSequence && nl.visit1 && nl.visit2) {
    behaviors.push(
      `Visit sequence on line: ${nl.visit1.label} (tick ${nl.visit1.tick + 1}) then ${nl.visit2.label} (tick ${nl.visit2.tick + 1}) — ` +
        (nl.correctVisitOrder && nl.visit2.reached
          ? "correct order."
          : !nl.visit1.reached
            ? "first object not reached."
            : !nl.visit2.reached
              ? "second object not reached."
              : "visit order incorrect.")
    );
  } else {
    behaviors.push(
      `Movement: tick ${nl.startTick + 1} → tick ${nl.endTick + 1}` +
        (nl.goalTick != null ? ` (goal tick ${nl.goalTick + 1})` : "") +
        ` · ${nl.studentMoveCount} step${nl.studentMoveCount === 1 ? "" : "s"} along the line.`
    );
  }
  if (nl.teacherNotes.directionConfusion) {
    behaviors.push(nl.teacherNotes.directionConfusion);
  }
  if (nl.teacherNotes.countingErrors) {
    behaviors.push(nl.teacherNotes.countingErrors);
  }
  if (nl.teacherNotes.movementConsistency) {
    behaviors.push(nl.teacherNotes.movementConsistency);
  }
  if (nl.teacherNotes.orientationUnderstanding) {
    behaviors.push(nl.teacherNotes.orientationUnderstanding);
  }
  if (edits + clears > 0) {
    behaviors.push(`Revised the program ${edits + clears} time(s) before or after running.`);
  }

  const resetFromEvents = attempt.commandEvents.filter((e) =>
    e.command.toLowerCase().includes("student_reset")
  ).length;
  const resetCount = Math.max(attempt.resetCount ?? 0, resetFromEvents);
  if (resetCount > 0) {
    behaviors.push(`Pressed Reset ${resetCount} time(s) during this attempt.`);
  }
  if (attempt.robotTouched || attempt.robotTouchCount > 0) {
    behaviors.push(
      `Used robot touch: Yes (${attempt.robotTouchCount} interaction${attempt.robotTouchCount === 1 ? "" : "s"}).`
    );
  } else {
    behaviors.push("Used robot touch: No.");
  }

  return {
    commandCount: simulation.commandCount,
    optimalCommandCount: nl.optimalMoveCount,
    efficiencyRatio: nl.stepCountingAccuracy,
    wrongTurns: simulation.wrongTurns,
    collisions: simulation.collisions.length,
    unnecessaryMoves: Math.max(0, nl.studentMoveCount - nl.optimalMoveCount),
    directionAccuracy: nl.directionAccuracy,
    goalCompletion: simulation.goalCompletion,
    subgoalCompletion: simulation.subgoalCompletion,
    correctGoalOrder: simulation.correctGoalOrder,
    sequenceCoherence: nl.movementSequencing,
    obstacleAvoidance: 100,
    routeRecovery: clampScore(
      (edits > 0 || clears > 0 ? 55 : 35) +
        (attempt.passed && attempt.attemptNumber > 1 ? 25 : 0) -
        mistakes.count * 8
    ),
    routeDeviation: 0,
    predictionAccuracy: nl.orientationUnderstanding,
    passed: attempt.passed || nl.passed,
    attemptNumber: attempt.attemptNumber,
    hintsUsed: attempt.hintsUsed,
    editCount: edits,
    clearCount: clears,
    mistakeCount: mistakes.count,
    robotTouchCount: attempt.robotTouchCount,
    robotTouched: attempt.robotTouched ?? attempt.robotTouchCount > 0,
    resetCount,
    totalTimeSeconds: attempt.totalTimeSeconds ?? 0,
    visitPattern: mistakes.visitPattern,
    reachedStart: mistakes.reachedStart,
    reachedEnd: mistakes.reachedEnd,
    simulation,
    routeComparison: null,
    numberLineEvidence: nl,
    taskEnvironmentType: "number-line",
    behaviors,
  };
}

function scoreConstruct(
  slug: ConstructSlug,
  evidence: GameplayEvidence,
  task: TaskAssessmentConfig,
  isPrimary: boolean
): { score: number; evidenceUsed: string[] } {
  const weights = CONSTRUCT_METRIC_WEIGHTS[slug];
  const evidenceUsed: string[] = [];
  let total = 0;
  let weightSum = 0;
  const nl = evidence.numberLineEvidence;
  const isNumberLine = task.taskEnvironmentType === "number-line" && nl;
  const pr = evidence.predictionResult;

  if (pr?.available) {
    const s = pr.isCorrect ? 100 : pr.score;
    return {
      score: clampScore(s),
      evidenceUsed: [pr.teacherExplanation],
    };
  }

  const add = (metric: string, raw: number, invert = false) => {
    const w = weights[metric as keyof typeof weights];
    if (!w) return;
    const s = metricToScore(raw, invert);
    total += s * w;
    weightSum += w;
    evidenceUsed.push(`${metric}: ${Math.round(s)}%`);
  };

  add("goalCompletion", evidence.goalCompletion);
  add("subgoalCompletion", evidence.subgoalCompletion);
  add("correctGoalOrder", evidence.correctGoalOrder ? 100 : 30);
  add("sequenceCoherence", evidence.sequenceCoherence);
  add("directionAccuracy", evidence.directionAccuracy);
  if (!isNumberLine) {
    add("efficiencyRatio", evidence.efficiencyRatio);
    add("unnecessaryMoves", Math.min(100, evidence.unnecessaryMoves * 20), true);
    add("routeDeviation", evidence.routeDeviation, true);
    add("obstacleAvoidance", evidence.obstacleAvoidance);
  } else if (nl) {
    add("efficiencyRatio", nl.stepCountingAccuracy);
    add("unnecessaryMoves", Math.min(100, evidence.unnecessaryMoves * 20), true);
    add("predictionAccuracy", nl.orientationUnderstanding);
  }
  add("routeRecovery", evidence.routeRecovery);
  if (!isNumberLine) {
    add("predictionAccuracy", evidence.predictionAccuracy);
  }
  add("wrongTurns", Math.min(100, evidence.wrongTurns * 25), true);
  if (!isNumberLine) {
    add("collisions", Math.min(100, evidence.collisions * 30), true);
  }
  add("passed", evidence.passed ? 100 : 25);
  add("editCount", Math.min(100, evidence.editCount * 15));
  add("robotTouchCount", Math.min(100, evidence.robotTouchCount * 10), true);
  add("hintsUsed", Math.min(100, evidence.hintsUsed * 20), true);

  let score = weightSum > 0 ? total / weightSum : 50;

  if (evidence.passed) score += isPrimary ? 8 : 4;
  if (!evidence.passed && isPrimary) score -= 12;
  if (evidence.attemptNumber > 1 && slug === "debugging") score += 6;

  if (slug === "loops") {
    score = 50;
    evidenceUsed.push("Loops not used in this game — not assessed.");
  }

  return { score: clampScore(score), evidenceUsed };
}

/** Per-construct CT scoring is disabled — assessment uses task-level evidence only. */
export function calculateConstructScores(
  _task: TaskAssessmentConfig,
  _evidence: GameplayEvidence
): ConstructScore[] {
  return [];
}

export function runStealthAssessment(params: {
  taskId: string;
  levelConfig: TaskAssessmentConfig["levelConfig"];
  levelType?: LevelType;
  mappings?: MappingWithConstruct[];
  attempt: AttemptEvidenceInput;
}): StealthAssessmentOutput {
  const task = buildTaskAssessmentConfig(
    params.taskId,
    params.levelConfig,
    params.mappings ?? []
  );
  if (
    task.taskEnvironmentType === "grid" &&
    !task.compareWithOptimalRoute &&
    params.levelType !== LevelType.INTRO &&
    !isFlagPredictionLevel(task.levelConfig, params.levelType) &&
    !isChooseActionLevel(task.levelConfig, params.levelType)
  ) {
    task.compareWithOptimalRoute = true;
  }
  const evidence = extractEvidence(task, params.attempt, params.levelType);
  const constructScores = calculateConstructScores(task, evidence);
  const summary = generateTeacherNarrative({
    task,
    evidence,
    constructScores,
    recommendations: generateRecommendations({ task, evidence, constructScores }),
  });

  return {
    assessmentVersion: "v1",
    taskConfig: task,
    evidence,
    constructScores,
    summary,
    createdAt: new Date().toISOString(),
  };
}
