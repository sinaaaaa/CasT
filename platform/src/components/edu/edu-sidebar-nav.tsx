"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EduNavGroup } from "@/lib/edu-ui";

export type ClassContextCard = {
  name: string;
  studentCount: number;
  activeToday?: number;
  href?: string;
};

export function EduSidebarNav({
  groups,
  classContext,
  footer,
  onNavigate,
}: {
  groups: EduNavGroup[];
  classContext?: ClassContextCard | null;
  footer?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {classContext && (
        <div className="border-b border-white/10 px-4 py-4">
          <Link
            href={classContext.href ?? "/teacher/classes"}
            onClick={onNavigate}
            className="group block rounded-2xl bg-gradient-to-br from-[#4F46E5]/20 to-[#14B8A6]/15 p-4 ring-1 ring-white/10 transition hover:from-[#4F46E5]/30 hover:ring-[#4F46E5]/30"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/30">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{classContext.name}</p>
                <p className="mt-0.5 text-xs text-indigo-200">
                  {classContext.studentCount} student{classContext.studentCount === 1 ? "" : "s"}
                  {classContext.activeToday != null && classContext.activeToday > 0 && (
                    <span className="text-teal-300">
                      {" "}
                      · {classContext.activeToday} active today
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-indigo-300 opacity-0 transition group-hover:opacity-100" />
            </div>
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/70">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-white/15 text-white shadow-lg shadow-indigo-900/20 ring-1 ring-white/20"
                          : "text-indigo-100/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="edu-nav-glow"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#4F46E5]/40 to-[#7C3AED]/30"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon className="relative h-[1.125rem] w-[1.125rem] shrink-0" />
                      <span className="relative flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="relative rounded-full bg-[#14B8A6]/25 px-2 py-0.5 text-[10px] font-bold text-teal-200">
                          {item.badge}
                        </span>
                      )}
                      {active && (
                        <ChevronRight className="relative h-3.5 w-3.5 opacity-60" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-t border-white/10 p-4">{footer}</div>
      )}
    </div>
  );
}
