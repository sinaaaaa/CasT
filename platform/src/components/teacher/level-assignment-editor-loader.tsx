"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const LevelAssignmentEditor = dynamic(
  () =>
    import("@/components/teacher/level-assignment-editor").then((mod) => ({
      default: mod.LevelAssignmentEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-100">
        <div className="border-b border-stone-100 bg-[#F7F4EE] px-6 py-5">
          <div className="h-5 w-36 animate-pulse rounded bg-stone-200/80" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-stone-200/60" />
        </div>
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading playlist…
        </div>
      </div>
    ),
  }
);

type Props =
  | { target: "student"; targetId: string; targetName: string }
  | { target: "class"; targetId: string; targetName: string };

export function LevelAssignmentEditorLoader(props: Props) {
  return <LevelAssignmentEditor {...props} />;
}
