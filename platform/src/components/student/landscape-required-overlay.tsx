"use client";

import { RotateCw, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const APP_SHORT_NAME = "LilLogic";

function isMobileLikeDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 1024px)").matches;
  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return coarse || narrow || mobileUa;
}

function isPortraitViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(orientation: portrait)").matches;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
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

export function LandscapeRequiredOverlay() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const update = () => {
      setShow(isMobileLikeDevice() && isPortraitViewport());
      setPlatform(detectMobilePlatform());
    };

    update();
    const portraitMq = window.matchMedia("(orientation: portrait)");
    portraitMq.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      portraitMq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!show) return null;

  const showInstallTip = !isStandaloneDisplay();

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-slate-950 px-8 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4F46E5]">
        <RotateCw className="h-8 w-8 animate-pulse" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Please rotate your device</h2>
        <p className="mx-auto max-w-sm text-base text-slate-300">
          Turn your phone sideways to play in landscape mode. The game works best when your device is
          horizontal.
        </p>
      </div>

      {showInstallTip && (
        <div className="w-full max-w-sm rounded-2xl border border-indigo-400/30 bg-indigo-950/60 p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Tip: add {APP_SHORT_NAME} to your home screen</p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-100/90">
                This hides the browser bar and gives you more room to play in landscape.
              </p>
              {platform === "ios" ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-indigo-100">
                  <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, and name it{" "}
                    <strong>{APP_SHORT_NAME}</strong>.
                  </span>
                </p>
              ) : platform === "android" ? (
                <p className="mt-2 text-xs text-indigo-100">
                  Open the browser menu and choose <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>. Use the name <strong>{APP_SHORT_NAME}</strong>.
                </p>
              ) : (
                <p className="mt-2 text-xs text-indigo-100">
                  Use your browser&apos;s install or <strong>Add to Home screen</strong> option and name it{" "}
                  <strong>{APP_SHORT_NAME}</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
