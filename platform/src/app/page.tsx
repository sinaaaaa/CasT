import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === UserRole.STUDENT) redirect("/student/dashboard");
  if (session.user.role === UserRole.ADMIN) redirect("/admin/users");
  redirect("/teacher/dashboard");
}
