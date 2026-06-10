/** User-facing label: show "item" instead of "level" in dashboard and game UI. */
export function formatItemDisplayName(name: string | null | undefined): string {
  if (!name) return name ?? "";
  return name
    .replace(/\bLevels\b/g, "Items")
    .replace(/\blevels\b/g, "items")
    .replace(/\bLevel\b/g, "Item")
    .replace(/\blevel\b/g, "item");
}
