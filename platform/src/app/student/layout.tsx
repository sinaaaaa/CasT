import type { ReactNode } from "react";

/** Shared wrapper for public student experience pages */
export default function StudentZoneLayout({ children }: { children: ReactNode }) {
  return (
    <div className="student-zone min-h-screen antialiased">{children}</div>
  );
}
