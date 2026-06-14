"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

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

export function LandscapeRequiredOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const update = () => {
      setShow(isMobileLikeDevice() && isPortraitViewport());
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

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4F46E5]">
        <RotateCw className="h-8 w-8 animate-pulse" />
      </div>
      <h2 className="text-2xl font-bold">Please rotate your device</h2>
      <p className="max-w-sm text-base text-slate-300">
        Turn your phone sideways to play in landscape mode. The game works best when your device is
        horizontal.
      </p>
    </div>
  );
}
