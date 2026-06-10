import { z } from "zod";

export const DEFAULT_CT_CONSTRUCTS = [
  { slug: "abstraction", name: "Abstraction", color: "#8b5cf6", sortOrder: 1 },
  { slug: "decomposition", name: "Decomposition", color: "#06b6d4", sortOrder: 2 },
  { slug: "algorithm-design", name: "Algorithm Design", color: "#3b82f6", sortOrder: 3 },
  { slug: "pattern-recognition", name: "Pattern Recognition", color: "#10b981", sortOrder: 4 },
  { slug: "debugging", name: "Debugging", color: "#f59e0b", sortOrder: 5 },
  { slug: "sequencing", name: "Sequencing", color: "#ec4899", sortOrder: 6 },
  { slug: "loops", name: "Loops", color: "#14b8a6", sortOrder: 7 },
  { slug: "conditionals", name: "Conditionals", color: "#f97316", sortOrder: 8 },
  { slug: "logical-reasoning", name: "Logical Reasoning", color: "#6366f1", sortOrder: 9 },
  { slug: "evaluation", name: "Evaluation", color: "#84cc16", sortOrder: 10 },
] as const;

export const createConstructSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, hyphens"),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  rubricDescription: z.string().max(4000).optional(),
  color: z.string().max(32).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const updateConstructSchema = createConstructSchema.partial();

export const levelConstructAssignmentSchema = z.object({
  constructId: z.string().min(1),
  weightPercent: z.number().int().min(0).max(100),
  rubricDescription: z.string().max(4000).optional(),
  expectedEvidence: z.string().max(4000).optional(),
});

export const assignLevelConstructsSchema = z.object({
  assignments: z.array(levelConstructAssignmentSchema),
});

export type MasteryLevel = "emerging" | "developing" | "proficient" | "advanced";

/** ECD bands: 0–39 emerging, 40–64 developing, 65–84 proficient, 85–100 advanced. */
export function masteryFromScore(score: number): MasteryLevel {
  if (score >= 85) return "advanced";
  if (score >= 65) return "proficient";
  if (score >= 40) return "developing";
  return "emerging";
}

export function masteryLabel(level: MasteryLevel): string {
  switch (level) {
    case "advanced":
      return "Advanced";
    case "proficient":
      return "Proficient";
    case "developing":
      return "Developing";
    default:
      return "Emerging";
  }
}

export function masteryBadgeClass(level: MasteryLevel): string {
  switch (level) {
    case "advanced":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "proficient":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "developing":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
