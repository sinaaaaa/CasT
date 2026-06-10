"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { LevelType } from "@prisma/client";
import { LevelBuilderWizard } from "./level-builder/level-builder-wizard";

type LevelRecord = {
  id?: string;
  levelKey: string;
  name: string;
  description?: string | null;
  orderIndex: number;
  difficulty: number;
  levelType: LevelType;
  published: boolean;
  config: LevelGameplayConfig;
};

type Props = {
  initial?: LevelRecord;
};

/** Guided step-by-step level builder for teachers. */
export function LevelEditorForm({ initial }: Props) {
  return <LevelBuilderWizard initial={initial} />;
}
