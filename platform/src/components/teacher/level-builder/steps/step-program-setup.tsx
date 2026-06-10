"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { Blocks, MousePointerClick } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";
import { VisualProgramBuilder } from "../visual-program-builder";

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function StepProgramSetup({ levelType, config, onChange }: Props) {
  const showBlanks = levelType === LevelType.CHOOSE_BUTTONS;
  const isEditableDrag = levelType === LevelType.DRAG_EDIT_PROGRAM;

  if (levelType === LevelType.DRAG_ACTIONS) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <ItemBuilderPanel
          title="Students build their own program"
          description="For drag-and-drop challenges, students choose and order action blocks themselves. You can skip ahead to rules — no starter program needed."
        >
          <div className="flex flex-col items-center py-10 text-center">
            <MousePointerClick className="mb-4 h-12 w-12 text-indigo-300" />
            <p className="max-w-md text-sm text-slate-600">
              Focus your design energy on the board layout and gameplay rules in the next steps.
            </p>
          </div>
        </ItemBuilderPanel>
      </motion.div>
    );
  }

  if (
    levelType !== LevelType.FLAG_PLACEMENT &&
    levelType !== LevelType.CHOOSE_BUTTONS &&
    levelType !== LevelType.DRAG_EDIT_PROGRAM
  ) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-6"
    >
      <ItemBuilderStepFrame
        icon={Blocks}
        title={isEditableDrag ? "Design the starter program" : "Shape the student program"}
        subtitle={
          isEditableDrag
            ? "Students see these blocks and can drag more in, delete, or reorder before RUN."
            : "Build the command sequence students will see. Drag to reorder or tap to add blocks."
        }
        accent="violet"
      />

      <VisualProgramBuilder config={config} onChange={onChange} showBlanks={showBlanks} />
    </motion.div>
  );
}
