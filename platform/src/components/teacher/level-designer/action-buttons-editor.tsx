"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import {
  ALL_ROBOT_ACTION_BUTTONS,
  DEFAULT_ENABLED_ACTION_BUTTONS,
  isNumberLineLayout,
  resolveEnabledActionButtons,
  type RobotActionButton,
} from "@/lib/level-config";

const LABELS: Record<RobotActionButton, string> = {
  forward: "Forward",
  backward: "Backward",
  "turn left": "Turn left",
  "turn right": "Turn right",
};

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function ActionButtonsEditor({ config, onChange }: Props) {
  const enabled = new Set(resolveEnabledActionButtons(config));
  const onNumberLine = isNumberLineLayout(config);
  const nlForwardBackOnly = config.numberLine?.forwardBackwardOnly !== false;

  function setEnabled(next: Set<RobotActionButton>) {
    const list = ALL_ROBOT_ACTION_BUTTONS.filter((a) => next.has(a));
    if (list.length === 0) return;
    onChange({
      ...config,
      enabledActionButtons: list,
    });
  }

  function toggle(action: RobotActionButton, checked: boolean) {
    const next = new Set(enabled);
    if (checked) next.add(action);
    else next.delete(action);
    if (next.size === 0) return;
    setEnabled(next);
  }

  function enableAll() {
    onChange({
      ...config,
      enabledActionButtons: [...DEFAULT_ENABLED_ACTION_BUTTONS],
      ...(onNumberLine && config.numberLine
        ? { numberLine: { ...config.numberLine, forwardBackwardOnly: false } }
        : {}),
    });
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-dashed p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-medium">Student action buttons</legend>
      <p className="text-xs text-muted-foreground">
        Unchecked buttons are hidden in the game. Best-route analysis and assessment only use
        enabled commands (e.g. if Backward is off, shortest paths never include backward).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ALL_ROBOT_ACTION_BUTTONS.map((action) => (
          <label key={action} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled.has(action)}
              onChange={(e) => toggle(action, e.target.checked)}
            />
            {LABELS[action]}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs text-sky-700 underline-offset-2 hover:underline"
          onClick={enableAll}
        >
          Enable all four
        </button>
        {onNumberLine && (
          <button
            type="button"
            className="text-xs text-sky-700 underline-offset-2 hover:underline"
            onClick={() =>
              onChange({
                ...config,
                enabledActionButtons: ["forward", "backward"],
                numberLine: {
                  ...(config.numberLine ?? {
                    tickCount: 9,
                    lineRow: 2,
                    showTickLabels: true,
                    showArrows: true,
                    forwardBackwardOnly: true,
                  }),
                  forwardBackwardOnly: true,
                },
              })
            }
          >
            Forward / backward only (number line)
          </button>
        )}
      </div>
      {onNumberLine && nlForwardBackOnly && (
        <p className="text-xs text-amber-800">
          Number line &quot;Forward / backward only&quot; is on — turn buttons stay hidden unless
          you enable them above and turn that option off in Board settings.
        </p>
      )}
    </fieldset>
  );
}
