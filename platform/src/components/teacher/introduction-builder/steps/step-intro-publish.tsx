"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, GraduationCap, ListOrdered, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LevelGameplayConfig } from "@/lib/level-config";

type Props = {
  name: string;
  published: boolean;
  setPublished: (v: boolean) => void;
  config: LevelGameplayConfig;
};

export function StepIntroPublish({ name, published, setPublished, config }: Props) {
  const steps = config.actionBlockIntro?.steps ?? [];
  const allowSkip = config.actionBlockIntro?.allowSkip !== false;
  const hasWelcome = config.cornerHint?.enabled !== false && !!config.cornerHint?.title;

  const robot = config.robotStartPosition;
  const hasRobot =
    robot != null &&
    Number.isFinite(robot.x) &&
    Number.isFinite(robot.y) &&
    robot.x >= 0 &&
    robot.y >= 0;

  const checklist = [
    { ok: !!name.trim(), label: "Display name is set" },
    { ok: hasRobot, label: "Robot start position on grid" },
    { ok: steps.length > 0, label: "At least one teaching step" },
    {
      ok: config.cornerHint?.enabled === false || hasWelcome,
      label:
        config.cornerHint?.enabled === false
          ? "Welcome message off (starts at step 1)"
          : "Welcome message configured",
    },
  ];
  const allReady = checklist.every((c) => c.ok);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Ready to launch?</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{name.trim() || "Block introduction"}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">Item 0</Badge>
              <Badge variant="outline">{steps.length} teaching steps</Badge>
              {allowSkip ? <Badge variant="outline">Skip allowed</Badge> : <Badge variant="outline">Skip hidden</Badge>}
              {published ? <Badge className="bg-emerald-600">Published</Badge> : <Badge variant="outline">Draft</Badge>}
            </div>
          </div>
          <Rocket className="h-10 w-10 text-violet-300" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <GraduationCap className="mb-2 h-5 w-5 text-violet-500" />
          <p className="text-2xl font-bold">{steps.length}</p>
          <p className="text-xs text-slate-500">Teaching steps</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <ListOrdered className="mb-2 h-5 w-5 text-violet-500" />
          <p className="text-2xl font-bold">{allowSkip ? "Yes" : "No"}</p>
          <p className="text-xs text-slate-500">Students can skip</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">Checklist</h4>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
              <span className={item.ok ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
            </li>
          ))}
        </ul>
        {!allReady && (
          <p className="mt-3 text-xs text-amber-700">Complete the items above, then save and publish.</p>
        )}
      </section>

      <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
        <label className="flex cursor-pointer items-start gap-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <div>
            <p className="font-semibold text-slate-900">Publish introduction</p>
            <p className="mt-1 text-sm text-slate-500">
              When published, new students will see this tutorial before Item 1.
            </p>
          </div>
        </label>
      </section>
    </motion.div>
  );
}
