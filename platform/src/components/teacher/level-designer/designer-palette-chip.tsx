"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
};

export function DesignerPaletteChip({
  label,
  icon,
  active,
  className,
  onSelect,
  onDragStart,
  onDragEnd,
}: Props) {
  return (
    <button
      type="button"
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex w-full cursor-grab flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition active:cursor-grabbing",
        active ? "ring-2 ring-primary ring-offset-1" : "hover:brightness-95",
        className
      )}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
