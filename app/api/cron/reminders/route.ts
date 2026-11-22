import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import {
  getActiveBusinessBundle,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import { sendBusinessEmail } from "@/lib/services/emailService";
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

  // Keep-alive + reminder candidates query
  const { data: candidates } = await admin
    .from("appointments")
    .select(
      "id, booking_code, appointment_date, start_time, reminder_24h_sent_at, reminder_48h_sent_at, client:clients(first_name, email), items:appointment_items(name_snapshot)"
    )
    .eq("business_id", bundle.business.id)
    .eq("status", "confirmed")
    .in("appointment_date", [tomorrow, inTwoDays]);

  if (!bundle.notifications.autoRemindersEnabled) {
    return NextResponse.json({
      ok: true,
      keepAlive: true,
      remindersSent: 0,
      note: "Recordatorios automáticos desactivados.",
    });
  }

  const privateLoc = await getPrivateLocationForServer(bundle.business.id);
  let sentCount = 0;

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
      sentCount++;
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

  return NextResponse.json({
    ok: true,
    keepAlive: true,
    checked: (candidates || []).length,
    remindersSent: sentCount,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
