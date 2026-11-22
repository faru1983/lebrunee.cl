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
import { AdminFinanzasClient } from "@/components/admin/AdminFinanzasClient";

export const dynamic = "force-dynamic";

export default async function AdminFinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const params = await searchParams;
  const today = getTodayInTimezone(ctx.business.timezone);
  const currentMonth = today.slice(0, 7);
  const monthIso =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth;

  const [bundle, finance, paymentMethods] = await Promise.all([
    getActiveBusinessBundle(),
    getMonthlyFinanceDashboard(ctx.business.id, monthIso),
    getPaymentMethodsForBusiness(ctx.business.id),
  ]);

  return (
    <AdminFinanzasClient
      today={today}
      finance={finance}
      paymentMethods={paymentMethods}
      expenseCategories={bundle.expenseCategories}
    />
  );
}
