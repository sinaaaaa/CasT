/**
 * Route simulation and optimal-path analysis via BFS over robot states.
 * State: position (x,y), facing direction, goal progress — NOT Manhattan distance.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { resolveEnabledActionButtons } from "@/lib/level-config";
import {
  extractRouteGoalsFromLevel,
  GRID_BOUNDS,
  resolveRouteStartCell,
  resolveRouteWinCell,
} from "@/lib/assessment/assessmentConfig";
import type { OptimalRouteVariant } from "@/lib/assessment/assessmentTypes";
import type {
  AssessmentGoal,
  FacingLabel,
  OptimalRouteResult,
  PathState,
  RobotCommand,
  RouteComparison,
  RouteUnreachableReason,
  SimulationResult,
  SimulationStep,
  TaskAssessmentConfig,
  Vec2,
} from "@/lib/assessment/assessmentTypes";

const FACING_UP: Vec2 = { x: 0, y: 1 };
const FACING_DOWN: Vec2 = { x: 0, y: -1 };
const FACING_LEFT: Vec2 = { x: -1, y: 0 };
const FACING_RIGHT: Vec2 = { x: 1, y: 0 };

const ALL_COMMANDS: RobotCommand[] = ["forward", "backward", "turn left", "turn right"];

export function vecKey(v: Vec2): string {
  return `${v.x},${v.y}`;
}

function vecEqual(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Number-line props sit on a different row than the robot; match by tick (x) only. */
function cellMatchesForLayout(
  pos: Vec2,
  goalPos: Vec2,
  layoutMode: "GRID" | "NUMBER_LINE" = "GRID"
): boolean {
  if (layoutMode === "NUMBER_LINE") return pos.x === goalPos.x;
  return vecEqual(pos, goalPos);
}

/** Matches Unity CharacterMove: turn left = counter-clockwise (−90°). */
function rotateLeft(f: Vec2): Vec2 {
  return { x: -f.y, y: f.x };
}

/** Matches Unity CharacterMove: turn right = clockwise (+90°). */
function rotateRight(f: Vec2): Vec2 {
  return { x: f.y, y: -f.x };
}

export function normalizeFacing(f: Vec2): Vec2 {
  if (
    vecEqual(f, FACING_UP) ||
    vecEqual(f, FACING_DOWN) ||
    vecEqual(f, FACING_LEFT) ||
    vecEqual(f, FACING_RIGHT)
  ) {
    return f;
  }
  return FACING_UP;
}

export function facingToLabel(f: Vec2): FacingLabel {
  const n = normalizeFacing(f);
  if (vecEqual(n, FACING_UP)) return "up";
  if (vecEqual(n, FACING_DOWN)) return "down";
  if (vecEqual(n, FACING_LEFT)) return "left";
  return "right";
}

export function formatGridCell(pos: Vec2): string {
  return `row ${pos.y + 1}, column ${pos.x + 1}`;
}

function parseCommands(raw: string[]): RobotCommand[] {
  const out: RobotCommand[] = [];
  for (const line of raw) {
    const c = line
      .replace(/^\[a\d+\]\s*/i, "")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ");
    if (c === "forward" || c === "backward" || c === "turn left" || c === "turn right") {
      out.push(c);
    }
  }
  return out;
}

export function blockedCells(config: LevelGameplayConfig): Set<string> {
  const set = new Set<string>();
  for (const o of config.gridObjects) {
    if (o.blocksRobot || o.objectType === "block") {
      set.add(vecKey(o.position));
    }
  }
  return set;
}

function inBounds(p: Vec2, layoutMode: "GRID" | "NUMBER_LINE", tickCount?: number): boolean {
  if (layoutMode === "NUMBER_LINE") {
    const maxX = (tickCount ?? 9) - 1;
    return p.x >= 0 && p.x <= maxX && p.y >= 0 && p.y < GRID_BOUNDS.rows;
  }
  return p.x >= 0 && p.x < GRID_BOUNDS.cols && p.y >= 0 && p.y < GRID_BOUNDS.rows;
}

function orderedGoals(task: TaskAssessmentConfig): AssessmentGoal[] {
  return [...task.goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** Required final facing from level assessment metadata (if any). */
export function taskRequiredFinalFacing(task: TaskAssessmentConfig): Vec2 | undefined {
  const meta = (
    task.levelConfig as LevelGameplayConfig & {
      assessment?: { requiredFinalFacing?: Vec2 };
    }
  ).assessment;
  return meta?.requiredFinalFacing;
}

function goalFacingRequirement(
  goal: AssessmentGoal,
  isFinalGoal: boolean,
  task: TaskAssessmentConfig
): Vec2 | undefined {
  if (goal.requiredFacing) return goal.requiredFacing;
  if (isFinalGoal) return taskRequiredFinalFacing(task);
  return undefined;
}

export function facingMatchesRequirement(facing: Vec2, required?: Vec2): boolean {
  if (!required) return true;
  return vecEqual(normalizeFacing(facing), normalizeFacing(required));
}

export type GoalRelationshipAnalysis = {
  stoppedOnGoal: boolean;
  passedThroughGoal: boolean;
  stoppedBeforeGoal: boolean;
  overshotGoal: boolean;
  undershotGoal: boolean;
  distanceFromGoal: number;
  finalDirectionCorrect: boolean;
  /** Robot visited the goal cell at least once during the program. */
  goalTouched: boolean;
  /** 1-based command step when the robot first stood on the goal (path index). */
  firstGoalTouchStep: number | null;
  /** Same as stoppedOnGoal — explicit for semantic rules. */
  finalStoppedOnGoal: boolean;
  /** Robot left the goal after touching it and did not end on goal. */
  movedAfterGoal: boolean;
  /** 1-based step of first command after first standing on goal. */
  firstExtraAfterGoalStep: number | null;
  /** Distance from final cell to goal when goal was touched but not stopped on. */
  passedGoalDistance: number;
};

/** Win cell for strict stop checks (goal prop or goalCell). */
export function resolveStrictGoalPosition(task: TaskAssessmentConfig): Vec2 | null {
  const win = resolveRouteWinCell(task.levelConfig);
  if (win) return { ...win.position };
  const gc = task.levelConfig.goalCell;
  if (gc != null && gc.x >= 0) return { x: gc.x, y: gc.y };
  const goals = orderedGoals(task);
  const last = goals[goals.length - 1];
  return last ? { ...last.position } : null;
}

/**
 * Goal relationship for debugging — bugFixed must use stoppedOnGoal, not passedThroughGoal.
 */
export function analyzeGoalRelationship(params: {
  pathVisited: Vec2[];
  finalPosition: Vec2;
  goalPosition: Vec2;
  finalDirection: Vec2;
  requiredFinalDirection?: Vec2;
  layoutMode?: "GRID" | "NUMBER_LINE";
}): GoalRelationshipAnalysis {
  const { pathVisited, finalPosition, goalPosition, finalDirection, requiredFinalDirection } =
    params;
  const layoutMode = params.layoutMode ?? "GRID";
  const matches = (a: Vec2, b: Vec2) => cellMatchesForLayout(a, b, layoutMode);
  const finalStoppedOnGoal = matches(finalPosition, goalPosition);
  const stoppedOnGoal = finalStoppedOnGoal;
  const goalTouched = pathVisited.some((p) => matches(p, goalPosition));

  let firstGoalTouchStep: number | null = null;
  for (let i = 0; i < pathVisited.length; i++) {
    if (matches(pathVisited[i], goalPosition)) {
      firstGoalTouchStep = i;
      break;
    }
  }

  const passedThroughGoal =
    !stoppedOnGoal && goalTouched;
  const distanceFromGoal =
    layoutMode === "NUMBER_LINE"
      ? Math.abs(finalPosition.x - goalPosition.x)
      : Math.abs(finalPosition.x - goalPosition.x) + Math.abs(finalPosition.y - goalPosition.y);

  let overshotGoal = false;
  let movedAfterGoal = false;
  let firstExtraAfterGoalStep: number | null = null;

  if (goalTouched && firstGoalTouchStep != null) {
    overshotGoal =
      !stoppedOnGoal &&
      firstGoalTouchStep < pathVisited.length - 1;
    movedAfterGoal = overshotGoal;
    if (movedAfterGoal && firstGoalTouchStep + 1 < pathVisited.length) {
      firstExtraAfterGoalStep = firstGoalTouchStep + 1;
    }
  }

  const stoppedBeforeGoal =
    !goalTouched && !stoppedOnGoal && distanceFromGoal > 0;
  const undershotGoal = stoppedBeforeGoal;

  const passedGoalDistance = goalTouched && !stoppedOnGoal ? distanceFromGoal : 0;

  const finalDirectionCorrect = facingMatchesRequirement(
    finalDirection,
    requiredFinalDirection
  );

  return {
    stoppedOnGoal,
    passedThroughGoal,
    stoppedBeforeGoal,
    overshotGoal,
    undershotGoal,
    distanceFromGoal,
    finalDirectionCorrect,
    goalTouched,
    firstGoalTouchStep,
    finalStoppedOnGoal,
    movedAfterGoal,
    firstExtraAfterGoalStep,
    passedGoalDistance,
  };
}

/** Strict completion: final stop on goal + facing + visit order; not “passed through” goal. */
export function programStopsOnGoalStrict(
  task: TaskAssessmentConfig,
  sim: SimulationResult
): boolean {
  const goalPosition = resolveStrictGoalPosition(task);
  if (!goalPosition) return false;
  const rel = analyzeGoalRelationship({
    pathVisited: sim.path,
    finalPosition: sim.finalPosition,
    goalPosition,
    finalDirection: sim.finalDirection,
    requiredFinalDirection: taskRequiredFinalFacing(task),
    layoutMode: task.levelConfig.layoutMode ?? "GRID",
  });
  if (!rel.stoppedOnGoal || !rel.finalDirectionCorrect) return false;
  if (sim.collisions.length > 0) return false;
  if (task.levelConfig.visitObjectSequence && !sim.correctGoalOrder) return false;
  return true;
}

export function allowedCommandsForTask(task: TaskAssessmentConfig): RobotCommand[] {
  return resolveEnabledActionButtons(task.levelConfig) as RobotCommand[];
}

function applyCommand(
  pos: Vec2,
  facing: Vec2,
  cmd: RobotCommand,
  blocked: Set<string>,
  bounds: { layoutMode: "GRID" | "NUMBER_LINE"; tickCount?: number }
): {
  pos: Vec2;
  facing: Vec2;
  collision: boolean;
  wrongTurn: boolean;
  attemptedCell?: Vec2;
  obstacleCollision?: boolean;
} {
  let collision = false;
  let wrongTurn = false;
  let newPos = { ...pos };
  let newFacing = normalizeFacing(facing);

  if (cmd === "turn left") {
    newFacing = rotateLeft(newFacing);
    return { pos: newPos, facing: newFacing, collision: false, wrongTurn };
  }
  if (cmd === "turn right") {
    newFacing = rotateRight(newFacing);
    return { pos: newPos, facing: newFacing, collision: false, wrongTurn };
  }

  if (bounds.layoutMode === "NUMBER_LINE") {
    const fx = newFacing.x;
    if (fx === 0) {
      return { pos: newPos, facing: newFacing, collision: false, wrongTurn: false };
    }
    const sign = cmd === "forward" ? fx : -fx;
    const candidate = { x: newPos.x + sign, y: newPos.y };
    if (!inBounds(candidate, bounds.layoutMode, bounds.tickCount)) {
      collision = true;
      wrongTurn = cmd === "forward" || cmd === "backward";
      return {
        pos: newPos,
        facing: newFacing,
        collision,
        wrongTurn,
        attemptedCell: { ...candidate },
        obstacleCollision: false,
      };
    }
    if (blocked.has(vecKey(candidate))) {
      collision = true;
      return {
        pos: newPos,
        facing: newFacing,
        collision,
        wrongTurn: false,
        attemptedCell: { ...candidate },
        obstacleCollision: true,
      };
    }
    newPos = candidate;
    return { pos: newPos, facing: newFacing, collision, wrongTurn };
  }

  const delta =
    cmd === "forward"
      ? { x: newFacing.x, y: newFacing.y }
      : { x: -newFacing.x, y: -newFacing.y };

  const candidate = { x: newPos.x + delta.x, y: newPos.y + delta.y };
  if (!inBounds(candidate, bounds.layoutMode, bounds.tickCount)) {
    collision = true;
    wrongTurn = cmd === "forward" || cmd === "backward";
    return {
      pos: newPos,
      facing: newFacing,
      collision,
      wrongTurn,
      attemptedCell: { ...candidate },
      obstacleCollision: false,
    };
  }
  if (blocked.has(vecKey(candidate))) {
    collision = true;
    return {
      pos: newPos,
      facing: newFacing,
      collision,
      wrongTurn: false,
      attemptedCell: { ...candidate },
      obstacleCollision: true,
    };
  }
  newPos = candidate;
  return { pos: newPos, facing: newFacing, collision, wrongTurn };
}

function usesOrderedGoals(task: TaskAssessmentConfig): boolean {
  if (task.goals.length <= 1) return false;
  return Boolean(task.requiredGoalOrder || task.levelConfig.visitObjectSequence);
}

function inferUnreachableReason(
  task: TaskAssessmentConfig,
  win: { position: Vec2 } | null,
  goals: AssessmentGoal[]
): RouteUnreachableReason {
  if (!win && goals.length === 0) return "no_goal";
  if (taskRequiredFinalFacing(task)) return "required_facing";
  return "no_path";
}

/** Whether BFS produced a usable best-route comparison (includes 0-command wins). */
export function isOptimalRouteAvailable(
  comparison: Pick<
    RouteComparison,
    | "optimalReachable"
    | "optimalPath"
    | "optimalCommandCount"
    | "routeStartPosition"
    | "routeGoalPosition"
  >
): boolean {
  if (comparison.optimalReachable === true) {
    return (comparison.optimalPath?.length ?? 0) > 0;
  }
  if (comparison.optimalPath.length === 0) return false;
  if (comparison.optimalCommandCount > 0) return true;
  const start = comparison.routeStartPosition;
  const goal = comparison.routeGoalPosition;
  return Boolean(start && goal && vecEqual(start, goal));
}

function advanceGoalProgress(
  progress: number,
  pos: Vec2,
  facing: Vec2,
  goals: AssessmentGoal[],
  task: TaskAssessmentConfig,
  layoutMode: "GRID" | "NUMBER_LINE" = "GRID"
): number {
  if (goals.length === 0) return progress;

  const atGoal = (g: AssessmentGoal) => cellMatchesForLayout(pos, g.position, layoutMode);

  if (usesOrderedGoals(task)) {
    if (progress >= goals.length) return progress;
    const g = goals[progress];
    const isFinal = progress === goals.length - 1;
    if (
      g &&
      atGoal(g) &&
      facingMatchesRequirement(facing, goalFacingRequirement(g, isFinal, task))
    ) {
      return progress + 1;
    }
    return progress;
  }

  let mask = progress;
  goals.forEach((g, i) => {
    const bit = 1 << i;
    if ((mask & bit) !== 0) return;
    const isFinal = i === goals.length - 1;
    if (
      atGoal(g) &&
      facingMatchesRequirement(facing, goalFacingRequirement(g, isFinal, task))
    ) {
      mask |= bit;
    }
  });
  return mask;
}

function isGoalProgressComplete(
  progress: number,
  pos: Vec2,
  facing: Vec2,
  goals: AssessmentGoal[],
  task: TaskAssessmentConfig,
  layoutMode: "GRID" | "NUMBER_LINE" = "GRID"
): boolean {
  if (goals.length === 0) {
    const gc = task.levelConfig.goalCell;
    if (!gc || gc.x < 0 || gc.y < 0) return false;
    if (!cellMatchesForLayout(pos, gc, layoutMode)) return false;
    return facingMatchesRequirement(facing, taskRequiredFinalFacing(task));
  }

  if (usesOrderedGoals(task)) {
    if (progress < goals.length) return false;
  } else {
    const targetMask = (1 << goals.length) - 1;
    if ((progress & targetMask) !== targetMask) return false;
  }

  const last = goals[goals.length - 1];
  if (!cellMatchesForLayout(pos, last.position, layoutMode)) return false;
  return facingMatchesRequirement(
    facing,
    goalFacingRequirement(last, true, task)
  );
}

function countTurns(commands: RobotCommand[]): number {
  return commands.filter((c) => c.includes("turn")).length;
}

/** Goals already satisfied when the robot spawns on a visit/goal cell. */
function initialGoalProgress(
  pos: Vec2,
  facing: Vec2,
  goals: AssessmentGoal[],
  task: TaskAssessmentConfig,
  layoutMode: "GRID" | "NUMBER_LINE" = "GRID"
): number {
  if (goals.length === 0) return 0;

  const atGoal = (g: AssessmentGoal) => cellMatchesForLayout(pos, g.position, layoutMode);

  if (usesOrderedGoals(task)) {
    let progress = 0;
    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      if (
        atGoal(g) &&
        facingMatchesRequirement(facing, goalFacingRequirement(g, i === goals.length - 1, task))
      ) {
        progress++;
      } else {
        break;
      }
    }
    return progress;
  }

  let mask = 0;
  goals.forEach((g, i) => {
    if (
      atGoal(g) &&
      facingMatchesRequirement(facing, goalFacingRequirement(g, i === goals.length - 1, task))
    ) {
      mask |= 1 << i;
    }
  });
  return mask;
}

/** Simulate student program on the level grid. */
export function simulateProgram(
  level: TaskAssessmentConfig | LevelGameplayConfig,
  commandInput: string | string[]
): SimulationResult {
  const config = "levelConfig" in level ? level.levelConfig : level;
  const task = "goals" in level ? (level as TaskAssessmentConfig) : null;
  const goals = task?.goals ?? [];
  const layoutMode = config.layoutMode ?? "GRID";
  const tickCount = config.numberLine?.tickCount;

  const commands =
    typeof commandInput === "string"
      ? parseCommands(
          commandInput
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      : parseCommands(commandInput);

  const blocked = blockedCells(config);
  const hasObstacle = blocked.size > 0;
  const bounds = { layoutMode, tickCount };
  let pos: Vec2 = { ...config.robotStartPosition };
  let facing = normalizeFacing(config.robotStartFacing);
  const path: Vec2[] = [{ ...pos }];
  const pathStates: PathState[] = [{ position: { ...pos }, facing: { ...facing } }];
  const steps: SimulationStep[] = [];
  const collisions: Vec2[] = [];
  const obstacleCollisionSteps: number[] = [];
  const attemptedObstacleCells: Vec2[] = [];
  let firstObstacleMistakeStep: number | null = null;
  let wrongTurns = 0;
  const reachedGoalIds: string[] = [];
  const ordered = [...goals].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  let visitIndex = 0;

  for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
    const cmd = commands[cmdIndex];
    const stepNum = cmdIndex + 1;
    const before = { pos: { ...pos }, facing: { ...facing } };
    const result = applyCommand(pos, facing, cmd, blocked, bounds);
    pos = result.pos;
    facing = result.facing;
    if (result.collision) {
      if (result.obstacleCollision && result.attemptedCell) {
        collisions.push({ ...result.attemptedCell });
        obstacleCollisionSteps.push(stepNum);
        attemptedObstacleCells.push({ ...result.attemptedCell });
        if (firstObstacleMistakeStep == null) firstObstacleMistakeStep = stepNum;
      } else {
        collisions.push({ ...pos });
      }
    }
    if (result.wrongTurn) wrongTurns++;

    steps.push({
      command: cmd,
      positionBefore: before.pos,
      positionAfter: { ...pos },
      facingBefore: before.facing,
      facingAfter: { ...facing },
      collision: result.collision,
      wrongTurn: result.wrongTurn,
      attemptedCell: result.attemptedCell,
      obstacleCollision: result.obstacleCollision,
    });
    path.push({ ...pos });
    pathStates.push({ position: { ...pos }, facing: { ...facing } });

    if (config.visitObjectSequence && ordered.length > 0) {
      const nextGoal = ordered[visitIndex];
      if (
        nextGoal &&
        cellMatchesForLayout(pos, nextGoal.position, layoutMode) &&
        facingMatchesRequirement(
          facing,
          task
            ? goalFacingRequirement(nextGoal, visitIndex === ordered.length - 1, task)
            : nextGoal.requiredFacing
        )
      ) {
        reachedGoalIds.push(nextGoal.id);
        visitIndex++;
      }
    } else {
      for (const g of goals) {
        if (
          cellMatchesForLayout(pos, g.position, layoutMode) &&
          !reachedGoalIds.includes(g.id)
        ) {
          reachedGoalIds.push(g.id);
        }
      }
    }
  }

  const totalGoals = Math.max(1, goals.length);
  const goalCompletion = (reachedGoalIds.length / totalGoals) * 100;
  const subgoalCompletion =
    ordered.length > 0 ? (visitIndex / ordered.length) * 100 : goalCompletion;

  let correctGoalOrder = true;
  if (config.visitObjectSequence && ordered.length >= 2) {
    correctGoalOrder =
      reachedGoalIds[0] === ordered[0]?.id &&
      (reachedGoalIds.length < 2 || reachedGoalIds[1] === ordered[1]?.id);
  }

  const finalGoal = goals[goals.length - 1];
  const passed =
    goals.length === 0
      ? config.goalCell != null &&
        config.goalCell.x >= 0 &&
        cellMatchesForLayout(pos, config.goalCell, layoutMode)
      : finalGoal
        ? reachedGoalIds.includes(finalGoal.id) ||
          cellMatchesForLayout(pos, finalGoal.position, layoutMode)
        : reachedGoalIds.length >= totalGoals;

  return {
    commands,
    path,
    pathStates,
    steps,
    collisions,
    wrongTurns,
    finalPosition: pos,
    finalDirection: facing,
    reachedGoals: reachedGoalIds,
    goalCompletion,
    subgoalCompletion,
    correctGoalOrder,
    commandCount: commands.length,
    turnCount: countTurns(commands),
    passed,
    hasObstacle,
    obstacleCollisionCount: obstacleCollisionSteps.length,
    obstacleCollisionSteps,
    attemptedObstacleCells,
    firstObstacleMistakeStep,
  };
}

type BfsState = {
  pos: Vec2;
  facing: Vec2;
  /** Ordered: count of goals done. Unordered: bitmask of reached goals. */
  goalProgress: number;
  commands: RobotCommand[];
  path: Vec2[];
  pathStates: PathState[];
};

function bfsStateKey(s: BfsState, ordered: boolean): string {
  return `${vecKey(s.pos)}|${vecKey(s.facing)}|${ordered ? "o" : "m"}:${s.goalProgress}`;
}

const MAX_OPTIMAL_ROUTES_STORED = 12;

function bfsStateToVariant(state: BfsState): OptimalRouteVariant {
  return {
    path: state.path,
    pathStates: state.pathStates,
    commands: state.commands,
    commandCount: state.commands.length,
  };
}

function commandSignature(commands: RobotCommand[]): string {
  return commands.join("|");
}

/**
 * Rank shortest routes so the canonical "best" matches typical game solutions:
 * prefer forward steps over backward workarounds at the same command count.
 */
export function rankOptimalRoute(commands: RobotCommand[]): number {
  let score = 0;
  for (const c of commands) {
    switch (c) {
      case "forward":
        score += 100;
        break;
      case "backward":
        score -= 120;
        break;
      case "turn right":
        score += 2;
        break;
      case "turn left":
        score += 1;
        break;
    }
  }
  return score;
}

function compareOptimalRoutes(a: BfsState, b: BfsState): number {
  const diff = rankOptimalRoute(b.commands) - rankOptimalRoute(a.commands);
  if (diff !== 0) return diff;
  return commandSignature(a.commands).localeCompare(commandSignature(b.commands));
}

function pickBestOptimalRoute(
  candidates: BfsState[],
  startPos: Vec2,
  goalPos?: Vec2 | null
): BfsState {
  const valid = goalPos
    ? candidates.filter((t) => pathEndsAtGoal(t, startPos, goalPos))
    : candidates;
  const pool = valid.length > 0 ? valid : candidates;
  return pool.reduce((best, cur) => (compareOptimalRoutes(cur, best) > 0 ? cur : best));
}

/**
 * BFS: all shortest command sequences from robot start → win cell.
 * Each action costs 1: forward, backward, turn left, turn right.
 */
export function findOptimalRoute(task: TaskAssessmentConfig): OptimalRouteResult {
  const config = task.levelConfig;
  let goals = orderedGoals(task);
  if (goals.length === 0) {
    goals = [...extractRouteGoalsFromLevel(config)].sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99)
    );
  }
  const win = resolveRouteWinCell(config);
  if (!win && goals.length === 0) {
    return {
      path: [],
      pathStates: [],
      commands: [],
      commandCount: 0,
      reachable: false,
      unreachableReason: "no_goal",
      totalOptimalRouteCount: 0,
    };
  }
  const startAnchor = resolveRouteStartCell(config);
  const blocked = blockedCells(config);
  const bounds = {
    layoutMode: task.layoutMode,
    tickCount: config.numberLine?.tickCount,
  };
  const ordered = usesOrderedGoals(task);
  const cmdOrder = allowedCommandsForTask(task);

  const startFacing = normalizeFacing(startAnchor.facing);
  const startProgress = initialGoalProgress(
    startAnchor.position,
    startFacing,
    goals,
    task,
    task.layoutMode
  );
  const start: BfsState = {
    pos: { ...startAnchor.position },
    facing: startFacing,
    goalProgress: startProgress,
    commands: [],
    path: [{ ...startAnchor.position }],
    pathStates: [{ position: { ...startAnchor.position }, facing: { ...startFacing } }],
  };

  const queue: BfsState[] = [start];
  const seen = new Set<string>([bfsStateKey(start, ordered)]);
  const maxDepth = 128;
  const terminal: BfsState[] = [];
  let minCommandCount: number | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;

    if (isGoalProgressComplete(cur.goalProgress, cur.pos, cur.facing, goals, task, task.layoutMode)) {
      if (minCommandCount === null) minCommandCount = cur.commands.length;
      if (cur.commands.length === minCommandCount) {
        terminal.push(cur);
      }
      continue;
    }

    if (minCommandCount !== null && cur.commands.length >= minCommandCount) continue;
    if (cur.commands.length >= maxDepth) continue;

    for (const cmd of cmdOrder) {
      const applied = applyCommand(cur.pos, cur.facing, cmd, blocked, bounds);
      const nextPos = applied.pos;
      const nextProgress = advanceGoalProgress(
        cur.goalProgress,
        nextPos,
        applied.facing,
        goals,
        task,
        task.layoutMode
      );

      const next: BfsState = {
        pos: nextPos,
        facing: applied.facing,
        goalProgress: nextProgress,
        commands: [...cur.commands, cmd],
        path: [...cur.path, { ...nextPos }],
        pathStates: [
          ...cur.pathStates,
          { position: { ...nextPos }, facing: { ...applied.facing } },
        ],
      };
      const key = bfsStateKey(next, ordered);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }

  if (terminal.length === 0 || minCommandCount === null) {
    return {
      path: [start.pos],
      pathStates: start.pathStates,
      commands: [],
      commandCount: 0,
      reachable: false,
      unreachableReason: inferUnreachableReason(task, win, goals),
      totalOptimalRouteCount: 0,
    };
  }

  const allSigs = new Set<string>();
  for (const t of terminal) {
    allSigs.add(commandSignature(t.commands));
  }

  const unique: BfsState[] = [];
  const stored = new Set<string>();
  for (const t of terminal) {
    const sig = commandSignature(t.commands);
    if (stored.has(sig)) continue;
    stored.add(sig);
    unique.push(t);
    if (unique.length >= MAX_OPTIMAL_ROUTES_STORED) break;
  }

  unique.sort(compareOptimalRoutes);

  const pick = pickBestOptimalRoute(unique, startAnchor.position, win?.position);

  const alternatives = unique
    .filter((t) => t !== pick)
    .map(bfsStateToVariant);

  return {
    path: pick.path,
    pathStates: pick.pathStates,
    commands: pick.commands,
    commandCount: pick.commands.length,
    reachable: true,
    alternativeRoutes: alternatives,
    totalOptimalRouteCount: allSigs.size,
  };
}

function pathEndsAtGoal(
  state: BfsState,
  startPos: Vec2,
  goalPos?: Vec2 | null
): boolean {
  if (!goalPos) return true;
  const first = state.pathStates[0]?.position ?? state.path[0];
  const last = state.pathStates[state.pathStates.length - 1]?.position;
  return vecEqual(first, startPos) && vecEqual(last, goalPos);
}

export function buildRouteEndpoints(task: TaskAssessmentConfig): {
  startPosition: Vec2;
  startFacing: FacingLabel;
  routeStartPosition: Vec2;
  routeGoalPosition: Vec2;
  goalPositions: Vec2[];
  goalLabels: string[];
  requiredEndFacing?: FacingLabel;
} {
  const config = task.levelConfig;
  const start = resolveRouteStartCell(config);
  const win = resolveRouteWinCell(config);
  const goalPositions = win ? [win.position] : [];
  const goalLabels = win ? [win.label] : [];
  const req = taskRequiredFinalFacing(task);
  return {
    startPosition: { ...start.position },
    startFacing: facingToLabel(start.facing),
    routeStartPosition: { ...start.position },
    routeGoalPosition: win ? { ...win.position } : { ...start.position },
    goalPositions,
    goalLabels,
    requiredEndFacing: req ? facingToLabel(req) : undefined,
  };
}

/** Teacher-facing sentence comparing student program to BFS-optimal program. */
export function buildRouteInterpretation(
  comparison: RouteComparison | null,
  simulationPassed: boolean
): string {
  if (!comparison || comparison.studentCommandCount === 0) {
    return "No command program was recorded for this attempt. Route comparison needs the student's final program or the level starter program.";
  }
  if (!isOptimalRouteAvailable(comparison)) {
    const hint = unreachableReasonHint(comparison.unreachableReason);
    return `The student's path is shown below. A best-route comparison could not be calculated${hint ? ` — ${hint}` : " — check goals, start position, and obstacles."}`;
  }
  if (comparison.optimalCommandCount === 0) {
    return "The student already starts on the goal — the shortest program uses 0 commands.";
  }

  if (comparison.extraCommands === 0 && comparison.extraTurns === 0) {
    return "The student's program matches the shortest command sequence for this level — strong planning and efficiency.";
  }

  if (simulationPassed) {
    if (comparison.extraTurns > 0 && comparison.extraCommands === comparison.extraTurns) {
      return `The student reached the goal, but used ${comparison.extraTurns} extra turn${comparison.extraTurns === 1 ? "" : "s"} compared with the best route.`;
    }
    if (comparison.extraCommands > 0) {
      const turnPart =
        comparison.extraTurns > 0
          ? ` (including ${comparison.extraTurns} extra turn${comparison.extraTurns === 1 ? "" : "s"})`
          : "";
      return `The student reached the goal, but used ${comparison.extraCommands} extra command${comparison.extraCommands === 1 ? "" : "s"} compared with the best route${turnPart}.`;
    }
  }

  const parts: string[] = [];
  if (comparison.extraCommands > 0) {
    parts.push(`${comparison.extraCommands} extra command${comparison.extraCommands === 1 ? "" : "s"}`);
  }
  if (comparison.extraTurns > 0) {
    parts.push(`${comparison.extraTurns} extra turn${comparison.extraTurns === 1 ? "" : "s"}`);
  }
  if (comparison.wrongTurns > 0) {
    parts.push(`${comparison.wrongTurns} bump${comparison.wrongTurns === 1 ? "" : "s"} into a wall or edge`);
  }
  if (comparison.collisions > 0) {
    parts.push(`${comparison.collisions} collision${comparison.collisions === 1 ? "" : "s"} with obstacles`);
  }

  return `Student program: ${comparison.studentCommandCount} commands · Best route: ${comparison.optimalCommandCount} commands${parts.length > 0 ? ` · ${parts.join("; ")}` : ""}.`;
}

export function unreachableReasonHint(
  reason?: RouteUnreachableReason
): string | null {
  switch (reason) {
    case "no_goal":
      return "no level goal is set (add visit step 2 / end object, or a valid goal cell)";
    case "no_path":
      return "the robot cannot reach the goal through the maze (obstacles or blocked cells)";
    case "required_facing":
      return "no shortest program satisfies the required final facing at the goal";
    case "out_of_bounds":
      return "the goal or spawn is outside the playable grid";
    default:
      return null;
  }
}

export function compareRoutes(
  simulation: SimulationResult,
  optimal: OptimalRouteResult | null,
  task: TaskAssessmentConfig
): RouteComparison | null {
  if (simulation.commandCount === 0 && simulation.path.length <= 1) return null;

  const endpoints = buildRouteEndpoints(task);
  const studentCommands = simulation.commands;
  const optimalCommands = optimal?.commands ?? [];
  const studentTurnCount = countTurns(studentCommands);
  const optimalTurnCount = countTurns(optimalCommands);
  const extraCommands = Math.max(0, studentCommands.length - optimalCommands.length);
  const extraTurns = Math.max(0, studentTurnCount - optimalTurnCount);

  const routeStartPosition = endpoints.routeStartPosition;
  const routeGoalPosition = endpoints.routeGoalPosition;

  const optimalLast = optimal?.pathStates?.[optimal.pathStates.length - 1];
  const optimalEndFacing = optimalLast
    ? facingToLabel(optimalLast.facing)
    : endpoints.startFacing;

  const base = {
    studentCommands,
    optimalCommands,
    extraCommands,
    extraTurns,
    studentTurnCount,
    optimalTurnCount,
    wrongTurns: simulation.wrongTurns,
    collisions: simulation.collisions.length,
    startPosition: routeStartPosition,
    startFacing: endpoints.startFacing,
    routeStartPosition,
    routeGoalPosition,
    endPosition: routeGoalPosition,
    studentEndFacing: facingToLabel(simulation.finalDirection),
    optimalEndFacing,
    requiredEndFacing: endpoints.requiredEndFacing,
    goalPositions: [routeGoalPosition],
    goalLabels: endpoints.goalLabels,
    alternativeOptimalRoutes: optimal?.alternativeRoutes,
    totalOptimalRouteCount: optimal?.totalOptimalRouteCount,
    optimalReachable: false,
    unreachableReason: optimal?.unreachableReason,
  };

  const optimalReachable =
    optimal?.reachable === true && (optimal.path?.length ?? 0) > 0;

  if (!optimalReachable) {
    return {
      studentCommandCount: simulation.commandCount,
      optimalCommandCount: 0,
      efficiencyRatio: 0,
      unnecessaryMoves: 0,
      routeDeviation: 0,
      overlapCells: 0,
      extraCells: simulation.path,
      collisionPoints: simulation.collisions,
      studentPath: simulation.path,
      optimalPath: [],
      studentPathStates: simulation.pathStates,
      optimalPathStates: [],
      ...base,
      optimalReachable: false,
      unreachableReason: optimal?.unreachableReason,
    };
  }

  const studentSet = new Set(simulation.path.map(vecKey));
  const optimalSet = new Set(optimal.path.map(vecKey));
  let overlap = 0;
  for (const k of studentSet) {
    if (optimalSet.has(k)) overlap++;
  }

  const extraCells = simulation.path.filter((p) => !optimalSet.has(vecKey(p)));
  const unnecessaryMoves = extraCommands;
  const efficiencyRatio = Math.min(
    1,
    optimal.commandCount / Math.max(simulation.commandCount, 1)
  );

  const routeDeviation =
    optimal.path.length > 0
      ? Math.round((1 - overlap / Math.max(studentSet.size, 1)) * 100)
      : 0;

  return {
    studentCommandCount: simulation.commandCount,
    optimalCommandCount: optimal.commandCount,
    efficiencyRatio: Math.round(efficiencyRatio * 100),
    unnecessaryMoves,
    routeDeviation,
    overlapCells: overlap,
    extraCells,
    collisionPoints: simulation.collisions,
    studentPath: simulation.path,
    optimalPath: optimal.path,
    studentPathStates: simulation.pathStates,
    optimalPathStates: optimal.pathStates ?? [],
    ...base,
    optimalReachable: true,
  };
}
