"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EduStudentListItemProps = {
  id: string;
  displayName: string;
  externalId: string | null;
  classes: string;
  passed: number;
  failed: number;
  avg: number;
  completionPercent: number;
  assignedLevelCount: number;
  needsHelp?: boolean;
  lastActivityAt?: string | null;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ProgressRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#4F46E5"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function EduStudentListItem({
  displayName,
  externalId,
  classes,
  passed,
  failed,
  avg,
  completionPercent,
  assignedLevelCount,
  needsHelp,
  lastActivityAt,
  selected,
  onToggleSelect,
  onEdit,
  id,
}: EduStudentListItemProps) {
  const progressPct = completionPercent;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "group flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md sm:flex-row sm:items-center",
        needsHelp && "ring-amber-200 bg-amber-50/30",
        selected && "ring-[#4F46E5]/40 bg-indigo-50/20"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-slate-300"
            aria-label={`Select ${displayName}`}
          />
        )}
        <div className="relative">
          <ProgressRing percent={progressPct} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-700">
            {progressPct}%
          </span>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-bold text-slate-900">{displayName}</p>
            {needsHelp && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                Needs support
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {externalId ?? "No ID"} · {classes || "No class"}
            {lastActivityAt ? ` · Active ${formatRelativeTime(lastActivityAt)}` : " · No activity yet"}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {passed} passed · {failed} needs work · avg {avg}%
            {assignedLevelCount > 0 && (
              <span className="text-indigo-600"> · {assignedLevelCount} assigned items</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button asChild size="sm" className="rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]">
          <Link href={`/teacher/students/${id}`}>View</Link>
        </Button>
        {onEdit && (
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>
    </motion.div>
  );
}
