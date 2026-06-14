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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading assignments…
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
