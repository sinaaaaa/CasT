"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import {
  CheckCircle2,
  Circle,
  Eye,
  Gamepad2,
  Grid3x3,
  ListOrdered,
  Rocket,
  Target,
} from "lucide-react";
import {
  LEVEL_TYPE_LABELS,
  visitSequenceReady,
  type LevelGameplayConfig,
} from "@/lib/level-config";
import { Badge } from "@/components/ui/badge";

type Props = {
  name: string;
  levelType: LevelType;
  difficulty: number;
  published: boolean;
  setPublished: (v: boolean) => void;
  config: LevelGameplayConfig;
  onConfigChange: (config: LevelGameplayConfig) => void;
};

export function StepPreviewPublish({
  name,
  levelType,
  difficulty,
  published,
  setPublished,
  config,
  onConfigChange,
}: Props) {
  const objectCount = config.gridObjects?.length ?? 0;
  const commandCount = config.guidedActions?.length ?? 0;
  const hasTip = config.cornerHint?.enabled !== false && !!config.cornerHint?.title;

  const visitReady =
    levelType !== LevelType.DRAG_ACTIONS ||
    !config.visitObjectSequence ||
    visitSequenceReady(config);

  const visible = config.visible ?? true;

  const checklist = [
    { ok: !!name.trim(), label: "Item has a display name" },
    { ok: visible || !published, label: "Hidden items are not published to students" },
    {
      ok: objectCount > 0 || levelType === LevelType.FLAG_PLACEMENT,
      label: "Grid has objects or flag mode",
    },
    {
      ok: visitReady,
      label: "Visit step 1 and 2 marked on grid (if visit sequence on)",
    },
    {
      ok: levelType === LevelType.DRAG_ACTIONS || commandCount > 0,
      label: "Program configured (if required)",
    },
    { ok: (config.maxAttempts ?? 3) >= 1, label: "Max attempts set" },
    {
      ok: true,
      label:
        config.runRobotOnSubmit === false
          ? "Answer-only: RUN checks without animating Robo"
          : "RUN will animate Robo through the program",
    },
  ];

  const allReady = checklist.every((c) => c.ok);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-violet-50/30 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Ready to launch?</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{name.trim() || "Untitled item"}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{LEVEL_TYPE_LABELS[levelType]}</Badge>
              <Badge variant="outline">Difficulty {difficulty}/5</Badge>
              {published ? (
                <Badge className="bg-emerald-600">Published</Badge>
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </div>
          </div>
          <Rocket className="h-10 w-10 text-primary/40" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Grid3x3} label="Objects on grid" value={String(objectCount)} />
        <SummaryCard icon={ListOrdered} label="Program steps" value={String(commandCount)} />
        <SummaryCard icon={Target} label="Max attempts" value={String(config.maxAttempts ?? 3)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Eye className="h-4 w-4 text-slate-500" />
          Pre-publish checklist
        </h4>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300" />
              )}
              <span className={item.ok ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
            </li>
          ))}
        </ul>
        {!allReady && (
          <p className="mt-3 text-xs text-amber-700">
            Complete the highlighted items above before publishing to students.
          </p>
        )}
      </section>

      <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 space-y-4">
        <label className="flex cursor-pointer items-start gap-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-slate-300"
            checked={config.visible ?? true}
            onChange={(e) => onConfigChange({ ...config, visible: e.target.checked })}
          />
          <div>
            <p className="font-semibold text-slate-900">Visible in game</p>
            <p className="mt-1 text-sm text-slate-500">
              When off, Unity and students will not load this item (useful while drafting). You can still
              test it in Unity via the item reset tools if published.
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-4 border-t border-slate-200 pt-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-slate-300"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <div>
            <p className="font-semibold text-slate-900">Publish this item</p>
            <p className="mt-1 text-sm text-slate-500">
              When published and visible, students assigned to your class can play this item in the game.
            </p>
          </div>
        </label>
      </section>

      <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-sky-900">
        <Gamepad2 className="h-5 w-5 shrink-0" />
        <p>
          <strong>Test in game:</strong> Open Unity with your class login to play-test this item before
          assigning it to students.
          {hasTip && " Students will see your tip panel in the top-right corner."}
        </p>
      </div>
    </motion.div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <Icon className="mb-2 h-5 w-5 text-slate-400" />
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
