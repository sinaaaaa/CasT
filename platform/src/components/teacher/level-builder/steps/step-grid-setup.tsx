"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";
import { NumberLineDesigner } from "@/components/teacher/level-designer/number-line-designer";
import { LayoutModePicker } from "@/components/teacher/level-designer/layout-mode-picker";
import { CopyLevelLayout } from "@/components/teacher/level-designer/copy-level-layout";
import { GeometryPathEditor } from "@/components/teacher/level-designer/geometry-path-editor";
import { isCanvasLayout, isNumberLineLayout } from "@/lib/level-config";
import { getCanvasStripType } from "@/lib/canvas-strip-types";
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-6"
    >
      <ItemBuilderStepFrame
        icon={Grid3x3}
        title={isGeometry ? "Design the geometry path" : "Design the board"}
        subtitle={
          isGeometry
            ? "Shape → start & direction → assessment → behavior. The grid is the hero."
            : "Grid, number line, or canvas."
        }
        accent="teal"
      />

      {currentLevelId && (
        <CopyLevelLayout
          currentLevelId={currentLevelId}
          currentConfig={config}
          onApply={onChange}
        />
      )}

      {!isGeometry && <LayoutModePicker config={config} onChange={onChange} />}

      {isGeometry ? (
        <>
          <GeometryPathEditor config={config} onChange={onChange} />
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
        <ItemBuilderPanel title="Board" description="Place Robo, goals, and objects.">
          <GridDesigner config={config} onChange={onChange} />
        </ItemBuilderPanel>
      )}
    </motion.div>
  );
}
