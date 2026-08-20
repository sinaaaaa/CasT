"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEFAULT_CANVAS_LESSON,
  DEFAULT_NUMBER_LINE_STYLE,
  isCanvasLayout,
  isNumberLineLayout,
  syncNumberLineGridPositions,
} from "@/lib/level-config";
import {
  NUMBER_LINE_DEFAULT_LINE_ROW,
  NUMBER_LINE_DEFAULT_TICKS,
} from "@/lib/level-editor-constants";
import { Grid3x3, Minus, SquareDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

const LAYOUTS = [
  {
    id: "GRID" as const,
    label: "6×6 Grid",
    blurb: "Robot moves on a grid with goals and obstacles.",
    icon: Grid3x3,
    active: "bg-emerald-700 text-white shadow-sm",
  },
  {
    id: "NUMBER_LINE" as const,
    label: "Number line",
    blurb: "Forward / backward along a line of ticks.",
    icon: Minus,
    active: "bg-indigo-700 text-white shadow-sm",
  },
  {
    id: "CANVAS" as const,
    label: "Canvas",
    blurb: "Pattern board + yellow strip — no robot grid.",
    icon: SquareDashed,
    active: "bg-slate-900 text-white shadow-sm",
  },
];

export function LayoutModePicker({ config, onChange }: Props) {
  const mode = config.layoutMode ?? "GRID";

  function setMode(next: "GRID" | "NUMBER_LINE" | "CANVAS") {
    if (next === "NUMBER_LINE") {
      onChange(
        syncNumberLineGridPositions({
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
        })
      );
      return;
    }

    if (next === "CANVAS") {
      onChange({
        ...config,
        layoutMode: "CANVAS",
        numberLine: undefined,
        gridObjects: [],
        runRobotOnSubmit: false,
        enabledActionButtons: [
          "forward",
          "backward",
          "turn left",
          "turn right",
          "repeat",
        ],
        canvasLesson: config.canvasLesson ?? { ...DEFAULT_CANVAS_LESSON },
        assessment: {
          ...config.assessment,
          taskEnvironmentType: "canvas",
          taskType: config.assessment?.taskType ?? "decomposition",
          correctPrograms: config.assessment?.correctPrograms?.length
            ? config.assessment.correctPrograms
            : [["repeat:1", "forward", "turn right", "repeat-end"]],
        },
      });
      return;
    }

    onChange({
      ...config,
      layoutMode: "GRID",
      numberLine: undefined,
      enabledActionButtons: config.enabledActionButtons?.length
        ? config.enabledActionButtons.filter((a) => a !== "repeat")
        : ["forward", "backward", "turn left", "turn right"],
      assessment: config.assessment
        ? { ...config.assessment, taskEnvironmentType: "grid" }
        : config.assessment,
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {LAYOUTS.map((layout) => {
        const active =
          layout.id === "GRID"
            ? mode === "GRID" && !isNumberLineLayout(config) && !isCanvasLayout(config)
            : layout.id === "NUMBER_LINE"
              ? isNumberLineLayout(config)
              : isCanvasLayout(config);
        const Icon = layout.icon;
        return (
          <button
            key={layout.id}
            type="button"
            onClick={() => setMode(layout.id)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-2xl border px-4 py-3.5 text-left transition",
              active
                ? cn("border-transparent", layout.active)
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Icon className={cn("h-5 w-5", active ? "opacity-95" : "text-slate-500")} />
            <span>
              <span className="block text-sm font-semibold">{layout.label}</span>
              <span
                className={cn(
                  "mt-0.5 block text-xs leading-snug",
                  active ? "text-white/80" : "text-slate-500"
                )}
              >
                {layout.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
