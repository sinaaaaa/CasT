"use client";

import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import type { AttemptVerdict, VerdictTone } from "@/lib/assessment/attempt-verdict";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<
  VerdictTone,
  { card: string; iconWrap: string; icon: typeof CheckCircle2; headline: string }
> = {
  success: {
    card: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40",
    iconWrap: "bg-emerald-500/15 text-emerald-700",
    icon: CheckCircle2,
    headline: "text-emerald-900",
  },
  warning: {
    card: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40",
    iconWrap: "bg-amber-500/15 text-amber-700",
    icon: AlertTriangle,
    headline: "text-amber-950",
  },
  danger: {
    card: "border-red-200 bg-gradient-to-br from-red-50 via-white to-red-50/40",
    iconWrap: "bg-red-500/15 text-red-700",
    icon: XCircle,
    headline: "text-red-900",
  },
  neutral: {
    card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/40",
    iconWrap: "bg-slate-500/15 text-slate-700",
    icon: Info,
    headline: "text-slate-900",
  },
};

/**
 * The first thing a reader sees on an attempt: a plain-English headline,
 * what happened, the next step, and an honest note when we are unsure.
 */
export function AttemptVerdictBanner({ verdict }: { verdict: AttemptVerdict }) {
  const tone = TONE_STYLES[verdict.tone];
  const Icon = tone.icon;

  return (
    <section
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        tone.card
      )}
      aria-label="Plain-language summary"
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            tone.iconWrap
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn("text-lg font-semibold leading-snug tracking-tight", tone.headline)}>
            {verdict.headline}
          </p>
          {verdict.detail && (
            <p className="text-sm leading-relaxed text-slate-700">{verdict.detail}</p>
          )}

          {verdict.fix && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Next step: </span>
                {verdict.fix}
              </p>
            </div>
          )}

          {verdict.confidence && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300/80 bg-slate-50/60 px-3 py-2">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <p className="text-xs leading-relaxed text-slate-600">
                <span className="font-medium text-slate-700">
                  {verdict.confidence.level === "low"
                    ? "Low confidence: "
                    : "Note: "}
                </span>
                {verdict.confidence.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
