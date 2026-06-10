import { ActivityTimeline, type TimelineItem } from "@/components/assessment/activity-timeline";

/** @deprecated Prefer ActivityTimeline from @/components/assessment/activity-timeline */
export function EventTimeline({
  items,
}: {
  items: { timestamp: Date | string; title: string; subtitle?: string; badge?: string }[];
}) {
  const mapped: TimelineItem[] = items.map((item) => ({
    ...item,
    tone: "neutral",
  }));
  return <ActivityTimeline items={mapped} />;
}
