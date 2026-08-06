"use client";

import Image from "next/image";
import {
  COMMAND_ARIA_LABELS,
  COMMAND_ICON_PATHS,
  normalizeCommandToken,
  type CommandToken,
} from "@/lib/command-icons";
import { isRepeatEnd, parseRepeatStart } from "@/lib/assessment/expand-repeats";
import { cn } from "@/lib/utils";

/** Game-style Repeat Start / End art (copied from Unity Assets/Image). */
export const REPEAT_ICON_PATHS = {
  start: "/command-icons/repeat-start.png",
  end: "/command-icons/repeat-end.png",
  btn: "/command-icons/repeat-btn.png",
} as const;

type Segment =
  | { kind: "motion"; token: CommandToken; raw: string }
  | { kind: "repeat-start"; count: number; raw: string }
  | { kind: "repeat-end"; raw: string }
  | { kind: "other"; raw: string };

function parseSegments(tokens: string[]): Segment[] {
  return tokens.map((raw) => {
    const count = parseRepeatStart(raw);
    if (count != null) return { kind: "repeat-start" as const, count, raw };
    if (isRepeatEnd(raw)) return { kind: "repeat-end" as const, raw };
    const motion = normalizeCommandToken(raw);
    if (motion) return { kind: "motion" as const, token: motion, raw };
    // Unity sometimes logs "right" / "left"
    const lower = raw.trim().toLowerCase();
    if (lower === "right" || lower === "left") {
      const t = lower === "right" ? "turn right" : "turn left";
      return { kind: "motion" as const, token: t as CommandToken, raw };
    }
    return { kind: "other" as const, raw };
  });
}

/**
 * Renders a program like the yellow strip: motion icons + Repeat Start/End
 * puzzle sprites, with a green sleeve wrapping the body between Start and End.
 */
export function ProgramSequenceVisualizer({
  tokens,
  size = 44,
  className,
  tone = "neutral",
}: {
  tokens: string[];
  size?: number;
  className?: string;
  tone?: "match" | "miss" | "neutral";
}) {
  if (!tokens.length) {
    return <span className="text-sm text-muted-foreground">Empty program</span>;
  }

  const segments = parseSegments(tokens);
  const repeatH = Math.round(size * 1.35);
  const repeatW = Math.round(size * 1.25);

  // Build visual groups: wrap motions that sit between a start and its end.
  type VisualNode =
    | { type: "token"; seg: Segment; index: number }
    | { type: "repeat-group"; start: Segment & { kind: "repeat-start" }; startIndex: number; body: { seg: Segment; index: number }[]; end: Segment & { kind: "repeat-end" }; endIndex: number };

  const nodes: VisualNode[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.kind === "repeat-start") {
      const body: { seg: Segment; index: number }[] = [];
      let j = i + 1;
      let endSeg: (Segment & { kind: "repeat-end" }) | null = null;
      let endIndex = -1;
      while (j < segments.length) {
        if (segments[j].kind === "repeat-end") {
          endSeg = segments[j] as Segment & { kind: "repeat-end" };
          endIndex = j;
          break;
        }
        if (segments[j].kind === "repeat-start") break; // no nesting
        body.push({ seg: segments[j], index: j });
        j++;
      }
      if (endSeg) {
        nodes.push({
          type: "repeat-group",
          start: seg,
          startIndex: i,
          body,
          end: endSeg,
          endIndex,
        });
        i = endIndex + 1;
        continue;
      }
    }
    nodes.push({ type: "token", seg, index: i });
    i++;
  }

  const sleeveTone =
    tone === "match"
      ? "bg-emerald-200/70 ring-emerald-300/60"
      : tone === "miss"
        ? "bg-sky-200/50 ring-sky-200/80"
        : "bg-emerald-200/60 ring-emerald-200/70";

  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label={`Program sequence, ${tokens.length} steps`}
    >
      {nodes.map((node, ni) => {
        if (node.type === "token") {
          return (
            <li key={`t-${node.index}-${ni}`}>
              <TokenBlock seg={node.seg} size={size} repeatW={repeatW} repeatH={repeatH} />
            </li>
          );
        }

        return (
          <li
            key={`g-${node.startIndex}-${ni}`}
            className={cn(
              "inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl py-1 pl-0.5 pr-0.5 ring-1",
              sleeveTone
            )}
            title={`Repeat ×${node.start.count}`}
          >
            <TokenBlock seg={node.start} size={size} repeatW={repeatW} repeatH={repeatH} />
            {node.body.map((b) => (
              <TokenBlock
                key={`b-${b.index}`}
                seg={b.seg}
                size={size}
                repeatW={repeatW}
                repeatH={repeatH}
              />
            ))}
            <TokenBlock seg={node.end} size={size} repeatW={repeatW} repeatH={repeatH} count={node.start.count} />
          </li>
        );
      })}
    </ol>
  );
}

function TokenBlock({
  seg,
  size,
  repeatW,
  repeatH,
  count,
}: {
  seg: Segment;
  size: number;
  repeatW: number;
  repeatH: number;
  count?: number;
}) {
  if (seg.kind === "motion") {
    return (
      <span
        className="flex items-center justify-center rounded-lg border bg-white shadow-sm"
        style={{ width: size, height: size }}
        title={COMMAND_ARIA_LABELS[seg.token]}
      >
        <span className="sr-only">{COMMAND_ARIA_LABELS[seg.token]}</span>
        <Image
          src={COMMAND_ICON_PATHS[seg.token]}
          alt=""
          width={size - 8}
          height={size - 8}
          className="object-contain"
          aria-hidden
        />
      </span>
    );
  }

  if (seg.kind === "repeat-start") {
    return (
      <span
        className="relative inline-flex shrink-0 drop-shadow-sm"
        style={{ width: repeatW, height: repeatH }}
        title={`Repeat start ×${seg.count}`}
      >
        <Image
          src={REPEAT_ICON_PATHS.start}
          alt=""
          width={repeatW}
          height={repeatH}
          className="h-full w-full object-contain"
          aria-hidden
        />
        <span className="sr-only">Repeat start, {seg.count} times</span>
        <span className="absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-violet-800 shadow-sm ring-1 ring-violet-200">
          ×{seg.count}
        </span>
      </span>
    );
  }

  if (seg.kind === "repeat-end") {
    const n = count ?? 2;
    return (
      <span
        className="relative inline-flex shrink-0 drop-shadow-sm"
        style={{ width: repeatW, height: repeatH }}
        title={`Repeat end ×${n}`}
      >
        <Image
          src={REPEAT_ICON_PATHS.end}
          alt=""
          width={repeatW}
          height={repeatH}
          className="h-full w-full object-contain"
          aria-hidden
        />
        <span className="sr-only">Repeat end</span>
        <span className="absolute bottom-1.5 left-1/2 z-[1] flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-amber-100/95 px-1 py-0.5 text-[9px] font-bold text-amber-900 shadow-sm ring-1 ring-amber-300/80">
          ×{n}
        </span>
      </span>
    );
  }

  return (
    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium capitalize text-slate-700">
      {seg.raw}
    </span>
  );
}
