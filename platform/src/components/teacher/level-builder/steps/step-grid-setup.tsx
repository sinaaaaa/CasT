"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";
import { NumberLineDesigner } from "@/components/teacher/level-designer/number-line-designer";
import { LayoutModePicker } from "@/components/teacher/level-designer/layout-mode-picker";
import { CopyLevelLayout } from "@/components/teacher/level-designer/copy-level-layout";
import { isNumberLineLayout } from "@/lib/level-config";
import { ItemBuilderStepFrame } from "../item-builder-step-frame";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
  currentLevelId?: string;
};

export function StepGridSetup({ config, onChange, currentLevelId }: Props) {
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
        subtitle="Choose a 6×6 grid or number line, then place Robo, goals, and interactive objects."
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

      {isNumberLineLayout(config) ? (
        <NumberLineDesigner config={config} onChange={onChange} />
      ) : (
        <GridDesigner config={config} onChange={onChange} />
      )}
    </motion.div>
  );
}
