"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { FACING_OPTIONS } from "@/lib/level-editor-constants";
import { Input } from "@/components/ui/input";
import { ActionButtonsEditor } from "./action-buttons-editor";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function RobotSettingsEditor({ config, onChange }: Props) {
  const facing = config.robotStartFacing ?? { x: 0, y: 1 };

  function setFacing(x: number, y: number) {
    onChange({ ...config, robotStartFacing: { x, y } });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4">
      <label className="space-y-1 text-sm">
        <span className="font-medium">Max attempts</span>
        <Input
          type="number"
          min={1}
          max={20}
          value={config.maxAttempts ?? 3}
          onChange={(e) => onChange({ ...config, maxAttempts: Number(e.target.value) })}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Robo facing at start</span>
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          value={`${facing.x},${facing.y}`}
          onChange={(e) => {
            const opt = FACING_OPTIONS.find((f) => `${f.value.x},${f.value.y}` === e.target.value);
            if (opt) setFacing(opt.value.x, opt.value.y);
          }}
        >
          {FACING_OPTIONS.map((f) => (
            <option key={f.label} value={`${f.value.x},${f.value.y}`}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Drag <strong>Robo start</strong> onto the grid, or use Cell settings — empty cells are allowed.
        </span>
      </label>
      <ActionButtonsEditor config={config} onChange={onChange} />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={config.runRobotOnSubmit ?? true}
          onChange={(e) => onChange({ ...config, runRobotOnSubmit: e.target.checked })}
        />
        Run Robo when student presses RUN (show movement animation)
      </label>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Turn off for answer-only items: students still build a program, choose blanks, or place the flag,
        but RUN checks the answer without animating Robo. Works for all item types.
      </p>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={config.allowRobotDrag ?? true}
          onChange={(e) => onChange({ ...config, allowRobotDrag: e.target.checked })}
        />
        Allow dragging Robo on the grid before RUN
      </label>
      <fieldset className="space-y-2 rounded-md border border-dashed p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium">Cell blink highlights</legend>
        <p className="text-xs text-muted-foreground">
          Blinking squares on marked start / end cells in the game. Turn on one without the other.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={
              (config.showCellBlinkHighlights ?? true) && (config.blinkStartCells ?? true)
            }
            onChange={(e) => {
              const blinkEnd = config.blinkEndCells ?? true;
              const on = e.target.checked;
              onChange({
                ...config,
                blinkStartCells: on,
                showCellBlinkHighlights: on || blinkEnd,
              });
            }}
          />
          Blink <strong>start</strong> (Robo start cell + any object marked as start in Grid step)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={
              (config.showCellBlinkHighlights ?? true) && (config.blinkEndCells ?? true)
            }
            onChange={(e) => {
              const blinkStart = config.blinkStartCells ?? true;
              const on = e.target.checked;
              onChange({
                ...config,
                blinkEndCells: on,
                showCellBlinkHighlights: blinkStart || on,
              });
            }}
          />
          Blink <strong>end / goal</strong> (end objects, goal cell, or flag cell after student places it)
        </label>
      </fieldset>
    </div>
  );
}
