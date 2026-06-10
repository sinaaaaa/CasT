"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { Input } from "@/components/ui/input";
import { HintImageUpload } from "./hint-image-upload";
import { HintAudioUpload } from "./hint-audio-upload";
import { MessageSquare } from "lucide-react";
import { DesignerSection } from "./designer-section";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
  label?: string;
  /** Introduction welcome step: enabled is controlled on the Info step. */
  hideEnabledToggle?: boolean;
};

export function CornerHintEditor({
  config,
  onChange,
  label = "Student tip panel (top-right in game)",
  hideEnabledToggle = false,
}: Props) {
  const hint = config.cornerHint ?? { enabled: true, title: "", body: "" };

  function patch(partial: Partial<NonNullable<LevelGameplayConfig["cornerHint"]>>) {
    onChange({
      ...config,
      cornerHint: { ...hint, ...partial },
    });
  }

  return (
    <DesignerSection
      icon={MessageSquare}
      title={label}
      description="Students see this in the top-right corner while playing. Add text, an optional picture, and optional voice audio."
    >
      {!hideEnabledToggle && (
        <label className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={hint.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <span className="font-medium text-emerald-900">Show this tip during the item</span>
        </label>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Headline</span>
          <Input
            value={hint.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Item 1"
            className="h-11"
          />
        </label>
        <div className="lg:row-span-2">
          <HintImageUpload
            imageUrl={hint.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
          />
        </div>
        <label className="block space-y-2 lg:col-span-1">
          <span className="text-sm font-medium text-slate-700">Instructions</span>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={hint.body ?? ""}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Tell students what to do in simple words…"
          />
        </label>
        <div className="lg:col-span-2">
          <HintAudioUpload
            audioUrl={hint.audioUrl}
            playAutomatically={hint.playAudioAutomatically !== false}
            onChange={(url) => patch({ audioUrl: url })}
            onPlayAutomaticallyChange={(v) => patch({ playAudioAutomatically: v })}
          />
        </div>
      </div>
    </DesignerSection>
  );
}
