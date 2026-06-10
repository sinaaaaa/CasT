"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileEdit, Users } from "lucide-react";
import { LevelType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatItemDisplayName } from "@/lib/item-display";
import { LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { LevelVisibleToggle } from "@/components/teacher/level-visible-toggle";
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
}: EduLevelCardProps) {
  const gradient = typeGradients[levelType] ?? "from-indigo-500 to-violet-600";

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
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link href={`/teacher/levels/${id}/edit`}>
              <FileEdit className="mr-1 h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
