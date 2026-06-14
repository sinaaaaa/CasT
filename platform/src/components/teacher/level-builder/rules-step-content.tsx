"use client";

import { useMemo, useState } from "react";
import { LevelType } from "@prisma/client";
import {
  Eye,
  Flag,
  Gamepad2,
  Hand,
  History,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import {
  ALL_ROBOT_ACTION_BUTTONS,
  DEFAULT_ENABLED_ACTION_BUTTONS,
  isNumberLineLayout,
  resolveEnabledActionButtons,
  type LevelGameplayConfig,
  type RobotActionButton,
} from "@/lib/level-config";
import { FACING_OPTIONS, NUMBER_LINE_FACING_OPTIONS } from "@/lib/level-editor-constants";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionButtonChips,
  AttemptPicker,
  FacingPicker,
  RuleSection,
  RulesCategoryNav,
  RulesSummaryBar,
  RuleToggleCard,
} from "./rules-ui";

type RulesCategory = "gameplay" | "tools" | "visual" | "win";

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function RulesStepContent({ levelType, config, onChange }: Props) {
  const hasWinRules =
    levelType === LevelType.DRAG_ACTIONS || levelType === LevelType.FLAG_PLACEMENT;

  const categories = useMemo(() => {
    const base: { id: RulesCategory; label: string; icon: typeof Gamepad2 }[] = [
      { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
      { id: "tools", label: "Student tools", icon: Hand },
      { id: "visual", label: "Visual cues", icon: Eye },
    ];
    if (hasWinRules) {
      base.push({ id: "win", label: "Win condition", icon: Target });
    }
    return base;
  }, [hasWinRules]);

  const [category, setCategory] = useState<RulesCategory>("gameplay");

  const facing = config.robotStartFacing ?? { x: 0, y: 1 };
  const onNumberLine = isNumberLineLayout(config);
  const facingOptions = onNumberLine ? NUMBER_LINE_FACING_OPTIONS : FACING_OPTIONS;
  const enabledActions = new Set(resolveEnabledActionButtons(config));

  const blinkStart =
    (config.showCellBlinkHighlights ?? true) && (config.blinkStartCells ?? true);
  const blinkEnd = (config.showCellBlinkHighlights ?? true) && (config.blinkEndCells ?? true);

  const summaryItems = useMemo(
    () => [
      { label: `${config.maxAttempts ?? 3} attempts` },
      {
        label: config.runRobotOnSubmit ?? true ? "Animated RUN" : "Answer-only RUN",
        tone: config.runRobotOnSubmit ?? true ? ("success" as const) : ("muted" as const),
      },
      {
        label: config.allowRobotDrag ?? true ? "Free Robo placement" : "Fixed start position",
      },
      {
        label: config.showStudentResetButton ?? true ? "Reset enabled" : "Reset hidden",
        tone: config.showStudentResetButton ?? true ? ("success" as const) : ("muted" as const),
      },
      ...(config.showCommandHistory
        ? [{ label: "Command history on", tone: "success" as const }]
        : []),
      ...(config.visitObjectSequence ? [{ label: "Visit sequence", tone: "success" as const }] : []),
    ],
    [config]
  );

  function patch(partial: Partial<LevelGameplayConfig>) {
    onChange({ ...config, ...partial });
  }

  function toggleAction(action: RobotActionButton, checked: boolean) {
    const next = new Set(enabledActions);
    if (checked) next.add(action);
    else next.delete(action);
    if (next.size === 0) return;
    const list = ALL_ROBOT_ACTION_BUTTONS.filter((a) => next.has(a));
    patch({ enabledActionButtons: list });
  }

  return (
    <div className="space-y-6">
      <RulesSummaryBar items={summaryItems} />

      <RulesCategoryNav categories={categories} active={category} onChange={setCategory} />

      {category === "gameplay" && (
        <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <AttemptPicker
            value={config.maxAttempts ?? 3}
            onChange={(v) => patch({ maxAttempts: v })}
          />

          <div className="h-px bg-slate-100" />

          <FacingPicker
            value={facing}
            onChange={(v) => patch({ robotStartFacing: v })}
            options={facingOptions}
          />

          <div className="h-px bg-slate-100" />

          <ActionButtonChips
            enabled={enabledActions}
            onToggle={toggleAction}
            onEnableAll={() =>
              patch({
                enabledActionButtons: [...DEFAULT_ENABLED_ACTION_BUTTONS],
                ...(onNumberLine && config.numberLine
                  ? { numberLine: { ...config.numberLine, forwardBackwardOnly: false } }
                  : {}),
              })
            }
            showNumberLinePreset={onNumberLine}
            onForwardBackwardOnly={
              onNumberLine
                ? () =>
                    patch({
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
                : undefined
            }
          />

          <div className="h-px bg-slate-100" />

          <RuleSection
            icon={Target}
            title="Attempt feedback (popups)"
            description="Text shown in Unity after a wrong answer, success, or when attempts run out. Leave a field empty for no popup text in the game."
          >
            <div className="grid gap-4 lg:grid-cols-1">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Wrong attempt message</span>
                <Textarea
                  rows={2}
                  placeholder="Leave empty for no text in the game"
                  value={config.attemptFailureMessage ?? ""}
                  onChange={(e) =>
                    patch({ attemptFailureMessage: e.target.value || undefined })
                  }
                />
                <span className="text-xs text-slate-500">
                  Placeholders: {"{attempt}"}, {"{maxAttempts}"}, {"{reason}"}
                </span>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Success message</span>
                <Textarea
                  rows={2}
                  placeholder="Leave empty for no text in the game"
                  value={config.attemptSuccessMessage ?? ""}
                  onChange={(e) =>
                    patch({ attemptSuccessMessage: e.target.value || undefined })
                  }
                />
                <span className="text-xs text-slate-500">Placeholders: {"{levelName}"}</span>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Max attempts message</span>
                <Textarea
                  rows={2}
                  placeholder="Leave empty for no text in the game"
                  value={config.maxAttemptsMessage ?? ""}
                  onChange={(e) =>
                    patch({ maxAttemptsMessage: e.target.value || undefined })
                  }
                />
                <span className="text-xs text-slate-500">
                  Placeholders: {"{levelName}"}, {"{maxAttempts}"}
                </span>
              </label>
            </div>
          </RuleSection>

          <div className="h-px bg-slate-100" />

          <div className="grid gap-4 lg:grid-cols-2">
            <RuleToggleCard
              icon={Play}
              title="Animate Robo on RUN"
              description="Show movement when students press RUN. Turn off for answer-only items that check without animating."
              checked={config.runRobotOnSubmit ?? true}
              onChange={(v) => patch({ runRobotOnSubmit: v })}
              accent="indigo"
            />
            <RuleToggleCard
              icon={Hand}
              title="Drag Robo before RUN"
              description="Let students reposition Robo on the grid before running their program."
              checked={config.allowRobotDrag ?? true}
              onChange={(v) => patch({ allowRobotDrag: v })}
              accent="teal"
            />
          </div>
        </div>
      )}

      {category === "tools" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RuleToggleCard
            icon={RotateCcw}
            title="Student Reset button"
            description="Shows Reset in-game so students can clear their program and return Robo to start without using an attempt."
            checked={config.showStudentResetButton ?? true}
            onChange={(v) => patch({ showStudentResetButton: v })}
            accent="violet"
          />
          <RuleToggleCard
            icon={History}
            title="Command history strip"
            description="After RUN, display a small timeline of moves so students can compare their plan to what ran."
            checked={config.showCommandHistory ?? false}
            onChange={(v) =>
              patch({
                showCommandHistory: v,
                commandHistoryScale: config.commandHistoryScale ?? 1,
              })
            }
            accent="indigo"
          >
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">History size in game</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={config.commandHistoryScale ?? 0.45}
                  onChange={(e) => patch({ commandHistoryScale: Number(e.target.value) })}
                  className="h-2 flex-1 accent-[#4F46E5]"
                />
                <span className="w-12 text-right text-sm tabular-nums text-slate-500">
                  {Math.round((config.commandHistoryScale ?? 0.45) * 100)}%
                </span>
              </div>
            </label>
          </RuleToggleCard>
        </div>
      )}

      {category === "visual" && (
        <div className="space-y-4">
          <RuleSection
            icon={Sparkles}
            title="Cell highlights"
            description="Blinking squares draw attention to start and goal cells during play."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <RuleToggleCard
                icon={Eye}
                title="Blink start cells"
                description="Highlights Robo's start cell and any object marked as a start on the board."
                checked={blinkStart}
                onChange={(on) => {
                  patch({
                    blinkStartCells: on,
                    showCellBlinkHighlights: on || blinkEnd,
                  });
                }}
                accent="amber"
              />
              <RuleToggleCard
                icon={Target}
                title="Blink goal cells"
                description="Highlights end objects, goal cells, or the flag after the student places it."
                checked={blinkEnd}
                onChange={(on) => {
                  patch({
                    blinkEndCells: on,
                    showCellBlinkHighlights: blinkStart || on,
                  });
                }}
                accent="amber"
              />
            </div>
          </RuleSection>
        </div>
      )}

      {category === "win" && levelType === LevelType.DRAG_ACTIONS && (
        <div className="space-y-4">
          <RuleToggleCard
            icon={Route}
            title="Visit two objects in order"
            description="Students build one program. Robo must reach the first object (e.g. banana), then the second (e.g. bin). Each disappears when touched."
            checked={config.visitObjectSequence ?? false}
            onChange={(on) =>
              patch({
                visitObjectSequence: on,
                goalCell: on ? undefined : config.goalCell,
                blinkStartCells: on ? true : config.blinkStartCells,
                blinkEndCells: on ? true : config.blinkEndCells,
              })
            }
            accent="teal"
          >
            <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
              On the <strong>{onNumberLine ? "Number line" : "Grid"}</strong> step, mark objects as{" "}
              <strong>Visit step 1</strong> and <strong>Visit step 2</strong>. Step 2 becomes the win
              target — the goal tick tool is hidden.
            </div>
          </RuleToggleCard>
        </div>
      )}

      {category === "win" && levelType === LevelType.FLAG_PLACEMENT && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RuleToggleCard
            icon={Flag}
            title="Tap to place flag"
            description="Students tap any cell (including on objects) to set the goal before or during their program."
            checked={config.playerPicksEndCellWithFlag ?? true}
            onChange={(v) => patch({ playerPicksEndCellWithFlag: v })}
            accent="rose"
          />
          <RuleToggleCard
            icon={Play}
            title="Require flag before RUN"
            description="RUN stays disabled until the student has placed the flag on the board."
            checked={config.requireFlagBeforeRun ?? true}
            onChange={(v) => patch({ requireFlagBeforeRun: v })}
            accent="rose"
          />
        </div>
      )}
    </div>
  );
}
