import { z } from "zod";
import { LevelType } from "@prisma/client";

const vec2 = z.object({ x: z.number().int(), y: z.number().int() });

export const levelCornerHintSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().optional(),
  body: z.string().optional(),
  /** Public URL served by the platform (e.g. /uploads/hints/abc.png) — shown in Unity top-right panel. */
  imageUrl: z.string().optional(),
  /** Optional voice / SFX for this tip (MP3, WAV, OGG). Played in Unity when the tip appears. */
  audioUrl: z.string().optional(),
  /** When true (default), Unity plays audio once when the tip panel opens. */
  playAudioAutomatically: z.boolean().optional(),
});

export const blankDataSchema = z.object({
  correctAnswer: z.string(),
  enabledArrows: z.array(z.string()).default([]),
});

export const layoutModeSchema = z.enum(["GRID", "NUMBER_LINE"]).default("GRID");

/** Palette buttons students can use (also limits BFS best-route commands). */
export const robotActionButtonSchema = z.enum([
  "forward",
  "backward",
  "turn left",
  "turn right",
]);

export type RobotActionButton = z.infer<typeof robotActionButtonSchema>;

export const ALL_ROBOT_ACTION_BUTTONS: RobotActionButton[] = [
  "forward",
  "backward",
  "turn left",
  "turn right",
];

export const DEFAULT_ENABLED_ACTION_BUTTONS: RobotActionButton[] = [...ALL_ROBOT_ACTION_BUTTONS];

export const numberLineSchema = z.object({
  /** Number of tick marks (positions 0 .. tickCount - 1). */
  tickCount: z.number().int().min(3).max(20).default(9),
  /** Grid row index where the horizontal line sits (Unity maps row → world Z). */
  lineRow: z.number().int().min(0).max(18).default(2),
  showTickLabels: z.boolean().default(true),
  showArrows: z.boolean().default(true),
  /** Hide turn-left/right palette buttons in Unity (forward/backward along the line only). */
  forwardBackwardOnly: z.boolean().default(true),
  /** Hex colors for Unity axis (e.g. #2d2d35). */
  lineColor: z.string().optional(),
  tickColor: z.string().optional(),
  labelColor: z.string().optional(),
  /** Size ratios relative to grid cell size in Unity (0.01–0.2). */
  axisThicknessRatio: z.number().min(0.01).max(0.2).optional(),
  tickHeightRatio: z.number().min(0.05).max(0.6).optional(),
  tickWidthRatio: z.number().min(0.01).max(0.15).optional(),
  labelSizeRatio: z.number().min(0.08).max(0.5).optional(),
  /** Tick spacing in Unity world units (overrides CharacterMove.numberLineGridSize when set). */
  tickSpacing: z.number().min(10).max(500).optional(),
  /** Tick spacing & axis size multiplier in Unity (1 = default). */
  playfieldScale: z.number().min(0.5).max(3).optional(),
  /** Prop size multiplier on the number line (1 = default auto-fit). */
  objectScale: z.number().min(0.3).max(3).optional(),
  /** Robot size multiplier on the number line (1 = default). */
  robotScale: z.number().min(0.3).max(3).optional(),
  /** Above/below offset from axis as fraction of cell spacing (default 0.32). */
  placementOffsetRatio: z.number().min(0.1).max(0.8).optional(),
});

export const DEFAULT_NUMBER_LINE: z.infer<typeof numberLineSchema> = {
  tickCount: 9,
  lineRow: 2,
  showTickLabels: true,
  showArrows: true,
  forwardBackwardOnly: true,
};

export const DEFAULT_NUMBER_LINE_STYLE = {
  lineColor: "#2d2d35",
  tickColor: "#1a1a22",
  labelColor: "#333340",
  axisThicknessRatio: 0.045,
  tickHeightRatio: 0.28,
  tickWidthRatio: 0.05,
  labelSizeRatio: 0.22,
  playfieldScale: 1,
  objectScale: 1,
  robotScale: 1,
  placementOffsetRatio: 0.32,
} as const;

export const gridObjectSchema = z.object({
  position: vec2,
  objectType: z.string(),
  isStartObject: z.boolean().optional(),
  isEndObject: z.boolean().optional(),
  /** When visitObjectSequence is on: 1 = first visit, 2 = second visit (synced with start/end flags). */
  visitOrder: z.number().int().min(1).max(2).optional(),
  /** Robot cannot enter this cell — bumps back when it tries to move in. */
  blocksRobot: z.boolean().optional(),
  allowDrag: z.boolean().optional(),
  guidedEndPosition: vec2.optional(),
  /** NUMBER_LINE: prop above the line, below it, or on the line (start/end markers). */
  placement: z.enum(["above", "below", "onLine"]).optional(),
  /** Optional custom image URL for this tick (Unity loads from platform). */
  imageUrl: z.string().optional(),
});

/** Per-step playfield override (robot cell, facing, props) — synced to Unity on each intro step. */
export const introStepPlayfieldSchema = z.object({
  useCustomPlayfield: z.boolean().default(false),
  robotStartPosition: vec2.optional(),
  robotStartFacing: vec2.optional(),
  gridObjects: z.array(gridObjectSchema).optional(),
});

/** Per-step tutorial animation (drag ghost + run tap) in Unity. */
export const introStepTutorialSchema = z.object({
  showDragAnimation: z.boolean().default(true),
  dragRepeatCount: z.number().int().min(1).max(4).default(2),
  showRunTapAnimation: z.boolean().default(true),
  runTapRepeatCount: z.number().int().min(1).max(4).default(2),
});

export const introStepSchema = z.object({
  action: z.enum(["forward", "backward", "turn left", "turn right"]),
  dragInstruction: z.string().optional(),
  runInstruction: z.string().optional(),
  runningInstruction: z.string().optional(),
  stepHint: levelCornerHintSchema.optional(),
  playfield: introStepPlayfieldSchema.optional(),
  tutorial: introStepTutorialSchema.optional(),
});

export const actionBlockIntroSchema = z.object({
  enabled: z.boolean().default(false),
  introId: z.string().optional(),
  showOnlyOnce: z.boolean().default(true),
  /** When true, students see a Skip button during the block introduction. */
  allowSkip: z.boolean().default(true),
  completeMessage: z.string().optional(),
  steps: z.array(introStepSchema).default([]),
});

export const levelGameplayConfigSchema = z.object({
  levelName: z.string(),
  layoutMode: layoutModeSchema,
  numberLine: numberLineSchema.optional(),
  /** Intro levels use a high value (e.g. 99) so students can practice freely. */
  maxAttempts: z.number().int().min(1).max(99).default(3),
  robotStartPosition: vec2.default({ x: 1, y: 0 }),
  robotStartFacing: vec2.default({ x: 0, y: 1 }),
  /** Goal cell when no prop is needed — Robo wins by reaching this cell. */
  goalCell: vec2.optional(),
  gridObjects: z.array(gridObjectSchema).default([]),
  showCellBlinkHighlights: z.boolean().default(true),
  blinkStartCells: z.boolean().default(true),
  blinkEndCells: z.boolean().default(true),
  allowRobotDrag: z.boolean().default(true),
  allowGridObjectDrag: z.boolean().default(false),
  cornerHint: levelCornerHintSchema.optional(),
  actionBlockIntro: actionBlockIntroSchema.optional(),
  guidedActions: z.array(z.string()).optional(),
  blanks: z.array(blankDataSchema).optional(),
  useFlagPlacement: z.boolean().default(false),
  playerPicksEndCellWithFlag: z.boolean().default(false),
  requireFlagBeforeRun: z.boolean().default(false),
  flagInitialPosition: vec2.optional(),
  /** DRAG_ACTIONS: robot visits two objects in order (visit 1 then visit 2); both blink and disappear on visit. */
  visitObjectSequence: z.boolean().default(false),
  /** When false, level is hidden from Unity / student play (can stay published). */
  visible: z.boolean().default(true),
  /** Show the small command-history strip after RUN (forward / turn icons). */
  showCommandHistory: z.boolean().default(false),
  /** Scale of the history strip in Unity (0.2–1.5). Default 0.45 = compact. */
  commandHistoryScale: z.number().min(0.2).max(1.5).optional(),
  /** Show the in-game Reset button (clears yellow strip + robot to start; does not use an attempt). */
  showStudentResetButton: z.boolean().default(true),
  /**
   * When true (default), pressing RUN animates Robo through the program.
   * When false, RUN checks the student's answer without moving Robo on screen.
   */
  runRobotOnSubmit: z.boolean().default(true),
  /** Success popup shown when the student completes the level. Placeholders: {levelName} */
  attemptSuccessMessage: z.string().optional(),
  /** Wrong-answer popup after a failed RUN. Placeholders: {attempt}, {maxAttempts}, {reason} */
  attemptFailureMessage: z.string().optional(),
  /** Popup when the student uses all attempts. Placeholders: {levelName}, {maxAttempts} */
  maxAttemptsMessage: z.string().optional(),
  /**
   * Action palette buttons visible to students. Omitted = all four on grid;
   * number-line levels also respect numberLine.forwardBackwardOnly when unset.
   */
  enabledActionButtons: z.array(robotActionButtonSchema).optional(),
  /** Optional ECD task metadata for stealth assessment (additive). */
  assessment: z
    .object({
      taskType: z
        .enum([
          "algorithmic-thinking",
          "debugging",
          "decomposition",
          "spatial-reasoning",
          "correspondence",
          "optimization",
          "prediction",
          "multi-stage-navigation",
          "path-building",
          "choice-action",
        ])
        .optional(),
      /** Teacher-facing category (e.g. dashboard section title). */
      teacherCategory: z.string().optional(),
      /** When true, reward smallest successful repair; show best route in advanced section. */
      minimalFixExpected: z.boolean().optional(),
      compareWithOptimalRoute: z.boolean().optional(),
      requiredGoalOrder: z.boolean().optional(),
      /** Robot must finish facing this direction (e.g. toward the goal object). */
      requiredFinalFacing: vec2.optional(),
      /** Known working programs for debugging assessment (command tokens per program). */
      correctPrograms: z.array(z.array(z.string())).optional(),
      workingFixes: z.array(z.array(z.string())).optional(),
      solutionPrograms: z.array(z.array(z.string())).optional(),
      /** Override playfield for assessment (defaults from layoutMode). */
      taskEnvironmentType: z.enum(["grid", "number-line"]).optional(),
    })
    .optional(),
});

export type LevelGameplayConfig = z.infer<typeof levelGameplayConfigSchema>;

/** Commands allowed in-game and in route / assessment BFS for this level. */
export function resolveEnabledActionButtons(
  config: LevelGameplayConfig
): RobotActionButton[] {
  const custom = config.enabledActionButtons;
  if (custom && custom.length > 0) {
    const valid = custom.filter((a) =>
      ALL_ROBOT_ACTION_BUTTONS.includes(a as RobotActionButton)
    ) as RobotActionButton[];
    if (valid.length > 0) return valid;
  }
  if (isNumberLineLayout(config) && config.numberLine?.forwardBackwardOnly !== false) {
    return ["forward", "backward"];
  }
  return [...DEFAULT_ENABLED_ACTION_BUTTONS];
}

export const createLevelBodySchema = z.object({
  levelKey: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, underscores"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  orderIndex: z.number().int().min(0).default(0),
  difficulty: z.number().int().min(1).max(5).default(1),
  levelType: z.nativeEnum(LevelType),
  published: z.boolean().default(false),
  config: levelGameplayConfigSchema,
});

export const updateLevelBodySchema = createLevelBodySchema.partial().extend({
  config: levelGameplayConfigSchema.optional(),
});

const LEVEL_KEY_PATTERN = /^[a-z0-9_]+$/;

/** Auto-generate a valid levelKey from a display name. */
export function suggestLevelKeyFromName(name: string, fallbackSuffix?: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (slug.length >= 1) {
    const key = `level_${slug}`.slice(0, 64);
    if (key.length >= 2 && LEVEL_KEY_PATTERN.test(key)) return key;
  }
  const suffix = fallbackSuffix ?? Date.now().toString(36).slice(-6);
  return `level_draft_${suffix}`;
}

/** Default levelKey for a brand-new item draft. */
export function defaultNewLevelKey(): string {
  return suggestLevelKeyFromName("", Date.now().toString(36).slice(-6));
}

/** Client-side identity checks aligned with createLevelBodySchema. */
export function validateLevelIdentity(name: string, levelKey: string): string | null {
  const trimmedName = name.trim();
  const trimmedKey = levelKey.trim();

  if (!trimmedName) return "Add a display name before saving.";
  if (trimmedName.length > 120) return "Display name is too long (max 120 characters).";
  if (!trimmedKey) return "Add an item code before saving.";
  if (trimmedKey.length < 2) return "Item code must be at least 2 characters.";
  if (trimmedKey.length > 64) return "Item code is too long (max 64 characters).";
  if (!LEVEL_KEY_PATTERN.test(trimmedKey)) {
    return "Item code can only use lowercase letters, numbers, and underscores.";
  }
  return null;
}

/** Turn API validation flatten() into readable lines for teachers. */
export function formatLevelSaveValidationError(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
  if (!fieldErrors) return null;

  const labels: Record<string, string> = {
    name: "Display name",
    levelKey: "Item code",
    description: "Teacher notes",
    orderIndex: "Order in sequence",
    difficulty: "Difficulty",
  };

  const lines = Object.entries(fieldErrors).flatMap(([field, messages]) =>
    (messages ?? []).map((msg) => `${labels[field] ?? field}: ${msg}`)
  );
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Default block-introduction steps when INTRO level config is missing or empty. */
export const DEFAULT_INTRO_BLOCK_STEPS: NonNullable<
  LevelGameplayConfig["actionBlockIntro"]
>["steps"] = [
  {
    action: "forward",
    dragInstruction: "Drag Forward to the yellow strip.",
    stepHint: { enabled: true, title: "Forward", body: "Moves one step ahead." },
  },
  {
    action: "backward",
    dragInstruction: "Drag Backward to the yellow strip.",
    stepHint: { enabled: true, title: "Backward", body: "Moves one step back." },
  },
  {
    action: "turn right",
    dragInstruction: "Drag Turn Right to the yellow strip.",
    stepHint: { enabled: true, title: "Turn Right", body: "Rotates 90° right." },
  },
  {
    action: "turn left",
    dragInstruction: "Drag Turn Left to the yellow strip.",
    stepHint: { enabled: true, title: "Turn Left", body: "Rotates 90° left." },
  },
];

const DEFAULT_INTRO_CORNER_HINT: NonNullable<LevelGameplayConfig["cornerHint"]> = {
  enabled: true,
  title: "Welcome!",
  body: "Let's learn how to use the action blocks.",
};

export function applyLevelTypeDefaults(
  levelType: LevelType,
  config: LevelGameplayConfig
): LevelGameplayConfig {
  const base = { ...config };
  switch (levelType) {
    case LevelType.INTRO: {
      const existingIntro = base.actionBlockIntro;
      const steps =
        existingIntro?.steps && existingIntro.steps.length > 0
          ? existingIntro.steps
          : DEFAULT_INTRO_BLOCK_STEPS;
      return {
        ...base,
        useFlagPlacement: false,
        guidedActions: undefined,
        blanks: undefined,
        cornerHint: { ...DEFAULT_INTRO_CORNER_HINT, ...base.cornerHint },
        actionBlockIntro: {
          introId: "level_0_action_blocks",
          showOnlyOnce: true,
          allowSkip: true,
          completeMessage: "Great job! You're ready for Item 1.",
          ...existingIntro,
          enabled: existingIntro?.enabled !== false,
          steps,
        },
      };
    }
    case LevelType.DRAG_ACTIONS:
      return {
        ...base,
        useFlagPlacement: false,
        playerPicksEndCellWithFlag: false,
        requireFlagBeforeRun: false,
        guidedActions: undefined,
        blanks: undefined,
        visitObjectSequence: base.visitObjectSequence ?? false,
      };
    case LevelType.FLAG_PLACEMENT:
      return {
        ...base,
        useFlagPlacement: true,
        playerPicksEndCellWithFlag: base.playerPicksEndCellWithFlag ?? true,
        requireFlagBeforeRun: base.requireFlagBeforeRun ?? true,
        guidedActions: base.guidedActions ?? ["forward", "forward", "forward"],
        blanks: undefined,
      };
    case LevelType.CHOOSE_BUTTONS:
      return {
        ...base,
        useFlagPlacement: false,
        playerPicksEndCellWithFlag: false,
        requireFlagBeforeRun: false,
        guidedActions: base.guidedActions ?? ["forward", "blank", "forward"],
        blanks: base.blanks ?? [
          { correctAnswer: "turn left", enabledArrows: ["turn left", "turn right"] },
        ],
      };
    case LevelType.DRAG_EDIT_PROGRAM:
      return {
        ...base,
        useFlagPlacement: false,
        playerPicksEndCellWithFlag: false,
        requireFlagBeforeRun: false,
        guidedActions: base.guidedActions ?? ["forward", "turn left", "forward"],
        blanks: undefined,
      };
    default:
      return base;
  }
}

export function defaultConfigForType(levelType: LevelType, levelName: string): LevelGameplayConfig {
  const base: LevelGameplayConfig = {
    levelName,
    layoutMode: "GRID",
    maxAttempts: 3,
    robotStartPosition: { x: 1, y: 0 },
    robotStartFacing: { x: 0, y: 1 },
    gridObjects: [
      { position: { x: 1, y: 0 }, objectType: "newspaper", isStartObject: true },
      { position: { x: 1, y: 2 }, objectType: "bin", isEndObject: true },
    ],
    showCellBlinkHighlights: true,
    blinkStartCells: true,
    blinkEndCells: true,
    allowRobotDrag: true,
    allowGridObjectDrag: false,
    visible: true,
    showCommandHistory: false,
    commandHistoryScale: 1,
    showStudentResetButton: true,
    runRobotOnSubmit: true,
    enabledActionButtons: [...DEFAULT_ENABLED_ACTION_BUTTONS],
    useFlagPlacement: false,
    playerPicksEndCellWithFlag: false,
    requireFlagBeforeRun: false,
    visitObjectSequence: false,
    cornerHint: { enabled: true, title: levelName, body: "Read the tip and build your program." },
  };

  if (levelType === LevelType.INTRO) {
    return applyLevelTypeDefaults(levelType, {
      ...base,
      maxAttempts: 99,
      robotStartPosition: { x: 1, y: 0 },
      robotStartFacing: { x: 0, y: 1 },
      gridObjects: [
        { position: { x: 1, y: 0 }, objectType: "newspaper", isStartObject: true },
        { position: { x: 1, y: 2 }, objectType: "bin", isEndObject: true },
      ],
      cornerHint: DEFAULT_INTRO_CORNER_HINT,
      actionBlockIntro: {
        enabled: true,
        introId: "level_0_action_blocks",
        showOnlyOnce: true,
        allowSkip: true,
        completeMessage: "Great job! You're ready for Item 1.",
        steps: DEFAULT_INTRO_BLOCK_STEPS,
      },
    });
  }

  if (levelType === LevelType.DRAG_ACTIONS) {
    return applyLevelTypeDefaults(levelType, { ...base });
  }

  if (levelType === LevelType.FLAG_PLACEMENT) {
    return applyLevelTypeDefaults(levelType, {
      ...base,
      cornerHint: {
        enabled: true,
        title: levelName,
        body: "Tap an empty cell to place the flag (goal), then use Forward blocks.",
      },
      guidedActions: ["forward", "forward", "forward"],
    });
  }

  if (levelType === LevelType.DRAG_EDIT_PROGRAM) {
    return applyLevelTypeDefaults(levelType, {
      ...base,
      cornerHint: {
        enabled: true,
        title: levelName,
        body: "Change the starter program: drag blocks in, remove blocks, or reorder, then press RUN.",
      },
      guidedActions: ["forward", "turn left", "forward"],
    });
  }

  return applyLevelTypeDefaults(levelType, {
    ...base,
    cornerHint: {
      enabled: true,
      title: levelName,
      body: "Pick the correct arrow for each blank slot.",
    },
    guidedActions: ["forward", "blank", "forward"],
    blanks: [{ correctAnswer: "turn left", enabledArrows: ["turn left", "turn right"] }],
  });
}

export const LEVEL_TYPE_LABELS: Record<LevelType, string> = {
  [LevelType.INTRO]: "Introduction (Item 0)",
  [LevelType.DRAG_ACTIONS]: "Drag action blocks",
  [LevelType.FLAG_PLACEMENT]: "Place flag (goal)",
  [LevelType.CHOOSE_BUTTONS]: "Choose action buttons (guided blanks)",
  [LevelType.DRAG_EDIT_PROGRAM]: "Edit starter program (drag & drop)",
};

export const LEVEL_TYPE_HELP: Record<LevelType, string> = {
  [LevelType.INTRO]:
    "Runs once before Item 1. Teaches Forward, Backward, and turns — edit under Introduction in the menu.",
  [LevelType.DRAG_ACTIONS]:
    "Students drag blocks into the queue, then press RUN. Optional: visit two objects in order (both blink and disappear when touched).",
  [LevelType.FLAG_PLACEMENT]:
    "Students tap a cell to place the flag as the goal, then run their program.",
  [LevelType.CHOOSE_BUTTONS]:
    "Pre-filled program with blanks; students pick the correct arrow buttons.",
  [LevelType.DRAG_EDIT_PROGRAM]:
    "You design a starter program; students add, remove, or reorder blocks with drag and drop, then RUN.",
};

export const INTRO_LEVEL_KEY = "level_0";

/** Visit-sequence (DRAG_ACTIONS) needs visit step 1 and visit step 2 on grid or number-line objects. */
export function visitSequenceReady(config: LevelGameplayConfig): boolean {
  if (!config.visitObjectSequence) return true;
  const objs = config.gridObjects ?? [];
  const has1 = objs.some((o) => o.visitOrder === 1 || o.isStartObject);
  const has2 = objs.some((o) => o.visitOrder === 2 || o.isEndObject);
  return has1 && has2;
}

export function isNumberLineLayout(config: LevelGameplayConfig): boolean {
  return config.layoutMode === "NUMBER_LINE";
}

/** Row index for a prop relative to the line row. */
export function placementToRow(
  lineRow: number,
  placement?: "above" | "below" | "onLine"
): number {
  if (placement === "above") return lineRow + 1;
  if (placement === "below") return lineRow - 1;
  return lineRow;
}

/** Maps tick index + placement to grid position for Unity. */
export function tickToGridPosition(
  tick: number,
  lineRow: number,
  placement?: "above" | "below" | "onLine"
): { x: number; y: number } {
  return { x: tick, y: placementToRow(lineRow, placement) };
}

/** Writes gridObjects positions from number-line ticks (call before save / API). */
export function syncNumberLineGridPositions(config: LevelGameplayConfig): LevelGameplayConfig {
  if (!isNumberLineLayout(config)) return config;
  const nl = config.numberLine ?? DEFAULT_NUMBER_LINE;
  const lineRow = nl.lineRow ?? 2;
  const tickCount = nl.tickCount ?? 9;
  const robotTick = config.robotStartPosition?.x ?? 0;
  const robotRow = placementToRow(lineRow, "onLine");
  const goal = config.goalCell;
  const gridObjects = (config.gridObjects ?? []).map((o) => {
    const tick = o.position?.x ?? 0;
    const placement = o.placement ?? "below";
    return {
      ...o,
      position: tickToGridPosition(tick, lineRow, placement),
    };
  });
  return {
    ...config,
    numberLine: { ...nl, tickCount, lineRow },
    robotStartPosition: {
      x: Math.min(Math.max(0, robotTick), tickCount - 1),
      y: robotRow,
    },
    goalCell:
      goal && goal.x >= 0
        ? {
            x: Math.min(Math.max(0, goal.x), tickCount - 1),
            y: placementToRow(lineRow, "onLine"),
          }
        : goal,
    gridObjects,
  };
}

/** Reads tick index from stored grid position (for designer UI). */
export function gridPositionToTick(
  pos: { x: number; y: number },
  lineRow: number
): { tick: number; placement: "above" | "below" | "onLine" } {
  if (pos.y > lineRow) return { tick: pos.x, placement: "above" };
  if (pos.y < lineRow) return { tick: pos.x, placement: "below" };
  return { tick: pos.x, placement: "onLine" };
}
