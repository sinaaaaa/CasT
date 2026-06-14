"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Filter, ExternalLink } from "lucide-react";
import { AttemptStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatDuration } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type LevelAttemptRow = {
  id: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  inLevelRunNumber: number | null;
  maxLevelRuns: number | null;
  attemptLabel: string;
  status: AttemptStatus;
  passed: boolean;
  score: number | null;
  totalTimeSeconds: number | null;
  robotTouched: boolean;
  robotTouchCount: number;
  startedAt: string;
};

const STATUS_FILTERS: { label: string; value: "all" | AttemptStatus }[] = [
  { label: "All", value: "all" },
  { label: "Correct", value: AttemptStatus.CORRECT },
  { label: "Incorrect", value: AttemptStatus.INCORRECT },
  { label: "Incomplete", value: AttemptStatus.INCOMPLETE },
];

export function LevelAttemptsTable({ attempts }: { attempts: LevelAttemptRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AttemptStatus>("all");

  const filtered = useMemo(() => {
    return attempts.filter((a) => {
      const matchesQuery =
        !query.trim() || a.studentName.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [attempts, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              className="transition-all"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Student</TableHead>
              <TableHead>Try</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Robot</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No attempts match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    a.passed && "border-l-2 border-l-emerald-500",
                    a.status === AttemptStatus.INCORRECT && "border-l-2 border-l-red-400",
                    a.status === AttemptStatus.INCOMPLETE && "border-l-2 border-l-amber-400"
                  )}
                >
                  <TableCell className="font-medium">
                    <Link href={`/teacher/students/${a.studentId}`} className="hover:text-primary hover:underline">
                      {a.studentName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{a.attemptLabel}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} passed={a.passed} />
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-semibold", a.passed ? "text-emerald-700" : "")}>
                      {a.score ?? "—"}
                      {a.score != null ? "%" : ""}
                    </span>
                  </TableCell>
                  <TableCell>{formatDuration(a.totalTimeSeconds)}</TableCell>
                  <TableCell>
                    {a.robotTouched ? (
                      <span className="text-amber-700">
                        Yes <span className="text-muted-foreground">({a.robotTouchCount})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <Link href={`/teacher/attempts/${a.id}`}>
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {attempts.length} attempts
      </p>
    </div>
  );
}
