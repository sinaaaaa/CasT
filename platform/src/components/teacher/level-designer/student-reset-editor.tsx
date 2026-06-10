"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { RotateCcw } from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function StudentResetEditor({ config, onChange }: Props) {
  const enabled = config.showStudentResetButton ?? true;

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <input
        type="checkbox"
        className="mt-1"
        checked={enabled}
        onChange={(e) => onChange({ ...config, showStudentResetButton: e.target.checked })}
      />
      <span>
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <RotateCcw className="h-4 w-4 text-slate-600" />
          Student Reset button
        </span>
        <span className="mt-1 block text-sm text-slate-600">
          When on, the Reset button in Unity is shown. Students can clear their program and move the
          robot back to the start without spending an attempt.
        </span>
      </span>
    </label>
  );
}
