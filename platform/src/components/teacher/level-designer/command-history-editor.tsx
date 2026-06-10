"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { History } from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function CommandHistoryEditor({ config, onChange }: Props) {
  const enabled = config.showCommandHistory ?? false;
  const scale = config.commandHistoryScale ?? 0.45;

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(e) =>
            onChange({
              ...config,
              showCommandHistory: e.target.checked,
              commandHistoryScale: config.commandHistoryScale ?? 1,
            })
          }
        />
        <span>
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <History className="h-4 w-4 text-indigo-700" />
            Show command history
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            After RUN, a small strip shows each move (forward, back, turns). Good for levels where students
            compare their plan to what actually ran.
          </span>
        </span>
      </label>
      {enabled && (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">History size in game (Unity)</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={scale}
              onChange={(e) =>
                onChange({ ...config, commandHistoryScale: Number(e.target.value) })
              }
              className="h-2 flex-1 accent-indigo-600"
            />
            <span className="w-12 text-right tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Icon size and spacing are set on CharacterMove in Unity. This slider slightly scales the whole strip (1 =
            normal).
          </span>
        </label>
      )}
    </div>
  );
}
