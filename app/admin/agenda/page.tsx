import { redirect } from "next/navigation";
import { getAdminAgendaRange } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { getPaymentMethodsForBusiness } from "@/lib/services/financeService";
import { addDaysToIsoDate, getTodayInTimezone } from "@/lib/utils";
import {
  AdminAgendaClient,
  type AgendaFilterStatus,
} from "@/components/admin/AdminAgendaClient";

export const dynamic = "force-dynamic";

const AGENDA_STATUS_MAP: Record<string, AgendaFilterStatus> = {
  all: "all",
  pending_deposit: "pending_deposit",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
};

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const params = await searchParams;
  const initialStatus: AgendaFilterStatus =
    (params.status && AGENDA_STATUS_MAP[params.status.toLowerCase()]) || "all";

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
      key={initialStatus}
      today={today}
      initialStatus={initialStatus}
      appointments={appointments}
      services={catalog.services}
      addons={catalog.addons}
      staff={catalog.staff}
      paymentMethods={paymentMethods}
      depositDefaultClp={bundle.paymentBank.depositAmountClp}
    />
  );
}
