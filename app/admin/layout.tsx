import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAuthenticatedAdminContext } from "@/lib/services/businessService";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-invoke-path") || hdrs.get("next-url") || "";
  const ctx = await getAuthenticatedAdminContext();

  // Login and Setup pages render without AdminShell
  if (!ctx) {
    return <>{children}</>;
  }

  // If authenticated admin lands on login, AdminShell isn't needed if page redirects,
  // but wrapping protected pages here is clean and consistent.
  if (
    pathname.includes("/admin/login") ||
    pathname.includes("/admin/setup") ||
    pathname.includes("/admin/reset-password")
  ) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      businessName={ctx.business.name}
      memberName={ctx.member.display_name}
      role={ctx.member.role}
    >
      {children}
    </AdminShell>
  );
}
