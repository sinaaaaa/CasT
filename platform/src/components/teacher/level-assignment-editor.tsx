"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Save,
  BookOpen,
  Users,
  User,
  Check,
  Search,
  ListChecks,
  Sparkles,
  AlertCircle,
} from "lucide-react";
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
type ApplyMode = "add" | "replace";

export function LevelAssignmentEditor(props: Props) {
  const isClass = props.target === "class";
  const apiBase = isClass
    ? `/api/teacher/classes/${props.targetId}/level-assignments`
    : `/api/teacher/students/${props.targetId}/level-assignments`;

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  const [fromClasses, setFromClasses] = useState<
    { levelId: string; levelKey: string; levelName: string; className: string }[]
  >([]);
  const [hasCustom, setHasCustom] = useState(false);
  const [classStudentCount, setClassStudentCount] = useState(0);
  const [applyMode, setApplyMode] = useState<ApplyMode>("add");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedDetail, setSavedDetail] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [query, setQuery] = useState("");

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
      const ids = new Set<string>(data.assignedLevelIds ?? []);
      setLevels(data.levels ?? []);
      setSelected(ids);
      setInitialSelected(new Set(ids));
      setHasCustom(Boolean(data.hasCustomAssignments));
      setClassStudentCount(Number(data.class?.studentCount ?? 0));
      if (!isClass) setFromClasses(data.fromClasses ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, isClass]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true;
    for (const id of selected) {
      if (!initialSelected.has(id)) return true;
    }
    return false;
  }, [selected, initialSelected]);

  const selectedCount = selected.size;
  const publishedSelected = useMemo(
    () => levels.filter((l) => selected.has(l.id) && l.published).length,
    [levels, selected]
  );

  const filteredLevels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return levels.filter((l) => {
      if (levelFilter === "assigned" && !selected.has(l.id)) return false;
      if (levelFilter === "unassigned" && selected.has(l.id)) return false;
      if (!q) return true;
      const name = formatItemDisplayName(l.name).toLowerCase();
      const type = (LEVEL_TYPE_LABELS[l.levelType] ?? "").toLowerCase();
      return (
        name.includes(q) ||
        l.levelKey.toLowerCase().includes(q) ||
        type.includes(q) ||
        String(l.orderIndex).includes(q)
      );
    });
  }, [levels, selected, levelFilter, query]);

  function markDirty() {
    setSaved(false);
    setSavedDetail(null);
  }

  function toggle(levelId: string) {
    markDirty();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  function assignAllLevels() {
    markDirty();
    setSelected(new Set(levels.map((l) => l.id)));
  }

  function clearAssignments() {
    markDirty();
    setSelected(new Set());
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    setSavedDetail(null);
    const orderedLevelIds = levels
      .filter((l) => selected.has(l.id))
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
      .map((l) => l.id);
    try {
      const payload = isClass
        ? {
            levelIds: orderedLevelIds,
            applyToStudents: true,
            studentApplyMode: applyMode,
          }
        : { levelIds: orderedLevelIds };
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          typeof data.details === "string" && data.details.trim().length > 0
            ? data.details.trim()
            : null;
        setError(detail ? `${data.error ?? "Save failed"} — ${detail}` : (data.error ?? "Save failed"));
        return;
      }
      setHasCustom(Boolean(data.hasCustomAssignments));
      setInitialSelected(new Set(orderedLevelIds));
      setSaved(true);
      if (isClass) {
        const n = Number(data.studentsUpdated ?? 0);
        setSavedDetail(
          n > 0
            ? applyMode === "replace"
              ? `Done. ${n} student${n === 1 ? "" : "s"} now play exactly these ${orderedLevelIds.length} item${orderedLevelIds.length === 1 ? "" : "s"}.`
              : `Done. Added ${orderedLevelIds.length} item${orderedLevelIds.length === 1 ? "" : "s"} to ${n} student${n === 1 ? "" : "s"}.`
            : orderedLevelIds.length > 0
              ? "Class playlist saved. Add students below and they will get these items."
              : "Class playlist cleared."
        );
      } else {
        setSavedDetail(
          orderedLevelIds.length > 0
            ? `${props.targetName} can play ${orderedLevelIds.length} assigned item${orderedLevelIds.length === 1 ? "" : "s"}.`
            : `${props.targetName} can play all available items again.`
        );
      }
    } catch {
      setError("Could not reach server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const headline = isClass ? "Class playlist" : "Personal playlist";
  const subtitle = isClass
    ? `Choose what everyone in ${props.targetName} plays.`
    : `Choose what ${props.targetName} plays.`;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-100">
      <div className="border-b border-stone-100 bg-[#F7F4EE] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3A5F] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                {isClass ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {isClass ? "Whole class" : "One student"}
              </span>
              {isClass ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200">
                  {classStudentCount} student{classStudentCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                    hasCustom || selectedCount > 0
                      ? "bg-[#1E3A5F]/10 text-[#1E3A5F] ring-[#1E3A5F]/20"
                      : "bg-white text-stone-600 ring-stone-200"
                  )}
                >
                  {selectedCount > 0
                    ? `${selectedCount} assigned`
                    : "All items available"}
                </span>
              )}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-stone-900">{headline}</h3>
            <p className="mt-1 max-w-xl text-sm text-stone-600">{subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
            <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Selected</p>
              <p className="text-lg font-semibold text-stone-900">
                {selectedCount}
                <span className="text-sm font-normal text-stone-500"> / {levels.length}</span>
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                {isClass ? "Goes to" : "In game"}
              </p>
              <p className="text-lg font-semibold text-stone-900">
                {isClass
                  ? classStudentCount === 0
                    ? "No one yet"
                    : `${classStudentCount} kids`
                  : selectedCount === 0
                    ? "Everything"
                    : `${publishedSelected} live`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {isClass && (
          <section className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="mb-3 flex items-start gap-2">
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A5F]" />
              <div>
                <p className="text-sm font-semibold text-stone-900">How should Save update students?</p>
                <p className="mt-0.5 text-xs text-stone-600">
                  Pick one. You can still customize a single student later from their profile.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  markDirty();
                  setApplyMode("add");
                }}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition",
                  applyMode === "add"
                    ? "border-[#1E3A5F] bg-white ring-2 ring-[#1E3A5F]/20"
                    : "border-stone-200 bg-white hover:border-stone-300"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-900">Add to their lists</span>
                  {applyMode === "add" && <Check className="h-4 w-4 text-[#1E3A5F]" />}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Recommended. Gives everyone the selected items and keeps any extras they already have.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  markDirty();
                  setApplyMode("replace");
                }}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition",
                  applyMode === "replace"
                    ? "border-[#1E3A5F] bg-white ring-2 ring-[#1E3A5F]/20"
                    : "border-stone-200 bg-white hover:border-stone-300"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-900">Exact same list</span>
                  {applyMode === "replace" && <Check className="h-4 w-4 text-[#1E3A5F]" />}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Every student in the class gets only these items. Use when the whole class should match.
                </p>
              </button>
            </div>
          </section>
        )}

        {!isClass && (
          <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {selectedCount === 0
              ? "No personal list yet. This student can play every available item."
              : `This student can play only the ${selectedCount} item${selectedCount === 1 ? "" : "s"} you select below.`}
          </p>
        )}

        {!isClass && fromClasses.length > 0 && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">From their class</p>
            <p className="mt-1 text-xs text-amber-900/80">
              Class playlists also add items to students. The checklist below is what this student can play now.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {fromClasses.map((c) => (
                <li
                  key={`${c.className}-${c.levelId}`}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 ring-1 ring-amber-200"
                >
                  {formatItemDisplayName(c.levelName)} · {c.className}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="h-10 rounded-xl border-stone-200 bg-white pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "assigned", "unassigned"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLevelFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  levelFilter === f
                    ? "bg-[#1E3A5F] text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                {f === "all" ? "All" : f === "assigned" ? "Selected" : "Not selected"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={assignAllLevels}
            disabled={loading}
            className="rounded-full"
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAssignments}
            disabled={loading}
            className="rounded-full"
          >
            Clear all
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading items…
          </div>
        ) : filteredLevels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 py-12 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-stone-400" />
            <p className="font-medium text-stone-800">No items match</p>
            <p className="mt-1 text-sm text-stone-500">
              Try another search or switch the Selected / Not selected filter.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {filteredLevels.map((level) => {
              const checked = selected.has(level.id);
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    onClick={() => toggle(level.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition",
                      checked
                        ? "border-[#1E3A5F] bg-[#1E3A5F]/[0.04] ring-1 ring-[#1E3A5F]/25"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        checked
                          ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                          : "border-stone-300 bg-white"
                      )}
                      aria-hidden
                    >
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-stone-400" />
                        <span className="font-medium text-stone-900">
                          {formatItemDisplayName(level.name)}
                        </span>
                        {!level.published && (
                          <Badge variant="secondary" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {LEVEL_TYPE_LABELS[level.levelType]} · Item order {level.orderIndex}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {saved && !dirty && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">
              {savedDetail ?? "Saved. Student progress and past attempts are unchanged."}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "sticky bottom-0 border-t px-4 py-3 sm:px-6",
          dirty ? "border-[#1E3A5F]/20 bg-[#F7F4EE]" : "border-stone-100 bg-white"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            {dirty ? (
              isClass ? (
                <>
                  Ready to give <strong className="text-stone-900">{selectedCount} item{selectedCount === 1 ? "" : "s"}</strong>
                  {classStudentCount > 0 ? (
                    <>
                      {" "}
                      to <strong className="text-stone-900">{classStudentCount} student{classStudentCount === 1 ? "" : "s"}</strong>
                      {applyMode === "replace" ? " as their exact list" : ""}.
                    </>
                  ) : (
                    <> for this class.</>
                  )}
                </>
              ) : (
                <>
                  Ready to update <strong className="text-stone-900">{props.targetName}</strong>
                  {selectedCount === 0 ? " to all items" : ` to ${selectedCount} item${selectedCount === 1 ? "" : "s"}`}.
                </>
              )
            ) : (
              "No unsaved changes."
            )}
          </p>
          <Button
            type="button"
            onClick={save}
            disabled={loading || saving || !dirty}
            className="gap-2 rounded-full bg-[#1E3A5F] px-5 hover:bg-[#16304F]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isClass
              ? classStudentCount > 0
                ? "Save for class"
                : "Save playlist"
              : "Save for student"}
          </Button>
        </div>
      </div>
    </div>
  );
}
