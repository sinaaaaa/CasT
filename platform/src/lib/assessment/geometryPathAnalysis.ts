/**
 * Geometry Path assessment — edge-trace evidence for the existing stealth / attempt pipeline.
 * Does NOT introduce a parallel scoring system; mirrors path-building style analysis.
 */

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { isGeometryPathLevel } from "@/lib/assessment/assessmentConfig";
import {
  geometryRequiresDestination,
  geometryRequiresFinishFacing,
  segmentKey,
  type GeometryAfterShapeBehavior,
  type GeometryValidationMode,
  type PathSegment,
} from "@/lib/geometry-path";
import { parseGeometryPathTelemetry } from "@/lib/attempt-mistakes";

export type GeometryEdgeStatus = "correct" | "missed" | "extra";

export type GeometryEdgeVisual = {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  status: GeometryEdgeStatus;
};

export type GeometryCombinedOutcome =
  | "geometry_and_destination"
  | "geometry_only"
  | "destination_only"
  | "both_incomplete"
  | "geometry_complete_no_destination_required"
  | "unknown";

export type GeometryPathAnalysisResult = {
  available: boolean;
  validationMode: GeometryValidationMode;
  afterShapeBehavior: GeometryAfterShapeBehavior;
  requiresDestination: boolean;
  targetEdgeCount: number;
  completedEdgeCount: number;
  missedEdgeCount: number;
  extraEdgeCount: number;
  pathCompletionPct: number;
  pathAccuracyPct: number;
  shapeCompleted: boolean;
  destinationReached: boolean | null;
  extraMovementAfterShape: number;
  requiredFinishCell: { x: number; y: number } | null;
  requiredFinishFacing: { x: number; y: number } | null;
  finishObjectType: string | null;
  finalCell: { x: number; y: number } | null;
  finalFacing: { x: number; y: number } | null;
  finishCellOk: boolean | null;
  finishFacingOk: boolean | null;
  requireRepeat: boolean;
  requireActionChunk: boolean;
  requireCommandBag: boolean;
  hasTelemetry: boolean;
  edges: GeometryEdgeVisual[];
  summary: string;
  combinedOutcome: GeometryCombinedOutcome;
  outcome: "correct" | "partial" | "incorrect" | "unknown";
};

function parseKey(key: string): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const parts = key.split("|");
  if (parts.length !== 2) return null;
  const a = parts[0]!.split(",").map(Number);
  const b = parts[1]!.split(",").map(Number);
  if (a.length !== 2 || b.length !== 2 || a.some(Number.isNaN) || b.some(Number.isNaN)) return null;
  return { from: { x: a[0]!, y: a[1]! }, to: { x: b[0]!, y: b[1]! } };
}

function undirectedKeys(segments: PathSegment[]): Set<string> {
  return new Set(segments.map((s) => segmentKey(s.from, s.to)));
}

/** Count edges traveled after the target set first became complete (from travel order). */
function countExtraAfterShape(
  travelOrder: string[] | null | undefined,
  target: Set<string>
): number {
  if (!travelOrder?.length || target.size === 0) return 0;
  const seen = new Set<string>();
  let completeAt = -1;
  for (let i = 0; i < travelOrder.length; i++) {
    const k = travelOrder[i]!;
    if (target.has(k)) seen.add(k);
    if (seen.size >= target.size) {
      completeAt = i;
      break;
    }
  }
  if (completeAt < 0) return 0;
  return Math.max(0, travelOrder.length - completeAt - 1);
}

export function buildGeometryPathAnalysisFromAttempt(args: {
  config: LevelGameplayConfig;
  levelType?: LevelType;
  mistakes: unknown;
  passed?: boolean | null;
}): GeometryPathAnalysisResult {
  const tel = parseGeometryPathTelemetry(args.mistakes);
  return analyzeGeometryPathAttempt({
    config: args.config,
    levelType: args.levelType,
    traveledKeys: tel?.traveledKeys ?? null,
    completedKeys: tel?.completedKeys ?? null,
    travelOrder: tel?.travelOrder ?? null,
    finalCell: tel?.finalCell ?? null,
    finalFacing: tel?.finalFacing ?? null,
    passed: args.passed,
  });
}

/**
 * Analyze geometry attempt evidence when trail/completed keys are available.
 */
export function analyzeGeometryPathAttempt(args: {
  config: LevelGameplayConfig;
  levelType?: LevelType;
  traveledKeys?: string[] | null;
  completedKeys?: string[] | null;
  travelOrder?: string[] | null;
  finalCell?: { x: number; y: number } | null;
  finalFacing?: { x: number; y: number } | null;
  passed?: boolean | null;
}): GeometryPathAnalysisResult {
  const gp = args.config.geometryPath;
  const available = isGeometryPathLevel(args.config, args.levelType) && !!gp?.segments?.length;
  const mode = (gp?.validationMode ?? "TRACE_TARGET") as GeometryValidationMode;
  const afterShapeBehavior = (gp?.afterShapeBehavior ?? "SHAPE_COMPLETE") as GeometryAfterShapeBehavior;
  const requiresDestination = geometryRequiresDestination(gp);
  const target = undirectedKeys(gp?.segments ?? []);
  const targetEdgeCount = target.size;

  const traveled = new Set([
    ...(args.traveledKeys ?? []),
    ...(args.completedKeys ?? []),
  ]);
  const hasTelemetry = traveled.size > 0 || !!args.finalCell;

  let completedEdgeCount = 0;
  const edges: GeometryEdgeVisual[] = [];

  for (const seg of gp?.segments ?? []) {
    const key = segmentKey(seg.from, seg.to);
    const done = traveled.has(key);
    if (done) completedEdgeCount++;
    edges.push({
      key,
      from: { ...seg.from },
      to: { ...seg.to },
      status: done ? "correct" : "missed",
    });
  }

  let extraEdgeCount = 0;
  for (const k of traveled) {
    if (!target.has(k)) {
      extraEdgeCount++;
      const parsed = parseKey(k);
      if (parsed) {
        edges.push({
          key: k,
          from: parsed.from,
          to: parsed.to,
          status: "extra",
        });
      }
    }
  }

  const missedEdgeCount = Math.max(0, targetEdgeCount - completedEdgeCount);
  const pathCompletionPct =
    targetEdgeCount === 0 ? 0 : Math.round((completedEdgeCount / targetEdgeCount) * 1000) / 10;
  const denom = completedEdgeCount + extraEdgeCount;
  const pathAccuracyPct =
    denom === 0 ? 0 : Math.round((completedEdgeCount / denom) * 1000) / 10;

  const shapeCompleted = targetEdgeCount > 0 && completedEdgeCount >= targetEdgeCount;
  const finish = gp?.finishCell ?? null;
  const finishCellOk =
    finish && args.finalCell
      ? finish.x === args.finalCell.x && finish.y === args.finalCell.y
      : requiresDestination && finish
        ? false
        : null;
  const ff = gp?.finishFacing ?? null;
  const needsFacing = geometryRequiresFinishFacing(gp);
  const finishFacingOk =
    needsFacing && ff && args.finalFacing
      ? ff.x === args.finalFacing.x && ff.y === args.finalFacing.y
      : needsFacing && ff
        ? false
        : null;

  const destinationReached =
    requiresDestination
      ? finishCellOk === true && (needsFacing ? finishFacingOk !== false : true)
      : null;

  const travelOrder =
    args.travelOrder && args.travelOrder.length > 0
      ? args.travelOrder
      : [...(args.traveledKeys ?? []), ...(args.completedKeys ?? [])];
  const extraMovementAfterShape = countExtraAfterShape(travelOrder, target);

  let combinedOutcome: GeometryCombinedOutcome = "unknown";
  if (requiresDestination && hasTelemetry) {
    if (shapeCompleted && destinationReached) combinedOutcome = "geometry_and_destination";
    else if (shapeCompleted && !destinationReached) combinedOutcome = "geometry_only";
    else if (!shapeCompleted && destinationReached) combinedOutcome = "destination_only";
    else combinedOutcome = "both_incomplete";
  } else if (!requiresDestination && hasTelemetry) {
    combinedOutcome = shapeCompleted
      ? "geometry_complete_no_destination_required"
      : completedEdgeCount > 0
        ? "both_incomplete"
        : "both_incomplete";
  }

  let outcome: GeometryPathAnalysisResult["outcome"] = "unknown";
  if (args.passed === true) outcome = "correct";
  else if (args.passed === false) {
    if (requiresDestination) {
      outcome =
        shapeCompleted || destinationReached || completedEdgeCount > 0 ? "partial" : "incorrect";
    } else {
      outcome =
        hasTelemetry && completedEdgeCount > 0 && completedEdgeCount < targetEdgeCount
          ? "partial"
          : "incorrect";
    }
  } else if (hasTelemetry) {
    if (requiresDestination) {
      if (shapeCompleted && destinationReached) outcome = "correct";
      else if (shapeCompleted || destinationReached || completedEdgeCount > 0) outcome = "partial";
      else outcome = "incorrect";
    } else if (completedEdgeCount >= targetEdgeCount && extraEdgeCount === 0) outcome = "correct";
    else if (completedEdgeCount > 0) outcome = "partial";
    else outcome = "incorrect";
  }

  let summary: string;
  if (!available) {
    summary = "Not a Geometry Path item.";
  } else if (!hasTelemetry) {
    summary =
      args.passed === true
        ? `Passed (${mode.replace(/_/g, " ").toLowerCase()}) — edge telemetry not attached to this attempt.`
        : args.passed === false
          ? `Did not pass (${mode.replace(/_/g, " ").toLowerCase()}) — edge telemetry not attached.`
          : `Target has ${targetEdgeCount} edges.`;
  } else if (requiresDestination) {
    const geoPart = `Geometry ${completedEdgeCount}/${targetEdgeCount} edges (${pathCompletionPct}%)`;
    const destPart =
      destinationReached === true
        ? "destination reached"
        : destinationReached === false
          ? "destination missed"
          : "destination not evaluated";
    summary = `${geoPart}; ${destPart}. Extra edges: ${extraEdgeCount}.`;
  } else {
    summary = `Completed ${completedEdgeCount}/${targetEdgeCount} target edges (${pathCompletionPct}%). Extra edges: ${extraEdgeCount}.`;
  }

  return {
    available,
    validationMode: mode,
    afterShapeBehavior,
    requiresDestination,
    targetEdgeCount,
    completedEdgeCount: hasTelemetry ? completedEdgeCount : 0,
    missedEdgeCount: hasTelemetry ? missedEdgeCount : targetEdgeCount,
    extraEdgeCount: hasTelemetry ? extraEdgeCount : 0,
    pathCompletionPct: hasTelemetry ? pathCompletionPct : 0,
    pathAccuracyPct: hasTelemetry ? pathAccuracyPct : 0,
    shapeCompleted: hasTelemetry ? shapeCompleted : false,
    destinationReached,
    extraMovementAfterShape: hasTelemetry ? extraMovementAfterShape : 0,
    requiredFinishCell: finish,
    requiredFinishFacing: needsFacing ? ff : null,
    finishObjectType: gp?.finishObjectType?.trim() || null,
    finalCell: args.finalCell ?? null,
    finalFacing: args.finalFacing ?? null,
    finishCellOk,
    finishFacingOk,
    requireRepeat: !!gp?.requireRepeat,
    requireActionChunk: !!gp?.requireActionChunk,
    requireCommandBag: !!gp?.requireCommandBag,
    hasTelemetry,
    edges,
    summary,
    combinedOutcome,
    outcome,
  };
}

/** Server-side pass check from stored telemetry (mirrors Unity validation modes). */
export function resolveGeometryPathPassed(args: {
  config: LevelGameplayConfig;
  mistakes: unknown;
  programTokens?: string[];
}): boolean | null {
  const gp = args.config.geometryPath;
  if (!gp?.segments?.length) return null;
  const tel = parseGeometryPathTelemetry(args.mistakes);
  if (!tel) return null;

  const analysis = analyzeGeometryPathAttempt({
    config: args.config,
    traveledKeys: tel.traveledKeys,
    completedKeys: tel.completedKeys,
    travelOrder: tel.travelOrder,
    finalCell: tel.finalCell,
    finalFacing: tel.finalFacing,
  });

  if (!analysis.hasTelemetry && tel.finalCell == null) return null;

  const mode = analysis.validationMode;
  const tokens = (args.programTokens ?? []).map((t) => t.toLowerCase());
  const hasRepeat = tokens.some((t) => t.includes("repeat"));
  const hasChunk = tokens.some((t) => t.includes("chunk:"));
  const hasBag = tokens.some((t) => t.includes("bag:"));

  const structureOk =
    (!gp.requireRepeat || hasRepeat) &&
    (!gp.requireActionChunk || hasChunk) &&
    (!gp.requireCommandBag || hasBag);

  const requiresDestination = geometryRequiresDestination(gp);
  const destinationOk =
    !requiresDestination ||
    (analysis.finishCellOk === true &&
      (!geometryRequiresFinishFacing(gp) || analysis.finishFacingOk !== false));

  let geometryOk: boolean;
  switch (mode) {
    case "FINAL_POSITION":
      geometryOk = true; // destination gate handles finish cell
      break;
    case "FINAL_POSITION_DIRECTION":
      geometryOk = true;
      break;
    case "EXACT_PATH":
    case "SHAPE_MATCH":
      geometryOk =
        analysis.completedEdgeCount >= analysis.targetEdgeCount &&
        analysis.extraEdgeCount === 0 &&
        structureOk;
      break;
    case "PROGRAM_STRUCTURE":
      geometryOk = analysis.completedEdgeCount >= analysis.targetEdgeCount && structureOk;
      break;
    case "TRACE_TARGET":
    default:
      geometryOk = analysis.completedEdgeCount >= analysis.targetEdgeCount && structureOk;
      break;
  }

  // Soft structure flags apply alongside non-PROGRAM_STRUCTURE modes (mirrors Unity).
  if (geometryOk && mode !== "PROGRAM_STRUCTURE") {
    if (!structureOk) geometryOk = false;
  }

  if (mode === "FINAL_POSITION") return destinationOk;
  if (mode === "FINAL_POSITION_DIRECTION") {
    return (
      analysis.finishCellOk === true &&
      (geometryRequiresFinishFacing(gp) ? analysis.finishFacingOk !== false : true)
    );
  }

  return geometryOk && destinationOk;
}
