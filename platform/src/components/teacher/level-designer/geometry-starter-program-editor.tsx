"use client";

import { FilePlus2, Puzzle, Repeat2, RotateCcw, Wrench } from "lucide-react";
import {
  formatCommandBagToken,
  formatCommandChunkToken,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { DEFAULT_GEOMETRY_PATH, geometryStarterPalette, isGeometryDrawPath } from "@/lib/geometry-path";
import {
  withGeometryRepeatProgram,
  withGeometryShapeProgram,
  wrapGeometryProgramAsChunk,
} from "@/lib/geometry-program-path";
import { VisualProgramBuilder } from "@/components/teacher/level-builder/visual-program-builder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

const MODES = [
  {
    seeded: false,
    title: "Blank program",
    description: "Students build the whole program from scratch.",
    Icon: FilePlus2,
  },
  {
    seeded: true,
    title: "Starter program",
    description: "Students get a program in the yellow box to fix or finish, like Edit Starter items.",
    Icon: Wrench,
  },
] as const;

function defaultStarter(config: LevelGameplayConfig): string[] {
  const palette = geometryStarterPalette(config.geometryPath?.tools);
  if (palette.arrows) return ["forward", "forward", "turn left"];
  const bags = config.commandBags ?? [];
  if (palette.bags && bags[0]) return [formatCommandBagToken(bags[0].id)];
  const chunk = bags.flatMap((b) => b.chunks ?? [])[0];
  if (palette.chunks && chunk) return [formatCommandChunkToken(chunk.id)];
  return [];
}

export function GeometryStarterProgramEditor({ config, onChange }: Props) {
  const drawPath = isGeometryDrawPath(config.geometryPath);
  const seeded = drawPath || !!config.geometryPath?.seedStarterProgram;
  const palette = geometryStarterPalette(config.geometryPath?.tools);

  function setSeeded(next: boolean) {
    if (next === seeded) return;
    const existing = (config.guidedActions ?? []).filter((t) => t !== "blank");
    onChange({
      ...config,
      geometryPath: { ...DEFAULT_GEOMETRY_PATH, ...config.geometryPath, seedStarterProgram: next },
      guidedActions: next ? (existing.length ? existing : defaultStarter(config)) : undefined,
    });
  }

  return (
    <div className="space-y-5">
      {!drawPath && (
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map(({ seeded: value, title, description, Icon }) => {
          const on = seeded === value;
          return (
            <button
              key={title}
              type="button"
              onClick={() => setSeeded(value)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                on
                  ? "border-navy bg-[#FFF8E8] ring-2 ring-[#E8C547]/50"
                  : "border-stone-200 bg-white hover:border-stone-300"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  on ? "bg-navy text-white" : "bg-stone-100 text-stone-500"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="text-sm font-bold text-slate-900">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
              </span>
            </button>
          );
        })}
      </div>
      )}

      {seeded && (
        <>
          <p className="rounded-xl border border-stone-200 bg-[#F7F4EE] px-3 py-2 text-xs leading-relaxed text-stone-700">
            {drawPath
              ? "Students see this program in the yellow strip and cannot edit it. They draw the path it will take on the grid, then press RUN to watch the robot follow it. Change the arrows into Repeat or a Chunk here — the drawn shape stays the same."
              : "Students see these blocks in the yellow box when the item loads. They can reorder, remove, or add blocks before RUN. Try Again and Reset bring the starter back. The blocks you can add follow the student tools you turned on."}
          </p>
          {drawPath && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => onChange(withGeometryShapeProgram(config))}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Rebuild from shape
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => onChange(withGeometryRepeatProgram(config))}
              >
                <Repeat2 className="h-3.5 w-3.5" />
                Fold into Repeat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => onChange(wrapGeometryProgramAsChunk(config))}
              >
                <Puzzle className="h-3.5 w-3.5" />
                Make a Chunk
              </Button>
            </div>
          )}
          <VisualProgramBuilder
            config={config}
            onChange={onChange}
            showBlanks={false}
            storage="guided"
            palette={palette}
          />
        </>
      )}
    </div>
  );
}
