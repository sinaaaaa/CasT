"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEFAULT_NUMBER_LINE_STYLE,
  isNumberLineLayout,
  syncNumberLineGridPositions,
} from "@/lib/level-config";
import {
  NUMBER_LINE_DEFAULT_LINE_ROW,
  NUMBER_LINE_DEFAULT_TICKS,
} from "@/lib/level-editor-constants";
import { Grid3x3, Minus } from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function LayoutModePicker({ config, onChange }: Props) {
  const mode = config.layoutMode ?? "GRID";

  function setMode(next: "GRID" | "NUMBER_LINE") {
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
    } else {
      onChange({
        ...config,
        layoutMode: "GRID",
        numberLine: undefined,
        enabledActionButtons: config.enabledActionButtons?.length
          ? config.enabledActionButtons
          : ["forward", "backward", "turn left", "turn right"],
      });
    }
  }

  return (
    <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => setMode("GRID")}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
          !isNumberLineLayout(config)
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Grid3x3 className="h-4 w-4" />
        6×6 Grid
      </button>
      <button
        type="button"
        onClick={() => setMode("NUMBER_LINE")}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
          isNumberLineLayout(config)
            ? "bg-indigo-600 text-white shadow-sm"
            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Minus className="h-4 w-4" />
        Number line
      </button>
    </div>
  );
}
