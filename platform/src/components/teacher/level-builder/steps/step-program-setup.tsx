"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { Blocks, MousePointerClick, CheckCircle2 } from "lucide-react";
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

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <ItemBuilderStepFrame
          icon={Blocks}
          title="Design the canvas item"
          subtitle="Board content on the left · live student preview on the right · then set every accepted answer."
          accent="violet"
        />

        <CanvasLessonEditor config={config} onChange={onChange} />

        {stripMode === "SEED_PROGRAM" && (
          <section className="space-y-3 overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-1 shadow-sm">
            <div className="px-4 pt-4 sm:px-5">
              <ItemBuilderStepFrame
                icon={Blocks}
                title="Starter program (seeded strip)"
                subtitle="Pre-loaded into the yellow strip. Students can edit these blocks before RUN."
                accent="teal"
              />
            </div>
            <div className="px-3 pb-4 sm:px-4">
              <VisualProgramBuilder
                config={config}
                onChange={onChange}
                showBlanks={false}
                storage="guided"
              />
            </div>
          </section>
        )}

        <section className="space-y-3 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-1 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
            <ItemBuilderStepFrame
              icon={CheckCircle2}
              title="Accepted programs"
              subtitle="Add every correct answer — Repeat nesting and the same expanded arrows can both be accepted."
              accent="violet"
            />
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {acceptedCount} accepted
            </span>
          </div>
          <div className="px-3 pb-4 sm:px-4">
            <VisualProgramBuilder
              config={config}
              onChange={onChange}
              showBlanks={false}
              storage="correctProgram"
            />
          </div>
        </section>
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
