"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { Blocks, MousePointerClick, Hash } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { isCanvasLayout } from "@/lib/level-config";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";
import { VisualProgramBuilder } from "../visual-program-builder";
import { CanvasLessonEditor } from "@/components/teacher/level-designer/canvas-lesson-editor";

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function StepProgramSetup({ levelType, config, onChange }: Props) {
  const showBlanks = levelType === LevelType.CHOOSE_BUTTONS;
  const isEditableDrag = levelType === LevelType.DRAG_EDIT_PROGRAM;

  if (levelType === LevelType.DRAG_ACTIONS && isCanvasLayout(config)) {
    const stripMode = config.canvasLesson?.stripMode ?? "EMPTY";
    const acceptedCount = config.assessment?.correctPrograms?.length ?? 0;
    const isCountMode = stripMode === "COUNT_ANSWER";

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ItemBuilderStepFrame
          icon={Blocks}
          title="Design the canvas item"
          subtitle="Board and strip on the left · live preview on the right · then set accepted answers."
          accent="teal"
        />

        <CanvasLessonEditor config={config} onChange={onChange} />

        {stripMode === "SEED_PROGRAM" && (
          <ItemBuilderPanel
            title="Starter program"
            description="Pre-loaded into the yellow strip. Students can edit before RUN."
          >
            <VisualProgramBuilder
              config={config}
              onChange={onChange}
              showBlanks={false}
              storage="guided"
            />
          </ItemBuilderPanel>
        )}

        {!isCountMode && (
          <ItemBuilderPanel
            title="Accepted programs"
            description="Every correct strip answer — Repeat nesting and the same expanded arrows both count."
          >
            <div className="mb-3 flex justify-end">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {acceptedCount} accepted
              </span>
            </div>
            <VisualProgramBuilder
              config={config}
              onChange={onChange}
              showBlanks={false}
              storage="correctProgram"
            />
          </ItemBuilderPanel>
        )}

        {isCountMode && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <Hash className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="font-medium text-slate-900">Count answer scoring</p>
              <p className="mt-0.5 text-slate-600">
                Correct count is set above ({config.canvasLesson?.correctCount ?? 0}). No accepted-program
                list is needed — students submit with the +/− counter.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

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
              Optional: enable the Repeat palette button under Rules if you want loops on the grid.
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
