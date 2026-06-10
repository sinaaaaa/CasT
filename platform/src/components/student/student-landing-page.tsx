"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, X } from "lucide-react";
import { FEATURE_CARDS, HOW_IT_WORKS_STEPS } from "@/lib/student-ui";
import { SparcBackground } from "./sparc/sparc-background";
import { SparcButton } from "./sparc/sparc-button";
import { SparcFeatureCard } from "./sparc/sparc-feature-card";
import { SparcRobot } from "./sparc/sparc-robot";

type StudentMe = { displayName: string; studentCode: string };

export function StudentLandingPage() {
  const router = useRouter();
  const howItWorksRef = useRef<HTMLElement>(null);
  const [me, setMe] = useState<StudentMe | null>(null);
  const [checking, setChecking] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    fetch("/api/student/me")
      .then(async (res) => (res.ok ? res.json() : null))
      .then(setMe)
      .finally(() => setChecking(false));
  }, []);

  function scrollToHowItWorks() {
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleStartPlaying() {
    if (me) router.push("/student/home");
    else router.push("/student/login");
  }

  return (
    <div className="student-zone relative min-h-screen overflow-x-hidden">
      <SparcBackground variant="hero" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-black text-white shadow-md">
            L
          </div>
          <span className="text-xl font-extrabold tracking-tight text-indigo-900">Little Logic Adventure</span>
        </div>
        <Link
          href="/login"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-white/60"
        >
          Teacher sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:pb-24 lg:pt-8">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="order-2 text-center lg:order-1 lg:text-left"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-[#14B8A6]" />
            Computational Thinking Adventures
          </motion.div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-[#4F46E5] to-[#14B8A6] bg-clip-text text-transparent">
              Little Logic Adventure
            </span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 sm:text-xl">
            Learn, explore, and solve robot challenges.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <SparcButton size="xl" onClick={handleStartPlaying} disabled={checking}>
              <Play className="h-6 w-6" />
              {checking ? "Loading…" : me ? "Continue Playing" : "Start Playing"}
            </SparcButton>
            <SparcButton size="xl" variant="secondary" onClick={scrollToHowItWorks}>
              How It Works
            </SparcButton>
          </div>

          {me && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-base font-medium text-indigo-700"
            >
              Welcome back, {me.displayName}! 👋
            </motion.p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="order-1 flex justify-center lg:order-2"
        >
          <SparcRobot size="xl" />
        </motion.div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl"
        >
          What you&apos;ll do
        </motion.h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((card, i) => (
            <SparcFeatureCard key={card.title} {...card} index={i} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        ref={howItWorksRef}
        id="how-it-works"
        className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16"
      >
        <div className="rounded-[2rem] border-2 border-indigo-100 bg-white/90 p-8 shadow-xl shadow-indigo-100/50 sm:p-10">
          <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <motion.li
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-lg font-black text-white shadow-md">
                  {step.step}
                </div>
                <h3 className="font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </motion.li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <SparcButton size="lg" onClick={() => router.push("/student/login")}>
              Get your Student ID ready — Let&apos;s go!
            </SparcButton>
          </div>
        </div>
      </section>

      {/* Mobile how-it-works modal trigger area */}
      <AnimatePresence>
        {showHowItWorks && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setShowHowItWorks(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">How It Works</h3>
                <button type="button" onClick={() => setShowHowItWorks(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="space-y-4">
                {HOW_IT_WORKS_STEPS.map((s) => (
                  <li key={s.step} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                      {s.step}
                    </span>
                    <div>
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-slate-600">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-10 py-10 text-center text-sm text-slate-500">
        Little Logic Adventure · Robot Coding for curious minds
      </footer>
    </div>
  );
}
