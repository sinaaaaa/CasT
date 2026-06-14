"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Info, Loader2 } from "lucide-react";
import { formatItemDisplayName } from "@/lib/item-display";
import { LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { cn } from "@/lib/utils";

type LevelRow = {
  id: string;
  levelKey: string;
  name: string;
  orderIndex: number;
  published: boolean;
  levelType: LevelType;
  assignedStudentCount?: number;
};

type Props = {
  selectedStudentIds: string[];
  onComplete?: () => void;
};

type LevelFilter = "all" | "assigned" | "unassigned";

export function BulkLevelAssignmentPanel({ selectedStudentIds, onComplete }: Props) {
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/teacher/level-assignments");
        const data = await res.json();
        if (res.ok) {
          setLevels(data.levels ?? []);
          setExplanation(data.explanation ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredLevels = useMemo(() => {
    if (levelFilter === "assigned") {
      return levels.filter((l) => (l.assignedStudentCount ?? 0) > 0);
    }
    if (levelFilter === "unassigned") {
      return levels.filter((l) => (l.assignedStudentCount ?? 0) === 0);
    }
    return levels;
  }, [levels, levelFilter]);

  function toggleLevel(id: string) {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply(mode: "replace" | "add" | "assignAll" | "clear") {
    if (selectedStudentIds.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const orderedLevelIds = levels
      .filter((l) => selectedLevels.has(l.id))
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
      .map((l) => l.id);
    try {
      const res = await fetch("/api/teacher/level-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          levelIds: orderedLevelIds,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setMessage(
        mode === "clear"
          ? `Cleared assignments for ${data.studentCount} student(s). They will see all items.`
          : `Updated ${data.studentCount} student(s) · ${data.levelCount} item(s).`
      );
      onComplete?.();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (selectedStudentIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select one or more students below to assign items in bulk.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <h3 className="font-semibold text-indigo-950">
        Assign items to {selectedStudentIds.length} student
        {selectedStudentIds.length === 1 ? "" : "s"}
      </h3>
      <div className="mt-2 flex items-start gap-2 text-sm text-indigo-900/90">
        <Info className="h-4 w-4 shrink-0" />
        <p>{explanation}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSelectedLevels(new Set(levels.map((l) => l.id)));
          }}
        >
          Select all items
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => apply("assignAll")}>
          Assign all items
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || selectedLevels.size === 0}
          onClick={() => apply("replace")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save assignments"}
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => apply("clear")}>
          Remove all assignments
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["all", "assigned", "unassigned"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={levelFilter === f ? "default" : "ghost"}
            onClick={() => setLevelFilter(f)}
          >
            {f === "all" ? "All items" : f === "assigned" ? "Has assignments" : "No assignments"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading items…</p>
      ) : (
        <ul className="mt-3 max-h-48 grid gap-1 overflow-y-auto sm:grid-cols-2">
          {filteredLevels.map((level) => (
            <li key={level.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 py-2 text-sm",
                  selectedLevels.has(level.id) && "border-primary ring-1 ring-primary/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedLevels.has(level.id)}
                  onChange={() => toggleLevel(level.id)}
                />
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                <span className="truncate font-medium">{formatItemDisplayName(level.name)}</span>
                {(level.assignedStudentCount ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {level.assignedStudentCount}
                  </Badge>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-2 text-sm font-medium text-emerald-800">{message}</p>}
    </div>
  );
}
