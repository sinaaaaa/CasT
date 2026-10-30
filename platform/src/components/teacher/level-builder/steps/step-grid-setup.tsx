"use client";

import { motion } from "framer-motion";
import { Grid3x3, SquareDashed } from "lucide-react";
import { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";
import { NumberLineDesigner } from "@/components/teacher/level-designer/number-line-designer";
import { CopyLevelLayout } from "@/components/teacher/level-designer/copy-level-layout";
import { GeometryPathEditor } from "@/components/teacher/level-designer/geometry-path-editor";
import { isCanvasLayout, isNumberLineLayout } from "@/lib/level-config";
import { getCanvasStripType } from "@/lib/canvas-strip-types";
import { resolveItemActivity } from "@/lib/item-activity";
import { ItemBuilderPanel, ItemBuilderStepFrame } from "../item-builder-step-frame";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
  currentLevelId?: string;
  levelType?: LevelType;
};

export function StepGridSetup({ config, onChange, currentLevelId, levelType }: Props) {
  const strip = getCanvasStripType(config.canvasLesson?.stripMode);
  const isGeometry = levelType === LevelType.GEOMETRY_PATH;
  const activity = levelType ? resolveItemActivity(levelType, config) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-6"
    >
      <ItemBuilderStepFrame
        icon={Grid3x3}
        title={
          isGeometry
            ? activity?.id === "predict-draw"
              ? "Draw the shape students will predict"
              : "Design the glowing shape"
            : isCanvasLayout(config)
              ? "This item has no robot grid"
              : isNumberLineLayout(config)
                ? "Tune the number line"
                : "Design the board"
        }
        subtitle={
          isGeometry
            ? activity?.id === "predict-draw"
              ? "Draw or pick a shape. Command arrows generate under it. Students never see this shape — they predict it from the program."
              : "Draw the path students must trace with a program."
            : isCanvasLayout(config)
              ? "Pattern items live on the canvas. Continue to set the yellow strip."
              : isNumberLineLayout(config)
                ? "Set the ticks, start position, and target. Students only move forward and back."
                : "Place Robo, goals, and objects. Keep the puzzle readable at a glance."
        }
        accent="teal"
      />

      {currentLevelId && !isCanvasLayout(config) && (
        <CopyLevelLayout
          currentLevelId={currentLevelId}
          currentConfig={config}
          onApply={onChange}
        />
      )}

      {isGeometry ? (
        <>
          <GeometryPathEditor config={config} onChange={onChange} lockStudentTask />
          <details className="group rounded-2xl border border-slate-200/80 bg-white open:shadow-sm">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Advanced board objects
                <span className="text-xs font-normal text-slate-500 group-open:hidden">
                  Optional · newspapers, goals, obstacles
                </span>
              </span>
            </summary>
            <div className="border-t border-slate-100 px-4 pb-4 pt-2 sm:px-5">
              <p className="mb-3 text-xs text-slate-500">
                Robot start and facing are set on the path canvas above. Use this only if you also need
                grid objects.
              </p>
              <GridDesigner config={config} onChange={onChange} />
            </div>
          </details>
        </>
      ) : isCanvasLayout(config) ? (
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-stone-200 bg-gradient-to-br from-[#FFF8E8] via-white to-[#F5F2EB] p-6 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-white shadow-sm">
            <SquareDashed className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">Pattern board</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {strip.studentJob} There is nothing to place on a grid — the next step is the yellow strip.
            </p>
          </div>
        </div>
      ) : isNumberLineLayout(config) ? (
        <NumberLineDesigner config={config} onChange={onChange} />
      ) : (
        <ItemBuilderPanel title="Board" description="Place Robo, goals, and objects.">
          <GridDesigner config={config} onChange={onChange} />
        </ItemBuilderPanel>
      )}
    </motion.div>
  );
}
