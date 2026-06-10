"use client";

import { motion } from "framer-motion";

type Props = {
  variant?: "hero" | "login" | "dashboard";
  className?: string;
};

export function SparcBackground({ variant = "hero", className = "" }: Props) {
  const shapes =
    variant === "login"
      ? [
          { className: "left-[8%] top-[12%] h-24 w-24 bg-indigo-300/30", delay: 0 },
          { className: "right-[10%] top-[20%] h-16 w-16 bg-teal-300/35", delay: 0.4 },
          { className: "left-[15%] bottom-[18%] h-20 w-20 bg-violet-300/25", delay: 0.8 },
        ]
      : [
          { className: "left-[5%] top-[8%] h-32 w-32 bg-indigo-400/20", delay: 0 },
          { className: "right-[8%] top-[15%] h-24 w-24 bg-teal-400/25", delay: 0.3 },
          { className: "left-[20%] bottom-[10%] h-28 w-28 bg-violet-400/20", delay: 0.6 },
          { className: "right-[18%] bottom-[20%] h-20 w-20 bg-amber-300/25", delay: 0.9 },
          { className: "left-[45%] top-[5%] h-14 w-14 bg-sky-300/30", delay: 1.1 },
        ];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-[#F8FAFC]" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-[#F8FAFC] to-teal-50/60" />
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#4F46E5]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#14B8A6]/15 blur-3xl" />

      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-sm ${shape.className}`}
          animate={{ y: [0, -14, 0], x: [0, i % 2 ? 8 : -8, 0] }}
          transition={{
            duration: 5 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: shape.delay,
          }}
        />
      ))}

      {variant === "hero" && (
        <>
          <motion.div
            className="absolute left-[12%] top-[30%] h-3 w-3 rounded-full bg-[#7C3AED]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <motion.div
            className="absolute right-[22%] top-[40%] h-2 w-2 rounded-full bg-[#14B8A6]"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
          />
        </>
      )}
    </div>
  );
}
