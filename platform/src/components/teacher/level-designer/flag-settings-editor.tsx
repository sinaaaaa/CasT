"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function FlagSettingsEditor({ config, onChange }: Props) {
  function patch(partial: Partial<LevelGameplayConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Flag (goal) rules</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.playerPicksEndCellWithFlag ?? true}
          onChange={(e) => patch({ playerPicksEndCellWithFlag: e.target.checked })}
        />
        Student taps any empty cell to place the flag (goal)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.requireFlagBeforeRun ?? true}
          onChange={(e) => patch({ requireFlagBeforeRun: e.target.checked })}
        />
        Must place flag before RUN is allowed
      </label>
    </div>
  );
}
