"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Maximize2, Minimize2 } from "lucide-react";
import type { StudentGameConfig } from "@/lib/student-session";

declare global {
  interface Window {
    StudentGameConfig?: StudentGameConfig;
  }

  interface Document {
    webkitFullscreenElement?: Element | null;
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
  if (config.gameApiKey) {
    url.searchParams.set("gameApiKey", config.gameApiKey);
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
    const shell = gameShellRef.current;
    if (!shell) return;

    try {
      if (isDocumentFullscreen()) {
        await document.exitFullscreen();
        return;
      }

      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (shell.webkitRequestFullscreen) {
        await shell.webkitRequestFullscreen();
      }
    } catch {
      // Some mobile browsers block fullscreen inside iframes — game still fills the viewport.
    }
  }, []);

  const controlButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-900/90";

  return (
    <div className="student-zone min-h-dvh bg-black text-white">
      <div ref={gameShellRef} className="relative flex min-h-dvh flex-col bg-black">
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
            <Link href={homeHref} className={`${controlButtonClass} pointer-events-auto`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`${controlButtonClass} pointer-events-auto`}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Exit full screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Full screen</span>
                </>
              )}
            </button>
          </div>
        )}

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
            className="min-h-dvh w-full flex-1 border-0 bg-black"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
