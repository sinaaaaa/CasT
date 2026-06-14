"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shared header for every assessment analysis panel (flag, choice, path, debugging).
 * Keeps a single, calm visual language: a neutral indigo icon chip, a title, and an
 * optional subtitle, with room for status badges on the right. Color is reserved for
 * status meaning elsewhere — the header itself stays neutral so the page feels unified.
 */
export function AssessmentPanelHeader({
  icon: Icon,
  title,
  subtitle,
  badges,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badges?: ReactNode;
}) {
  return (
    <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {badges && <div className="flex shrink-0 flex-wrap items-center gap-2">{badges}</div>}
      </div>
    </CardHeader>
  );
}
