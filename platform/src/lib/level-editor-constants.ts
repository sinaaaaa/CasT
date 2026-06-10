/** Shared options for the visual level designer (no JSON required for teachers). */

export const GRID_COLS = 6;
export const GRID_ROWS = 6;

export const NUMBER_LINE_MIN_TICKS = 3;
export const NUMBER_LINE_MAX_TICKS = 20;
export const NUMBER_LINE_DEFAULT_TICKS = 9;
export const NUMBER_LINE_DEFAULT_LINE_ROW = 2;

export const PLACEMENT_OPTIONS = [
  { value: "below", label: "Below line" },
  { value: "onLine", label: "On line (marker)" },
  { value: "above", label: "Above line" },
] as const;

export type PlacementOption = (typeof PLACEMENT_OPTIONS)[number]["value"];

export const OBJECT_TYPES = [
  "newspaper",
  "bin",
  "apple",
  "box",
  "amazon-box",
  "banana",
  "recycle",
  "bed",
  "chair",
  "vacuum",
  "bag",
  "book",
  "scissors",
  "crayon",
  "crayon-box",
  "crayons",
  "black-crayon",
  "mail",
  "package",
  "school",
  "tree",
  "glue",
  "home",
  "pencil",
  "post",
  "block",
  "outlet",
  "backpack",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

/** Short labels + emoji for the drag-and-drop palette (maps to Unity objectType). */
export const OBJECT_PALETTE: { type: ObjectType; label: string; icon: string }[] = [
  { type: "newspaper", label: "Newspaper", icon: "📰" },
  { type: "bin", label: "Bin", icon: "🗑️" },
  { type: "apple", label: "Apple", icon: "🍎" },
  { type: "box", label: "Box", icon: "📦" },
  { type: "amazon-box", label: "Amazon box", icon: "🟧" },
  { type: "banana", label: "Banana", icon: "🍌" },
  { type: "recycle", label: "Recycle", icon: "♻️" },
  { type: "bed", label: "Bed", icon: "🛏️" },
  { type: "chair", label: "Chair", icon: "🪑" },
  { type: "vacuum", label: "Vacuum", icon: "🧹" },
  { type: "bag", label: "Bag", icon: "👜" },
  { type: "book", label: "Book", icon: "📚" },
  { type: "scissors", label: "Scissors", icon: "✂️" },
  { type: "crayon", label: "Crayon", icon: "🖤" },
  { type: "crayon-box", label: "Crayon box", icon: "🖍️" },
  { type: "mail", label: "Mail", icon: "✉️" },
  { type: "package", label: "Package", icon: "📫" },
  { type: "school", label: "School", icon: "🏫" },
  { type: "tree", label: "Tree", icon: "🌳" },
  { type: "glue", label: "Glue", icon: "🧴" },
  { type: "home", label: "Home", icon: "🏠" },
  { type: "pencil", label: "Pencil", icon: "✏️" },
  { type: "post", label: "Post", icon: "📮" },
  { type: "block", label: "Block (wall)", icon: "🧱" },
  { type: "outlet", label: "Outlet", icon: "🔌" },
  { type: "backpack", label: "Backpack", icon: "🎒" },
];

export const NUMBER_LINE_FACING_OPTIONS = [
  { value: { x: -1, y: 0 }, label: "Left ←" },
  { value: { x: 1, y: 0 }, label: "Right →" },
] as const;

export const DND_MIME = "application/x-sparc-level-editor";

/** True when goalCell is set (Unity uses x,y >= 0). */
export function isGoalCellSet(cell?: { x: number; y: number } | null): boolean {
  return cell != null && cell.x >= 0 && cell.y >= 0;
}

export const GUIDED_ACTIONS = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "turn left", label: "Turn left" },
  { value: "turn right", label: "Turn right" },
  { value: "blank", label: "Blank (student chooses)" },
] as const;

export const INTRO_ACTIONS = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "turn left", label: "Turn left" },
  { value: "turn right", label: "Turn right" },
] as const;

export const FACING_OPTIONS = [
  { value: { x: 0, y: 1 }, label: "Up ↑" },
  { value: { x: 1, y: 0 }, label: "Right →" },
  { value: { x: 0, y: -1 }, label: "Down ↓" },
  { value: { x: -1, y: 0 }, label: "Left ←" },
] as const;

export const OBJECT_COLORS: Record<string, string> = {
  newspaper: "bg-amber-100 border-amber-400 text-amber-900",
  bin: "bg-slate-200 border-slate-500 text-slate-900",
  apple: "bg-red-100 border-red-400 text-red-900",
  box: "bg-orange-100 border-orange-400 text-orange-900",
  "amazon-box": "bg-amber-100 border-amber-500 text-amber-950",
  banana: "bg-yellow-100 border-yellow-500 text-yellow-900",
  recycle: "bg-green-100 border-green-500 text-green-900",
  bed: "bg-purple-100 border-purple-400 text-purple-900",
  scissors: "bg-cyan-100 border-cyan-500 text-cyan-900",
  crayon: "bg-slate-300 border-slate-600 text-slate-950",
  "crayon-box": "bg-pink-100 border-pink-400 text-pink-900",
  crayons: "bg-pink-100 border-pink-400 text-pink-900",
  "black-crayon": "bg-slate-300 border-slate-600 text-slate-950",
  home: "bg-rose-100 border-rose-400 text-rose-900",
  block: "bg-stone-200 border-stone-600 text-stone-900",
  outlet: "bg-yellow-100 border-yellow-500 text-yellow-900",
  backpack: "bg-orange-100 border-orange-500 text-orange-900",
  default: "bg-blue-50 border-blue-300 text-blue-900",
};

export function objectCellClass(objectType: string): string {
  return OBJECT_COLORS[objectType] ?? OBJECT_COLORS.default;
}
