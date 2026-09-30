"use client";

import { FilePlus2, Wrench } from "lucide-react";
import {
  formatCommandBagToken,
  formatCommandChunkToken,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { DEFAULT_GEOMETRY_PATH, geometryStarterPalette } from "@/lib/geometry-path";
import { VisualProgramBuilder } from "@/components/teacher/level-builder/visual-program-builder";
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
  const seeded = !!config.geometryPath?.seedStarterProgram;
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
                  ? "border-violet-400 bg-violet-50/70 ring-2 ring-violet-100"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"
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

      {seeded && (
        <>
          <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
            Students see these blocks in the yellow box when the item loads. They can reorder, remove, or add
            blocks before RUN. Try Again and Reset bring the starter back. The blocks you can add follow the
            student tools you turned on.
          </p>
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
