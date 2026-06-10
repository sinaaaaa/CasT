"use client";

import type { LevelGameplayConfig } from "@/lib/level-config";
import { VisualProgramBuilder } from "@/components/teacher/level-builder/visual-program-builder";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
  showBlanks?: boolean;
};

export function GuidedProgramEditor({ config, onChange, showBlanks = true }: Props) {
  return <VisualProgramBuilder config={config} onChange={onChange} showBlanks={showBlanks} />;
}
