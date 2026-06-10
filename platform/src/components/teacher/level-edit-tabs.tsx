"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelEditorForm } from "@/components/teacher/level-editor-form";

type Props = {
  level: {
    id: string;
    levelKey: string;
    name: string;
    description: string | null;
    orderIndex: number;
    difficulty: number;
    levelType: import("@prisma/client").LevelType;
    published: boolean;
    config: LevelGameplayConfig;
  };
};

export function LevelEditTabs({ level }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-slate-600">
          <Link href="/teacher/levels">
            <ArrowLeft className="h-4 w-4" />
            All levels
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/teacher/levels/${level.id}?tab=attempts`}>View attempts</Link>
        </Button>
      </div>
      <LevelEditorForm initial={level} />
    </div>
  );
}
