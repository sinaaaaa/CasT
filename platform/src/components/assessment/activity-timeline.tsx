"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  Circle,
  MousePointerClick,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Hand,
} from "lucide-react";

export type TimelineVariant = "command" | "button" | "touch" | "default";

export type TimelineItem = {
  timestamp: Date | string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
};

const toneStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-card text-foreground",
};

function commandToneFromAction(action?: string): TimelineItem["tone"] {
  switch (action?.toUpperCase()) {
    case "ADDED":
      return "success";
    case "REMOVED":
    case "CLEARED":
      return "danger";
    case "MODIFIED":
      return "warning";
    case "REORDERED":
      return "info";
    default:
      return "neutral";
  }
}

function CommandIcon({ action }: { action?: string }) {
  switch (action?.toUpperCase()) {
    case "ADDED":
      return <Plus className="h-3.5 w-3.5" />;
    case "REMOVED":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "MODIFIED":
      return <Pencil className="h-3.5 w-3.5" />;
    case "REORDERED":
      return <ArrowRightLeft className="h-3.5 w-3.5" />;
    case "CLEARED":
      return <RotateCcw className="h-3.5 w-3.5" />;
    default:
      return <Circle className="h-3.5 w-3.5" />;
  }
}

export function ActivityTimeline({
  items,
  variant = "default",
  emptyMessage = "No events recorded.",
}: {
  items: TimelineItem[];
  variant?: TimelineVariant;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12 text-center">
        <Circle className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {items.map((item, i) => {
        const tone = item.tone ?? "neutral";
        const isLast = i === items.length - 1;
        return (
          <li key={i} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-border to-transparent"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-105",
                tone === "success" && "border-emerald-500 bg-emerald-500 text-white",
                tone === "danger" && "border-red-500 bg-red-500 text-white",
                tone === "warning" && "border-amber-500 bg-amber-500 text-white",
                tone === "info" && "border-sky-500 bg-sky-500 text-white",
                tone === "neutral" && "border-primary bg-background text-primary"
              )}
            >
              {variant === "command" ? (
                <CommandIcon action={item.subtitle?.replace("Action: ", "")} />
              ) : variant === "button" ? (
                <MousePointerClick className="h-3.5 w-3.5" />
              ) : variant === "touch" ? (
                <Hand className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md",
                toneStyles[tone]
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{item.title}</p>
                {item.badge && (
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(item.timestamp), "MMM d, yyyy · HH:mm:ss")}
              </p>
              {item.subtitle && <p className="mt-2 text-sm opacity-90">{item.subtitle}</p>}
              {item.meta && <p className="mt-1 font-mono text-xs opacity-75">{item.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function commandTimelineItem(
  e: { timestamp: Date | string; command: string; action: string; sequence: number }
): TimelineItem {
  return {
    timestamp: e.timestamp,
    title: e.command,
    subtitle: `Action: ${e.action}`,
    badge: `Step ${e.sequence + 1}`,
    tone: commandToneFromAction(e.action),
  };
}
