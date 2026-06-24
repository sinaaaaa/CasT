"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, FileEdit, Loader2, Users } from "lucide-react";
import { LevelType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatItemDisplayName } from "@/lib/item-display";
import { LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { LevelVisibleToggle } from "@/components/teacher/level-visible-toggle";
import { parseApiError, readApiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const typeGradients: Partial<Record<LevelType, string>> = {
  INTRO: "from-violet-500 to-purple-600",
  DRAG_ACTIONS: "from-teal-500 to-emerald-600",
  FLAG_PLACEMENT: "from-amber-500 to-orange-600",
  CHOOSE_BUTTONS: "from-sky-500 to-blue-600",
  DRAG_EDIT_PROGRAM: "from-rose-500 to-pink-600",
};

export type EduLevelCardProps = {
  id: string;
  levelKey: string;
  name: string;
  orderIndex: number;
  levelType: LevelType;
  published: boolean;
  visible: boolean;
  attemptCount: number;
  difficulty?: number;
  index?: number;
  ownerTeacherId?: string | null;
  canEdit?: boolean;
  isPlatformDefault?: boolean;
};

export function EduLevelCard({
  id,
  levelKey,
  name,
  orderIndex,
  levelType,
  published,
  visible,
  attemptCount,
  index = 0,
  ownerTeacherId,
  canEdit = true,
  isPlatformDefault = false,
}: EduLevelCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gradient = typeGradients[levelType] ?? "from-indigo-500 to-violet-600";

  async function customizeItem() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/levels/${id}/duplicate`, { method: "POST" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(parseApiError(data, "Could not copy item"));
      const level = (data as { level?: { id: string } }).level;
      if (level?.id) {
        router.push(`/teacher/levels/${level.id}/edit`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -6 }}
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
    >
      <div className={cn("relative flex h-28 items-end bg-gradient-to-br p-4", gradient)}>
        <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-indigo-700 shadow">
          {orderIndex}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="bg-white/90 text-slate-800 hover:bg-white">{LEVEL_TYPE_LABELS[levelType]}</Badge>
          {isPlatformDefault && (
            <Badge variant="secondary" className="bg-white/90 text-slate-700">
              Default
            </Badge>
          )}
          <Badge variant={published ? "default" : "secondary"} className={published ? "bg-emerald-600" : ""}>
            {published ? "Live" : "Draft"}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <Link href={`/teacher/levels/${id}`} className="text-lg font-bold text-slate-900 hover:text-[#4F46E5]">
            {formatItemDisplayName(name)}
          </Link>
          <p className="text-xs text-slate-500">{levelKey}</p>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {attemptCount} attempts
          </span>
          <LevelVisibleToggle levelId={id} visible={visible} published={published} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]">
            <Link href={`/teacher/levels/${id}?tab=attempts`}>Review</Link>
          </Button>
          {canEdit ? (
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link href={`/teacher/levels/${id}/edit`}>
                <FileEdit className="mr-1 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={busy}
              onClick={() => void customizeItem()}
            >
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" />
              )}
              Customize
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {isPlatformDefault && !canEdit && (
          <p className="text-xs text-muted-foreground">
            Customize creates your own version of this item. The shared default is hidden from your
            list once you customize it.
          </p>
        )}
        {canEdit && !isPlatformDefault && (
          <p className="text-xs text-muted-foreground">
            Your customized version replaces the shared default for you and your students when
            published.
          </p>
        )}
      </div>
    </motion.article>
  );
}
