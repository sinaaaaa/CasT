"use client";

import Image from "next/image";
import {
  COMMAND_ARIA_LABELS,
  COMMAND_ICON_PATHS,
  type CommandToken,
} from "@/lib/command-icons";

export function CommandIconSequence({
  commands,
  size = 36,
  className,
}: {
  commands: CommandToken[];
  size?: number;
  className?: string;
}) {
  if (commands.length === 0) {
    return <span className="text-sm text-muted-foreground">No commands recorded</span>;
  }

  return (
    <ol
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}
      aria-label={`Command sequence, ${commands.length} steps`}
    >
      {commands.map((cmd, i) => (
        <li key={`${cmd}-${i}`} className="flex items-center gap-1">
          <span className="sr-only">
            Step {i + 1}: {COMMAND_ARIA_LABELS[cmd]}
          </span>
          <span
            className="flex items-center justify-center rounded-lg border bg-white shadow-sm"
            style={{ width: size, height: size }}
            title={COMMAND_ARIA_LABELS[cmd]}
          >
            <Image
              src={COMMAND_ICON_PATHS[cmd]}
              alt=""
              width={size - 8}
              height={size - 8}
              className="object-contain"
              aria-hidden
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
