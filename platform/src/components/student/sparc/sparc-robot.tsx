"use client";

import { motion } from "framer-motion";

type Props = {
  size?: "sm" | "md" | "lg" | "xl";
  waving?: boolean;
  className?: string;
};

const sizes = {
  sm: "h-24 w-24",
  md: "h-36 w-36",
  lg: "h-48 w-48",
  xl: "h-64 w-64 md:h-72 md:w-72",
};

/** Friendly SPARC robot mascot — SVG with gentle float animation */
export function SparcRobot({ size = "lg", waving = false, className = "" }: Props) {
  return (
    <motion.div
      className={`relative ${sizes[size]} ${className}`}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      role="img"
      aria-label="SPARC robot mascot"
    >
      <svg viewBox="0 0 200 200" fill="none" className="h-full w-full drop-shadow-xl">
        {/* Antenna */}
        <motion.line
          x1="100" y1="28" x2="100" y2="48"
          stroke="#4F46E5" strokeWidth="4" strokeLinecap="round"
          animate={{ rotate: waving ? [0, 8, -8, 0] : 0 }}
          style={{ originX: "100px", originY: "48px" }}
          transition={{ duration: 1.2, repeat: waving ? Infinity : 0, repeatDelay: 0.3 }}
        />
        <circle cx="100" cy="24" r="8" fill="#14B8A6" />

        {/* Head */}
        <rect x="55" y="48" width="90" height="72" rx="20" fill="#4F46E5" />
        <rect x="62" y="55" width="76" height="58" rx="16" fill="#6366F1" />

        {/* Eyes */}
        <circle cx="82" cy="82" r="10" fill="white" />
        <circle cx="118" cy="82" r="10" fill="white" />
        <circle cx="84" cy="83" r="5" fill="#1E293B" />
        <circle cx="120" cy="83" r="5" fill="#1E293B" />
        <circle cx="86" cy="81" r="2" fill="white" />
        <circle cx="122" cy="81" r="2" fill="white" />

        {/* Smile */}
        <path d="M 88 98 Q 100 108 112 98" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Body */}
        <rect x="65" y="125" width="70" height="55" rx="16" fill="#7C3AED" />
        <rect x="72" y="132" width="56" height="40" rx="12" fill="#8B5CF6" />

        {/* Chest light */}
        <circle cx="100" cy="152" r="10" fill="#14B8A6" />
        <circle cx="100" cy="152" r="5" fill="#5EEAD4" />

        {/* Left arm */}
        <motion.g
          animate={
            waving
              ? { rotate: [0, 18, -8, 18, 0] }
              : { rotate: [0, 4, 0] }
          }
          style={{ originX: "58px", originY: "138px" }}
          transition={
            waving
              ? { duration: 1.4, repeat: Infinity, repeatDelay: 0.2 }
              : { duration: 3, repeat: Infinity }
          }
        >
          <rect x="38" y="128" width="22" height="14" rx="7" fill="#4F46E5" />
          <circle cx="34" cy="135" r="9" fill="#14B8A6" />
        </motion.g>

        {/* Right arm */}
        <rect x="140" y="128" width="22" height="14" rx="7" fill="#4F46E5" />
        <circle cx="166" cy="135" r="9" fill="#14B8A6" />

        {/* Legs */}
        <rect x="78" y="178" width="18" height="14" rx="6" fill="#4F46E5" />
        <rect x="104" y="178" width="18" height="14" rx="6" fill="#4F46E5" />
      </svg>

      <motion.div
        className="absolute -bottom-2 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-full bg-indigo-900/10 blur-md"
        animate={{ scaleX: [1, 0.85, 1], opacity: [0.4, 0.25, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
