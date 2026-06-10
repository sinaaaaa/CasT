"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  Clock,
  Hash,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

export const EDU_ICONS = {
  users: Users,
  "trending-up": TrendingUp,
  target: Target,
  brain: Brain,
  clock: Clock,
  trophy: Trophy,
  "bar-chart": BarChart3,
  timer: Timer,
  hash: Hash,
} as const satisfies Record<string, LucideIcon>;

export type EduIconName = keyof typeof EDU_ICONS;

export function resolveEduIcon(name: EduIconName): LucideIcon {
  return EDU_ICONS[name];
}
