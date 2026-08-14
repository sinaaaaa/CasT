"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Maximize2, Minimize2 } from "lucide-react";
import type { StudentGameConfig } from "@/lib/student-session";
import { LandscapeRequiredOverlay } from "@/components/student/landscape-required-overlay";
import { InstallPlayAppPrompt } from "@/components/student/install-play-app-prompt";

declare global {
  interface Window {
    StudentGameConfig?: StudentGameConfig;
  }

  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
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
  url.searchParams.set("v", "frame-chrome-1");
  if (config.gameApiKey) {
    url.searchParams.set("gameApiKey", config.gameApiKey);
  }
  if (config.resumeLevelKey) {
    url.searchParams.set("resumeLevelKey", config.resumeLevelKey);
  }
  if (config.resumeSlot != null && config.resumeSlot > 0) {
    url.searchParams.set("resumeSlot", String(config.resumeSlot));
  }
  return url.pathname + url.search;
}

function isDocumentFullscreen(): boolean {
  return !!(document.fullscreenElement ?? document.webkitFullscreenElement);
}

export function StudentPlayClient({
  config,
  unityGameUrl,
  homeHref = "/student/home",
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gameShellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [iframeSrc, setIframeSrc] = useState(unityGameUrl);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(isDocumentFullscreen());
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;

    try {
      if (isDocumentFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        return;
      }

      const target = frame as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (target.requestFullscreen) await target.requestFullscreen();
      else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      else if (gameShellRef.current?.requestFullscreen) await gameShellRef.current.requestFullscreen();
    } catch {
      // Fullscreen API is limited on some browsers; the framed layout still works.
    }
  }, []);

  const controlButtonClass =
    "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-slate-950/80 text-white shadow-lg backdrop-blur transition hover:bg-slate-900/95 sm:h-10 sm:w-10";

  return (
    <div className="student-zone min-h-dvh bg-black text-white">
      <LandscapeRequiredOverlay />
      <InstallPlayAppPrompt gameReady={status === "ready"} />
      <div
        ref={gameShellRef}
        className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black p-3 sm:p-5"
      >
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
            <p className="text-slate-300">Loading game…</p>
          </div>
        )}

        {status === "missing" ? (
          <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
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
                  resumeSlot: config.resumeSlot,
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
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl shadow-black/70 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:max-h-none [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
            style={{
              width: "min(92vw, calc(88dvh * 16 / 9))",
              maxWidth: "1400px",
              aspectRatio: "16 / 9",
            }}
          >
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Robot Coding Game"
              className="absolute inset-0 block h-full w-full border-0 bg-black"
              allow="autoplay; fullscreen"
              allowFullScreen
            />

            {status === "ready" && (
              <>
                <Link
                  href={homeHref}
                  className={`${controlButtonClass} absolute left-2 top-2 z-30 sm:left-3 sm:top-3`}
                  aria-label="Back to home"
                  title="Home"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`${controlButtonClass} absolute right-2 top-2 z-30 sm:right-3 sm:top-3`}
                  aria-pressed={isFullscreen}
                  aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                  title={isFullscreen ? "Exit full screen" : "Full screen"}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
