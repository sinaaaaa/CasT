"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg" | "xl";
  asChild?: false;
};

const variants = {
  primary:
    "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30",
  secondary:
    "bg-white text-[#4F46E5] border-2 border-indigo-200 shadow-md hover:border-indigo-300 hover:bg-indigo-50",
  ghost: "bg-transparent text-indigo-700 hover:bg-indigo-50",
};

const sizes = {
  md: "h-12 px-6 text-base rounded-2xl",
  lg: "h-14 px-8 text-lg rounded-2xl",
  xl: "h-16 px-10 text-xl rounded-3xl font-bold",
};

export function SparcButton({
  variant = "primary",
  size = "lg",
  className,
  children,
  ...props
}: Props) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
