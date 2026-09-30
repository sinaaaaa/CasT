/**
 * Debugging Config — edit rules for items where students repair a starter program
 * (DRAG_EDIT_PROGRAM, and GEOMETRY_PATH with a seeded starter).
 *
 * One shared edit budget covers every program-item type (arrows, Repeat, Command Bags,
 * Action Chunks). An "edit" is one committed change to the program: add, remove, replace,
 * reorder, or a Repeat-count change. A drag that leaves the program unchanged costs nothing.
 */
import { z } from "zod";
import { LevelType } from "@prisma/client";

export const DEBUG_EDIT_KINDS = ["add", "remove", "replace", "reorder", "editRepeat"] as const;
export type DebugEditKind = (typeof DEBUG_EDIT_KINDS)[number];

export const DEBUG_ITEM_TYPES = ["arrows", "repeat", "commandBag", "actionChunk"] as const;
export type DebugItemType = (typeof DEBUG_ITEM_TYPES)[number];

export const DEBUG_EDIT_KIND_LABELS: Record<DebugEditKind, string> = {
  add: "Add",
  remove: "Remove",
  replace: "Replace",
  reorder: "Reorder",
  editRepeat: "Change Repeat count",
};

export const DEBUG_EDIT_KIND_HINTS: Record<DebugEditKind, string> = {
  add: "Drag a new block into the program.",
  remove: "Delete a block (X button or drag it out).",
  replace: "Drop a block on top of another to swap it.",
  reorder: "Drag a block to a new place in the program.",
  editRepeat: "Use + / − on a Repeat block.",
};

export const DEBUG_ITEM_TYPE_LABELS: Record<DebugItemType, string> = {
  arrows: "Arrows",
  repeat: "Repeat blocks",
  commandBag: "Command Bags",
  actionChunk: "Action Chunks",
};

export const debuggingConfigSchema = z.object({
  allowedEdits: z.array(z.enum(DEBUG_EDIT_KINDS)).default([...DEBUG_EDIT_KINDS]),
  editableItemTypes: z.array(z.enum(DEBUG_ITEM_TYPES)).default([...DEBUG_ITEM_TYPES]),
  /** Max committed program edits per try; restarts when Reset / Try Again restore the starter. Omitted = unlimited. */
  editBudget: z.number().int().min(1).max(50).optional(),
  /** Max RUN presses for the whole item. Omitted = only maxAttempts applies. */
  runBudget: z.number().int().min(1).max(20).optional(),
  /** Students can't delete below this many program items (a Repeat pair counts as 1). */
  minProgramItems: z.number().int().min(0).max(50).default(0),
  /** Students must keep at least half of the starter's blocks — no delete-all-and-rebuild. */
  preserveProgramStructure: z.boolean().default(false),
});

export type DebuggingConfig = z.infer<typeof debuggingConfigSchema>;

export const DEFAULT_DEBUGGING_CONFIG: DebuggingConfig = {
  allowedEdits: [...DEBUG_EDIT_KINDS],
  editableItemTypes: [...DEBUG_ITEM_TYPES],
  minProgramItems: 0,
  preserveProgramStructure: false,
};

type ConfigLike = {
  geometryPath?: { seedStarterProgram?: boolean } | null;
  debuggingConfig?: Partial<DebuggingConfig> | null;
};

/** Debugging items: edit-the-starter items, including geometry with a seeded starter. */
export function supportsDebuggingConfig(levelType: LevelType | null | undefined, config: ConfigLike): boolean {
  if (levelType === LevelType.DRAG_EDIT_PROGRAM) return true;
  if (levelType === LevelType.GEOMETRY_PATH) return !!config.geometryPath?.seedStarterProgram;
  return false;
}

/** Effective config for a debugging item (defaults filled), or null when not a debugging item. */
export function resolveDebuggingConfig(
  levelType: LevelType | null | undefined,
  config: ConfigLike
): DebuggingConfig | null {
  if (!supportsDebuggingConfig(levelType, config)) return null;
  const parsed = debuggingConfigSchema.safeParse(config.debuggingConfig ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_DEBUGGING_CONFIG };
}

/** True when the config restricts anything (otherwise the item plays exactly as before). */
export function debuggingConfigIsRestrictive(dc: DebuggingConfig | null): boolean {
  if (!dc) return false;
  return (
    dc.allowedEdits.length < DEBUG_EDIT_KINDS.length ||
    dc.editableItemTypes.length < DEBUG_ITEM_TYPES.length ||
    dc.editBudget != null ||
    dc.runBudget != null ||
    dc.minProgramItems > 0 ||
    dc.preserveProgramStructure
  );
}

function listLabels<T extends string>(values: readonly T[], labels: Record<T, string>): string {
  return values.map((v) => labels[v]).join(", ");
}

/** Short teacher-facing lines describing the rules (item summary, reports). */
export function describeDebuggingConfig(dc: DebuggingConfig): string[] {
  const lines: string[] = [];
  lines.push(
    dc.allowedEdits.length === DEBUG_EDIT_KINDS.length
      ? "Any edit type is allowed."
      : dc.allowedEdits.length === 0
        ? "No edits are allowed — students can only run the starter."
        : `Allowed edits: ${listLabels(dc.allowedEdits, DEBUG_EDIT_KIND_LABELS)}.`
  );
  lines.push(
    dc.editableItemTypes.length === DEBUG_ITEM_TYPES.length
      ? "Every block type can be edited."
      : dc.editableItemTypes.length === 0
        ? "No block type can be edited."
        : `Editable blocks: ${listLabels(dc.editableItemTypes, DEBUG_ITEM_TYPE_LABELS)}.`
  );
  lines.push(
    dc.editBudget != null
      ? `Edit budget: ${dc.editBudget} edits per try (Reset and Try Again give them back).`
      : "No edit limit."
  );
  if (dc.runBudget != null) lines.push(`Run budget: ${dc.runBudget} RUN press${dc.runBudget === 1 ? "" : "es"}.`);
  if (dc.minProgramItems > 0) lines.push(`Program must keep at least ${dc.minProgramItems} block${dc.minProgramItems === 1 ? "" : "s"}.`);
  if (dc.preserveProgramStructure) lines.push("Students must keep at least half of the starter blocks (no delete-all-and-rebuild).");
  return lines;
}

/** Blocks the student must keep when preserveProgramStructure is on. */
export function preservedStarterItemCount(starterItemCount: number): number {
  return starterItemCount <= 0 ? 0 : Math.ceil(starterItemCount / 2);
}
