"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";
import { NumberLineDesigner } from "@/components/teacher/level-designer/number-line-designer";
import { LayoutModePicker } from "@/components/teacher/level-designer/layout-mode-picker";
import { CopyLevelLayout } from "@/components/teacher/level-designer/copy-level-layout";
import { isCanvasLayout, isNumberLineLayout } from "@/lib/level-config";
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
        subtitle="Choose a 6×6 grid, number line, or canvas (strip-only pattern task)."
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
        <div className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold text-violet-950">Canvas playfield</p>
                <p className="mt-1 text-sm text-violet-800/80">
                  No grid — students build in the yellow strip while the white board shows your
                  lesson. Fine-tune content in the Program step.
                </p>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-violet-100">
                  <dt className="text-violet-600">Strip</dt>
                  <dd className="font-semibold text-violet-950">
                    {(config.canvasLesson?.stripMode ?? "EMPTY").replace(/_/g, " ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-violet-100">
                  <dt className="text-violet-600">Accepted answers</dt>
                  <dd className="font-semibold text-violet-950">
                    {config.assessment?.correctPrograms?.length ?? 0}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-violet-100">
                  <dt className="text-violet-600">Pattern tiles</dt>
                  <dd className="font-semibold text-violet-950">
                    {config.canvasLesson?.patternPreview?.length ?? 0}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="border-t border-violet-100 bg-slate-100/60 p-4 lg:border-l lg:border-t-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <p className="line-clamp-3 text-sm font-medium text-slate-800">
                  {config.canvasLesson?.prompt?.trim() || "Prompt appears on the white board"}
                </p>
                <div className="mt-3 flex min-h-[2.75rem] flex-wrap justify-center gap-1.5 rounded-lg bg-amber-200/80 px-2 py-2">
                  {(config.canvasLesson?.stripMode ?? "EMPTY") === "BLANKS"
                    ? Array.from({ length: config.canvasLesson?.blankSlotCount ?? 4 }).map((_, i) => (
                        <span
                          key={i}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-dashed border-amber-500 bg-amber-50 text-xs font-bold text-amber-700"
                        >
                          _
                        </span>
                      ))
                    : (
                        <span className="self-center text-[11px] font-medium text-amber-900/70">
                          Yellow strip
                        </span>
                      )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : isNumberLineLayout(config) ? (
        <NumberLineDesigner config={config} onChange={onChange} />
      ) : (
        <GridDesigner config={config} onChange={onChange} />
      )}
    </motion.div>
  );
}
