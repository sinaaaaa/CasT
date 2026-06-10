"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { INTRO_ACTIONS } from "@/lib/level-editor-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HintImageUpload } from "./hint-image-upload";
import { HintAudioUpload } from "./hint-audio-upload";
import { DesignerSection } from "./designer-section";
import { IntroStepFieldsEditor } from "./intro-step-fields-editor";
import { ListOrdered, Plus } from "lucide-react";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
  /** When true, intro is always on (Level 0 editor). */
  forLevelZero?: boolean;
};

export function IntroStepsEditor({ config, onChange, forLevelZero }: Props) {
  const intro = config.actionBlockIntro ?? {
    enabled: true,
    introId: "level_0_action_blocks",
    showOnlyOnce: true,
    allowSkip: true,
    completeMessage: "Great job! You're ready for Item 1.",
    steps: [],
  };

  const steps = intro.steps ?? [];

  function patchIntro(partial: Partial<NonNullable<LevelGameplayConfig["actionBlockIntro"]>>) {
    onChange({
      ...config,
      actionBlockIntro: {
        ...intro,
        enabled: true,
        showOnlyOnce: intro.showOnlyOnce ?? true,
        allowSkip: intro.allowSkip ?? true,
        ...partial,
      },
    });
  }

  function updateStep(index: number, partial: (typeof steps)[number]) {
    const next = [...steps];
    next[index] = { ...next[index], ...partial };
    patchIntro({ steps: next });
  }

  function patchStepHint(
    index: number,
    partial: Partial<NonNullable<(typeof steps)[number]["stepHint"]>>
  ) {
    const step = steps[index];
    updateStep(index, {
      ...step,
      stepHint: { enabled: true, title: step.stepHint?.title ?? "", body: step.stepHint?.body ?? "", ...step.stepHint, ...partial },
    });
  }

  function addStep() {
    patchIntro({
      steps: [
        ...steps,
        {
          action: "forward",
          dragInstruction: "Drag this block to the yellow strip.",
          runInstruction: "Now tap Run!",
          runningInstruction: "Watch Robo go!",
          stepHint: { enabled: true, title: "Forward", body: "Moves one step ahead." },
          tutorial: {
            showDragAnimation: true,
            dragRepeatCount: 2,
            showRunTapAnimation: true,
            runTapRepeatCount: 2,
          },
        },
      ],
    });
  }

  return (
    <DesignerSection
      icon={ListOrdered}
      title="Teach each action block"
      description="Students see one button at a time. Each step can have its own tip text and picture in the top-right."
    >
      {!forLevelZero && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={intro.enabled}
            onChange={(e) => patchIntro({ enabled: e.target.checked })}
          />
          Enable introduction on this level
        </label>
      )}

      {(forLevelZero || intro.enabled) && (
        <div className="space-y-6">
          {!forLevelZero && (
            <label className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={intro.showOnlyOnce !== false}
                onChange={(e) => patchIntro({ showOnlyOnce: e.target.checked })}
              />
              <span>Each student sees this only once</span>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Message when finished</span>
            <Input
              value={intro.completeMessage ?? ""}
              onChange={(e) => patchIntro({ completeMessage: e.target.value })}
              placeholder="Great! Now solve Item 1."
              className="h-11"
            />
          </label>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <article
                key={i}
                className="rounded-xl border-2 border-violet-100 bg-gradient-to-b from-white to-violet-50/30 p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                    Step {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => patchIntro({ steps: steps.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Which block?</span>
                    <select
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      value={step.action}
                      onChange={(e) =>
                        updateStep(i, {
                          ...step,
                          action: e.target.value as (typeof step)["action"],
                        })
                      }
                    >
                      {INTRO_ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm lg:col-span-2">
                    <span className="font-medium text-slate-700">Say while they drag</span>
                    <Input
                      className="mt-1.5 h-11"
                      value={step.dragInstruction ?? ""}
                      onChange={(e) => updateStep(i, { ...step, dragInstruction: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Tip title (top-right)</span>
                    <Input
                      className="mt-1.5 h-11"
                      value={step.stepHint?.title ?? ""}
                      onChange={(e) => patchStepHint(i, { title: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Tip message</span>
                    <textarea
                      className="mt-1.5 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={step.stepHint?.body ?? ""}
                      onChange={(e) => patchStepHint(i, { body: e.target.value })}
                    />
                  </label>
                  <div className="lg:col-span-2 space-y-4">
                    <HintImageUpload
                      label="Tip picture (optional)"
                      imageUrl={step.stepHint?.imageUrl}
                      onChange={(url) => patchStepHint(i, { imageUrl: url })}
                    />
                    <HintAudioUpload
                      label="Tip audio (optional)"
                      audioUrl={step.stepHint?.audioUrl}
                      playAutomatically={step.stepHint?.playAudioAutomatically !== false}
                      onChange={(url) => patchStepHint(i, { audioUrl: url })}
                      onPlayAutomaticallyChange={(v) =>
                        patchStepHint(i, { playAudioAutomatically: v })
                      }
                    />
                  </div>
                </div>

                <IntroStepFieldsEditor
                  levelConfig={config}
                  step={step}
                  stepIndex={i}
                  onChange={(nextStep) => updateStep(i, nextStep)}
                />
              </article>
            ))}
          </div>

          <Button type="button" variant="outline" className="gap-2" onClick={addStep}>
            <Plus className="h-4 w-4" />
            Add another step
          </Button>
        </div>
      )}
    </DesignerSection>
  );
}
