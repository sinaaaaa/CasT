"use client";

import { motion } from "framer-motion";
import { LevelType } from "@prisma/client";
import { Shield } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { ItemBuilderStepFrame } from "../item-builder-step-frame";
import { RulesStepContent } from "../rules-step-content";

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (c: LevelGameplayConfig) => void;
};

export function StepRules({ levelType, config, onChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <ItemBuilderStepFrame
        icon={Shield}
        title="Set the rules"
        subtitle="Shape how students experiment — attempts, movement freedom, feedback, and what counts as success."
        accent="amber"
      />

      <RulesStepContent levelType={levelType} config={config} onChange={onChange} />
    </motion.div>
  );
}
