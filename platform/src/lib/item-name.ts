/** Placeholder names teachers should not publish, and students should never see. */
export function isPlaceholderItemName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return true;
  return /^(untitled item|new item|untitled)$/i.test(trimmed);
}

/** Name shown to students. Falls back to Item N plus the task when the catalog name is empty. */
export function classroomItemName(
  name: string | null | undefined,
  levelNumber: number,
  taskLabel?: string | null
): string {
  if (!isPlaceholderItemName(name)) return name!.trim();
  const n = Math.max(1, levelNumber);
  const task = taskLabel?.trim();
  return task ? `Item ${n}: ${task}` : `Item ${n}`;
}

/** Badge number students see. Prefer "Item 2" from the name so it matches Play next. */
export function studentItemNumber(name: string | null | undefined, fallbackIndex: number): number {
  const trimmed = name?.trim() ?? "";
  const match = trimmed.match(/^Item\s+(\d+)\b/i);
  if (match) return Math.max(1, Number(match[1]));
  return Math.max(1, fallbackIndex);
}
