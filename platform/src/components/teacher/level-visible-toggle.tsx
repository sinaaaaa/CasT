"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LevelVisibleToggle({
  levelId,
  visible,
  published,
}: {
  levelId: string;
  visible: boolean;
  published: boolean;
}) {
  const [v, setV] = useState(visible);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/levels/${levelId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !v }),
      });
      if (res.ok) setV(!v);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={toggle}
      title={
        v
          ? "Visible in game — click to hide from Unity / students"
          : "Hidden from game — click to show in Unity"
      }
      className={cn("gap-1.5", !v && "text-amber-700")}
    >
      {v ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      {v ? "Visible" : "Hidden"}
      {published && !v && (
        <span className="text-[10px] text-amber-600">(published)</span>
      )}
    </Button>
  );
}
