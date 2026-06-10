import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { ClassesAdminPanelLoader } from "@/components/admin/classes-admin-panel-loader";

export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.ADMIN) redirect("/login");

  return (
    <AdminShell title="Classes" userName={session.user.name}>
      <ClassesAdminPanelLoader />
    </AdminShell>
  );
}
