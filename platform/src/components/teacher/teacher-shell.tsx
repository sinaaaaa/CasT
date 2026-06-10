"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  FileText,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EduSidebarNav, type ClassContextCard } from "@/components/edu/edu-sidebar-nav";
import type { EduNavGroup } from "@/lib/edu-ui";

const teacherNav: EduNavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/teacher/reports", label: "Assessment reports", icon: FileText },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/teacher/introduction", label: "Introduction", icon: Sparkles },
      { href: "/teacher/levels", label: "Items", icon: BookOpen },
    ],
  },
  {
    label: "People & plans",
    items: [
      { href: "/teacher/students", label: "Students", icon: Users },
      { href: "/teacher/classes", label: "Classes & assignments", icon: GraduationCap },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/teacher/ct-constructs", label: "CT constructs", icon: ClipboardList },
      { href: "/teacher/dashboard", label: "Exports", icon: Download },
    ],
  },
];

export function TeacherShell({
  title,
  children,
  userName,
  classContext,
  immersive = false,
}: {
  title: string;
  children: React.ReactNode;
  userName?: string | null;
  classContext?: ClassContextCard | null;
  /** Full-width builder layout — hides page header and content padding */
  immersive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [sidebarClass, setSidebarClass] = useState<ClassContextCard | null>(classContext ?? null);

  useEffect(() => {
    if (classContext) {
      setSidebarClass(classContext);
      return;
    }
    fetch("/api/teacher/classes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { classes?: { id: string; name: string; studentCount?: number }[] } | null) => {
        const first = data?.classes?.[0];
        if (first) {
          setSidebarClass({
            name: first.name,
            studentCount: first.studentCount ?? 0,
            href: `/teacher/classes/${first.id}`,
          });
        }
      })
      .catch(() => {});
  }, [classContext]);

  const navGroups: EduNavGroup[] = [
    ...(isAdmin
      ? [
          {
            label: "Administration",
            items: [
              { href: "/admin/users", label: "User management", icon: Shield },
              { href: "/admin/classes", label: "All classes", icon: Settings },
            ],
          } satisfies EduNavGroup,
        ]
      : []),
    ...teacherNav,
  ];

  return (
    <div className="edu-zone min-h-screen bg-[#F8FAFC]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[18rem] flex-col bg-gradient-to-b from-[#1E1B4B] via-[#312E81] to-[#1E1B4B] shadow-2xl transition-transform duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <Link
            href="/teacher/dashboard"
            className="group flex items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#14B8A6] text-sm font-black text-white shadow-lg shadow-indigo-900/40 transition group-hover:scale-105">
              CT
            </span>
            <div>
              <p className="text-sm font-bold text-white">Learning Intelligence</p>
              <p className="text-xs text-indigo-300">Computational thinking</p>
            </div>
          </Link>
        </div>

        <EduSidebarNav
          groups={navGroups}
          classContext={sidebarClass}
          onNavigate={() => setOpen(false)}
          footer={
            <>
              <p className="truncate px-1 text-xs text-indigo-300">{userName ?? "Teacher"}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start rounded-xl text-indigo-200 hover:bg-white/10 hover:text-white"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </>
          }
        />
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      <div className="lg:pl-[18rem]">
        {immersive ? (
          <div className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 px-4 py-2 backdrop-blur-xl lg:hidden">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl border-slate-200"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        ) : (
          <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-xl border-slate-200 lg:hidden"
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">
                    Teacher workspace
                  </p>
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                    {title}
                  </h1>
                </div>
              </div>
            </div>
          </header>
        )}
        <main
          className={cn(
            immersive ? "min-h-screen" : "mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
