"use client";

import dynamic from "next/dynamic";

const ClassesAdminPanel = dynamic(
  () =>
    import("@/components/admin/classes-admin-panel").then((mod) => ({
      default: mod.ClassesAdminPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading class management…</p>
    ),
  }
);

export function ClassesAdminPanelLoader() {
  return <ClassesAdminPanel />;
}
