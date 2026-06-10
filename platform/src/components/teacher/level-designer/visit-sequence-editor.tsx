"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { isNumberLineLayout } from "@/lib/level-config";
import { Route } from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function VisitSequenceEditor({ config, onChange }: Props) {
  const enabled = config.visitObjectSequence ?? false;
  const boardTab = isNumberLineLayout(config) ? "Number line" : "Grid";

  return (
    <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(e) =>
            onChange({
              ...config,
              visitObjectSequence: e.target.checked,
              goalCell: e.target.checked ? undefined : config.goalCell,
              blinkStartCells: e.target.checked ? true : config.blinkStartCells,
              blinkEndCells: e.target.checked ? true : config.blinkEndCells,
            })
          }
        />
        <span>
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Route className="h-4 w-4 text-teal-700" />
            Visit two objects in order
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            Students build one program with drag-and-drop blocks. The robot must visit the first object
            (e.g. banana), then the second (e.g. bin). Both cells blink; each object disappears when the
            robot reaches it.
          </span>
        </span>
      </label>
      {enabled && (
        <p className="text-sm text-teal-900">
          On the <strong>{boardTab}</strong> tab, select each object and mark <strong>Visit step 1</strong>{" "}
          (first visit) and <strong>Visit step 2</strong> (second visit / goal). The goal tick tool is
          hidden — step 2 is the win target.
        </p>
      )}
    </div>
  );
}
