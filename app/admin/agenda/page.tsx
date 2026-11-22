import { redirect } from "next/navigation";
import { getAdminAgendaRange } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { getPaymentMethodsForBusiness } from "@/lib/services/financeService";
import { addDaysToIsoDate, getTodayInTimezone } from "@/lib/utils";
import { AdminAgendaClient } from "@/components/admin/AdminAgendaClient";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const today = getTodayInTimezone(ctx.business.timezone);
  const fromDate = addDaysToIsoDate(today, -14);
  const toDate = addDaysToIsoDate(today, 60);

  const [bundle, catalog, appointments, paymentMethods] = await Promise.all([
    getActiveBusinessBundle(),
    getPublicCatalog(ctx.business.id),
    getAdminAgendaRange(ctx.business.id, fromDate, toDate),
    getPaymentMethodsForBusiness(ctx.business.id),
  ]);

  return (
    <AdminAgendaClient
      today={today}
      appointments={appointments}
      services={catalog.services}
      addons={catalog.addons}
      staff={catalog.staff}
      paymentMethods={paymentMethods}
      depositDefaultClp={bundle.paymentBank.depositAmountClp}
    />
  );
}
