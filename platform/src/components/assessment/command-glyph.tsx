"use client";

import Image from "next/image";
import {
  COMMAND_ARIA_LABELS,
  COMMAND_ICON_PATHS,
  normalizeCommandToken,
  type CommandToken,
} from "@/lib/command-icons";
import { parseRepeatStart } from "@/lib/assessment/expand-repeats";
import { cn } from "@/lib/utils";

const REPEAT_START = "/command-icons/repeat-start.png";
const REPEAT_END = "/command-icons/repeat-end.png";
const REPEAT_BTN = "/command-icons/repeat-btn.png";

const MOTION: CommandToken[] = ["forward", "backward", "turn left", "turn right"];

export function commandGlyphSrc(token: string): string | null {
  const motion = normalizeCommandToken(token);
  if (motion) return COMMAND_ICON_PATHS[motion];
  if (token === "repeat-btn" || token === "repeat-tool") return REPEAT_BTN;
  if (token === "repeat-end") return REPEAT_END;
  if (
    token === "repeat-start" ||
    token === "repeat" ||
    token.startsWith("repeat:") ||
    parseRepeatStart(token) != null
  ) {
    return REPEAT_START;
  }
  return null;
}

/** Game / report command artwork — same PNGs teachers see in assessment reports. */
export function CommandGlyph({
  token,
  size = 28,
  framed = true,
  className,
}: {
  token: string;
  size?: number;
  framed?: boolean;
  className?: string;
}) {
  const src = commandGlyphSrc(token);
  const motion = normalizeCommandToken(token);
  if (!src) return null;

  const img = (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="object-contain"
      aria-hidden
    />
  );

  if (!framed) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        aria-label={motion ? COMMAND_ARIA_LABELS[motion] : token}
      >
        {img}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-stone-200/80",
        className
      )}
      style={{ width: size + 10, height: size + 10 }}
      aria-label={motion ? COMMAND_ARIA_LABELS[motion] : token}
    >
      {img}
    </span>
  );
}

export function ArrowGlyphRow({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {MOTION.map((token) => (
        <CommandGlyph key={token} token={token} size={size} />
      ))}
    </span>
  );
}
