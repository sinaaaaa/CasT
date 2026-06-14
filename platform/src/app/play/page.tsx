import { StudentPlayView } from "@/components/student/student-play-view";

export const metadata = {
  title: "Play — Robot Coding",
};

export default function PlayPage() {
  return <StudentPlayView loginNext="/play" homeHref="/student/home" />;
}
