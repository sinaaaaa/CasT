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
    label: "Grid world",
    hint: "6×6 cells, robot, objects",
    icon: Grid3x3,
  },
  {
    id: "NUMBER_LINE" as const,
    label: "Number line",
    hint: "Forward and back only",
    icon: Minus,
  },
  {
    id: "CANVAS" as const,
    label: "Pattern canvas",
    hint: "No grid — strip + pattern",
    icon: SquareDashed,
  },
];

export function LayoutModePicker({ config, onChange }: Props) {
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
            ? !isNumberLineLayout(config) && !isCanvasLayout(config)
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
              "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
              active
                ? "border-teal-400 bg-teal-50/80 ring-2 ring-teal-100"
                : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900">{layout.label}</span>
              <span className="text-[11px] text-slate-500">{layout.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
