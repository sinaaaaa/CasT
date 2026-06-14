"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { StudentGameConfig } from "@/lib/student-session";
import { LandscapeRequiredOverlay } from "@/components/student/landscape-required-overlay";

declare global {
  interface Window {
    StudentGameConfig?: StudentGameConfig;
  }
}

type Props = {
  config: StudentGameConfig;
  unityGameUrl: string;
  displayName: string;
  homeHref?: string;
};

function buildUnityUrl(baseUrl: string, config: StudentGameConfig): string {
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set("studentId", config.studentId);
  url.searchParams.set("studentCode", config.studentCode);
  url.searchParams.set("token", config.sessionToken);
  url.searchParams.set("apiBaseUrl", config.apiBaseUrl);
  if (config.gameApiKey) {
    url.searchParams.set("gameApiKey", config.gameApiKey);
  }
  return url.pathname + url.search;
}

export function StudentPlayClient({
  config,
  unityGameUrl,
  displayName,
  homeHref = "/student/home",
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [iframeSrc, setIframeSrc] = useState(unityGameUrl);

  useEffect(() => {
    window.StudentGameConfig = config;
    setIframeSrc(buildUnityUrl(unityGameUrl, config));

    fetch(unityGameUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setStatus("ready");
        else setStatus("missing");
      })
      .catch(() => setStatus("missing"));
  }, [config, unityGameUrl]);

  return (
    <div className="student-zone flex min-h-screen flex-col bg-slate-950 text-white">
      <LandscapeRequiredOverlay />
      <header className="flex shrink-0 items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#312E81] to-[#1E1B4B] px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-indigo-100 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4F46E5] text-xs font-black">
              L
            </div>
            <span className="font-bold text-white">Little Logic Adventure</span>
          </div>
        </div>
        <p className="truncate text-sm text-indigo-200">
          <span className="text-white">{displayName}</span>
        </p>
      </header>

      <div className="relative flex flex-1 flex-col">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
            <p className="text-slate-300">Loading game…</p>
          </div>
        )}

        {status === "missing" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4F46E5] text-2xl font-black">
              L
            </div>
            <h2 className="text-xl font-bold">Unity WebGL build not found</h2>
            <p className="max-w-md text-sm text-slate-400">
              Export your Unity project as WebGL and copy the build to{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">platform/public/unity/</code>.
              Your student session is ready — the game will receive your Student ID automatically.
            </p>
            <pre className="max-w-lg overflow-x-auto rounded-xl bg-slate-900 p-4 text-left text-xs text-slate-300">
              {JSON.stringify(
                {
                  studentCode: config.studentCode,
                  apiBaseUrl: config.apiBaseUrl,
                },
                null,
                2
              )}
            </pre>
            <Link
              href={homeHref}
              className="rounded-2xl bg-white px-6 py-3 font-semibold text-indigo-900 hover:bg-indigo-50"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Robot Coding Game"
            className="h-[calc(100vh-57px)] w-full flex-1 border-0 bg-black"
            allow="autoplay; fullscreen"
          />
        )}
      </div>

    </div>
  );
}
