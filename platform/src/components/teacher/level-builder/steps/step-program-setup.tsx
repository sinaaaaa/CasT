"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { Blocks, CheckCircle2 } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { isCanvasLayout } from "@/lib/level-config";
import { getCanvasStripType } from "@/lib/canvas-strip-types";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";
import { VisualProgramBuilder } from "../visual-program-builder";
import { CanvasLessonEditor } from "@/components/teacher/level-designer/canvas-lesson-editor";
import { CommandBagsEditor } from "@/components/teacher/level-designer/command-bags-editor";
import { GeometryPathToolsEditor } from "@/components/teacher/level-designer/geometry-path-tools-editor";

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function StepProgramSetup({ levelType, config, onChange }: Props) {
  const showBlanks = levelType === LevelType.CHOOSE_BUTTONS;
  const isEditableDrag = levelType === LevelType.DRAG_EDIT_PROGRAM;

  if (levelType === LevelType.DRAG_ACTIONS && isCanvasLayout(config)) {
    const strip = getCanvasStripType(config.canvasLesson?.stripMode);
    const acceptedCount = config.assessment?.correctPrograms?.length ?? 0;

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ItemBuilderStepFrame
          icon={Blocks}
          title="Canvas item"
          subtitle={strip.studentJob}
          accent="violet"
        />

        <CanvasLessonEditor config={config} onChange={onChange} />

        {strip.value === "SEED_PROGRAM" && (
          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Starter program</h3>
            <VisualProgramBuilder
              config={config}
              onChange={onChange}
              showBlanks={false}
              storage="guided"
            />
          </section>
        )}

        {strip.usesAcceptedPrograms && (
          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Accepted answers
              </h3>
              <span className="text-xs text-slate-500">{acceptedCount}</span>
            </div>
            <VisualProgramBuilder
              config={config}
              onChange={onChange}
              showBlanks={false}
              storage="correctProgram"
            />
          </section>
        )}
      </motion.div>
    );
  }

  if (levelType === LevelType.DRAG_ACTIONS) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ItemBuilderStepFrame
          icon={Blocks}
          title="Student program tools"
          subtitle="Optional Command Bags and Chunks for the blue palette. Leave empty for classic arrows only."
          accent="violet"
        />
        <ItemBuilderPanel
          title="Command Bags & Chunks"
          description="First choose Bags or Chunks, then add only that type."
        >
          <CommandBagsEditor config={config} onChange={onChange} />
        </ItemBuilderPanel>
        <p className="text-center text-xs text-slate-500">
          Leave empty to use classic arrow buttons from Rules instead.
        </p>
      </motion.div>
    );
  }

  if (levelType === LevelType.GEOMETRY_PATH) {
    const tools = config.geometryPath?.tools;
    const showBags = tools?.commandBags || tools?.actionChunks;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ItemBuilderStepFrame
          icon={Blocks}
          title="Student programming tools"
          subtitle="Choose how students build programs to trace the geometry — then author Chunks or Bags if needed."
          accent="violet"
        />
        <ItemBuilderPanel
          title="Available tools"
          description="Students only see what you turn on. Presets speed up common setups."
        >
          <GeometryPathToolsEditor config={config} onChange={onChange} />
        </ItemBuilderPanel>
        {showBags ? (
          <ItemBuilderPanel
            title="Command Bags & Chunks"
            description="Build reusable pieces students use to trace the shape. Same system as Drag Action items."
          >
            <CommandBagsEditor config={config} onChange={onChange} />
          </ItemBuilderPanel>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            Turn on <span className="font-semibold">Action Chunks</span> or{" "}
            <span className="font-semibold">Command Bags</span> above to author them here.
          </p>
        )}
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
        title={isEditableDrag ? "Starter program" : "Student program"}
        subtitle={
          isEditableDrag
            ? "Students can edit these blocks before RUN."
            : "Build the command sequence students will see."
        }
        accent="violet"
      />

      <VisualProgramBuilder config={config} onChange={onChange} showBlanks={showBlanks} />
    </motion.div>
  );
}
