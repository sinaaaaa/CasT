"use client";

import dynamic from "next/dynamic";

const UsersAdminPanel = dynamic(
  () =>
    import("@/components/admin/users-admin-panel").then((mod) => ({
      default: mod.UsersAdminPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading user management…</p>
    ),
  }
);

export function UsersAdminPanelLoader() {
  return <UsersAdminPanel />;
}
