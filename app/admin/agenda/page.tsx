import { redirect } from "next/navigation";
import { getAdminAgendaWorkspaceData } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { getPaymentMethodsForBusiness } from "@/lib/services/financeService";
import { addDaysToIsoDate, getNowMinutesInTimezone } from "@/lib/utils";
import {
  AdminAgendaClient,
  type AgendaFilterStatus,
} from "@/components/admin/AdminAgendaClient";
import type { AgendaViewMode } from "@/components/admin/agenda/agendaHelpers";

export const dynamic = "force-dynamic";

const AGENDA_STATUS_MAP: Record<string, AgendaFilterStatus> = {
  all: "all",
  pending_deposit: "pending_deposit",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
};

const AGENDA_VIEW_MAP: Record<string, AgendaViewMode> = {
  day: "day",
  week: "week",
  month: "month",
  list: "list",
};

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    view?: string;
    date?: string;
    emergency?: string;
  }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const params = await searchParams;
  const { today, minutes: nowMinutes } = getNowMinutesInTimezone(ctx.business.timezone);

  const initialStatus: AgendaFilterStatus =
    (params.status && AGENDA_STATUS_MAP[params.status.toLowerCase()]) || "all";
  const initialView: AgendaViewMode =
    (params.view && AGENDA_VIEW_MAP[params.view.toLowerCase()]) || "week";
  const initialDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const initialOpenEmergency = params.emergency === "1";

  const fromDate = addDaysToIsoDate(initialDate, -35);
  const toDate = addDaysToIsoDate(initialDate, 65);

  const [bundle, catalog, workspace, paymentMethods] = await Promise.all([
    getActiveBusinessBundle(),
    getPublicCatalog(ctx.business.id),
    getAdminAgendaWorkspaceData(ctx.business.id, fromDate, toDate),
    getPaymentMethodsForBusiness(ctx.business.id),
  ]);

  return (
    <AdminAgendaClient
      today={today}
      nowMinutes={nowMinutes}
      businessName={bundle.business.name}
      initialIsAgendaOpen={bundle.bookingRules.isAgendaOpen}
      initialView={initialView}
      initialDate={initialDate}
      initialStatus={initialStatus}
      initialOpenEmergency={initialOpenEmergency}
      initialWindowFrom={fromDate}
      initialWindowTo={toDate}
      appointments={workspace.appointments}
      rules={workspace.rules}
      exceptions={workspace.exceptions}
      clients={workspace.clients}
      services={catalog.services}
      addons={catalog.addons}
      staff={catalog.staff}
      paymentMethods={paymentMethods}
      depositDefaultClp={bundle.paymentBank.depositAmountClp}
    />
  );
}
