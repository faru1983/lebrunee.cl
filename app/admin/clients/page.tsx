import { redirect } from "next/navigation";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import { getAdminClientsList } from "@/lib/services/crmService";
import { AdminClientsClient } from "@/components/admin/AdminClientsClient";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const [bundle, clients] = await Promise.all([
    getActiveBusinessBundle(),
    getAdminClientsList(ctx.business.id, ctx.business.timezone),
  ]);

  return (
    <AdminClientsClient
      businessName={bundle.business.name}
      clients={clients}
      retentionRules={bundle.retentionRules}
    />
  );
}
