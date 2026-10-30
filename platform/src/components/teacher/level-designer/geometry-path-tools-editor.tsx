"use client";

import { Briefcase, Puzzle } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  DEFAULT_GEOMETRY_PATH,
  GEOMETRY_TOOL_PRESETS,
  syncGeometryPathToolsToConfig,
  type GeometryPathTools,
  type GeometryToolPresetId,
} from "@/lib/geometry-path";
import { ArrowGlyphRow, CommandGlyph } from "@/components/assessment/command-glyph";
import { cn } from "@/lib/utils";

type Props = {
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

const TOOL_ROWS: {
  key: keyof GeometryPathTools;
  title: string;
  hint: string;
  preview: "arrows" | "repeat" | "chunk" | "bag";
}[] = [
  {
    key: "individualCommands",
    title: "Arrow commands",
    hint: "Forward, back, and turns — the same arrows as in reports.",
    preview: "arrows",
  },
  {
    key: "repeat",
    title: "Repeat",
    hint: "Loop a sequence to draw patterns and perimeters.",
    preview: "repeat",
  },
  {
    key: "actionChunks",
    title: "Chunks",
    hint: "Reusable groups of arrows students drop in as one block.",
    preview: "chunk",
  },
  {
    key: "commandBags",
    title: "Bags",
    hint: "A collection of chunks students pick from.",
    preview: "bag",
  },
];

function ToolPreview({ kind, on }: { kind: (typeof TOOL_ROWS)[number]["preview"]; on: boolean }) {
  const dim = on ? "" : "opacity-50 grayscale-[0.35]";
  if (kind === "arrows") return <ArrowGlyphRow size={20} className={dim} />;
  if (kind === "repeat") {
    return (
      <span className={cn("inline-flex items-center gap-1", dim)}>
        <CommandGlyph token="repeat-btn" size={32} framed={false} />
      </span>
    );
  }
  if (kind === "chunk") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-1.5 py-1 ring-1",
          on ? "bg-[#9E66EB]/12 ring-[#9E66EB]/35" : "bg-stone-100 ring-stone-200",
          dim
        )}
      >
        <Puzzle className={cn("h-3.5 w-3.5", on ? "text-[#9E66EB]" : "text-stone-400")} />
        <CommandGlyph token="forward" size={16} framed={false} />
        <CommandGlyph token="turn right" size={16} framed={false} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-1.5 py-1 ring-1",
        on ? "bg-[#F7F4EE] ring-stone-300" : "bg-stone-100 ring-stone-200",
        dim
      )}
    >
      <Briefcase className={cn("h-3.5 w-3.5", on ? "text-stone-700" : "text-stone-400")} />
      <CommandGlyph token="forward" size={16} framed={false} />
      <CommandGlyph token="turn left" size={16} framed={false} />
    </span>
  );
}

function PresetPreview({ id }: { id: GeometryToolPresetId }) {
  if (id === "beginner") return <ArrowGlyphRow size={14} />;
  if (id === "patterns") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <CommandGlyph token="forward" size={14} />
        <CommandGlyph token="repeat-btn" size={18} framed={false} />
      </span>
    );
  }
  if (id === "chunks") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <CommandGlyph token="forward" size={14} framed={false} />
        <CommandGlyph token="turn right" size={14} framed={false} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <Briefcase className="h-3.5 w-3.5 text-stone-600" />
      <CommandGlyph token="forward" size={14} framed={false} />
    </span>
  );
}

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

  const noneOn =
    !tools.individualCommands && !tools.repeat && !tools.actionChunks && !tools.commandBags;

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 overflow-hidden rounded-2xl border border-stone-200 bg-[#F7F4EE] p-1 sm:grid-cols-4"
        role="radiogroup"
        aria-label="Palette presets"
      >
        {(Object.keys(GEOMETRY_TOOL_PRESETS) as GeometryToolPresetId[]).map((id) => {
          const p = GEOMETRY_TOOL_PRESETS[id];
          const selected = activePreset === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => applyPreset(id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition",
                selected
                  ? "bg-navy text-white shadow-sm"
                  : "text-stone-600 hover:bg-white/80 hover:text-stone-900"
              )}
            >
              <PresetPreview id={id} />
              <span className="text-[11px] font-bold leading-tight">{p.label}</span>
              <span className={cn("text-[10px] leading-tight", selected ? "text-white/70" : "text-stone-400")}>
                {p.description}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {TOOL_ROWS.map((row) => {
          const on = !!tools[row.key];
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => toggle(row.key)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3.5 text-left transition",
                  on ? "bg-[#FFF8E8]" : "hover:bg-stone-50"
                )}
              >
                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition",
                    on ? "bg-[#0F9B8E]" : "bg-stone-200"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left]",
                      on ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-stone-900">{row.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{row.hint}</span>
                </span>
                <ToolPreview kind={row.preview} on={on} />
              </button>
            </li>
          );
        })}
      </ul>

      {noneOn && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Turn on at least one tool so students can build a program.
        </p>
      )}
    </div>
  );
}
