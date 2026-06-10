import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, isTeacherRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !isTeacherRole(session.user.role)) redirect("/login");
  return children;
}
