"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { levelGameplayConfigSchema, type LevelGameplayConfig } from "@/lib/level-config";
import { copyGridLayoutOnto, type GridLayoutCopyMode } from "@/lib/copy-level-layout";

type LevelRow = { id: string; levelKey: string; name: string; orderIndex: number };

type Props = {
  currentLevelId?: string;
  currentConfig: LevelGameplayConfig;
  onApply: (config: LevelGameplayConfig) => void;
};

export function CopyLevelLayout({ currentLevelId, currentConfig, onApply }: Props) {
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [mode, setMode] = useState<GridLayoutCopyMode>("grid-and-robot");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadLevels = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/levels");
      const data = await res.json();
      if (!res.ok) return;
      const rows = (data.levels ?? []) as LevelRow[];
      setLevels(
        rows
          .filter((l) => l.id !== currentLevelId)
          .sort((a, b) => a.orderIndex - b.orderIndex)
      );
    } catch {
      /* ignore */
    }
  }, [currentLevelId]);

  useEffect(() => {
    void loadLevels();
  }, [loadLevels]);

  async function handleCopy() {
    if (!sourceId) {
      setError("Choose an item to copy from.");
      return;
    }
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/teacher/levels/${sourceId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load source item.");
        return;
      }
      const parsed = levelGameplayConfigSchema.safeParse(data.level?.config);
      if (!parsed.success) {
        setError("Source item has invalid layout data.");
        return;
      }
      onApply(copyGridLayoutOnto(currentConfig, parsed.data, mode));
      setDone(true);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  if (levels.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Copy className="h-4 w-4" />
        Copy layout from another item
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Reuse a grid you already built (e.g. copy Item 1 onto Item 2). Your item name and play type
        are kept.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Copy from</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="h-9 bg-background text-sm">
              <SelectValue placeholder="Select item…" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.orderIndex}. {l.name} ({l.levelKey})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">What to copy</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as GridLayoutCopyMode)}>
            <SelectTrigger className="h-9 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid-only">Objects on grid only</SelectItem>
              <SelectItem value="grid-and-robot">Grid + robot start + goal cell</SelectItem>
              <SelectItem value="full">Full layout (grid, robot, drag rules)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void handleCopy()} disabled={loading || !sourceId}>
          {loading ? "Copying…" : "Apply to this item"}
        </Button>
        {done && (
          <span className="text-xs font-medium text-emerald-600">Layout copied — click Save item when ready.</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
