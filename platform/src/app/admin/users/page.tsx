import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { UsersAdminPanelLoader } from "@/components/admin/users-admin-panel-loader";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.ADMIN) redirect("/login");

  return (
    <AdminShell title="Users" userName={session.user.name}>
      <UsersAdminPanelLoader />
    </AdminShell>
  );
}
