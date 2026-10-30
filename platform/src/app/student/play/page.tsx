import { StudentPlayView } from "@/components/student/student-play-view";

export const metadata = {
  title: "Play | Robot Coding",
};

export default async function StudentPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const next = item ? `/student/play?item=${encodeURIComponent(item)}` : "/student/play";
  return <StudentPlayView loginNext={next} itemKey={item} />;
}
