import { masteryBadgeClass, masteryLabel, type MasteryLevel } from "@/lib/ct/constructs";
import { cn } from "@/lib/utils";

const LEVELS: MasteryLevel[] = ["emerging", "developing", "proficient", "advanced"];

function normalizeLevel(level: string): MasteryLevel {
  return LEVELS.includes(level as MasteryLevel) ? (level as MasteryLevel) : "emerging";
}

export function MasteryBadge({
  level,
  className,
}: {
  level: MasteryLevel | string;
  className?: string;
}) {
  const l = normalizeLevel(level);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        masteryBadgeClass(l),
        className
      )}
    >
      {masteryLabel(l)}
    </span>
  );
}
