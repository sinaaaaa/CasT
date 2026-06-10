"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  applyLevelTypeDefaults,
  defaultConfigForType,
  defaultNewLevelKey,
  formatLevelSaveValidationError,
  syncNumberLineGridPositions,
  validateLevelIdentity,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import type { AutosaveStatus } from "./wizard-header";
import { ItemBuilderTopbar } from "./item-builder-topbar";
import { ItemBuilderStepRail } from "./item-builder-step-rail";
import { ItemBuilderMobileSteps } from "./item-builder-mobile-steps";
import { ItemBuilderContextPanel } from "./item-builder-context-panel";
import { WIZARD_STEPS, isWizardStepId, type WizardStepId } from "./wizard-types";
import { StepLevelInfo } from "./steps/step-level-info";
import { StepGridSetup } from "./steps/step-grid-setup";
import { StepProgramSetup } from "./steps/step-program-setup";
import { StepRules } from "./steps/step-rules";
import { StepPreviewPublish } from "./steps/step-preview-publish";

type LevelRecord = {
  id?: string;
  levelKey: string;
  name: string;
  description?: string | null;
  orderIndex: number;
  difficulty: number;
  levelType: LevelType;
  published: boolean;
  config: LevelGameplayConfig;
};

type Props = {
  initial?: LevelRecord;
};

export function LevelBuilderWizard({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = Boolean(initial?.id);
  const [levelId, setLevelId] = useState<string | undefined>(initial?.id);

  useEffect(() => {
    if (initial?.id) setLevelId(initial.id);
  }, [initial?.id]);

  const stepFromUrl = searchParams.get("step");
  const initialStep: WizardStepId = isWizardStepId(stepFromUrl) ? stepFromUrl : "info";

  const [currentStep, setCurrentStep] = useState<WizardStepId>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStepId>>(new Set());

  const [levelKey, setLevelKey] = useState(initial?.levelKey ?? defaultNewLevelKey());
  const [name, setName] = useState(initial?.name ?? "Untitled item");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [orderIndex, setOrderIndex] = useState(initial?.orderIndex ?? 0);
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 1);
  const [levelType, setLevelType] = useState<LevelType>(initial?.levelType ?? LevelType.DRAG_ACTIONS);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [config, setConfig] = useState<LevelGameplayConfig>(
    () => initial?.config ?? defaultConfigForType(LevelType.DRAG_ACTIONS, "New Item")
  );

  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
  const progress = Math.round(((stepIndex + 1) / WIZARD_STEPS.length) * 100);
  const currentStepMeta = WIZARD_STEPS[stepIndex];

  useEffect(() => {
    const t = searchParams.get("step");
    if (t === "assessment" || t === "ct") setCurrentStep("preview");
    else if (isWizardStepId(t)) setCurrentStep(t);
  }, [searchParams]);

  async function goToStep(step: WizardStepId) {
    setCurrentStep(step);
    const url = new URL(window.location.href);
    url.searchParams.set("step", step);
    window.history.replaceState({}, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyType(type: LevelType) {
    if (type === levelType) return;
    setLevelType(type);
    setConfig((prev) => applyLevelTypeDefaults(type, prev));
    setSaveMessage(null);
    dirtyRef.current = true;
  }

  function markDirty() {
    dirtyRef.current = true;
    setSaveMessage(null);
  }

  const buildPayload = useCallback(() => {
    const withDefaults = applyLevelTypeDefaults(levelType, {
      ...config,
      levelName: name.trim() || config.levelName,
    });
    const finalConfig = syncNumberLineGridPositions(withDefaults);
    return {
      levelKey: levelKey.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      orderIndex: Number(orderIndex),
      difficulty: Number(difficulty),
      levelType,
      published,
      config: finalConfig,
    };
  }, [config, description, difficulty, levelKey, levelType, name, orderIndex, published]);

  const saveLevel = useCallback(
    async (silent = false): Promise<string | false> => {
      const identityError = validateLevelIdentity(name, levelKey);
      if (identityError) {
        if (silent) return false;
        setError(identityError);
        setSaving(false);
        if (currentStep !== "info") void goToStep("info");
        return false;
      }

      if (!silent) {
        setError(null);
        setSaveMessage(null);
        setSaving(true);
      } else {
        setAutosaveStatus("saving");
      }

      try {
        const url = levelId ? `/api/teacher/levels/${levelId}` : "/api/teacher/levels";
        const method = levelId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();

        if (!res.ok) {
          if (silent) {
            setAutosaveStatus("error");
          } else {
            const fieldMessage = formatLevelSaveValidationError(data.details);
            setError(fieldMessage ?? data.error ?? "Save failed");
            setSaving(false);
            if (fieldMessage && currentStep !== "info") void goToStep("info");
          }
          return false;
        }

        dirtyRef.current = false;
        const savedId = (data.level?.id as string | undefined) ?? levelId;

        if (savedId && savedId !== levelId) {
          setLevelId(savedId);
          router.replace(`/teacher/levels/${savedId}/edit?step=${currentStep}`);
        }

        if (levelId || savedId) {
          if (silent) {
            setAutosaveStatus("saved");
            setTimeout(() => setAutosaveStatus("idle"), 2500);
          } else {
            setSaveMessage(
              savedId && !levelId ? "Item created — continue to preview and publish." : "Item saved. You can keep editing."
            );
            setSaving(false);
          }
          router.refresh();
          return savedId ?? false;
        }

        if (!silent) {
          setSaveMessage("Item created.");
          setSaving(false);
        }
        return savedId ?? false;
      } catch {
        if (silent) setAutosaveStatus("error");
        else {
          setError("Could not save. Check your connection and try again.");
          setSaving(false);
        }
        return false;
      }
    },
    [buildPayload, currentStep, levelId, levelKey, name, router]
  );

  useEffect(() => {
    if (!levelId || !dirtyRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveLevel(true);
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [levelId, saveLevel, name, config, levelType, published, difficulty, orderIndex, description, levelKey]);

  function validateStep(step: WizardStepId): boolean {
    if (step === "info") {
      return validateLevelIdentity(name, levelKey) === null;
    }
    return true;
  }

  function stepValidationMessage(step: WizardStepId): string {
    if (step === "info") {
      return validateLevelIdentity(name, levelKey) ?? "Please complete the required fields.";
    }
    return "Please fill in the required fields before continuing.";
  }

  async function handleNext() {
    if (!validateStep(currentStep)) {
      setError(stepValidationMessage(currentStep));
      return;
    }
    setError(null);
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) await goToStep(next.id);
  }

  function handleBack() {
    setError(null);
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) goToStep(prev.id);
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    const ok = await saveLevel(false);
    if (ok && currentStep === "preview") {
      setCompletedSteps((prev) => new Set([...prev, "preview"]));
    }
  }

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case "info":
        return (
          <StepLevelInfo
            isEdit={isEdit}
            levelKey={levelKey}
            setLevelKey={(v) => {
              setLevelKey(v);
              markDirty();
            }}
            name={name}
            setName={(v) => {
              setName(v);
              markDirty();
            }}
            description={description}
            setDescription={(v) => {
              setDescription(v);
              markDirty();
            }}
            orderIndex={orderIndex}
            setOrderIndex={(v) => {
              setOrderIndex(v);
              markDirty();
            }}
            difficulty={difficulty}
            setDifficulty={(v) => {
              setDifficulty(v);
              markDirty();
            }}
            levelType={levelType}
            applyType={applyType}
            config={config}
            setConfig={(c) => {
              setConfig(c);
              markDirty();
            }}
          />
        );
      case "grid":
        return (
          <StepGridSetup
            config={config}
            onChange={(c) => {
              setConfig(c);
              markDirty();
            }}
            currentLevelId={levelId}
          />
        );
      case "program":
        return (
          <StepProgramSetup
            levelType={levelType}
            config={config}
            onChange={(c) => {
              setConfig(c);
              markDirty();
            }}
          />
        );
      case "rules":
        return (
          <StepRules
            levelType={levelType}
            config={config}
            onChange={(c) => {
              setConfig(c);
              markDirty();
            }}
          />
        );
      case "preview":
        return (
          <StepPreviewPublish
            name={name}
            levelType={levelType}
            difficulty={difficulty}
            published={published}
            setPublished={(v) => {
              setPublished(v);
              markDirty();
            }}
            config={config}
            onConfigChange={(c) => {
              setConfig(c);
              markDirty();
            }}
          />
        );
      default:
        return null;
    }
  }, [
    config,
    currentStep,
    description,
    difficulty,
    levelId,
    isEdit,
    levelKey,
    levelType,
    name,
    orderIndex,
    published,
  ]);

  return (
    <form onSubmit={handleSave} className="flex min-h-screen flex-col bg-[#F8FAFC] pb-24">
      <ItemBuilderTopbar
        itemName={name}
        isNew={!levelId}
        autosaveStatus={autosaveStatus}
        currentStepLabel={currentStepMeta?.label ?? ""}
      />

      <div className="flex flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white lg:block">
          <div className="sticky top-[4.25rem] space-y-5 p-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
            <ItemBuilderStepRail
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={goToStep}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1">
          <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
            <ItemBuilderMobileSteps
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={goToStep}
            />

            <AnimatePresence mode="wait">
              <motion.div key={currentStep} className="mt-6 lg:mt-0">
                {stepContent}
              </motion.div>
            </AnimatePresence>

            {saveMessage && (
              <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {saveMessage}
              </p>
            )}
            {error && (
              <p className="mt-6 whitespace-pre-wrap rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          {currentStep !== "grid" && (
            <ItemBuilderContextPanel stepId={currentStep} />
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md lg:left-[18rem]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="gap-1 rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <p className="hidden text-sm text-slate-500 sm:block">
            {currentStepMeta?.description}
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={saving} className="gap-2 rounded-xl">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            {stepIndex < WIZARD_STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => void handleNext()}
                disabled={saving}
                className="gap-1 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving} className="gap-1 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]">
                {published ? "Save & publish" : "Save item"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
