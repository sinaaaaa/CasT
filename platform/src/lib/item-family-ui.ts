import type { ItemActivityId, ItemFamilyId } from "@/lib/item-activity";

export const SPARC = {
  navy: "#1E3A8A",
  paper: "#F5F2EB",
  cream: "#F7F4EE",
  teal: "#0F9B8E",
  gold: "#F7E37D",
  goldLine: "#E8C547",
  brand: "#4F46E5",
} as const;

export const FAMILY_UI: Record<
  ItemFamilyId,
  {
    gradient: string;
    solid: string;
    soft: string;
    selected: string;
    chip: string;
    ring: string;
    text: string;
    filterOn: string;
    bar: string;
    glow: string;
    fromHex: string;
    toHex: string;
    barHex: string;
  }
> = {
  program: {
    gradient: "from-teal-500 to-emerald-600",
    solid: "bg-teal-600 text-white",
    soft: "bg-teal-50 text-teal-800",
    selected: "border-teal-400 bg-white shadow-sm ring-2 ring-teal-100",
    chip: "bg-teal-100 text-teal-800",
    ring: "ring-teal-200",
    text: "text-teal-800",
    filterOn: "data-[on=true]:border-teal-600 data-[on=true]:bg-teal-600 data-[on=true]:text-white",
    bar: "bg-teal-500",
    glow: "from-teal-50 via-white to-emerald-50/40",
    fromHex: "#14B8A6",
    toHex: "#059669",
    barHex: "#0D9488",
  },
  predict: {
    gradient: "from-amber-500 to-orange-500",
    solid: "bg-amber-500 text-white",
    soft: "bg-amber-50 text-amber-900",
    selected: "border-amber-400 bg-white shadow-sm ring-2 ring-amber-100",
    chip: "bg-amber-100 text-amber-900",
    ring: "ring-amber-200",
    text: "text-amber-900",
    filterOn: "data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500 data-[on=true]:text-white",
    bar: "bg-amber-500",
    glow: "from-amber-50 via-white to-orange-50/40",
    fromHex: "#F59E0B",
    toHex: "#EA580C",
    barHex: "#F59E0B",
  },
  shape: {
    gradient: "from-violet-500 to-purple-700",
    solid: "bg-violet-600 text-white",
    soft: "bg-violet-50 text-violet-800",
    selected: "border-violet-400 bg-white shadow-sm ring-2 ring-violet-100",
    chip: "bg-violet-100 text-violet-800",
    ring: "ring-violet-200",
    text: "text-violet-800",
    filterOn: "data-[on=true]:border-violet-600 data-[on=true]:bg-violet-600 data-[on=true]:text-white",
    bar: "bg-violet-500",
    glow: "from-violet-50 via-white to-indigo-50/40",
    fromHex: "#8B5CF6",
    toHex: "#6D28D9",
    barHex: "#8B5CF6",
  },
  pattern: {
    gradient: "from-orange-500 to-rose-600",
    solid: "bg-orange-600 text-white",
    soft: "bg-orange-50 text-orange-900",
    selected: "border-orange-400 bg-white shadow-sm ring-2 ring-orange-100",
    chip: "bg-orange-100 text-orange-900",
    ring: "ring-orange-200",
    text: "text-orange-900",
    filterOn: "data-[on=true]:border-orange-600 data-[on=true]:bg-orange-600 data-[on=true]:text-white",
    bar: "bg-orange-500",
    glow: "from-orange-50 via-white to-rose-50/40",
    fromHex: "#F97316",
    toHex: "#E11D48",
    barHex: "#EA580C",
  },
};

/** Remaining builder beats, in classroom language, after the activity is chosen. */
export function activityBuilderPath(id: ItemActivityId): string[] {
  switch (id) {
    case "program-build":
      return [
        "Place Robo and the goal on the board",
        "Leave the strip empty, or add Bags later",
        "Set attempts, then play it like a student",
      ];
    case "program-edit":
      return [
        "Set up the board they will debug on",
        "Build the starter program (with the mistake)",
        "Preview: students fix it, then RUN",
      ];
    case "program-blanks":
      return [
        "Set up the board",
        "Build the sequence and leave the blank slots",
        "Preview the fill-in-the-blank strip",
      ];
    case "program-number-line":
      return [
        "Tune the number line and start tick",
        "Students only need forward and back",
        "Preview the landing target",
      ];
    case "predict-flag":
      return [
        "Set the board and the program they watch",
        "Students tap where Robo will finish",
        "Preview the flag task",
      ];
    case "predict-draw":
      return [
        "Draw the shape. Arrows generate under it",
        "Optionally fold those arrows into Repeat or a Chunk",
        "Preview: students see the program and draw",
      ];
    case "shape-trace":
      return [
        "Draw the glowing shape on the board",
        "Choose arrows, Repeat, or Chunks",
        "Preview the trace",
      ];
    case "canvas-build":
      return ["No robot grid. Continue to the yellow strip", "Students build a matching program", "Preview the pattern"];
    case "canvas-blanks":
      return ["No robot grid. Continue to the strip", "Drop arrows into the blank slots", "Preview the pattern blanks"];
    case "canvas-starter":
      return ["No robot grid. Continue to the strip", "Seed a starter they can fix", "Preview the pattern"];
    case "canvas-count":
      return ["No robot grid. Continue to the strip", "Set the count question", "Preview the number answer"];
  }
}
