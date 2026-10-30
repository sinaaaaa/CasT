"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, LogOut, Play } from "lucide-react";
import { canOpenStudentItem, heyGreeting, type LevelTaskLabel } from "@/lib/student-ui";
import { SparcActivityTimeline } from "./sparc/sparc-activity-timeline";
import { SparcBackground } from "./sparc/sparc-background";
import { SparcButton } from "./sparc/sparc-button";
import { SparcLevelCard } from "./sparc/sparc-level-card";
import { SparcRobot } from "./sparc/sparc-robot";
import { SiteFooter } from "@/components/site-footer";

type HomeLevel = {
  id: string;
  levelKey: string;
  name: string;
  levelNumber: number;
  taskLabel: LevelTaskLabel;
  difficultyLabel: string;
  difficulty: number;
  status: "completed" | "in_progress" | "new";
  score: number | null;
  queuedForReplay?: boolean;
};

type HomeData = {
  student: { displayName: string; studentCode: string };
  stats: {
    levelsCompleted: number;
    totalLevels: number;
    remainingLevels: number;
    completionPercent: number;
  };
  levels: HomeLevel[];
  activity: {
    id: string;
    levelName: string;
    passed: boolean;
    score: number | null;
    endedAt: string | null;
  }[];
  nextLevel: HomeLevel | null;
};

function playHref(levelKey?: string | null) {
  return levelKey ? `/play?item=${encodeURIComponent(levelKey)}` : "/play";
}

export function StudentDashboardHome() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function loadHome(isRefresh = false) {
      if (!isRefresh) setLoading(true);
      fetch("/api/student/home", { cache: "no-store" })
        .then(async (res) => {
          if (res.status === 401) {
            router.replace("/student/login?next=/student/home");
            return null;
          }
          if (!res.ok) throw new Error("Failed to load");
          return res.json() as Promise<HomeData>;
        })
        .then((d) => {
          if (cancelled || !d) return;
          setData(d);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load your dashboard.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    loadHome();
    const onVisible = () => {
      if (document.visibilityState === "visible") loadHome(true);
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/student/logout", { method: "POST" });
    router.push("/student");
  }

  const groups = useMemo(() => {
    if (!data) {
      return {
        playNext: [] as HomeLevel[],
        tryAgain: [] as HomeLevel[],
        keepGoing: [] as HomeLevel[],
        stillToPlay: [] as HomeLevel[],
        alreadyPlayed: [] as HomeLevel[],
      };
    }
    const nextId = data.nextLevel?.id;
    const used = new Set<string>();
    const take = (pred: (level: HomeLevel) => boolean) => {
      const rows = data.levels.filter((level) => !used.has(level.id) && pred(level));
      rows.forEach((level) => used.add(level.id));
      return rows;
    };

    return {
      playNext: take((level) => level.id === nextId),
      tryAgain: take((level) => Boolean(level.queuedForReplay)),
      keepGoing: take((level) => level.status === "in_progress"),
      stillToPlay: take((level) => level.status === "new"),
      alreadyPlayed: take((level) => level.status === "completed"),
    };
  }, [data]);

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
        <p className="text-lg font-semibold text-stone-700">{error ?? "Something went wrong."}</p>
        <SparcButton onClick={() => router.push("/student/login")}>Sign in again</SparcButton>
      </div>
    );
  }

  const greeting = heyGreeting(data.student.displayName);
  const nextKey = data.nextLevel?.levelKey ?? groups.playNext[0]?.levelKey;
  const nextName = data.nextLevel?.name ?? groups.playNext[0]?.name ?? "the current item";
  const lockHint = `Finish ${nextName} first. Then this one opens.`;
  const finished = data.stats.levelsCompleted;
  const total = data.stats.totalLevels;
  const percent = Math.max(0, Math.min(100, data.stats.completionPercent));

  function openLevel(level: HomeLevel) {
    const open = canOpenStudentItem({
      status: level.status,
      queuedForReplay: level.queuedForReplay,
      isNext: level.levelKey === nextKey,
    });
    if (!open) {
      setLockNotice(lockHint);
      return;
    }
    setLockNotice(null);
    router.push(playHref(level.levelKey));
  }

  function renderGroup(
    title: string,
    subtitle: string,
    levels: HomeLevel[],
    options: { highlight?: boolean; locked?: boolean; compact?: boolean } = {}
  ) {
    if (levels.length === 0) return null;
    return (
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-stone-800 sm:text-2xl">{title}</h2>
            <p className="text-stone-500">{subtitle}</p>
          </div>
          {options.compact && levels.length > 4 && (
            <p className="text-sm font-semibold text-stone-400">{levels.length} items</p>
          )}
        </div>
        <div
          className={
            options.compact
              ? "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {levels.map((level, i) => (
            <SparcLevelCard
              key={level.id}
              {...level}
              index={i}
              size={options.compact ? "compact" : "default"}
              highlight={Boolean(options.highlight) && i === 0}
              locked={options.locked}
              lockHint={options.locked ? lockHint : undefined}
              onClick={() => openLevel(level)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="student-zone relative min-h-screen pb-16">
      <SparcBackground variant="dashboard" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/student" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-xs font-black text-white">
            L
          </div>
          <span className="text-lg font-extrabold text-stone-800">Little Logic Adventure</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-500 sm:inline">
            ID {data.student.studentCode}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-white/70"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border-2 border-white bg-gradient-to-br from-[#0F766E] via-[#0D9488] to-[#4338CA] p-6 text-white shadow-xl shadow-teal-300/25 sm:p-8"
        >
          <div className="lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div className="flex-1">
              <p className="text-lg font-medium text-white/90">{greeting}</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
                {data.nextLevel ? "Ready for your next robot challenge?" : "You finished every item"}
              </h1>
              {data.nextLevel ? (
                <p className="mt-3 text-white/90">
                  Play next: <span className="font-bold text-white">{data.nextLevel.name}</span>
                  <span className="text-white/80"> · {data.nextLevel.taskLabel}</span>
                </p>
              ) : (
                <p className="mt-3 text-white/90">You can replay any finished item below.</p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <SparcButton
                  size="xl"
                  variant="secondary"
                  className="border-0 bg-white text-stone-800 hover:bg-stone-50"
                  onClick={() =>
                    router.push(playHref(nextKey ?? groups.alreadyPlayed[0]?.levelKey))
                  }
                >
                  <Play className="h-6 w-6" />
                  {data.nextLevel ? `Play ${data.nextLevel.name}` : "Play again"}
                </SparcButton>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-5 lg:mt-0">
              <div className="min-w-[10.5rem] rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Progress</p>
                <p className="mt-1 text-lg font-extrabold">
                  {finished} of {total} finished
                </p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-white/80">
                  {data.stats.remainingLevels === 0
                    ? "All done"
                    : `${data.stats.remainingLevels} left`}
                </p>
              </div>
              <div className="hidden shrink-0 sm:block">
                <SparcRobot size="md" />
              </div>
            </div>
          </div>
        </motion.section>

        {lockNotice && (
          <p
            className="fixed bottom-4 left-1/2 z-40 flex w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg"
            role="status"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {lockNotice}
          </p>
        )}

        {groups.playNext.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-extrabold text-stone-800 sm:text-2xl">Play next</h2>
              <p className="text-stone-500">
                {groups.playNext[0].status === "in_progress"
                  ? "Finish this item. The next one opens after you get it right."
                  : "This is the item waiting for you right now."}
              </p>
            </div>
            <div className="max-w-sm">
              <SparcLevelCard
                {...groups.playNext[0]}
                index={0}
                highlight
                onClick={() => openLevel(groups.playNext[0])}
              />
            </div>
          </section>
        )}

        {renderGroup(
          "Try this again",
          "Your teacher asked you to replay these.",
          groups.tryAgain
        )}
        {renderGroup(
          "Keep going",
          "You started these. Open one to pick up where you left off.",
          groups.keepGoing
        )}
        {renderGroup(
          "Coming up",
          `These stay locked until you finish ${nextName}.`,
          groups.stillToPlay,
          { locked: true, compact: true }
        )}
        {renderGroup(
          "Already played",
          "Tap one to load that item again.",
          groups.alreadyPlayed,
          { compact: true }
        )}

        {data.levels.length === 0 && (
          <section className="rounded-3xl border-2 border-dashed border-stone-200 bg-white p-10 text-center text-stone-500">
            Nothing assigned yet. Ask your teacher to add you to a class and give you items to play.
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-extrabold text-stone-800 sm:text-2xl">Recent activity</h2>
          <SparcActivityTimeline items={data.activity} />
        </section>
      </main>
      <SiteFooter className="relative z-10" />
    </div>
  );
}
