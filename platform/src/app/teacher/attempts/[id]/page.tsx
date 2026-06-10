import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import {
  AttemptAssessmentView,
  type AttemptDetailPayload,
} from "@/components/assessment/attempt-assessment-view";
import { loadStealthAssessmentForAttempt } from "@/lib/assessment/load-stealth";
import { computeAttemptRouteAnalysis } from "@/lib/assessment/compute-attempt-route";
import {
  isDebuggingLevel,
  isEditStarterProgramLevel,
  isPathBuildingLevel,
  resolveRouteMapAnchors,
} from "@/lib/assessment/assessmentConfig";
import type { AttemptEvidenceInput } from "@/lib/assessment/assessmentTypes";
import { levelGameplayConfigSchema } from "@/lib/level-config";
import {
  resolveAttemptProgram,
  resolveStarterProgram,
} from "@/lib/assessment/resolve-program";
import { LevelType } from "@prisma/client";
import type { CommandToken } from "@/lib/command-icons";
function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  return [];
}

function parseObjectVisit(val: unknown): AttemptDetailPayload["objectVisit"] {
  if (!val || typeof val !== "object") return null;
  const root = val as Record<string, unknown>;
  const v =
    root.objectVisit && typeof root.objectVisit === "object"
      ? (root.objectVisit as Record<string, unknown>)
      : null;
  if (!v) return null;
  const pattern = String(v.visitPattern ?? "neither");
  if (!["both", "start_only", "end_only", "neither"].includes(pattern)) return null;
  return {
    startObjectType: v.startObjectType ? String(v.startObjectType) : undefined,
    endObjectType: v.endObjectType ? String(v.endObjectType) : undefined,
    reachedStart: Boolean(v.reachedStart),
    reachedEnd: Boolean(v.reachedEnd),
    visitPattern: pattern as "both" | "start_only" | "end_only" | "neither",
  };
}

function parseMistakes(val: unknown): {
  messages: string[];
  objectVisit: AttemptDetailPayload["objectVisit"];
} {
  if (Array.isArray(val)) return { messages: parseStringArray(val), objectVisit: null };
  if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    return {
      messages: parseStringArray(o.messages),
      objectVisit: parseObjectVisit(o),
    };
  }
  return { messages: [], objectVisit: null };
}

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const attempt = await prisma.levelAttempt.findUnique({
    where: { id },
    include: {
      student: true,
      level: true,
      commandEvents: { orderBy: { sequence: "asc" } },
      actionButtonEvents: { orderBy: { timestamp: "asc" } },
      robotTouchEvents: { orderBy: { timestamp: "asc" } },
      assessmentResult: true,
      teacherNotes: { include: { teacher: { include: { teacherProfile: true } } } },
    },
  });

  if (!attempt) notFound();

  const stealthAssessment = await loadStealthAssessmentForAttempt(id);

  const evidenceInput: AttemptEvidenceInput = {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    passed: attempt.passed,
    status: attempt.status,
    finalCommand: attempt.finalCommand,
    initialCommand: attempt.initialCommand,
    commandHistory: attempt.commandHistory,
    hintsUsed: attempt.hintsUsed,
    mistakes: attempt.mistakes,
    totalTimeSeconds: attempt.totalTimeSeconds,
    robotTouched: attempt.robotTouched,
    robotTouchCount: attempt.robotTouchCount,
    resetCount: attempt.resetCount,
    firstRobotTouchAt: attempt.firstRobotTouchAt,
    startedAt: attempt.startedAt,
    commandEvents: attempt.commandEvents.map((e) => ({
      command: e.command,
      action: e.action,
    })),
  };

  const liveRoute = computeAttemptRouteAnalysis({
    levelConfig: attempt.level.config,
    levelType: attempt.level.levelType,
    attempt: evidenceInput,
  });

  const parsedLevelConfig = levelGameplayConfigSchema.safeParse(attempt.level.config);
  const isPathBuildingLevelFlag =
    parsedLevelConfig.success &&
    isPathBuildingLevel(parsedLevelConfig.data, attempt.level.levelType);
  const isEditStarterLevelFlag =
    parsedLevelConfig.success &&
    isEditStarterProgramLevel(parsedLevelConfig.data, attempt.level.levelType);
  const isDebuggingLevelFlag =
    parsedLevelConfig.success &&
    isDebuggingLevel(parsedLevelConfig.data, attempt.level.levelType);
  let starterProgram: CommandToken[] = [];
  let studentProgram: CommandToken[] = [];
  if (parsedLevelConfig.success && isEditStarterLevelFlag) {
    starterProgram = resolveStarterProgram({
      initialCommand: attempt.initialCommand,
      levelConfig: parsedLevelConfig.data,
    });
    studentProgram = resolveAttemptProgram({
      finalCommand: attempt.finalCommand,
      initialCommand: attempt.initialCommand,
      levelConfig: parsedLevelConfig.data,
      levelType: attempt.level.levelType,
      commandEvents: evidenceInput.commandEvents,
      commandHistory: attempt.commandHistory,
    });
  } else if (parsedLevelConfig.success && isPathBuildingLevelFlag) {
    studentProgram = resolveAttemptProgram({
      finalCommand: attempt.finalCommand,
      initialCommand: attempt.initialCommand,
      levelConfig: parsedLevelConfig.data,
      levelType: attempt.level.levelType,
      commandEvents: evidenceInput.commandEvents,
      commandHistory: attempt.commandHistory,
    });
  }

  const mapAnchors =
    parsedLevelConfig.success
      ? resolveRouteMapAnchors(parsedLevelConfig.data, {
          studentEnd:
            liveRoute.studentPath.length > 0
              ? liveRoute.studentPath[liveRoute.studentPath.length - 1]
              : null,
        })
      : null;

  const { messages: mistakeMessages, objectVisit } = parseMistakes(attempt.mistakes);
  const stripCloseCount = attempt.actionButtonEvents.filter(
    (e) => e.eventType === "CLOSED"
  ).length;

  const payload: AttemptDetailPayload = {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    passed: attempt.passed,
    score: attempt.score,
    totalTimeSeconds: attempt.totalTimeSeconds,
    startedAt: attempt.startedAt.toISOString(),
    endedAt: attempt.endedAt?.toISOString() ?? null,
    initialCommand: attempt.initialCommand,
    finalCommand: attempt.finalCommand,
    robotTouched: attempt.robotTouched,
    robotTouchCount: attempt.robotTouchCount,
    robotTouchDurationSeconds: attempt.robotTouchDurationSeconds,
    mistakes: mistakeMessages,
    objectVisit,
    feedback: attempt.feedback,
    student: {
      id: attempt.student.id,
      displayName: attempt.student.displayName,
      externalId: attempt.student.externalId,
    },
    level: {
      id: attempt.level.id,
      name: attempt.level.name,
      levelKey: attempt.level.levelKey,
      levelType: attempt.level.levelType,
    },
    isEditStarterLevel: isEditStarterLevelFlag,
    isPathBuildingLevel: isPathBuildingLevelFlag,
    isDebuggingLevel: isDebuggingLevelFlag,
    starterProgram,
    studentProgram,
    commandEvents: attempt.commandEvents.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      command: e.command,
      action: e.action,
      sequence: e.sequence,
    })),
    robotTouchEvents: attempt.robotTouchEvents.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      eventType: e.eventType,
      durationSeconds: e.durationSeconds,
    })),
    assessmentResult: attempt.assessmentResult
      ? {
          mistakePattern: attempt.assessmentResult.mistakePattern,
          assessmentNotes: attempt.assessmentResult.assessmentNotes,
        }
      : null,
    teacherNotes: attempt.teacherNotes.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      authorName: n.teacher.teacherProfile?.displayName ?? n.teacher.email ?? "Teacher",
    })),
    stealthAssessment,
    resetCount: attempt.resetCount,
    firstRobotTouchAt: attempt.firstRobotTouchAt?.toISOString() ?? null,
    stripCloseCount,
    liveRoute,
    mapAnchors,
    commandProgram: attempt.finalCommand ?? attempt.initialCommand,
    visitLabels: objectVisit
      ? [
          objectVisit.startObjectType ?? "first goal",
          objectVisit.endObjectType ?? "second goal",
        ].filter(Boolean)
      : undefined,
  };

  return (
    <TeacherShell title="Attempt evidence">
      <AttemptAssessmentView attempt={payload} />
    </TeacherShell>
  );
}
