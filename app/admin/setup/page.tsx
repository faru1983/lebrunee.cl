import { redirect } from "next/navigation";
import { countBusinessOwners } from "@/lib/services/adminService";
import { getActiveBusinessBundle } from "@/lib/services/businessService";
import { hasValidServiceRoleKey } from "@/lib/supabase/server";
import { AdminSetupForm } from "@/components/admin/AdminSetupForm";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  const bundle = await getActiveBusinessBundle();
  const serviceKeyOk = hasValidServiceRoleKey();
  const ownersCount = serviceKeyOk
    ? await countBusinessOwners(bundle.business.id)
    : 0;

  if (serviceKeyOk && ownersCount > 0) {
    redirect("/admin/login");
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh items-center justify-center bg-[#faf6f8] px-4 py-10"
    >
      <AdminSetupForm
        businessName={bundle.business.name}
        serviceKeyConfigured={serviceKeyOk}
      />
    </main>
  );
}
