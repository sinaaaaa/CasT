"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EduSidebarNav } from "@/components/edu/edu-sidebar-nav";
import type { EduNavGroup } from "@/lib/edu-ui";

const adminNav: EduNavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/classes", label: "Classes", icon: BookOpen },
    ],
  },
  {
    label: "Teaching",
    items: [
      { href: "/teacher/dashboard", label: "Teacher dashboard", icon: LayoutDashboard },
      { href: "/teacher/students", label: "Students hub", icon: GraduationCap },
    ],
  },
];

export function AdminShell({
  title,
  children,
  userName,
}: {
  title: string;
  children: React.ReactNode;
  userName?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="edu-zone min-h-screen bg-[#F8FAFC]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[18rem] flex-col bg-gradient-to-b from-[#1E1B4B] via-[#312E81] to-[#1E1B4B] shadow-2xl transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white ring-2 ring-[#4F46E5]/50">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Administration</p>
              <p className="text-sm font-bold text-white">Platform control</p>
            </div>
          </div>
        </div>

        <EduSidebarNav
          groups={adminNav}
          onNavigate={() => setOpen(false)}
          footer={
            <>
              {userName && (
                <p className="truncate px-1 text-xs text-indigo-300">{userName}</p>
              )}
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
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl lg:hidden"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Admin</p>
                <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">{title}</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
