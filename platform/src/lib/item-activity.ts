/**
 * Teacher-facing item catalog.
 * Prisma LevelType is an implementation detail — teachers pick what students will do.
 */

import { LevelType } from "@prisma/client";
import {
  DEFAULT_CANVAS_LESSON,
  DEFAULT_GEOMETRY_PATH,
  DEFAULT_NUMBER_LINE_STYLE,
  applyLevelTypeDefaults,
  isCanvasLayout,
  isGeometryDrawPath,
  isNumberLineLayout,
  syncNumberLineGridPositions,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { withGeometryShapeProgram } from "@/lib/geometry-program-path";
import {
  NUMBER_LINE_DEFAULT_LINE_ROW,
  NUMBER_LINE_DEFAULT_TICKS,
} from "@/lib/level-editor-constants";

export type ItemActivityId =
  | "program-build"
  | "program-edit"
  | "program-blanks"
  | "program-number-line"
  | "predict-flag"
  | "predict-draw"
  | "shape-trace"
  | "canvas-build"
  | "canvas-blanks"
  | "canvas-starter"
  | "canvas-count";

export type ItemFamilyId = "program" | "predict" | "shape" | "pattern";

export type ActivityIconName =
  | "blocks"
  | "wrench"
  | "blank"
  | "line"
  | "flag"
  | "pencil"
  | "shape"
  | "pattern"
  | "slots"
  | "starter"
  | "hash";

export type ItemFamily = {
  id: ItemFamilyId;
  title: string;
  studentJob: string;
  hint: string;
  accent: "teal" | "amber" | "violet" | "sky";
  icon: ActivityIconName;
};

export type ItemActivity = {
  id: ItemActivityId;
  family: ItemFamilyId;
  title: string;
  studentJob: string;
  example: string;
  icon: ActivityIconName;
  levelType: LevelType;
  layout: "GRID" | "NUMBER_LINE" | "CANVAS";
  canvasStrip?: "EMPTY" | "BLANKS" | "SEED_PROGRAM" | "COUNT_ANSWER";
  geometryTask?: "PROGRAM" | "DRAW_PATH";
};

export const ITEM_FAMILIES: readonly ItemFamily[] = [
  {
    id: "program",
    title: "Program the robot",
    studentJob: "Students write or edit commands.",
    hint: "Classic coding items on a grid or number line.",
    accent: "teal",
    icon: "blocks",
  },
  {
    id: "predict",
    title: "Predict",
    studentJob: "Students show they understand a program.",
    hint: "No full program to write. They mark the result.",
    accent: "amber",
    icon: "flag",
  },
  {
    id: "shape",
    title: "Trace a shape",
    studentJob: "Students follow a glowing geometry path.",
    hint: "Great for Repeat, patterns, and perimeter thinking.",
    accent: "violet",
    icon: "shape",
  },
  {
    id: "pattern",
    title: "Pattern board",
    studentJob: "Students work with a pattern and the yellow strip.",
    hint: "No grid world. Just the canvas and blocks.",
    accent: "sky",
    icon: "pattern",
  },
] as const;

export const ITEM_ACTIVITIES: readonly ItemActivity[] = [
  {
    id: "program-build",
    family: "program",
    title: "Build a path",
    studentJob: "Drag blocks into an empty strip, then press RUN.",
    example: "Get the newspaper to the bin",
    icon: "blocks",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "GRID",
  },
  {
    id: "program-edit",
    family: "program",
    title: "Fix a starter",
    studentJob: "Change a ready-made program, then RUN.",
    example: "A wrong turn is already in the strip",
    icon: "wrench",
    levelType: LevelType.DRAG_EDIT_PROGRAM,
    layout: "GRID",
  },
  {
    id: "program-blanks",
    family: "program",
    title: "Fill in blanks",
    studentJob: "Pick the missing move or turn.",
    example: "Forward · ? · Forward",
    icon: "blank",
    levelType: LevelType.CHOOSE_BUTTONS,
    layout: "GRID",
  },
  {
    id: "program-number-line",
    family: "program",
    title: "Number line",
    studentJob: "Move forward and back along a line.",
    example: "Land on the right tick",
    icon: "line",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "NUMBER_LINE",
  },
  {
    id: "predict-flag",
    family: "predict",
    title: "Place the flag",
    studentJob: "Tap where the robot will finish.",
    example: "Watch the program, mark the cell",
    icon: "flag",
    levelType: LevelType.FLAG_PLACEMENT,
    layout: "GRID",
  },
  {
    id: "predict-draw",
    family: "predict",
    title: "Draw the path",
    studentJob: "Look at the yellow-strip program, then draw that path.",
    example: "Prediction on the geometry grid",
    icon: "pencil",
    levelType: LevelType.GEOMETRY_PATH,
    layout: "GRID",
    geometryTask: "DRAW_PATH",
  },
  {
    id: "shape-trace",
    family: "shape",
    title: "Trace with a program",
    studentJob: "Write a program that follows the glowing shape.",
    example: "Square, L, stairs, then Repeat or Chunks",
    icon: "shape",
    levelType: LevelType.GEOMETRY_PATH,
    layout: "GRID",
    geometryTask: "PROGRAM",
  },
  {
    id: "canvas-build",
    family: "pattern",
    title: "Build the pattern",
    studentJob: "Build a program that matches the pattern.",
    example: "Empty yellow strip",
    icon: "pattern",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "CANVAS",
    canvasStrip: "EMPTY",
  },
  {
    id: "canvas-blanks",
    family: "pattern",
    title: "Fill pattern blanks",
    studentJob: "Drop arrows into fixed blank slots.",
    example: "Dash slots on the strip",
    icon: "slots",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "CANVAS",
    canvasStrip: "BLANKS",
  },
  {
    id: "canvas-starter",
    family: "pattern",
    title: "Edit a pattern starter",
    studentJob: "Fix or finish a seeded strip.",
    example: "Some blocks already placed",
    icon: "starter",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "CANVAS",
    canvasStrip: "SEED_PROGRAM",
  },
  {
    id: "canvas-count",
    family: "pattern",
    title: "Count the pattern",
    studentJob: "Count how many times an arrow appears.",
    example: "+/− number answer, no programming",
    icon: "hash",
    levelType: LevelType.DRAG_ACTIONS,
    layout: "CANVAS",
    canvasStrip: "COUNT_ANSWER",
  },
] as const;

const ACTIVITY_BY_ID = Object.fromEntries(
  ITEM_ACTIVITIES.map((a) => [a.id, a])
) as Record<ItemActivityId, ItemActivity>;

const FAMILY_BY_ID = Object.fromEntries(ITEM_FAMILIES.map((f) => [f.id, f])) as Record<
  ItemFamilyId,
  ItemFamily
>;

export function getItemActivity(id: ItemActivityId): ItemActivity {
  return ACTIVITY_BY_ID[id];
}

export function getItemFamily(id: ItemFamilyId): ItemFamily {
  return FAMILY_BY_ID[id];
}

export function activitiesInFamily(family: ItemFamilyId): ItemActivity[] {
  return ITEM_ACTIVITIES.filter((a) => a.family === family);
}

export function resolveItemActivity(
  levelType: LevelType,
  config: Pick<LevelGameplayConfig, "layoutMode" | "canvasLesson" | "geometryPath"> | null | undefined
): ItemActivity {
  if (levelType === LevelType.FLAG_PLACEMENT) return ACTIVITY_BY_ID["predict-flag"];
  if (levelType === LevelType.CHOOSE_BUTTONS) return ACTIVITY_BY_ID["program-blanks"];
  if (levelType === LevelType.DRAG_EDIT_PROGRAM) return ACTIVITY_BY_ID["program-edit"];
  if (levelType === LevelType.GEOMETRY_PATH) {
    return isGeometryDrawPath(config?.geometryPath)
      ? ACTIVITY_BY_ID["predict-draw"]
      : ACTIVITY_BY_ID["shape-trace"];
  }
  if (levelType === LevelType.DRAG_ACTIONS) {
    const cfg = (config ?? {}) as LevelGameplayConfig;
    if (isCanvasLayout(cfg)) {
      const mode = (config?.canvasLesson?.stripMode ?? "EMPTY").toUpperCase();
      if (mode === "BLANKS") return ACTIVITY_BY_ID["canvas-blanks"];
      if (mode === "SEED_PROGRAM") return ACTIVITY_BY_ID["canvas-starter"];
      if (mode === "COUNT_ANSWER") return ACTIVITY_BY_ID["canvas-count"];
      return ACTIVITY_BY_ID["canvas-build"];
    }
    if (isNumberLineLayout(cfg)) return ACTIVITY_BY_ID["program-number-line"];
    return ACTIVITY_BY_ID["program-build"];
  }
  return ACTIVITY_BY_ID["program-build"];
}

export function itemActivityLabel(
  levelType: LevelType,
  config?: Pick<LevelGameplayConfig, "layoutMode" | "canvasLesson" | "geometryPath"> | null
): string {
  return resolveItemActivity(levelType, config).title;
}

function applyLayout(
  config: LevelGameplayConfig,
  layout: ItemActivity["layout"]
): LevelGameplayConfig {
  if (layout === "NUMBER_LINE") {
    return syncNumberLineGridPositions({
      ...config,
      layoutMode: "NUMBER_LINE",
      enabledActionButtons: ["forward", "backward"],
      numberLine: {
        tickCount: NUMBER_LINE_DEFAULT_TICKS,
        lineRow: NUMBER_LINE_DEFAULT_LINE_ROW,
        showTickLabels: true,
        showArrows: true,
        forwardBackwardOnly: true,
        ...DEFAULT_NUMBER_LINE_STYLE,
        ...config.numberLine,
      },
    });
  }

  if (layout === "CANVAS") {
    return {
      ...config,
      layoutMode: "CANVAS",
      numberLine: undefined,
      gridObjects: [],
      runRobotOnSubmit: false,
      enabledActionButtons: ["forward", "backward", "turn left", "turn right", "repeat"],
      canvasLesson: config.canvasLesson ?? { ...DEFAULT_CANVAS_LESSON },
      assessment: {
        ...config.assessment,
        taskEnvironmentType: "canvas",
        taskType: config.assessment?.taskType ?? "decomposition",
        correctPrograms: config.assessment?.correctPrograms?.length
          ? config.assessment.correctPrograms
          : [["repeat:1", "forward", "turn right", "repeat-end"]],
      },
    };
  }

  return {
    ...config,
    layoutMode: "GRID",
    numberLine: undefined,
    runRobotOnSubmit: config.runRobotOnSubmit ?? true,
    enabledActionButtons: config.enabledActionButtons?.length
      ? config.enabledActionButtons.filter((a) => a !== "repeat")
      : ["forward", "backward", "turn left", "turn right"],
    assessment: config.assessment
      ? { ...config.assessment, taskEnvironmentType: "grid" }
      : config.assessment,
  };
}

/** Switch the item to a catalog activity (type + board + geometry/canvas flavor). */
export function applyItemActivity(
  activityId: ItemActivityId,
  current: LevelGameplayConfig
): { levelType: LevelType; config: LevelGameplayConfig } {
  const activity = getItemActivity(activityId);
  let config = applyLayout(current, activity.layout);
  config = applyLevelTypeDefaults(activity.levelType, config);

  if (activity.canvasStrip) {
    config = {
      ...config,
      canvasLesson: {
        ...DEFAULT_CANVAS_LESSON,
        ...config.canvasLesson,
        stripMode: activity.canvasStrip,
      },
    };
  }

  if (activity.geometryTask) {
    const wasGeometry = !!current.geometryPath?.enabled;
    const origin = current.geometryPath?.templateOrigin ?? { x: 1, y: 1 };
    const gp = {
      ...DEFAULT_GEOMETRY_PATH,
      ...config.geometryPath,
      studentTask: activity.geometryTask,
      templateOrigin: origin,
      ...(activity.geometryTask === "DRAW_PATH"
        ? {
            seedStarterProgram: true,
            keepShapeVisibleDuringRun: false,
            afterShapeBehavior: "SHAPE_COMPLETE" as const,
            validationMode: "EXACT_PATH" as const,
          }
        : {}),
    };
    config = { ...config, geometryPath: gp };
    if (!wasGeometry) {
      config = {
        ...config,
        robotStartPosition: origin,
        robotStartFacing: { x: 1, y: 0 },
        gridObjects: [{ position: { ...origin }, objectType: "newspaper", isStartObject: true }],
        goalCell: undefined,
        blinkEndCells: false,
      };
    }
    if (activity.geometryTask === "DRAW_PATH") {
      config = withGeometryShapeProgram(config);
    }
  }

  return { levelType: activity.levelType, config };
}
