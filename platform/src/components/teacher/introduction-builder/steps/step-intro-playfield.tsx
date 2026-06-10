"use client";

import { motion } from "framer-motion";
import { Bot, MapPin } from "lucide-react";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { GridDesigner } from "@/components/teacher/level-designer/grid-designer";

type Props = {
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
};

export function StepIntroPlayfield({ config, onChange }: Props) {
  const robot = config.robotStartPosition ?? { x: 1, y: 0 };
  const facing = config.robotStartFacing ?? { x: 0, y: 1 };
  const facingLabel =
    facing.x === 1 && facing.y === 0
      ? "right"
      : facing.x === -1 && facing.y === 0
        ? "left"
        : facing.x === 0 && facing.y === -1
          ? "down"
          : "up";

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-violet-50/40 p-4">
        <p className="text-sm font-semibold text-slate-900">Introduction playfield</p>
        <p className="mt-1 text-sm text-slate-600">
          Set where students see the robot when Item 0 loads in Unity. Drag the robot onto a cell,
          pick which way it faces, and optionally place props (mailbox, bin, etc.).
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
            <Bot className="h-3.5 w-3.5 text-violet-600" />
            Robot: ({robot.x}, {robot.y}) facing {facingLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {(config.gridObjects?.length ?? 0)} object
            {(config.gridObjects?.length ?? 0) === 1 ? "" : "s"} on grid
          </span>
        </div>
      </div>

      <GridDesigner config={config} onChange={onChange} />
    </motion.div>
  );
}
