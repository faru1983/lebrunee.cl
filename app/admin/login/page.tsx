import { redirect } from "next/navigation";
import { countBusinessOwners } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import { hasValidServiceRoleKey } from "@/lib/supabase/server";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (ctx) {
    redirect("/admin");
  }

  const bundle = await getActiveBusinessBundle();
  const serviceKeyOk = hasValidServiceRoleKey();
  const ownersCount = serviceKeyOk
    ? await countBusinessOwners(bundle.business.id)
    : 0;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh items-center justify-center bg-[#faf6f8] px-4 py-10"
    >
      <AdminLoginForm
        businessName={bundle.business.name}
        showSetupLink={!serviceKeyOk || ownersCount === 0}
      />
    </main>
  );
}
