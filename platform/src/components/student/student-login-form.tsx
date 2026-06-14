"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play } from "lucide-react";
import { SparcBackground } from "./sparc/sparc-background";
import { SparcButton } from "./sparc/sparc-button";
import { SparcRobot } from "./sparc/sparc-robot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StudentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/student/home";

  const [studentCode, setStudentCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentCode: studentCode.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.push(next);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="student-zone relative flex min-h-screen flex-col">
      <SparcBackground variant="login" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:px-6">
        <Link
          href="/student"
          className="mb-4 inline-flex items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-white/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-1 flex-col justify-center pb-10"
        >
          <div className="mb-6 flex justify-center">
            <SparcRobot size="md" waving />
          </div>

          <div className="rounded-[2rem] border-2 border-white bg-white/95 p-8 shadow-2xl shadow-indigo-200/40 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-extrabold text-slate-900">Let&apos;s Get Started!</h1>
              <p className="mt-2 text-lg text-slate-600">Enter your Student ID</p>
              {next === "/play" ? (
                <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800">
                  Sign in to open the robot coding game.
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">
                  Your teacher gave you a Student ID.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="studentCode" className="text-base font-bold text-slate-800">
                  Student ID
                </Label>
                <Input
                  id="studentCode"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="e.g. S1234"
                  autoComplete="username"
                  autoFocus
                  inputMode="text"
                  className="h-16 rounded-2xl border-2 border-indigo-100 bg-white text-xl font-semibold tracking-wide focus-visible:border-[#4F46E5] focus-visible:ring-[#4F46E5]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm font-semibold text-slate-700">
                  Nickname <span className="font-normal text-slate-400">(optional, first time only)</span>
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  className="h-14 rounded-2xl border-2 border-indigo-100 text-lg"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <SparcButton
                type="submit"
                size="xl"
                className="w-full"
                disabled={loading || !studentCode.trim()}
              >
                <Play className="h-6 w-6" />
                {loading ? "One moment…" : "Play"}
              </SparcButton>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
