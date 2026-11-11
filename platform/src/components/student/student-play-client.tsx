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
  url.searchParams.set("v", "ios-lowmem-2");
  if (config.gameApiKey) {
    url.searchParams.set("gameApiKey", config.gameApiKey);
  }
  if (config.resumeLevelKey) {
    url.searchParams.set("resumeLevelKey", config.resumeLevelKey);
  }
  if (config.resumeSlot != null && config.resumeSlot > 0) {
    url.searchParams.set("resumeSlot", String(config.resumeSlot));
  }
  if (config.displayName) {
    url.searchParams.set("displayName", config.displayName);
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

/** Prefer CSS fill on iOS/iPad — requestFullscreen is missing or crashes Safari. */
function prefersCssImmersiveFullscreen(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ often spoofs Macintosh desktop Safari.
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  if (/Mac/i.test(ua) && navigator.maxTouchPoints > 1 && "ontouchend" in document) return true;
  return false;
}

function setPlayViewportLock(locked: boolean) {
  const html = document.documentElement;
  const body = document.body;
  html.classList.toggle("play-viewport-lock", locked);
  body.classList.toggle("play-viewport-lock", locked);
  if (locked) {
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "manipulation";
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
  displayName,
  homeHref = "/student/home",
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [iframeSrc, setIframeSrc] = useState(unityGameUrl);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

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
    setPlayViewportLock(true);
    window.scrollTo(0, 0);

    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventZoomKeys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "+" || event.key === "-" || event.key === "=" || event.key === "0") {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", preventZoomWheel, { passive: false });
    window.addEventListener("keydown", preventZoomKeys);
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchmove", preventPinch, { passive: false });

    return () => {
      setPlayViewportLock(false);
      window.removeEventListener("wheel", preventZoomWheel);
      window.removeEventListener("keydown", preventZoomKeys);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const fit = () => {
      const availableW = shell.clientWidth;
      const availableH = shell.clientHeight;
      const aspect = 16 / 9;
      let width = availableW;
      let height = width / aspect;
      if (height > availableH) {
        height = availableH;
        width = height * aspect;
      }
      setFrameSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(shell);
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsNativeFullscreen(isDocumentFullscreen());
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;

    if (isDocumentFullscreen()) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch {
        // ignore
      }
      return;
    }

    if (prefersCssImmersiveFullscreen() || !canUseNativeFullscreen(shell)) return;

    try {
      const target = shell as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }
      if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      }
    } catch {
      // Browser blocked native fullscreen. The page already contain-fits the window.
    }
  }, []);

  const showFullscreenButton = !prefersCssImmersiveFullscreen();

  const controlButtonClass =
    "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-slate-950/80 text-white shadow-lg backdrop-blur transition hover:bg-slate-900/95 sm:h-10 sm:w-10";

  return (
    <div
      ref={shellRef}
      className="student-zone fixed inset-0 overflow-hidden bg-black text-white"
    >
      <LandscapeRequiredOverlay />
      <InstallPlayAppPrompt gameReady={status === "ready"} />
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
            <p className="text-slate-300">
              {displayName ? `Hey ${displayName.split(" ")[0]}, loading your game…` : "Loading game…"}
            </p>
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
              Your student session is ready. The game will receive your Student ID automatically.
            </p>
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
            className="relative overflow-hidden bg-black"
            style={{
              width: frameSize.width ? `${frameSize.width}px` : "100%",
              height: frameSize.height ? `${frameSize.height}px` : "100%",
            }}
          >
            <iframe
              ref={(node) => {
                iframeRef.current = node;
                if (!node) return;
                node.setAttribute("allowfullscreen", "true");
                node.setAttribute("webkitallowfullscreen", "true");
                node.setAttribute("mozallowfullscreen", "true");
              }}
              src={iframeSrc}
              title="Robot Coding Game"
              className="absolute inset-0 block h-full w-full overflow-hidden border-0 bg-black"
              scrolling="no"
              allow="autoplay; fullscreen; web-share"
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
                {showFullscreenButton && (
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    className={`${controlButtonClass} absolute right-2 top-2 z-30 sm:right-3 sm:top-3`}
                    aria-pressed={isNativeFullscreen}
                    aria-label={isNativeFullscreen ? "Exit full screen" : "Enter full screen"}
                    title={isNativeFullscreen ? "Exit full screen" : "Full screen"}
                  >
                    {isNativeFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
