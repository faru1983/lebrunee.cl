import { redirect } from "next/navigation";
import { getAdminScheduleSetup } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { AdminScheduleClient } from "@/components/admin/AdminScheduleClient";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const [bundle, catalog] = await Promise.all([
    getActiveBusinessBundle(),
    getPublicCatalog(ctx.business.id),
  ]);

  const primaryStaffId = catalog.staff[0]?.id || "";
  const schedule = primaryStaffId
    ? await getAdminScheduleSetup(ctx.business.id, primaryStaffId)
    : { rules: [], fixedSlots: [], exceptions: [] };

  return (
    <AdminScheduleClient
      staff={catalog.staff}
      initialStaffId={primaryStaffId}
      initialBookingRules={bundle.bookingRules}
      initialRules={schedule.rules}
      initialFixedSlots={schedule.fixedSlots}
      initialExceptions={schedule.exceptions}
    />
  );
}
