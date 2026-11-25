import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import type {
  AgendaClientOption,
  AppointmentRecord,
  AvailabilityException,
  AvailabilityFixedSlot,
  AvailabilityRule,
  BusinessMemberRecord,
  EmailTemplateRecord,
} from "@/lib/types";
import { getTodayInTimezone } from "@/lib/utils";

export async function getAdminDashboardData(businessId: string, timezone = "America/Santiago") {
  if (!hasValidServiceRoleKey()) {
    return {
      today: getTodayInTimezone(timezone),
      todayAppointments: [] as AppointmentRecord[],
      pendingDeposit: [] as AppointmentRecord[],
      upcomingConfirmed: [] as AppointmentRecord[],
      monthRevenueClp: 0,
      monthAppointmentsCount: 0,
    };
  }

  const admin = createSupabaseAdminClient();
  const today = getTodayInTimezone(timezone);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todayRes, pendingRes, upcomingRes, paymentsRes, countRes] = await Promise.all([
    admin
      .from("appointments")
      .select(
        "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
      )
      .eq("business_id", businessId)
      .eq("appointment_date", today)
      .in("status", ["pending_deposit", "confirmed", "completed"])
      .order("start_time", { ascending: true }),
    admin
      .from("appointments")
      .select(
        "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
      )
      .eq("business_id", businessId)
      .eq("status", "pending_deposit")
      .gte("appointment_date", today)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(20),
    admin
      .from("appointments")
      .select(
        "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
      )
      .eq("business_id", businessId)
      .eq("status", "confirmed")
      .gt("appointment_date", today)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(15),
    admin
      .from("payments")
      .select("amount_clp")
      .eq("business_id", businessId)
      .gte("paid_at", `${monthStart}T00:00:00.000Z`),
    admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("appointment_date", monthStart)
      .in("status", ["confirmed", "completed"]),
  ]);

  const monthRevenueClp = (paymentsRes.data || []).reduce(
    (sum, p) => sum + (p.amount_clp || 0),
    0
  );

  return {
    today,
    todayAppointments: (todayRes.data || []) as AppointmentRecord[],
    pendingDeposit: (pendingRes.data || []) as AppointmentRecord[],
    upcomingConfirmed: (upcomingRes.data || []) as AppointmentRecord[],
    monthRevenueClp,
    monthAppointmentsCount: countRes.count || 0,
  };
}

export async function getAdminAgendaRange(
  businessId: string,
  fromDate: string,
  toDate: string
): Promise<AppointmentRecord[]> {
  if (!hasValidServiceRoleKey()) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("appointments")
    .select(
      "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
    )
    .eq("business_id", businessId)
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  return (data || []) as AppointmentRecord[];
}

export async function getAdminAgendaWorkspaceData(
  businessId: string,
  fromDate: string,
  toDate: string
): Promise<{
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  clients: AgendaClientOption[];
}> {
  if (!hasValidServiceRoleKey()) {
    return { appointments: [], rules: [], exceptions: [], clients: [] };
  }
  const admin = createSupabaseAdminClient();

  const [apptsRes, rulesRes, excRes, clientsRes] = await Promise.all([
    admin
      .from("appointments")
      .select(
        "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
      )
      .eq("business_id", businessId)
      .gte("appointment_date", fromDate)
      .lte("appointment_date", toDate)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("availability_rules")
      .select("id, business_id, staff_id, day_of_week, start_time, end_time, is_active")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("availability_exceptions")
      .select("id, business_id, staff_id, exception_date, exception_type, start_time, end_time, reason")
      .eq("business_id", businessId)
      .gte("exception_date", fromDate)
      .lte("exception_date", toDate)
      .order("exception_date", { ascending: true }),
    admin
      .from("clients")
      .select("id, first_name, last_name, email, phone, instagram_handle, birth_date")
      .eq("business_id", businessId)
      .order("first_name", { ascending: true })
      .limit(400),
  ]);

  return {
    appointments: (apptsRes.data || []) as AppointmentRecord[],
    rules: (rulesRes.data || []) as AvailabilityRule[],
    exceptions: (excRes.data || []) as AvailabilityException[],
    clients: (clientsRes.data || []) as AgendaClientOption[],
  };
}

export async function getAdminScheduleSetup(businessId: string, staffId: string) {
  if (!hasValidServiceRoleKey()) {
    return {
      rules: [] as AvailabilityRule[],
      fixedSlots: [] as AvailabilityFixedSlot[],
      exceptions: [] as AvailabilityException[],
    };
  }
  const admin = createSupabaseAdminClient();
  const [rulesRes, fixedRes, excRes] = await Promise.all([
    admin
      .from("availability_rules")
      .select("*")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("availability_fixed_slots")
      .select("*")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .order("slot_time", { ascending: true }),
    admin
      .from("availability_exceptions")
      .select("*")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .order("exception_date", { ascending: true }),
  ]);

  return {
    rules: (rulesRes.data || []) as AvailabilityRule[],
    fixedSlots: (fixedRes.data || []) as AvailabilityFixedSlot[],
    exceptions: (excRes.data || []) as AvailabilityException[],
  };
}

export async function getAdminCatalogAll(businessId: string) {
  if (!hasValidServiceRoleKey()) {
    return { categories: [], services: [], addons: [] };
  }
  const admin = createSupabaseAdminClient();
  const [catRes, srvRes, addRes] = await Promise.all([
    admin
      .from("service_categories")
      .select("*")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true }),
    admin
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true }),
    admin
      .from("service_addons")
      .select("*")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true }),
  ]);

  return {
    categories: catRes.data || [],
    services: srvRes.data || [],
    addons: addRes.data || [],
  };
}

export async function getAdminMembersAndTemplates(businessId: string) {
  if (!hasValidServiceRoleKey()) {
    return {
      members: [] as BusinessMemberRecord[],
      templates: [] as EmailTemplateRecord[],
    };
  }
  const admin = createSupabaseAdminClient();
  const [memRes, tplRes] = await Promise.all([
    admin
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    admin
      .from("email_templates")
      .select("*")
      .eq("business_id", businessId)
      .order("template_key", { ascending: true }),
  ]);

  return {
    members: (memRes.data || []) as BusinessMemberRecord[],
    templates: (tplRes.data || []) as EmailTemplateRecord[],
  };
}

export async function countBusinessOwners(businessId: string): Promise<number> {
  if (!hasValidServiceRoleKey()) return 0;
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("role", "owner")
    .eq("is_active", true);
  return count || 0;
}
