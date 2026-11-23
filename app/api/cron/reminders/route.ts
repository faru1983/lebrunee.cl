import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  getActiveBusinessBundle,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import {
  filterBirthdayDueToday,
  filterRetentionCandidates,
  getAdminClientsList,
} from "@/lib/services/crmService";
import { sendBusinessEmail } from "@/lib/services/emailService";
import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import { addDaysToIsoDate, formatDateLongEs, getTodayInTimezone } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() || "";
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 503 });
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const bundle = await getActiveBusinessBundle();
  if (!hasValidServiceRoleKey()) {
    return NextResponse.json({ ok: true, skipped: "service_role no configurada" });
  }

  const admin = createSupabaseAdminClient();
  const today = getTodayInTimezone(bundle.business.timezone);
  const tomorrow = addDaysToIsoDate(today, 1);
  const inTwoDays = addDaysToIsoDate(today, 2);

  // 1. Upcoming Appointment Reminders (also keeps Supabase Free Tier active daily)
  const { data: candidates } = await admin
    .from("appointments")
    .select(
      "id, booking_code, appointment_date, start_time, reminder_24h_sent_at, reminder_48h_sent_at, client:clients(first_name, email), items:appointment_items(name_snapshot)"
    )
    .eq("business_id", bundle.business.id)
    .eq("status", "confirmed")
    .in("appointment_date", [tomorrow, inTwoDays]);

  let upcomingSent = 0;

  if (bundle.notifications.autoRemindersEnabled) {
    const privateLoc = await getPrivateLocationForServer(bundle.business.id);
    for (const row of candidates || []) {
      const client = row.client as unknown as { first_name: string; email: string } | null;
      if (!client?.email) continue;

      const is24h = row.appointment_date === tomorrow && !row.reminder_24h_sent_at;
      const is48h = row.appointment_date === inTwoDays && !row.reminder_48h_sent_at;
      if (!is24h && !is48h) continue;

      const serviceLabel =
        (row.items as Array<{ name_snapshot: string }> | undefined)
          ?.map((i) => i.name_snapshot)
          .join(" + ") || "Tu cita";

      const res = await sendBusinessEmail({
        businessId: bundle.business.id,
        to: client.email,
        templateKey: "reminder_upcoming",
        category: "reminder",
        appointmentId: row.id,
        variables: {
          nombre: client.first_name,
          codigo: row.booking_code,
          servicio: serviceLabel,
          fecha: formatDateLongEs(row.appointment_date),
          hora: row.start_time.slice(0, 5),
          direccion: privateLoc.exactAddress || bundle.contactPublic.publicLocationLabel,
        },
      });

      if (res.status === "sent") {
        upcomingSent++;
        await admin
          .from("appointments")
          .update(
            is24h
              ? { reminder_24h_sent_at: new Date().toISOString() }
              : { reminder_48h_sent_at: new Date().toISOString() }
          )
          .eq("id", row.id);
      }
    }
  }

  // 2. Configurable Retention Reminders (XX days since last visit)
  let retentionSent = 0;
  const needsClientList =
    bundle.retentionRules.retentionEnabled || bundle.birthdayRules.birthdayEnabled;
  const allClients = needsClientList
    ? await getAdminClientsList(bundle.business.id, bundle.business.timezone)
    : [];
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lebrunee.cl"}/reservar`;

  if (bundle.retentionRules.retentionEnabled) {
    const dueClients = filterRetentionCandidates(allClients, bundle.retentionRules);

    for (const c of dueClients) {
      const res = await sendBusinessEmail({
        businessId: bundle.business.id,
        to: c.email,
        templateKey: "retention_followup",
        category: "reminder",
        variables: {
          nombre: c.first_name,
          dias: c.daysSinceLastVisit || bundle.retentionRules.daysSinceLastVisit,
          servicio: c.lastServiceName || "tu último servicio",
          link_reserva: bookingUrl,
        },
      });

      if (res.status === "sent") {
        retentionSent++;
        await admin.from("client_retention_logs").insert({
          business_id: bundle.business.id,
          client_id: c.id,
          channel: "email",
          days_since_last_visit:
            c.daysSinceLastVisit || bundle.retentionRules.daysSinceLastVisit,
        });
      }
    }
  }

  // 3. Configurable Birthday Gift Reminders
  let birthdaySent = 0;
  if (bundle.birthdayRules.birthdayEnabled) {
    const currentYear = Number(today.slice(0, 4));
    const birthdayDue = filterBirthdayDueToday(allClients, bundle.birthdayRules, today);

    for (const c of birthdayDue) {
      const res = await sendBusinessEmail({
        businessId: bundle.business.id,
        to: c.email,
        templateKey: "birthday_gift",
        category: "reminder",
        variables: {
          nombre: c.first_name,
          link_reserva: bookingUrl,
        },
      });

      if (res.status === "sent") {
        birthdaySent++;
        await admin.from("client_birthday_logs").upsert(
          {
            business_id: bundle.business.id,
            client_id: c.id,
            birthday_year: currentYear,
            channel: "email",
          },
          { onConflict: "business_id,client_id,birthday_year,channel" }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    keepAlive: true,
    checkedUpcoming: (candidates || []).length,
    upcomingSent,
    retentionSent,
    birthdaySent,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
