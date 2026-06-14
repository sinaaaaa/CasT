"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, BookOpen, Users, User, Info } from "lucide-react";
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
};

type Props =
  | { target: "student"; targetId: string; targetName: string }
  | { target: "class"; targetId: string; targetName: string };

type LevelFilter = "all" | "assigned" | "unassigned";

export function LevelAssignmentEditor(props: Props) {
  const apiBase =
    props.target === "student"
      ? `/api/teacher/students/${props.targetId}/level-assignments`
      : `/api/teacher/classes/${props.targetId}/level-assignments`;

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromClasses, setFromClasses] = useState<
    { levelId: string; levelKey: string; levelName: string; className: string }[]
  >([]);
  const [explanation, setExplanation] = useState<string>("");
  const [hasCustom, setHasCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load");
        return;
      }
      setLevels(data.levels ?? []);
      setSelected(new Set(data.assignedLevelIds ?? []));
      setHasCustom(Boolean(data.hasCustomAssignments));
      setExplanation(
        data.explanation ??
          "Assigned items let you personalize practice. Students with no assigned items will continue to see all items."
      );
      if (props.target === "student") setFromClasses(data.fromClasses ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, props.target]);

  useEffect(() => {
    void load();
  }, [load]);

  const actionsDisabled = loading;
  const saveDisabled = loading || saving;

  const filteredLevels = useMemo(() => {
    if (levelFilter === "assigned") return levels.filter((l) => selected.has(l.id));
    if (levelFilter === "unassigned") return levels.filter((l) => !selected.has(l.id));
    return levels;
  }, [levels, selected, levelFilter]);

  function toggle(levelId: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  function assignAllLevels() {
    setSaved(false);
    setSelected(new Set(levels.map((l) => l.id)));
  }

  function clearAssignments() {
    setSaved(false);
    setSelected(new Set());
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const orderedLevelIds = levels
      .filter((l) => selected.has(l.id))
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
      .map((l) => l.id);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelIds: orderedLevelIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setHasCustom(Boolean(data.hasCustomAssignments));
      setSaved(true);
    } catch {
      setError("Could not reach server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const Icon = props.target === "class" ? Users : User;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Assigned game items</h3>
            <p className="text-sm text-slate-500">
              {props.target === "class"
                ? `Items assigned to class ${props.targetName}.`
                : `Personalized items for ${props.targetName}.`}
            </p>
            {props.target === "student" && (
              <Badge
                variant={hasCustom ? "default" : "secondary"}
                className="mt-2 text-[10px]"
              >
                {hasCustom
                  ? `${selected.size} assigned · restricted in game`
                  : "No assignments · all items available"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={assignAllLevels}
            disabled={actionsDisabled}
          >
            Assign all items
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAssignments}
            disabled={actionsDisabled}
          >
            Clear assignments
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saveDisabled} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{explanation}</p>
        </div>

        {props.target === "student" && fromClasses.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Class items (informational)</p>
            <p className="mt-1 text-xs text-amber-900/90">
              Game access uses <strong>direct assignments above</strong> only. Class items listed
              here do not restrict Unity unless you assign them to this student.
            </p>
            <ul className="mt-1 list-inside list-disc">
              {fromClasses.map((c) => (
                <li key={`${c.className}-${c.levelId}`}>
                  {formatItemDisplayName(c.levelName)} ({c.levelKey}) — {c.className}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">Show items</span>
          {(["all", "assigned", "unassigned"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={levelFilter === f ? "default" : "outline"}
              onClick={() => setLevelFilter(f)}
            >
              {f === "all" ? "All" : f === "assigned" ? "Assigned" : "Unassigned"}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading items…
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {filteredLevels.map((level) => {
              const checked = selected.has(level.id);
              return (
                <li key={level.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition",
                      checked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={checked}
                      onChange={() => toggle(level.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="font-medium text-slate-900">{formatItemDisplayName(level.name)}</span>
                        {!level.published && (
                          <Badge variant="secondary" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {level.levelKey} · order {level.orderIndex} ·{" "}
                        {LEVEL_TYPE_LABELS[level.levelType]}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {saved && (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            Assignments saved. Previous attempts and progress are unchanged.
          </p>
        )}
      </div>
    </div>
  );
}
