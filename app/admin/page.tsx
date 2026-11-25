import { redirect } from "next/navigation";
import { getAdminDashboardData } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { getPaymentMethodsForBusiness } from "@/lib/services/financeService";
import { AdminTodayClient } from "@/components/admin/AdminTodayClient";

export const dynamic = "force-dynamic";

export default async function AdminTodayPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) {
    redirect("/admin/login");
  }

  const [bundle, catalog, dashboard, paymentMethods] = await Promise.all([
    getActiveBusinessBundle(),
    getPublicCatalog(ctx.business.id),
    getAdminDashboardData(ctx.business.id, ctx.business.timezone),
    getPaymentMethodsForBusiness(ctx.business.id),
  ]);

  return (
    <AdminTodayClient
      today={dashboard.today}
      businessName={bundle.business.name}
      isAgendaOpen={bundle.bookingRules.isAgendaOpen}
      todayAppointments={dashboard.todayAppointments}
      pendingDeposit={dashboard.pendingDeposit}
      upcomingConfirmed={dashboard.upcomingConfirmed}
      monthRevenueClp={dashboard.monthRevenueClp}
      monthAppointmentsCount={dashboard.monthAppointmentsCount}
      services={catalog.services}
      addons={catalog.addons}
      staff={catalog.staff}
      paymentMethods={paymentMethods}
      depositDefaultClp={bundle.paymentBank.depositAmountClp}
    />
  );
}
