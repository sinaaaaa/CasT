/** Educational intelligence platform — teacher/admin design tokens */
export const EDU = {
  primary: "#4F46E5",
  purple: "#7C3AED",
  teal: "#14B8A6",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  background: "#F8FAFC",
} as const;

export type EduNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export type EduNavGroup = {
  label: string;
  items: EduNavItem[];
};
