"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "./grid-designer";
import { Input } from "@/components/ui/input";
import { Bot, Clapperboard } from "lucide-react";

type IntroStep = NonNullable<LevelGameplayConfig["actionBlockIntro"]>["steps"][number];

type Props = {
  levelConfig: LevelGameplayConfig;
  step: IntroStep;
  stepIndex: number;
  onChange: (step: IntroStep) => void;
};

export function IntroStepFieldsEditor({ levelConfig, step, stepIndex, onChange }: Props) {
  const playfield = step.playfield ?? { useCustomPlayfield: false };
  const tutorial = step.tutorial ?? {
    showDragAnimation: true,
    dragRepeatCount: 2,
    showRunTapAnimation: true,
    runTapRepeatCount: 2,
  };

  const levelRobot = levelConfig.robotStartPosition ?? { x: 1, y: 0 };
  const levelFacing = levelConfig.robotStartFacing ?? { x: 0, y: 1 };

  function patchPlayfield(partial: Partial<NonNullable<IntroStep["playfield"]>>) {
    onChange({
      ...step,
      playfield: {
        useCustomPlayfield: playfield.useCustomPlayfield ?? false,
        robotStartPosition: playfield.robotStartPosition,
        robotStartFacing: playfield.robotStartFacing,
        gridObjects: playfield.gridObjects,
        ...partial,
      },
    });
  }

  function patchTutorial(partial: Partial<NonNullable<IntroStep["tutorial"]>>) {
    onChange({
      ...step,
      tutorial: { ...tutorial, ...partial },
    });
  }

  const gridConfigForStep: LevelGameplayConfig = playfield.useCustomPlayfield
    ? {
        ...levelConfig,
        robotStartPosition: playfield.robotStartPosition ?? levelRobot,
        robotStartFacing: playfield.robotStartFacing ?? levelFacing,
        gridObjects: playfield.gridObjects ?? [],
      }
    : levelConfig;

  return (
    <div className="mt-4 space-y-5 border-t border-violet-100 pt-4">
      <section className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-sky-700" />
          <h4 className="text-sm font-semibold text-slate-900">Step animation (Unity)</h4>
        </div>
        <p className="mb-3 text-xs text-slate-600">
          Before students try Step {stepIndex + 1}, the game shows a ghost drag and Play tap (like the
          opening demo).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={tutorial.showDragAnimation !== false}
              onChange={(e) => patchTutorial({ showDragAnimation: e.target.checked })}
            />
            Show drag demo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={tutorial.showRunTapAnimation !== false}
              onChange={(e) => patchTutorial({ showRunTapAnimation: e.target.checked })}
            />
            Show Play tap demo
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Drag repeats</span>
            <Input
              type="number"
              min={1}
              max={4}
              className="mt-1 h-10"
              value={tutorial.dragRepeatCount ?? 2}
              onChange={(e) =>
                patchTutorial({
                  dragRepeatCount: Math.min(4, Math.max(1, Number(e.target.value) || 2)),
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Play tap repeats</span>
            <Input
              type="number"
              min={1}
              max={4}
              className="mt-1 h-10"
              value={tutorial.runTapRepeatCount ?? 2}
              onChange={(e) =>
                patchTutorial({
                  runTapRepeatCount: Math.min(4, Math.max(1, Number(e.target.value) || 2)),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-700" />
          <h4 className="text-sm font-semibold text-slate-900">Robot & grid for this step</h4>
        </div>
        <label className="mb-3 flex items-start gap-3 rounded-lg border border-white/80 bg-white/70 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={playfield.useCustomPlayfield === true}
            onChange={(e) => {
              if (e.target.checked) {
                patchPlayfield({
                  useCustomPlayfield: true,
                  robotStartPosition: playfield.robotStartPosition ?? levelRobot,
                  robotStartFacing: playfield.robotStartFacing ?? levelFacing,
                  gridObjects: playfield.gridObjects ?? levelConfig.gridObjects ?? [],
                });
              } else {
                patchPlayfield({ useCustomPlayfield: false });
              }
            }}
          />
          <span>
            <span className="font-medium">Custom position for this step</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              When off, uses the introduction grid from the &quot;Robot &amp; grid&quot; wizard step.
            </span>
          </span>
        </label>

        {playfield.useCustomPlayfield ? (
          <GridDesigner
            config={gridConfigForStep}
            onChange={(c) =>
              patchPlayfield({
                useCustomPlayfield: true,
                robotStartPosition: c.robotStartPosition,
                robotStartFacing: c.robotStartFacing,
                gridObjects: c.gridObjects,
              })
            }
          />
        ) : (
          <p className="text-xs text-slate-600">
            Robot starts at ({levelRobot.x}, {levelRobot.y}) with level default props — change on the
            &quot;Robot &amp; grid&quot; step for all non-custom steps.
          </p>
        )}
      </section>
    </div>
  );
}
