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
  url.searchParams.set("v", "wasm-no-transform-1");
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

/** iOS Safari (and some Android WebViews) have no usable Fullscreen API for div/iframe. */
function canUseNativeFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

/** Prefer CSS immersive on iOS — requestFullscreen is missing or a no-op there. */
function prefersCssImmersiveFullscreen(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel with touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

function setBodyImmersiveLock(locked: boolean) {
  const html = document.documentElement;
  const body = document.body;
  if (locked) {
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
  } else {
    html.style.overflow = "";
    body.style.overflow = "";
    body.style.touchAction = "";
    body.style.overscrollBehavior = "";
  }
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
  /** Native Fullscreen API (desktop / Android Chrome). */
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  /** CSS immersive mode — works on iOS where Fullscreen API does not. */
  const [isImmersive, setIsImmersive] = useState(false);

  const isFullscreen = isNativeFullscreen || isImmersive;

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
    const syncFullscreen = () => {
      const native = isDocumentFullscreen();
      setIsNativeFullscreen(native);
      if (native) setIsImmersive(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  useEffect(() => {
    setBodyImmersiveLock(isImmersive);
    return () => setBodyImmersiveLock(false);
  }, [isImmersive]);

  // Escape / back gesture: leave immersive mode when not using native FS.
  useEffect(() => {
    if (!isImmersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isImmersive]);

  const enterImmersive = useCallback(() => {
    setIsImmersive(true);
    // Nudge mobile Safari to settle viewport after expanding.
    window.setTimeout(() => {
      window.scrollTo(0, 0);
      try {
        iframeRef.current?.contentWindow?.dispatchEvent(new Event("resize"));
      } catch {
        // Cross-origin guard — same-origin Unity host usually allows this.
      }
    }, 50);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;

    // Exit either mode first.
    if (isDocumentFullscreen()) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch {
        // ignore
      }
      setIsImmersive(false);
      return;
    }
    if (isImmersive) {
      setIsImmersive(false);
      return;
    }

    // Prefer native Fullscreen when the browser supports it (Windows / Android).
    // On iOS, skip native — it often exists but does nothing for our frame.
    if (!prefersCssImmersiveFullscreen() && canUseNativeFullscreen(frame)) {
      try {
        const target = frame as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
        if (target.requestFullscreen) {
          await target.requestFullscreen();
          return;
        }
        if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
          return;
        }
      } catch {
        // Fall through to CSS immersive (common on iOS).
      }
    }

    // iOS Safari / unsupported browsers: expand to viewport.
    enterImmersive();
  }, [enterImmersive, isImmersive]);

  const controlButtonClass =
    "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-slate-950/80 text-white shadow-lg backdrop-blur transition hover:bg-slate-900/95 sm:h-10 sm:w-10";

  return (
    <div className="student-zone min-h-dvh bg-black text-white">
      <LandscapeRequiredOverlay />
      <InstallPlayAppPrompt gameReady={status === "ready"} />
      <div
        ref={gameShellRef}
        className={
          isImmersive
            ? "relative flex h-dvh max-h-dvh items-stretch justify-stretch overflow-hidden bg-black p-0"
            : "relative flex min-h-dvh items-center justify-center overflow-hidden bg-black p-3 sm:p-5"
        }
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
            className={
              isImmersive
                ? "fixed inset-0 z-[120] h-[100dvh] w-[100vw] max-h-none max-w-none overflow-hidden rounded-none border-0 bg-black"
                : "relative overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl shadow-black/70 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:max-h-none [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
            }
            style={
              isImmersive
                ? {
                    width: "100vw",
                    height: "100dvh",
                    paddingTop: "env(safe-area-inset-top)",
                    paddingBottom: "env(safe-area-inset-bottom)",
                    paddingLeft: "env(safe-area-inset-left)",
                    paddingRight: "env(safe-area-inset-right)",
                  }
                : {
                    width: "min(92vw, calc(88dvh * 16 / 9))",
                    maxWidth: "1400px",
                    aspectRatio: "16 / 9",
                  }
            }
          >
            <iframe
              ref={(node) => {
                iframeRef.current = node;
                if (!node) return;
                // Legacy WebKit attrs — help iOS recognize fullscreen intent on the frame.
                node.setAttribute("allowfullscreen", "true");
                node.setAttribute("webkitallowfullscreen", "true");
                node.setAttribute("mozallowfullscreen", "true");
              }}
              src={iframeSrc}
              title="Robot Coding Game"
              className="absolute inset-0 block h-full w-full border-0 bg-black"
              allow="autoplay; fullscreen; web-share"
              allowFullScreen
            />

            {status === "ready" && (
              <>
                <Link
                  href={homeHref}
                  className={`${controlButtonClass} absolute left-2 top-2 z-30 sm:left-3 sm:top-3`}
                  style={{
                    top: isImmersive ? "max(0.5rem, env(safe-area-inset-top))" : undefined,
                    left: isImmersive ? "max(0.5rem, env(safe-area-inset-left))" : undefined,
                  }}
                  aria-label="Back to home"
                  title="Home"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`${controlButtonClass} absolute right-2 top-2 z-30 sm:right-3 sm:top-3`}
                  style={{
                    top: isImmersive ? "max(0.5rem, env(safe-area-inset-top))" : undefined,
                    right: isImmersive ? "max(0.5rem, env(safe-area-inset-right))" : undefined,
                  }}
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
