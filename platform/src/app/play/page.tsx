import { StudentPlayView } from "@/components/student/student-play-view";

export const metadata = {
  title: "Play | Robot Coding",
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const next = item ? `/play?item=${encodeURIComponent(item)}` : "/play";
  return <StudentPlayView loginNext={next} homeHref="/student/home" itemKey={item} />;
}
