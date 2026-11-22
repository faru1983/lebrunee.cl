import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import type {
  EmailLogRecord,
  ExpenseRecord,
  PaymentMethodRecord,
  PaymentRecord,
} from "@/lib/types";
import { addDaysToIsoDate, getTodayInTimezone } from "@/lib/utils";

export async function getPaymentMethodsForBusiness(
  businessId: string
): Promise<PaymentMethodRecord[]> {
  if (!hasValidServiceRoleKey()) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("payment_methods")
    .select("id, business_id, name, is_active, display_order")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return (data || []) as PaymentMethodRecord[];
}

export async function getMonthlyFinanceDashboard(
  businessId: string,
  monthIso: string // "YYYY-MM"
) {
  if (!hasValidServiceRoleKey()) {
    return {
      monthIso,
      totalRevenueClp: 0,
      totalExpensesClp: 0,
      netProfitClp: 0,
      pendingBalanceClp: 0,
      payments: [] as PaymentRecord[],
      expenses: [] as ExpenseRecord[],
      byMethod: [] as Array<{ name: string; totalClp: number }>,
      topServices: [] as Array<{ name: string; count: number; totalClp: number }>,
    };
  }

  const admin = createSupabaseAdminClient();
  const startDate = `${monthIso}-01`;
  const [y, m] = monthIso.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const endDate = addDaysToIsoDate(nextMonthDate, -1);

  const [paymentsRes, expensesRes, apptsRes] = await Promise.all([
    admin
      .from("payments")
      .select(
        "*, payment_method:payment_methods(name), client:clients(first_name, last_name)"
      )
      .eq("business_id", businessId)
      .gte("paid_at", `${startDate}T00:00:00.000Z`)
      .lte("paid_at", `${endDate}T23:59:59.999Z`)
      .order("paid_at", { ascending: false }),
    admin
      .from("expenses")
      .select("*, payment_method:payment_methods(name)")
      .eq("business_id", businessId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false }),
    admin
      .from("appointments")
      .select(
        "id, status, total_estimated_clp, total_paid_clp, manual_adjustment_clp, items:appointment_items(item_type, name_snapshot, unit_price_clp, quantity)"
      )
      .eq("business_id", businessId)
      .gte("appointment_date", startDate)
      .lte("appointment_date", endDate)
      .in("status", ["confirmed", "completed"]),
  ]);

  const payments = (paymentsRes.data || []) as PaymentRecord[];
  const expenses = (expensesRes.data || []) as ExpenseRecord[];

  const totalRevenueClp = payments.reduce((sum, p) => sum + (p.amount_clp || 0), 0);
  const totalExpensesClp = expenses.reduce((sum, e) => sum + (e.amount_clp || 0), 0);
  const netProfitClp = totalRevenueClp - totalExpensesClp;

  const methodMap = new Map<string, number>();
  for (const p of payments) {
    const label = p.payment_method?.name || "Sin especificar";
    methodMap.set(label, (methodMap.get(label) || 0) + p.amount_clp);
  }
  const byMethod = Array.from(methodMap.entries())
    .map(([name, totalClp]) => ({ name, totalClp }))
    .sort((a, b) => b.totalClp - a.totalClp);

  const serviceMap = new Map<string, { count: number; totalClp: number }>();
  let pendingBalanceClp = 0;

  for (const a of apptsRes.data || []) {
    if (a.status === "confirmed") {
      const est = Math.max(0, (a.total_estimated_clp || 0) + (a.manual_adjustment_clp || 0));
      pendingBalanceClp += Math.max(0, est - (a.total_paid_clp || 0));
    }
    const items = (a.items as Array<{
      item_type: string;
      name_snapshot: string;
      unit_price_clp: number;
      quantity: number;
    }>) || [];
    for (const item of items) {
      if (item.item_type !== "service") continue;
      const cur = serviceMap.get(item.name_snapshot) || { count: 0, totalClp: 0 };
      cur.count += item.quantity || 1;
      cur.totalClp += (item.unit_price_clp || 0) * (item.quantity || 1);
      serviceMap.set(item.name_snapshot, cur);
    }
  }

  const topServices = Array.from(serviceMap.entries())
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.count - a.count);

  return {
    monthIso,
    totalRevenueClp,
    totalExpensesClp,
    netProfitClp,
    pendingBalanceClp,
    payments,
    expenses,
    byMethod,
    topServices,
  };
}

export async function getCommunicationsOverview(
  businessId: string,
  timezone = "America/Santiago"
) {
  if (!hasValidServiceRoleKey()) {
    return { sentToday: 0, logs: [] as EmailLogRecord[] };
  }
  const admin = createSupabaseAdminClient();
  const today = getTodayInTimezone(timezone);
  const startOfDayUtc = `${today}T00:00:00.000Z`;

  const [countRes, logsRes] = await Promise.all([
    admin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "sent")
      .gte("sent_at", startOfDayUtc),
    admin
      .from("email_logs")
      .select("id, recipient_email, template_key, category, status, error_message, sent_at")
      .eq("business_id", businessId)
      .order("sent_at", { ascending: false })
      .limit(40),
  ]);

  return {
    sentToday: countRes.count || 0,
    logs: (logsRes.data || []) as EmailLogRecord[],
  };
}
