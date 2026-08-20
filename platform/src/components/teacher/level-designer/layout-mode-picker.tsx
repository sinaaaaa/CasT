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
  { id: "GRID" as const, label: "6×6 Grid", icon: Grid3x3 },
  { id: "NUMBER_LINE" as const, label: "Number line", icon: Minus },
  { id: "CANVAS" as const, label: "Canvas", icon: SquareDashed },
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
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
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
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {layout.label}
          </button>
        );
      })}
    </div>
  );
}
