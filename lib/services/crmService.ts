import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import type {
  AppointmentRecord,
  ClientNoteRecord,
  ClientSummaryRecord,
  RetentionRulesSettings,
} from "@/lib/types";
import { getTodayInTimezone } from "@/lib/utils";

function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.floor(ms / 86_400_000);
}

export async function getAdminClientsList(
  businessId: string,
  timezone = "America/Santiago"
): Promise<ClientSummaryRecord[]> {
  if (!hasValidServiceRoleKey()) return [];

  const admin = createSupabaseAdminClient();
  const today = getTodayInTimezone(timezone);

  const [clientsRes, apptsRes, retLogsRes] = await Promise.all([
    admin
      .from("clients")
      .select(
        "id, first_name, last_name, email, phone, instagram_handle, is_new_client, tags, notes, no_show_count, retention_opt_out, created_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    admin
      .from("appointments")
      .select(
        "id, client_id, status, appointment_date, total_paid_clp, items:appointment_items(name_snapshot)"
      )
      .eq("business_id", businessId)
      .in("status", ["pending_deposit", "confirmed", "completed"]),
    admin
      .from("client_retention_logs")
      .select("client_id, sent_at")
      .eq("business_id", businessId)
      .order("sent_at", { ascending: false }),
  ]);

  const apptsByClient = new Map<
    string,
    Array<{
      id: string;
      status: string;
      appointment_date: string;
      total_paid_clp: number;
      items: Array<{ name_snapshot: string }>;
    }>
  >();

  for (const a of apptsRes.data || []) {
    const list = apptsByClient.get(a.client_id) || [];
    list.push({
      id: a.id,
      status: a.status,
      appointment_date: a.appointment_date,
      total_paid_clp: a.total_paid_clp || 0,
      items: (a.items as Array<{ name_snapshot: string }>) || [],
    });
    apptsByClient.set(a.client_id, list);
  }

  const lastRetentionByClient = new Map<string, string>();
  for (const log of retLogsRes.data || []) {
    if (!lastRetentionByClient.has(log.client_id)) {
      lastRetentionByClient.set(log.client_id, log.sent_at);
    }
  }

  return (clientsRes.data || []).map((c) => {
    const list = apptsByClient.get(c.id) || [];
    const completed = list
      .filter((a) => a.status === "completed")
      .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
    const lastCompleted = completed[0] || null;

    const hasUpcomingAppointment = list.some(
      (a) =>
        ["pending_deposit", "confirmed"].includes(a.status) &&
        a.appointment_date >= today
    );

    const totalSpentClp = list.reduce((sum, a) => sum + a.total_paid_clp, 0);
    const lastVisitDate = lastCompleted?.appointment_date || null;
    const daysSinceLastVisit = lastVisitDate ? diffDaysIso(lastVisitDate, today) : null;
    const lastServiceName =
      lastCompleted?.items.map((i) => i.name_snapshot).join(" + ") || null;

    return {
      ...(c as Omit<
        ClientSummaryRecord,
        | "visitsCount"
        | "totalSpentClp"
        | "lastVisitDate"
        | "lastServiceName"
        | "daysSinceLastVisit"
        | "hasUpcomingAppointment"
        | "lastRetentionSentAt"
      >),
      visitsCount: completed.length,
      totalSpentClp,
      lastVisitDate,
      lastServiceName,
      daysSinceLastVisit,
      hasUpcomingAppointment,
      lastRetentionSentAt: lastRetentionByClient.get(c.id) || null,
    };
  });
}

export async function getAdminClientDetail(businessId: string, clientId: string) {
  if (!hasValidServiceRoleKey()) return null;
  const admin = createSupabaseAdminClient();

  const [clientRes, apptsRes, notesRes] = await Promise.all([
    admin
      .from("clients")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", clientId)
      .maybeSingle(),
    admin
      .from("appointments")
      .select("*, staff:staff_members(id, name), items:appointment_items(*)")
      .eq("business_id", businessId)
      .eq("client_id", clientId)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false }),
    admin
      .from("client_notes")
      .select("*")
      .eq("business_id", businessId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientRes.data) return null;

  return {
    client: clientRes.data as ClientSummaryRecord,
    appointments: (apptsRes.data || []) as AppointmentRecord[],
    notes: (notesRes.data || []) as ClientNoteRecord[],
  };
}

export function filterRetentionCandidates(
  clients: ClientSummaryRecord[],
  rules: RetentionRulesSettings
): ClientSummaryRecord[] {
  const minDays = Math.max(1, rules.daysSinceLastVisit || 21);
  const cooldownMs = Math.max(1, rules.cooldownDays || 30) * 86_400_000;
  const nowMs = Date.now();

  return clients
    .filter((c) => {
      if (c.retention_opt_out) return false;
      if (c.hasUpcomingAppointment) return false;
      if (c.daysSinceLastVisit === null || c.daysSinceLastVisit < minDays) return false;
      if (c.lastRetentionSentAt) {
        const sentMs = new Date(c.lastRetentionSentAt).getTime();
        if (nowMs - sentMs < cooldownMs) return false;
      }
      return true;
    })
    .sort((a, b) => (b.daysSinceLastVisit || 0) - (a.daysSinceLastVisit || 0));
}
