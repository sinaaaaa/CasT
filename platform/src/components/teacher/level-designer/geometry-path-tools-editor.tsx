"use client";

import {
  ArrowUp,
  Blocks,
  Package,
  Repeat2,
  Sparkles,
} from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  GEOMETRY_TOOL_PRESETS,
  syncGeometryPathToolsToConfig,
  type GeometryPathTools,
  type GeometryToolPresetId,
} from "@/lib/geometry-path";
import { DEFAULT_GEOMETRY_PATH } from "@/lib/geometry-path";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

const TOOL_CARDS: {
  key: keyof GeometryPathTools;
  title: string;
  description: string;
  Icon: typeof ArrowUp;
}[] = [
  {
    key: "individualCommands",
    title: "Individual Commands",
    description: "Build one movement at a time (forward, turn, …).",
    Icon: ArrowUp,
  },
  {
    key: "repeat",
    title: "Repeat / Loop",
    description: "Repeat a sequence to form patterns and perimeters.",
    Icon: Repeat2,
  },
  {
    key: "actionChunks",
    title: "Action Chunks",
    description: "Reusable groups of instructions students can drop in.",
    Icon: Blocks,
  },
  {
    key: "commandBags",
    title: "Command Bags",
    description: "Teacher-provided collections of chunks and commands.",
    Icon: Package,
  },
];

function patchTools(config: LevelGameplayConfig, tools: GeometryPathTools): LevelGameplayConfig {
  const gp = {
    ...DEFAULT_GEOMETRY_PATH,
    ...config.geometryPath,
    enabled: true,
    tools,
  };
  const synced = syncGeometryPathToolsToConfig(tools);
  const next: LevelGameplayConfig = {
    ...config,
    geometryPath: gp,
    enabledActionButtons: synced.enabledActionButtons,
    commandBagMode: synced.commandBagMode,
  };
  // When Chunks/Bags are off, clear mode so Unity never treats this as a bag level.
  // Keep authored bag data so turning tools back on restores them.
  if (!tools.actionChunks && !tools.commandBags) {
    next.commandBagMode = undefined;
  }
  return next;
}

export function GeometryPathToolsEditor({ config, onChange }: Props) {
  const tools: GeometryPathTools = {
    individualCommands: true,
    repeat: false,
    actionChunks: false,
    commandBags: false,
    ...config.geometryPath?.tools,
  };

  function toggle(key: keyof GeometryPathTools) {
    onChange(patchTools(config, { ...tools, [key]: !tools[key] }));
  }

  function applyPreset(id: GeometryToolPresetId) {
    onChange(patchTools(config, { ...GEOMETRY_TOOL_PRESETS[id].tools }));
  }

  const activePreset = (Object.keys(GEOMETRY_TOOL_PRESETS) as GeometryToolPresetId[]).find((id) => {
    const p = GEOMETRY_TOOL_PRESETS[id].tools;
    return (
      p.individualCommands === tools.individualCommands &&
      p.repeat === tools.repeat &&
      p.actionChunks === tools.actionChunks &&
      p.commandBags === tools.commandBags
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h4 className="text-sm font-bold text-slate-900">Quick presets</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GEOMETRY_TOOL_PRESETS) as GeometryToolPresetId[]).map((id) => {
            const p = GEOMETRY_TOOL_PRESETS[id];
            const selected = activePreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  selected
                    ? "border-violet-500 bg-violet-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                )}
              >
                {p.label}
                <span className={cn("ml-1 font-normal", selected ? "text-violet-100" : "text-slate-400")}>
                  · {p.description}
                </span>
              </button>
            );
          })}
          {!activePreset && (
            <span className="rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-500">
              Custom
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOL_CARDS.map(({ key, title, description, Icon }) => {
          const on = !!tools[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
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
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{title}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {on ? "On" : "Off"}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!tools.individualCommands && !tools.repeat && !tools.actionChunks && !tools.commandBags && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Select at least one student tool so learners can build a program.
        </p>
      )}
    </div>
  );
}
