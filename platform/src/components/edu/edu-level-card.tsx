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
import { getItemFamily, type ItemFamilyId } from "@/lib/item-activity";
import { FAMILY_UI } from "@/lib/item-family-ui";
import { LevelVisibleToggle } from "@/components/teacher/level-visible-toggle";
import { parseApiError, readApiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
  activityTitle?: string;
  familyId?: ItemFamilyId;
};

export function EduLevelCard({
  id,
  name,
  orderIndex,
  published,
  visible,
  attemptCount,
  index = 0,
  canEdit = true,
  isPlatformDefault = false,
  activityTitle,
  familyId = "program",
}: EduLevelCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const family = getItemFamily(familyId);

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
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: FAMILY_UI[familyId].barHex }}
      />
      <div className="space-y-3 p-5 pl-6">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
              FAMILY_UI[familyId].soft
            )}
          >
            {orderIndex}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge variant={published ? "default" : "secondary"} className={published ? "bg-emerald-600" : ""}>
              {published ? "Live" : "Draft"}
            </Badge>
            {isPlatformDefault && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                Default
              </Badge>
            )}
          </div>
        </div>

        <div>
          <Link href={`/teacher/levels/${id}`} className="text-base font-bold leading-snug text-slate-900 hover:text-[#4F46E5]">
            {formatItemDisplayName(name)}
          </Link>
          {activityTitle && (
            <p className="mt-1 text-sm text-slate-500">{activityTitle}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", FAMILY_UI[familyId].chip)}>
            {family.title}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {attemptCount} attempts
          </span>
          <LevelVisibleToggle levelId={id} visible={visible} published={published} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 rounded-xl">
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
      </div>
    </motion.article>
  );
}
