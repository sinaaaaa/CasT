"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { isGeometryDrawPath } from "@/lib/geometry-path";
import { Blocks, CheckCircle2 } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { isCanvasLayout } from "@/lib/level-config";
import { getCanvasStripType } from "@/lib/canvas-strip-types";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";
import { VisualProgramBuilder } from "../visual-program-builder";
import { CanvasLessonEditor } from "@/components/teacher/level-designer/canvas-lesson-editor";
import { CommandBagsEditor } from "@/components/teacher/level-designer/command-bags-editor";
import { GeometryPathToolsEditor } from "@/components/teacher/level-designer/geometry-path-tools-editor";
import { GeometryStarterProgramEditor } from "@/components/teacher/level-designer/geometry-starter-program-editor";

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
          accent="amber"
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
          title="The yellow strip is empty — that’s the point"
          subtitle="Students drag arrows from the palette and press RUN. You can skip this step unless the lesson needs Bags or Chunks."
          accent="amber"
        />
        <div className="rounded-2xl border border-[#E8C547]/50 bg-[#FFF8E8] px-5 py-4 text-sm leading-relaxed text-stone-800">
          <p className="font-bold">You’re ready for a classic coding item.</p>
          <p className="mt-1 text-stone-600">
            Continue to play rules, or open advanced tools below if students should reuse a Chunk or draw from a Bag.
          </p>
        </div>
        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            Advanced · Command Bags & Chunks
            <span className="text-xs font-normal text-slate-500 group-open:hidden">Optional</span>
          </summary>
          <div className="border-t border-slate-100 px-5 pb-5 pt-3">
            <p className="mb-4 text-sm text-slate-600">
              First choose Bags or Chunks, then add only that type. Leave empty to keep the classic arrow palette.
            </p>
            <CommandBagsEditor config={config} onChange={onChange} />
          </div>
        </details>
      </motion.div>
    );
  }

  if (levelType === LevelType.GEOMETRY_PATH) {
    const tools = config.geometryPath?.tools;
    const showBags = tools?.commandBags || tools?.actionChunks;
    const drawPath = isGeometryDrawPath(config.geometryPath);
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ItemBuilderStepFrame
          icon={Blocks}
          title={drawPath ? "Program students will see" : "Student programming tools"}
          subtitle={
            drawPath
              ? "These are the same command arrows as in the game and in assessment reports. Fold them into Repeat or a Chunk if the lesson needs it."
              : "Turn on the blocks students may use. Arrows match the assessment report artwork."
          }
          accent="amber"
        />
        <ItemBuilderPanel
          title="Student palette"
          description="Pick a preset, or toggle tools. What is on here is what appears in the game."
        >
          <GeometryPathToolsEditor config={config} onChange={onChange} />
        </ItemBuilderPanel>
        {showBags && (
          <ItemBuilderPanel
            title="Build Chunks & Bags"
            description="Author the reusable pieces students will drop into the strip."
          >
            <CommandBagsEditor config={config} onChange={onChange} />
          </ItemBuilderPanel>
        )}
        <ItemBuilderPanel
          title={drawPath ? "Shown program" : "Starting program"}
          description={
            drawPath
              ? "Students cannot edit this in-game. Fold it into Repeat, wrap it as a Chunk, or rearrange the arrows."
              : "Start students with a blank program, or seed a starter they edit to trace the shape."
          }
          className="border-[#E8C547]/40"
        >
          <GeometryStarterProgramEditor config={config} onChange={onChange} />
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
        title={
          isEditableDrag
            ? "Starter program students will fix"
            : levelType === LevelType.FLAG_PLACEMENT
              ? "Program students will watch"
              : showBlanks
                ? "Sequence with blank slots"
                : "Student program"
        }
        subtitle={
          isEditableDrag
            ? "Put the buggy or incomplete program in the strip. Students edit it, then RUN."
            : levelType === LevelType.FLAG_PLACEMENT
              ? "They do not write this — they watch it and place the flag where Robo finishes."
              : showBlanks
                ? "Build the sequence and mark the blanks students must fill."
                : "Build the command sequence students will see."
        }
        accent="amber"
      />

      {isEditableDrag && (
        <ItemBuilderPanel
          title="Command Bags & Chunks (optional)"
          description="Define Bags or Chunks for the yellow strip, then add them to the starter program below. Leave empty for arrows and Repeat."
        >
          <CommandBagsEditor config={config} onChange={onChange} />
        </ItemBuilderPanel>
      )}

      <VisualProgramBuilder config={config} onChange={onChange} showBlanks={showBlanks} />
    </motion.div>
  );
}
