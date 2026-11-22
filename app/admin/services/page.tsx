import { redirect } from "next/navigation";
import { getAdminCatalogAll } from "@/lib/services/adminService";
import { getAuthenticatedAdminContext } from "@/lib/services/businessService";
import { AdminServicesClient } from "@/components/admin/AdminServicesClient";
import type { ServiceAddon, ServiceCategory, ServiceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const catalog = await getAdminCatalogAll(ctx.business.id);

  return (
    <AdminServicesClient
      categories={catalog.categories as ServiceCategory[]}
      services={catalog.services as ServiceItem[]}
      addons={catalog.addons as ServiceAddon[]}
    />
  );
}
