"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";
import { NumberLineDesigner } from "@/components/teacher/level-designer/number-line-designer";
import { LayoutModePicker } from "@/components/teacher/level-designer/layout-mode-picker";
import { CopyLevelLayout } from "@/components/teacher/level-designer/copy-level-layout";
import { isCanvasLayout, isNumberLineLayout } from "@/lib/level-config";
import { getCanvasStripType } from "@/lib/canvas-strip-types";
import { ItemBuilderStepFrame } from "../item-builder-step-frame";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
  currentLevelId?: string;
};

export function StepGridSetup({ config, onChange, currentLevelId }: Props) {
  const strip = getCanvasStripType(config.canvasLesson?.stripMode);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-6"
    >
      <ItemBuilderStepFrame
        icon={Grid3x3}
        title="Design the board"
        subtitle="Grid, number line, or canvas."
        accent="teal"
      />

      {currentLevelId && (
        <CopyLevelLayout
          currentLevelId={currentLevelId}
          currentConfig={config}
          onApply={onChange}
        />
      )}

      <LayoutModePicker config={config} onChange={onChange} />

      {isCanvasLayout(config) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Canvas</span>
          {" · "}
          {strip.label}
          {" — "}
          {strip.studentJob} Continue in the Program step.
        </div>
      ) : isNumberLineLayout(config) ? (
        <NumberLineDesigner config={config} onChange={onChange} />
      ) : (
        <GridDesigner config={config} onChange={onChange} />
      )}
    </motion.div>
  );
}
