"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  LogOut,
  Play,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import type { LevelTaskLabel } from "@/lib/student-ui";
import { SparcActivityTimeline } from "./sparc/sparc-activity-timeline";
import { SparcBackground } from "./sparc/sparc-background";
import { SparcButton } from "./sparc/sparc-button";
import { SparcLevelCard } from "./sparc/sparc-level-card";
import { SparcProgressRing, SparcStatCard } from "./sparc/sparc-stat-card";
import { SparcRobot } from "./sparc/sparc-robot";

type HomeData = {
  student: { displayName: string; studentCode: string };
  stats: {
    levelsCompleted: number;
    currentStreak: number;
    starsEarned: number;
    challengesSolved: number;
    completionPercent: number;
  };
  levels: {
    id: string;
    name: string;
    levelNumber: number;
    taskLabel: LevelTaskLabel;
    difficultyLabel: string;
    difficulty: number;
    status: "completed" | "in_progress" | "new";
    score: number | null;
  }[];
  activity: {
    id: string;
    levelName: string;
    passed: boolean;
    score: number | null;
    endedAt: string | null;
  }[];
  nextLevel: { name: string } | null;
};

export function StudentDashboardHome() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/home")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/student/login?next=/student/home");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<HomeData>;
      })
      .then((d) => setData(d))
      .catch(() => setError("Could not load your dashboard."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/student/logout", { method: "POST" });
    router.push("/student");
  }

  if (loading) {
    return (
      <div className="student-zone flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <SparcRobot size="md" />
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="student-zone flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] p-6 text-center">
        <p className="text-lg font-semibold text-slate-700">{error ?? "Something went wrong."}</p>
        <SparcButton onClick={() => router.push("/student/login")}>Sign in again</SparcButton>
      </div>
    );
  }

  const firstName = data.student.displayName.split(" ")[0];

  return (
    <div className="student-zone relative min-h-screen pb-16">
      <SparcBackground variant="dashboard" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/student" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-xs font-black text-white">
            L
          </div>
          <span className="text-lg font-extrabold text-indigo-900">Little Logic Adventure</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white/70"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-10 px-4 sm:px-6">
        {/* Welcome hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border-2 border-white bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#7C3AED] p-6 text-white shadow-xl shadow-indigo-300/40 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8"
        >
          <div className="flex-1">
            <p className="text-lg font-medium text-indigo-100">Hi {firstName} 👋</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
              Ready for your next robot challenge?
            </h1>
            {data.nextLevel && (
              <p className="mt-3 text-indigo-100">
                Up next: <span className="font-bold text-white">{data.nextLevel.name}</span>
              </p>
            )}
            <div className="mt-6">
              <SparcButton
                size="xl"
                variant="secondary"
                className="border-0 bg-white text-[#4F46E5] hover:bg-indigo-50"
                onClick={() => router.push("/play")}
              >
                <Play className="h-6 w-6" />
                Play Now
              </SparcButton>
            </div>
          </div>
          <div className="mt-6 hidden shrink-0 lg:mt-0 lg:block">
            <SparcRobot size="md" />
          </div>
        </motion.section>

        {/* Stats */}
        <section>
          <h2 className="mb-4 text-xl font-extrabold text-slate-900 sm:text-2xl">Your progress</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
            <div className="col-span-2 flex items-center justify-center rounded-3xl border-2 border-white bg-white p-6 shadow-md lg:col-span-1">
              <SparcProgressRing
                percent={data.stats.completionPercent}
                label="Journey"
              />
            </div>
            <SparcStatCard
              icon={Trophy}
              label="Levels Completed"
              value={data.stats.levelsCompleted}
              accent="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]"
              index={0}
            />
            <SparcStatCard
              icon={Flame}
              label="Current Streak"
              value={data.stats.currentStreak}
              suffix={data.stats.currentStreak === 1 ? " day" : " days"}
              accent="bg-gradient-to-br from-amber-400 to-orange-500"
              index={1}
            />
            <SparcStatCard
              icon={Star}
              label="Stars Earned"
              value={data.stats.starsEarned}
              accent="bg-gradient-to-br from-yellow-400 to-amber-500"
              index={2}
            />
            <SparcStatCard
              icon={Target}
              label="Challenges Solved"
              value={data.stats.challengesSolved}
              accent="bg-gradient-to-br from-[#14B8A6] to-emerald-500"
              index={3}
            />
          </div>
        </section>

        {/* Levels grid */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Your levels</h2>
              <p className="text-slate-600">Pick a challenge and help your robot succeed!</p>
            </div>
            <SparcButton size="md" onClick={() => router.push("/play")}>
              <Play className="h-5 w-5" />
              Play
            </SparcButton>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.levels.map((level, i) => (
              <SparcLevelCard
                key={level.id}
                {...level}
                index={i}
                onClick={() => router.push("/play")}
              />
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="mb-4 text-xl font-extrabold text-slate-900 sm:text-2xl">Recent activity</h2>
          <SparcActivityTimeline items={data.activity} />
        </section>
      </main>
    </div>
  );
}
