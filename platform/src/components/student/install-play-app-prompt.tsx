"use client";

import { Download, Share, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DISMISS_STORAGE_KEY = "sparc-pwa-install-dismissed-v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 1024px)").matches;
  const ua = navigator.userAgent;
  return coarse || narrow || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari when launched from home screen
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function detectMobilePlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Optional — install UI still shows manual steps on iOS.
  });
}

type Props = {
  gameReady?: boolean;
};

export function InstallPlayAppPrompt({ gameReady = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!gameReady) return;
    if (!isMobileDevice()) return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_STORAGE_KEY) === "1") return;

    setPlatform(detectMobilePlatform());
    setVisible(true);
  }, [gameReady]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      dismiss();
    } catch {
      // User cancelled or browser blocked the prompt.
    } finally {
      setInstalling(false);
      setInstallPrompt(null);
    }
  }, [dismiss, installPrompt]);

  if (!visible) return null;

  const canNativeInstall = platform === "android" && installPrompt != null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-labelledby="pwa-install-title"
        className="pointer-events-auto w-full max-w-lg rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-[#1E1B4B] to-[#312E81] p-4 text-white shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p id="pwa-install-title" className="text-sm font-bold text-white">
              Recommended: install for fullscreen play
            </p>
            <p className="mt-1 text-xs leading-relaxed text-indigo-100/90">
              Optional — you can keep playing in the browser. Installing hides the browser bar and
              gives you more screen space in landscape.
            </p>

            {platform === "ios" && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-indigo-100">
                <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.
                </span>
              </p>
            )}

            {platform === "android" && !canNativeInstall && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-indigo-100">
                <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Open the browser menu and choose <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>.
                </span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canNativeInstall && (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={installing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-indigo-900 transition hover:bg-indigo-50 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? "Installing…" : "Install app"}
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                I understand
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-indigo-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss install tip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
