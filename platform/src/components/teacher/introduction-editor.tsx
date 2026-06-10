"use client";

import { IntroductionBuilderWizard } from "./introduction-builder/introduction-builder-wizard";
import type { LevelGameplayConfig } from "@/lib/level-config";

type IntroRecord = {
  id: string;
  levelKey: string;
  name: string;
  published: boolean;
  config: LevelGameplayConfig;
};

type Props = {
  initial: IntroRecord;
};

export function IntroductionEditor({ initial }: Props) {
  return <IntroductionBuilderWizard initial={initial} />;
}
