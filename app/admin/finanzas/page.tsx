import { redirect } from "next/navigation";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import {
  getMonthlyFinanceDashboard,
  getPaymentMethodsForBusiness,
} from "@/lib/services/financeService";
import { getTodayInTimezone } from "@/lib/utils";
import { AdminFinanzasClient, type FinanzasTabKey } from "@/components/admin/AdminFinanzasClient";

export const dynamic = "force-dynamic";

const FINANZAS_TABS: Record<string, FinanzasTabKey> = {
  resumen: "resumen",
  ingresos: "ingresos",
  gastos: "gastos",
};

export default async function AdminFinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const params = await searchParams;
  const today = getTodayInTimezone(ctx.business.timezone);
  const currentMonth = today.slice(0, 7);
  const monthIso =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth;
  const initialTab: FinanzasTabKey =
    (params.tab && FINANZAS_TABS[params.tab.toLowerCase()]) || "resumen";

  const [bundle, finance, paymentMethods] = await Promise.all([
    getActiveBusinessBundle(),
    getMonthlyFinanceDashboard(ctx.business.id, monthIso),
    getPaymentMethodsForBusiness(ctx.business.id),
  ]);

  return (
    <AdminFinanzasClient
      key={`${finance.monthIso}-${initialTab}`}
      today={today}
      initialTab={initialTab}
      finance={finance}
      paymentMethods={paymentMethods}
      expenseCategories={bundle.expenseCategories}
    />
  );
}
