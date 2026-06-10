"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  applyLevelTypeDefaults,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { WizardHeader, type AutosaveStatus } from "@/components/teacher/level-builder/wizard-header";
import { WizardStepper } from "@/components/teacher/level-builder/wizard-stepper";
import { INTRO_WIZARD_STEPS, isIntroWizardStepId, type IntroWizardStepId } from "./intro-wizard-types";
import { CornerHintEditor } from "@/components/teacher/level-designer/corner-hint-editor";
import { IntroStepsEditor } from "@/components/teacher/level-designer/intro-steps-editor";
import { StepIntroPublish } from "./steps/step-intro-publish";
import { StepIntroPlayfield } from "./steps/step-intro-playfield";

type IntroRecord = {
  id: string;
  levelKey: string;
  name: string;
  published: boolean;
  config: LevelGameplayConfig;
};

type Props = {
  initial: IntroRecord;
};

function formatValidationError(details: unknown): string {
  if (!details || typeof details !== "object") return "Please check your entries and try again.";
  const d = details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  const parts: string[] = [];
  if (d.formErrors?.length) parts.push(...d.formErrors);
  if (d.fieldErrors) {
    for (const [field, msgs] of Object.entries(d.fieldErrors)) {
      if (msgs?.length) parts.push(`${field}: ${msgs.join(", ")}`);
    }
  }
  return parts.length > 0 ? parts.join("\n") : "Please check your entries and try again.";
}

export function IntroductionBuilderWizard({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stepFromUrl = searchParams.get("step");
  const [currentStep, setCurrentStep] = useState<IntroWizardStepId>(
    isIntroWizardStepId(stepFromUrl) ? stepFromUrl : "info"
  );
  const [completedSteps, setCompletedSteps] = useState<Set<IntroWizardStepId>>(new Set());

  const [name, setName] = useState(initial.name);
  const [published, setPublished] = useState(initial.published);
  const [config, setConfig] = useState<LevelGameplayConfig>(initial.config);

  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intro = config.actionBlockIntro ?? { enabled: true, steps: [], allowSkip: true, showOnlyOnce: true };
  const stepIndex = INTRO_WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    const t = searchParams.get("step");
    if (isIntroWizardStepId(t)) setCurrentStep(t);
  }, [searchParams]);

  function goToStep(step: IntroWizardStepId) {
    setCurrentStep(step);
    const url = new URL(window.location.href);
    url.searchParams.set("step", step);
    window.history.replaceState({}, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markDirty() {
    dirtyRef.current = true;
    setSaveMessage(null);
  }

  function patchIntro(partial: Partial<NonNullable<LevelGameplayConfig["actionBlockIntro"]>>) {
    setConfig((c) => {
      const prev = c.actionBlockIntro ?? {
        enabled: true,
        steps: [],
        showOnlyOnce: true,
        allowSkip: true,
      };
      return {
        ...c,
        actionBlockIntro: {
          ...prev,
          enabled: true,
          showOnlyOnce: prev.showOnlyOnce ?? true,
          allowSkip: prev.allowSkip ?? true,
          ...partial,
        },
      };
    });
    markDirty();
  }

  const buildPayload = useCallback(() => {
    const finalConfig = applyLevelTypeDefaults(LevelType.INTRO, {
      ...config,
      levelName: name.trim() || config.levelName || "Block introduction",
    });
    return {
      name: name.trim(),
      published,
      levelType: LevelType.INTRO,
      config: finalConfig,
    };
  }, [config, name, published]);

  const saveIntro = useCallback(
    async (silent = false) => {
      if (!silent) {
        setError(null);
        setSaveMessage(null);
        setSaving(true);
      } else {
        setAutosaveStatus("saving");
      }

      try {
        const res = await fetch(`/api/teacher/levels/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();

        if (!res.ok) {
          const msg = data.details
            ? formatValidationError(data.details)
            : (data.error ?? "Could not save. Please try again.");
          if (silent) setAutosaveStatus("error");
          else setError(msg);
          if (!silent) setSaving(false);
          return false;
        }

        dirtyRef.current = false;
        if (silent) {
          setAutosaveStatus("saved");
          setTimeout(() => setAutosaveStatus("idle"), 2500);
        } else {
          setSaveMessage("Introduction saved.");
          setSaving(false);
        }
        router.refresh();
        return true;
      } catch {
        if (silent) setAutosaveStatus("error");
        else {
          setError("Network error. Check your connection and try again.");
          setSaving(false);
        }
        return false;
      }
    },
    [buildPayload, initial.id, router]
  );

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void saveIntro(true), 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveIntro, name, published, config]);

  function handleNext() {
    if (currentStep === "info" && !name.trim()) {
      setError("Please enter a display name.");
      return;
    }
    setError(null);
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    const next = INTRO_WIZARD_STEPS[stepIndex + 1];
    if (next) goToStep(next.id);
  }

  function handleBack() {
    setError(null);
    const prev = INTRO_WIZARD_STEPS[stepIndex - 1];
    if (prev) goToStep(prev.id);
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    await saveIntro(false);
  }

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case "info":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50/50 p-4">
              <p className="text-sm font-semibold text-slate-900">Item 0 — Block introduction</p>
              <p className="mt-1 text-sm text-slate-600">
                Students see this once before Item 1. They learn Forward, Backward, and turns with your
                guided steps.
              </p>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Basic settings</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Display name</span>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                    className="h-11"
                    required
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={published}
                    onChange={(e) => {
                      setPublished(e.target.checked);
                      markDirty();
                    }}
                  />
                  <span>
                    <span className="font-medium">Published</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Students must see a published introduction before Item 1
                    </span>
                  </span>
                </label>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Student options</h3>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={intro.allowSkip !== false}
                    onChange={(e) => patchIntro({ allowSkip: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Show Skip button</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Lets students skip the tutorial and go straight to Item 1
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={intro.showOnlyOnce !== false}
                    onChange={(e) => patchIntro({ showOnlyOnce: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Show only once per student</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      After finishing or skipping, they won&apos;t see it again
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={config.runRobotOnSubmit !== false}
                    onChange={(e) => {
                      setConfig({ ...config, runRobotOnSubmit: e.target.checked });
                      markDirty();
                    }}
                  />
                  <span>
                    <span className="font-medium">Run Robo when student presses RUN</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Off = check each teaching step without animating Robo on screen
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={config.cornerHint?.enabled !== false}
                    onChange={(e) => {
                      const prev = config.cornerHint ?? {
                        enabled: true,
                        title: "Welcome!",
                        body: "Let's learn how to use the action blocks.",
                      };
                      setConfig({
                        ...config,
                        cornerHint: { ...prev, enabled: e.target.checked },
                      });
                      markDirty();
                    }}
                  />
                  <span>
                    <span className="font-medium">Show welcome message</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Top-right welcome panel before step 1. Off = start directly at step 1 in Unity.
                    </span>
                  </span>
                </label>
              </div>
            </section>
          </div>
        );
      case "playfield":
        return (
          <StepIntroPlayfield
            config={config}
            onChange={(c) => {
              setConfig(c);
              markDirty();
            }}
          />
        );
      case "welcome":
        return (
          <div className="space-y-4">
            {config.cornerHint?.enabled === false && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Welcome is turned off (see <strong>Info → Show welcome message</strong>). Unity starts at step 1 with no welcome panel.
              </p>
            )}
            <CornerHintEditor
              config={config}
              onChange={(c) => {
                setConfig(c);
                markDirty();
              }}
              label="Welcome message (optional — before step 1)"
              hideEnabledToggle
            />
          </div>
        );
      case "steps":
        return (
          <IntroStepsEditor
            config={config}
            onChange={(c) => {
              setConfig(c);
              markDirty();
            }}
            forLevelZero
          />
        );
      case "publish":
        return (
          <StepIntroPublish
            name={name}
            published={published}
            config={config}
            setPublished={(v) => {
              setPublished(v);
              markDirty();
            }}
          />
        );
      default:
        return null;
    }
  }, [config, currentStep, intro.allowSkip, intro.showOnlyOnce, name, published]);

  return (
    <form onSubmit={handleSave} className="pb-24">
      <WizardHeader
        levelName={name}
        stepIndex={stepIndex}
        totalSteps={INTRO_WIZARD_STEPS.length}
        autosaveStatus={autosaveStatus}
        isNew={false}
      />

      <div className="mx-auto mt-6 max-w-5xl space-y-8">
        <div className="flex items-center gap-2">
          <Badge className="bg-violet-600">Introduction</Badge>
          <span className="text-sm text-slate-500">Runs before Item 1 in the game</span>
        </div>

        <WizardStepper
          steps={INTRO_WIZARD_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />

        <AnimatePresence mode="wait">
          <motion.div key={currentStep}>{stepContent}</motion.div>
        </AnimatePresence>

        {saveMessage && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {saveMessage}
          </p>
        )}
        {error && (
          <p className="whitespace-pre-wrap rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md md:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={handleBack} disabled={stepIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
            {stepIndex < INTRO_WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} className="gap-1">
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {published ? "Save & publish" : "Save introduction"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
