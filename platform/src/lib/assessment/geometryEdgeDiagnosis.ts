/**
 * Geometry Path edge diagnosis — replays the student's program on the grid, checks
 * every target edge, and explains what went wrong when an edge was not met
 * (wrong turn, missing turn, stopped short, Repeat count, destination, …).
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import type { RobotCommand, Vec2 } from "@/lib/assessment/assessmentTypes";
import { parseGeometryPathTelemetry } from "@/lib/attempt-mistakes";
import { geometryRequiresDestination, geometryRequiresFinishFacing, segmentKey } from "@/lib/geometry-path";
import { formatRepeatStart, parseRepeatStart } from "@/lib/assessment/expand-repeats";
import { checkGeometryRun, expandBlockProgram } from "@/lib/assessment/blockProgram";
import { describeStructureBlock } from "@/lib/assessment/programStructureAnalysis";

export type GeometryIssueKind =
  | "no_program"
  | "wrong_start_direction"
  | "wrong_turn_direction"
  | "missing_turn"
  | "extra_turn"
  | "needed_turn_around"
  | "left_shape"
  | "hit_wall"
  | "stopped_short"
  | "repeat_too_few"
  | "repeat_too_many"
  | "extra_edges"
  | "destination_missed"
  | "destination_overshot"
  | "wrong_final_facing";

export type GeometryIssue = {
  kind: GeometryIssueKind;
  title: string;
  message: string;
  /** What the student could change. */
  fix: string | null;
  /** 1-based command step, when tied to one. */
  step: number | null;
  /** 1-based strip block, when tied to one. */
  block: number | null;
  blockLabel: string | null;
};

export type GeometryEdgeCheck = {
  key: string;
  from: Vec2;
  to: Vec2;
  met: boolean;
  metAtStep: number | null;
  metByBlock: number | null;
  /** Why it was missed (null when met). */
  reason: string | null;
};

export type GeometryReplayStep = {
  step: number;
  command: RobotCommand;
  block: number;
  blockLabel: string;
  from: Vec2;
  to: Vec2;
  facingAfter: string;
  edgeKey: string | null;
  onShape: boolean | null;
  collision: boolean;
};

export type GeometryEdgeDiagnosis = {
  available: boolean;
  hasProgram: boolean;
  succeeded: boolean;
  targetCount: number;
  metCount: number;
  edges: GeometryEdgeCheck[];
  extraEdges: { key: string; step: number; block: number }[];
  retracedEdgeCount: number;
  shapeCompleteAtStep: number | null;
  finalCell: Vec2 | null;
  finalFacing: string | null;
  issues: GeometryIssue[];
  primaryIssue: GeometryIssue | null;
  steps: GeometryReplayStep[];
  /** Replay disagrees with the edges the game recorded (edge status uses the game's record). */
  telemetryMismatch: boolean;
  summary: string;
};

const DIR_WORD: Record<string, string> = { "0,1": "up", "0,-1": "down", "-1,0": "left", "1,0": "right" };

function dirWord(v: Vec2): string {
  return DIR_WORD[`${Math.sign(v.x)},${Math.sign(v.y)}`] ?? "?";
}
function cell(v: Vec2): string {
  return `(${v.x}, ${v.y})`;
}
function eq(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
function rotL(f: Vec2): Vec2 {
  return { x: -f.y, y: f.x };
}
function rotR(f: Vec2): Vec2 {
  return { x: f.y, y: -f.x };
}
function parseEdge(key: string): { from: Vec2; to: Vec2 } {
  const [a, b] = key.split("|");
  const [ax, ay] = (a ?? "0,0").split(",").map(Number);
  const [bx, by] = (b ?? "0,0").split(",").map(Number);
  return { from: { x: ax ?? 0, y: ay ?? 0 }, to: { x: bx ?? 0, y: by ?? 0 } };
}
function edgeTouches(key: string, c: Vec2): Vec2 | null {
  const e = parseEdge(key);
  if (eq(e.from, c)) return e.to;
  if (eq(e.to, c)) return e.from;
  return null;
}

/** Which turn gets from `from` facing to `to` facing. */
function turnNeeded(from: Vec2, to: Vec2): "none" | "turn left" | "turn right" | "turn around" {
  if (eq(from, to)) return "none";
  if (eq(rotL(from), to)) return "turn left";
  if (eq(rotR(from), to)) return "turn right";
  return "turn around";
}

export function diagnoseGeometryProgram(args: {
  config: LevelGameplayConfig;
  blockTokens: string[];
  mistakes: unknown;
  passed?: boolean | null;
}): GeometryEdgeDiagnosis {
  const { config, blockTokens, mistakes } = args;
  const gp = config.geometryPath;
  const bags = config.commandBags ?? [];
  const segments = gp?.segments ?? [];
  const blocks = blockTokens.map((t) => describeStructureBlock(t, bags));
  const { commands, blockOfCommand } = expandBlockProgram(blockTokens, bags);
  const run = checkGeometryRun(config, commands);
  const { sim, edgeOfCommand, target } = run;

  const blockLabel = (cmdIndex: number) => blocks[blockOfCommand[cmdIndex] ?? -1]?.label ?? "";
  const blockNo = (cmdIndex: number) => (blockOfCommand[cmdIndex] ?? -1) + 1 || null;

  // ── Replay rows ──
  const steps: GeometryReplayStep[] = sim.steps.map((s, i) => ({
    step: i + 1,
    command: s.command,
    block: (blockOfCommand[i] ?? 0) + 1,
    blockLabel: blockLabel(i),
    from: s.positionBefore,
    to: s.positionAfter,
    facingAfter: dirWord(s.facingAfter),
    edgeKey: edgeOfCommand[i] ?? null,
    onShape: edgeOfCommand[i] ? target.has(edgeOfCommand[i]!) : null,
    collision: s.collision,
  }));

  // ── When each target edge was met (replay) ──
  const metAt = new Map<string, number>();
  const travelCount = new Map<string, number>();
  let shapeCompleteAtStep: number | null = null;
  const extraEdges: { key: string; step: number; block: number }[] = [];
  edgeOfCommand.forEach((key, i) => {
    if (!key) return;
    travelCount.set(key, (travelCount.get(key) ?? 0) + 1);
    if (target.has(key)) {
      if (!metAt.has(key)) metAt.set(key, i);
      if (shapeCompleteAtStep == null && metAt.size === target.size) shapeCompleteAtStep = i + 1;
    } else if (!extraEdges.some((e) => e.key === key)) {
      extraEdges.push({ key, step: i + 1, block: (blockOfCommand[i] ?? 0) + 1 });
    }
  });
  const retracedEdgeCount = [...travelCount.values()].filter((n) => n > 1).length;

  // Prefer the edges the game actually recorded for met / not met.
  const tel = parseGeometryPathTelemetry(mistakes);
  const telSet = tel ? new Set([...tel.traveledKeys, ...tel.completedKeys]) : null;
  const telemetryMismatch =
    !!telSet &&
    telSet.size > 0 &&
    ([...target].some((k) => telSet.has(k) !== run.traveled.has(k)) ||
      [...telSet].some((k) => !run.traveled.has(k)));
  const isMet = (k: string) => (telSet && telSet.size > 0 ? telSet.has(k) : run.traveled.has(k));

  // ── Why each missed edge was missed ──
  /** Arrivals at a cell (path index), ignoring turns in place. */
  const arrivalsAt = (c: Vec2) =>
    sim.path.map((p, i) => (eq(p, c) && (i === 0 || !eq(sim.path[i - 1]!, c)) ? i : -1)).filter((i) => i >= 0);
  /** What the robot did after arriving: moved (and where), bumped a wall, or the program ended. */
  const departureAfter = (i: number, c: Vec2): { kind: "move"; dir: Vec2; key: string } | { kind: "bump" } | { kind: "end" } => {
    for (let j = i; j < sim.steps.length; j++) {
      const s = sim.steps[j]!;
      if (!eq(s.positionBefore, c)) break;
      if (s.collision) return { kind: "bump" };
      if (!eq(s.positionBefore, s.positionAfter)) {
        return {
          kind: "move",
          dir: { x: s.positionAfter.x - c.x, y: s.positionAfter.y - c.y },
          key: segmentKey(s.positionBefore, s.positionAfter),
        };
      }
    }
    return { kind: "end" };
  };
  const edges: GeometryEdgeCheck[] = segments.map((seg) => {
    const key = segmentKey(seg.from, seg.to);
    const met = isMet(key);
    const at = metAt.get(key);
    let reason: string | null = null;
    if (!met) {
      const visits = [
        ...arrivalsAt(seg.from).map((i) => ({ i, c: seg.from, other: seg.to })),
        ...arrivalsAt(seg.to).map((i) => ({ i, c: seg.to, other: seg.from })),
      ].sort((a, b) => a.i - b.i);
      const when = (i: number) => (i === 0 ? "at the start" : `after step ${i}`);
      if (!visits.length) {
        reason = "The robot never reached either end of this edge.";
      } else {
        let found: string | null = null;
        let endedAt: Vec2 | null = null;
        for (const v of visits) {
          const wantDir = dirWord({ x: v.other.x - v.c.x, y: v.other.y - v.c.y });
          const dep = departureAfter(v.i, v.c);
          if (dep.kind === "end") {
            endedAt = v.c;
            continue;
          }
          if (dep.kind === "bump") {
            found = `The robot reached ${cell(v.c)} ${when(v.i)} and bumped into a wall instead of moving ${wantDir}.`;
            break;
          }
          if (!target.has(dep.key)) {
            found = `The robot reached ${cell(v.c)} ${when(v.i)} and moved ${dirWord(dep.dir)} (off the shape) instead of ${wantDir}.`;
            break;
          }
        }
        reason =
          found ??
          (endedAt
            ? `The robot reached ${cell(endedAt)} but the program ended before it traced this edge.`
            : `The robot passed through ${cell(visits[0]!.c)} while tracing other edges but never came back for this one.`);
      }
    }
    return {
      key,
      from: seg.from,
      to: seg.to,
      met,
      metAtStep: at != null ? at + 1 : null,
      metByBlock: at != null ? blockNo(at) : null,
      reason,
    };
  });
  const metCount = edges.filter((e) => e.met).length;
  const targetCount = edges.length;

  // ── What happened ──
  const issues: GeometryIssue[] = [];
  const hasProgram = commands.length > 0;
  const shapeNeeded = gp?.validationMode !== "FINAL_POSITION" && gp?.validationMode !== "FINAL_POSITION_DIRECTION";

  if (!hasProgram) {
    issues.push({
      kind: "no_program",
      title: "No program recorded",
      message: "No robot moves were recorded for this run.",
      fix: null,
      step: null,
      block: null,
      blockLabel: null,
    });
  }

  // Repeat count that would make the program work.
  if (hasProgram && !run.succeeded) {
    for (let bi = 0; bi < blockTokens.length; bi++) {
      const count = parseRepeatStart(blockTokens[bi]!);
      if (count == null) continue;
      for (const delta of [1, -1, 2, -2, 3]) {
        const next = count + delta;
        if (next < 1 || next > 9) continue;
        const trial = [...blockTokens];
        trial[bi] = formatRepeatStart(next);
        if (checkGeometryRun(config, expandBlockProgram(trial, bags).commands).succeeded) {
          issues.push({
            kind: delta > 0 ? "repeat_too_few" : "repeat_too_many",
            title: delta > 0 ? "Repeat count too low" : "Repeat count too high",
            message: `Block ${bi + 1} repeats ×${count}. With ×${next} the program traces the whole shape${geometryRequiresDestination(gp) ? " and reaches the destination" : ""}.`,
            fix: `Change Repeat ×${count} to ×${next}.`,
            step: null,
            block: bi + 1,
            blockLabel: `Repeat ×${count}`,
          });
          break;
        }
      }
      if (issues.some((i) => i.kind === "repeat_too_few" || i.kind === "repeat_too_many")) break;
    }
  }

  // First wall bump.
  const bump = sim.steps.findIndex((s) => s.collision);
  if (bump >= 0) {
    const s = sim.steps[bump]!;
    issues.push({
      kind: "hit_wall",
      title: "Robot hit a wall",
      message: `Step ${bump + 1}: the robot tried to move ${s.command === "backward" ? "backward" : "forward"} from ${cell(s.positionBefore)} into a wall or the edge of the board and stayed in place.`,
      fix: "Check the direction the robot is facing before this move.",
      step: bump + 1,
      block: blockNo(bump),
      blockLabel: blockLabel(bump),
    });
  }

  // First move off the shape while target edges were still left.
  if (hasProgram && shapeNeeded) {
    const done = new Set<string>();
    let lastMoveIndex = -1;
    for (let i = 0; i < sim.steps.length; i++) {
      const key = edgeOfCommand[i];
      if (!key) continue;
      if (target.has(key)) {
        done.add(key);
        lastMoveIndex = i;
        if (done.size === target.size) break;
        continue;
      }
      const s = sim.steps[i]!;
      const F = s.positionBefore;
      const moved = { x: s.positionAfter.x - F.x, y: s.positionAfter.y - F.y };
      const pending = [...target].filter((k) => !done.has(k) && edgeTouches(k, F));
      const facingBeforeTurns = lastMoveIndex >= 0 ? sim.steps[lastMoveIndex]!.facingAfter : sim.pathStates[0]!.facing;
      const turnsSince = sim.steps
        .slice(lastMoveIndex + 1, i)
        .map((t) => t.command)
        .filter((c) => c === "turn left" || c === "turn right");
      const lastTurnIndex = (() => {
        for (let j = i - 1; j > lastMoveIndex; j--) if (sim.steps[j]!.command.startsWith("turn")) return j;
        return -1;
      })();
      const at = { step: i + 1, block: blockNo(i), blockLabel: blockLabel(i) };
      const inMacro = (() => {
        const b = blocks[blockOfCommand[i] ?? -1];
        return b && (b.kind === "bag" || b.kind === "chunk") ? b : null;
      })();
      const addTurn = (turn: string) =>
        inMacro
          ? `Block ${at.block} (“${inMacro.label}”) goes ${dirWord(moved)} here — the robot needs a ${turn} first (or a different ${inMacro.kind === "bag" ? "bag" : "chunk"}).`
          : `Add a ${turn} before block ${at.block}.`;
      const turnAt =
        lastTurnIndex >= 0
          ? { step: lastTurnIndex + 1, block: blockNo(lastTurnIndex), blockLabel: blockLabel(lastTurnIndex) }
          : at;

      if (pending.length === 0) {
        const remaining = [...target].filter((k) => !done.has(k));
        const nextStart = remaining[0] ? parseEdge(remaining[0]).from : null;
        issues.push({
          kind: "left_shape",
          title: "Left the shape",
          message: `Step ${i + 1}: the robot moved ${dirWord(moved)} from ${cell(F)} onto an edge that is not part of the shape.${nextStart ? ` ${remaining.length} edge${remaining.length === 1 ? "" : "s"} were still left (for example near ${cell(nextStart)}).` : ""}`,
          fix: "Plan the order of the edges so the robot can trace them without leaving the shape.",
          ...at,
        });
        break;
      }

      const wantTo = edgeTouches(pending[0]!, F)!;
      const wantDir = { x: wantTo.x - F.x, y: wantTo.y - F.y };
      const neededFacing = s.command === "backward" ? { x: -wantDir.x, y: -wantDir.y } : wantDir;
      const need = turnNeeded(facingBeforeTurns, neededFacing);
      const firstMove = lastMoveIndex < 0 && !sim.steps.slice(0, i).some((t) => !eq(t.positionBefore, t.positionAfter));

      if (turnsSince.length === 0) {
        if (firstMove) {
          issues.push({
            kind: "wrong_start_direction",
            title: "Started in the wrong direction",
            message: `The robot's first move went ${dirWord(moved)}, but the shape starts by going ${dirWord(wantDir)} from ${cell(F)}.`,
            fix: need === "turn around" ? "Turn around before the first move." : addTurn(need),
            ...at,
          });
        } else {
          issues.push({
            kind: "missing_turn",
            title: "Missed a corner",
            message: `At ${cell(F)} the robot kept going ${dirWord(moved)} past the corner. The shape turns ${dirWord(wantDir)} here.`,
            fix: need === "turn around" ? "The robot needs to turn around here." : addTurn(need),
            ...at,
          });
        }
      } else if (need === "none") {
        issues.push({
          kind: "extra_turn",
          title: "Turned when it should go straight",
          message: `At ${cell(F)} the robot turned (${turnsSince.join(", ")}) but the shape continues ${dirWord(wantDir)} — straight ahead.`,
          fix: "Remove the turn before this move.",
          ...turnAt,
        });
      } else if (
        (need === "turn left" && turnsSince.length === 1 && turnsSince[0] === "turn right") ||
        (need === "turn right" && turnsSince.length === 1 && turnsSince[0] === "turn left")
      ) {
        issues.push({
          kind: "wrong_turn_direction",
          title: `Turned ${turnsSince[0] === "turn left" ? "left" : "right"} instead of ${need === "turn left" ? "left" : "right"}`,
          message: `At ${cell(F)} the robot needed to ${need} to follow the shape ${dirWord(wantDir)}, but it ${turnsSince[0] === "turn left" ? "turned left" : "turned right"} and moved ${dirWord(moved)}.`,
          fix: (() => {
            const b = blocks[blockOfCommand[lastTurnIndex] ?? -1];
            return b && (b.kind === "bag" || b.kind === "chunk")
              ? `Block ${turnAt.block} (“${b.label}”) makes a ${turnsSince[0]} here — use a ${b.kind === "bag" ? "bag" : "chunk"} that makes a ${need}.`
              : `Change block ${turnAt.block} from ${turnsSince[0]} to ${need}.`;
          })(),
          ...turnAt,
        });
      } else if (need === "turn around") {
        issues.push({
          kind: "needed_turn_around",
          title: "Needed to turn around",
          message: `At ${cell(F)} the next edge goes back ${dirWord(wantDir)}; the robot needed two turns (or a backward move) but moved ${dirWord(moved)}.`,
          fix: "Use two turns in the same direction, or move backward.",
          ...turnAt,
        });
      } else {
        issues.push({
          kind: "left_shape",
          title: "Left the shape",
          message: `At ${cell(F)} the robot moved ${dirWord(moved)} after ${turnsSince.join(", ")}; the shape continues ${dirWord(wantDir)} (needs a ${need}).`,
          fix: `Make the turns before block ${at.block} add up to a ${need}.`,
          ...turnAt,
        });
      }
      break;
    }

    const remaining = [...target].filter((k) => !run.traveled.has(k));
    if (remaining.length > 0 && !issues.some((x) => ["left_shape", "missing_turn", "extra_turn", "wrong_turn_direction", "wrong_start_direction", "needed_turn_around"].includes(x.kind))) {
      const endCell = sim.finalPosition;
      const nextKey = remaining.find((k) => edgeTouches(k, endCell));
      const nextDir = nextKey ? dirWord({ x: edgeTouches(nextKey, endCell)!.x - endCell.x, y: edgeTouches(nextKey, endCell)!.y - endCell.y }) : null;
      issues.push({
        kind: "stopped_short",
        title: "Stopped before the shape was finished",
        message: `The program ended at ${cell(endCell)} with ${remaining.length} of ${targetCount} edge${targetCount === 1 ? "" : "s"} still to trace.${nextDir ? ` The next edge goes ${nextDir} from here.` : ""}`,
        fix: issues.some((x) => x.kind === "repeat_too_few") ? null : "Add the missing moves at the end of the program (or repeat the pattern more times).",
        step: sim.steps.length || null,
        block: blockTokens.length || null,
        blockLabel: blocks[blocks.length - 1]?.label ?? null,
      });
    }
  }

  // Extra edges for exact-path grading.
  const exact = gp?.validationMode === "EXACT_PATH" || gp?.validationMode === "SHAPE_MATCH";
  if (exact && run.extraEdges.length > 0) {
    const first = extraEdges[0]!;
    issues.push({
      kind: "extra_edges",
      title: "Traveled extra edges",
      message: `This item needs an exact path, but the robot traveled ${run.extraEdges.length} edge${run.extraEdges.length === 1 ? "" : "s"} that are not part of the shape (first at step ${first.step}).`,
      fix: "Remove moves that go off the shape.",
      step: first.step,
      block: first.block,
      blockLabel: blocks[first.block - 1]?.label ?? null,
    });
  }

  // Destination after the shape.
  if (hasProgram && geometryRequiresDestination(gp) && gp?.finishCell) {
    const finish = gp.finishCell;
    const after = shapeCompleteAtStep ?? (shapeNeeded ? null : 0);
    if (after != null && !run.finishCellOk) {
      const passedIt = sim.path.slice(after).some((p) => eq(p, finish));
      const dist = Math.abs(sim.finalPosition.x - finish.x) + Math.abs(sim.finalPosition.y - finish.y);
      issues.push(
        passedIt
          ? {
              kind: "destination_overshot",
              title: "Went past the destination",
              message: `After the shape, the robot passed the destination ${cell(finish)} but kept going and stopped at ${cell(sim.finalPosition)}.`,
              fix: "Remove the extra moves after reaching the destination.",
              step: sim.steps.length,
              block: blockTokens.length || null,
              blockLabel: blocks[blocks.length - 1]?.label ?? null,
            }
          : {
              kind: "destination_missed",
              title: "Didn't reach the destination",
              message: `After the shape, the robot stopped at ${cell(sim.finalPosition)}, ${dist} cell${dist === 1 ? "" : "s"} from the destination ${cell(finish)}.`,
              fix: "Add moves after the shape to reach the destination.",
              step: sim.steps.length,
              block: blockTokens.length || null,
              blockLabel: blocks[blocks.length - 1]?.label ?? null,
            }
      );
    } else if (run.finishCellOk && geometryRequiresFinishFacing(gp) && run.finishFacingOk === false && gp.finishFacing) {
      issues.push({
        kind: "wrong_final_facing",
        title: "Facing the wrong way at the end",
        message: `The robot reached the destination facing ${dirWord(sim.finalDirection)}, but it must face ${dirWord(gp.finishFacing)}.`,
        fix: `Add a ${turnNeeded(sim.finalDirection, gp.finishFacing)} at the end.`,
        step: sim.steps.length,
        block: blockTokens.length || null,
        blockLabel: blocks[blocks.length - 1]?.label ?? null,
      });
    }
  }

  // The Repeat fix (if found) is the clearest thing to tell the student; otherwise the first problem in time.
  const repeatFix = issues.find((x) => x.kind === "repeat_too_few" || x.kind === "repeat_too_many") ?? null;
  const chronological = issues
    .filter((x) => x !== repeatFix)
    .sort((a, b) => (a.step ?? Number.MAX_SAFE_INTEGER) - (b.step ?? Number.MAX_SAFE_INTEGER));
  const ordered = repeatFix ? [repeatFix, ...chronological] : chronological;
  const succeeded = run.succeeded || args.passed === true;
  const primaryIssue = succeeded ? null : (ordered[0] ?? null);

  let summary: string;
  if (!hasProgram) summary = "No program was recorded, so the edges could not be checked.";
  else if (succeeded && metCount === targetCount) summary = `All ${targetCount} edges were met${geometryRequiresDestination(gp) ? " and the destination was reached" : ""}.`;
  else if (primaryIssue) summary = `${metCount} of ${targetCount} edges met. ${primaryIssue.title}: ${primaryIssue.message}`;
  else summary = `${metCount} of ${targetCount} edges met.`;

  return {
    available: segments.length > 0,
    hasProgram,
    succeeded,
    targetCount,
    metCount,
    edges,
    extraEdges,
    retracedEdgeCount,
    shapeCompleteAtStep,
    finalCell: hasProgram ? sim.finalPosition : null,
    finalFacing: hasProgram ? dirWord(sim.finalDirection) : null,
    issues: succeeded ? issues.filter((x) => x.kind === "extra_edges") : ordered,
    primaryIssue,
    steps,
    telemetryMismatch,
    summary,
  };
}
