"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";

export function SparcCountUp({
  value,
  duration = 1.2,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const unsub = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
    return unsub;
  }, [rounded]);

  useEffect(() => {
    if (inView) {
      animate(count, value, { duration, ease: "easeOut" });
    }
  }, [inView, value, count, duration]);

  return (
    <motion.span ref={ref} className={className}>
      0
    </motion.span>
  );
}
