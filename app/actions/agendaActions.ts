"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import { sendBusinessEmail } from "@/lib/services/emailService";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type {
  AppointmentRecord,
  AppointmentStatus,
  AvailabilityException,
} from "@/lib/types";
import {
  formatDateLongEs,
  getDayOfWeekFromIsoDate,
  minutesToTime,
  normalizeEmail,
  normalizeInstagramHandle,
  normalizePersonName,
  timeToMinutes,
} from "@/lib/utils";

async function requireAdmin() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) {
    throw new Error("Sesión administrativa requerida.");
  }
  return ctx;
}

const FetchWindowSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function fetchAgendaWindowAction(rawInput: {
  fromDate: string;
  toDate: string;
}): Promise<
  | {
      success: true;
      appointments: AppointmentRecord[];
      exceptions: AvailabilityException[];
    }
  | { success: false; error: string }
> {
  try {
    const ctx = await requireAdmin();
    const parsed = FetchWindowSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: "Rango de fechas inválido." };
    }

    const admin = createSupabaseAdminClient();
    const [apptsRes, excRes] = await Promise.all([
      admin
        .from("appointments")
        .select(
          "*, client:clients(id, first_name, last_name, email, phone, instagram_handle, is_new_client), staff:staff_members(id, name), items:appointment_items(*)"
        )
        .eq("business_id", ctx.business.id)
        .gte("appointment_date", parsed.data.fromDate)
        .lte("appointment_date", parsed.data.toDate)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true }),
      admin
        .from("availability_exceptions")
        .select(
          "id, business_id, staff_id, exception_date, exception_type, start_time, end_time, reason"
        )
        .eq("business_id", ctx.business.id)
        .gte("exception_date", parsed.data.fromDate)
        .lte("exception_date", parsed.data.toDate)
        .order("exception_date", { ascending: true }),
    ]);

    return {
      success: true,
      appointments: (apptsRes.data || []) as AppointmentRecord[],
      exceptions: (excRes.data || []) as AvailabilityException[],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error cargando agenda.",
    };
  }
}

export interface MoveConflictInfo {
  type: "overlap" | "blocked" | "outside_hours";
  message: string;
  conflictingCodes?: string[];
}

const MoveAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  staffId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  forceOverride: z.boolean().default(false),
  notifyClientEmail: z.boolean().default(false),
});

async function detectScheduleConflicts(params: {
  businessId: string;
  staffId: string;
  appointmentDate: string;
  startMin: number;
  endMin: number;
  excludeAppointmentId: string;
}): Promise<MoveConflictInfo | null> {
  const admin = createSupabaseAdminClient();
  const dow = getDayOfWeekFromIsoDate(params.appointmentDate);

  const [sameDayRes, excRes, rulesRes] = await Promise.all([
    admin
      .from("appointments")
      .select("id, booking_code, start_time, end_time, status, client:clients(first_name)")
      .eq("business_id", params.businessId)
      .eq("staff_id", params.staffId)
      .eq("appointment_date", params.appointmentDate)
      .in("status", ["pending_deposit", "confirmed", "completed"])
      .neq("id", params.excludeAppointmentId),
    admin
      .from("availability_exceptions")
      .select("exception_type, start_time, end_time, reason")
      .eq("business_id", params.businessId)
      .eq("staff_id", params.staffId)
      .eq("exception_date", params.appointmentDate),
    admin
      .from("availability_rules")
      .select("start_time, end_time")
      .eq("business_id", params.businessId)
      .eq("staff_id", params.staffId)
      .eq("day_of_week", dow)
      .eq("is_active", true),
  ]);

  const overlapping = (sameDayRes.data || []).filter((other) => {
    const oStart = timeToMinutes(other.start_time);
    const oEnd = timeToMinutes(other.end_time);
    return params.startMin < oEnd && params.endMin > oStart;
  });

  if (overlapping.length > 0) {
    const labels = overlapping.map((o) => {
      const clientObj = Array.isArray(o.client) ? o.client[0] : o.client;
      const name = clientObj?.first_name || o.booking_code;
      return `${name} (${o.start_time.slice(0, 5)}–${o.end_time.slice(0, 5)})`;
    });
    return {
      type: "overlap",
      message: `Se superpone con: ${labels.join(", ")}.`,
      conflictingCodes: overlapping.map((o) => o.booking_code),
    };
  }

  const exceptions = excRes.data || [];
  const blockDay = exceptions.find((e) => e.exception_type === "block_day");
  if (blockDay) {
    return {
      type: "blocked",
      message: `Ese día está bloqueado${blockDay.reason ? ` (${blockDay.reason})` : ""}.`,
    };
  }

  const blockRange = exceptions.find((e) => {
    if (e.exception_type !== "block_range" || !e.start_time || !e.end_time) return false;
    const bStart = timeToMinutes(e.start_time);
    const bEnd = timeToMinutes(e.end_time);
    return params.startMin < bEnd && params.endMin > bStart;
  });
  if (blockRange) {
    return {
      type: "blocked",
      message: `Cae dentro del bloqueo ${blockRange.start_time?.slice(0, 5)}–${blockRange.end_time?.slice(0, 5)}${blockRange.reason ? ` (${blockRange.reason})` : ""}.`,
    };
  }

  const customOpens = exceptions.filter(
    (e) => e.exception_type === "open_custom" && e.start_time && e.end_time
  );
  const workingRanges =
    customOpens.length > 0
      ? customOpens.map((e) => ({
          start: timeToMinutes(e.start_time!),
          end: timeToMinutes(e.end_time!),
        }))
      : (rulesRes.data || []).map((r) => ({
          start: timeToMinutes(r.start_time),
          end: timeToMinutes(r.end_time),
        }));

  const insideWorking = workingRanges.some(
    (r) => params.startMin >= r.start && params.endMin <= r.end
  );
  if (!insideWorking) {
    return {
      type: "outside_hours",
      message:
        workingRanges.length === 0
          ? "Ese día figura cerrado en tu horario habitual."
          : "Ese bloque queda fuera de tu jornada laboral habitual.",
    };
  }

  return null;
}

export async function adminMoveAppointmentAction(rawInput: unknown): Promise<
  | {
      success: true;
      appointment: {
        id: string;
        appointment_date: string;
        start_time: string;
        end_time: string;
        staff_id: string;
        total_duration_minutes: number;
      };
    }
  | {
      success: false;
      error: string;
      conflict?: MoveConflictInfo;
    }
> {
  try {
    const ctx = await requireAdmin();
    const parsed = MoveAppointmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos inválidos para mover la cita.",
      };
    }

    const d = parsed.data;
    const admin = createSupabaseAdminClient();

    const { data: appt } = await admin
      .from("appointments")
      .select(
        "id, booking_code, staff_id, appointment_date, start_time, end_time, total_duration_minutes, rescheduled_count, client:clients(first_name, email), items:appointment_items(name_snapshot)"
      )
      .eq("business_id", ctx.business.id)
      .eq("id", d.appointmentId)
      .single();

    if (!appt) {
      return { success: false, error: "Cita no encontrada." };
    }

    const targetStaffId = d.staffId || appt.staff_id;
    const duration = d.durationMinutes ?? appt.total_duration_minutes;
    const startMin = timeToMinutes(d.startTime);
    const endMin = startMin + duration;
    if (startMin < 0 || endMin > 24 * 60) {
      return { success: false, error: "El bloque horario excede los límites del día." };
    }

    if (!d.forceOverride) {
      const conflict = await detectScheduleConflicts({
        businessId: ctx.business.id,
        staffId: targetStaffId,
        appointmentDate: d.appointmentDate,
        startMin,
        endMin,
        excludeAppointmentId: appt.id,
      });
      if (conflict) {
        return {
          success: false,
          error: conflict.message,
          conflict,
        };
      }
    }

    const endTime = minutesToTime(endMin);
    const dateOrTimeChanged =
      appt.appointment_date !== d.appointmentDate ||
      appt.start_time.slice(0, 5) !== d.startTime;

    const patch: Record<string, unknown> = {
      appointment_date: d.appointmentDate,
      start_time: d.startTime,
      end_time: endTime,
      staff_id: targetStaffId,
      total_duration_minutes: duration,
      updated_at: new Date().toISOString(),
    };

    if (dateOrTimeChanged) {
      patch.rescheduled_count = (appt.rescheduled_count || 0) + 1;
      patch.reminder_48h_sent_at = null;
      patch.reminder_24h_sent_at = null;
    }

    const { error } = await admin
      .from("appointments")
      .update(patch)
      .eq("business_id", ctx.business.id)
      .eq("id", appt.id);

    if (error) throw new Error(error.message);

    if (d.notifyClientEmail && dateOrTimeChanged) {
      const clientObj = Array.isArray(appt.client) ? appt.client[0] : appt.client;
      if (clientObj?.email) {
        const serviceLabel =
          (appt.items as Array<{ name_snapshot: string }> | undefined)
            ?.map((i) => i.name_snapshot)
            .join(" + ") || "Tu servicio";
        await sendBusinessEmail({
          businessId: ctx.business.id,
          to: clientObj.email,
          templateKey: "booking_rescheduled",
          appointmentId: appt.id,
          variables: {
            nombre: clientObj.first_name,
            codigo: appt.booking_code,
            servicio: serviceLabel,
            fecha: formatDateLongEs(d.appointmentDate),
            hora: d.startTime,
          },
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/mi-cuenta");

    return {
      success: true,
      appointment: {
        id: appt.id,
        appointment_date: d.appointmentDate,
        start_time: d.startTime,
        end_time: endTime,
        staff_id: targetStaffId,
        total_duration_minutes: duration,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo mover la cita.",
    };
  }
}

const FullEditAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  staffId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(15).max(480),
  bufferMinutes: z.number().int().min(0).max(120),
  status: z.enum(["pending_deposit", "confirmed", "completed", "cancelled", "no_show"]),
  serviceId: z.string().uuid().optional(),
  addonIds: z.array(z.string().uuid()).optional(),
  manualAdjustmentClp: z.number().int(),
  adminNotes: z.string().max(1000).default(""),
  clientNotes: z.string().max(1000).default(""),
  forceOverride: z.boolean().default(false),
  notifyClientEmail: z.boolean().default(false),
});

export async function adminFullEditAppointmentAction(rawInput: unknown): Promise<
  | { success: true }
  | { success: false; error: string; conflict?: MoveConflictInfo }
> {
  try {
    const ctx = await requireAdmin();
    const parsed = FullEditAppointmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Revisa los datos de la cita.",
      };
    }

    const d = parsed.data;
    const admin = createSupabaseAdminClient();

    const { data: appt } = await admin
      .from("appointments")
      .select(
        "id, booking_code, staff_id, status, appointment_date, start_time, total_duration_minutes, rescheduled_count, client:clients(first_name, email), items:appointment_items(*)"
      )
      .eq("business_id", ctx.business.id)
      .eq("id", d.appointmentId)
      .single();

    if (!appt) return { success: false, error: "Cita no encontrada." };

    const targetStaffId = d.staffId || appt.staff_id;
    const startMin = timeToMinutes(d.startTime);
    const endMin = startMin + d.durationMinutes;
    if (startMin < 0 || endMin > 24 * 60) {
      return { success: false, error: "La duración excede el final del día." };
    }

    const isActiveTarget = ["pending_deposit", "confirmed", "completed"].includes(d.status);
    if (isActiveTarget && !d.forceOverride) {
      const conflict = await detectScheduleConflicts({
        businessId: ctx.business.id,
        staffId: targetStaffId,
        appointmentDate: d.appointmentDate,
        startMin,
        endMin,
        excludeAppointmentId: appt.id,
      });
      if (conflict) {
        return { success: false, error: conflict.message, conflict };
      }
    }

    const endTime = minutesToTime(endMin);
    const dateOrTimeChanged =
      appt.appointment_date !== d.appointmentDate ||
      appt.start_time.slice(0, 5) !== d.startTime;

    const patch: Record<string, unknown> = {
      appointment_date: d.appointmentDate,
      start_time: d.startTime,
      end_time: endTime,
      staff_id: targetStaffId,
      total_duration_minutes: d.durationMinutes,
      buffer_minutes: d.bufferMinutes,
      status: d.status,
      manual_adjustment_clp: d.manualAdjustmentClp,
      admin_notes: d.adminNotes.trim() || null,
      client_notes: d.clientNotes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (dateOrTimeChanged) {
      patch.rescheduled_count = (appt.rescheduled_count || 0) + 1;
      patch.reminder_48h_sent_at = null;
      patch.reminder_24h_sent_at = null;
    }

    if (d.status === "confirmed" && appt.status !== "confirmed") {
      patch.confirmed_at = new Date().toISOString();
      patch.hold_expires_at = null;
    }
    if (d.status === "completed" && appt.status !== "completed") {
      patch.completed_at = new Date().toISOString();
    }
    if (d.status === "cancelled" && appt.status !== "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.cancellation_reason = "Cancelada desde editor de agenda";
    }

    let finalServiceLabel =
      (appt.items as Array<{ name_snapshot: string }> | undefined)
        ?.map((i) => i.name_snapshot)
        .join(" + ") || "Tu servicio";

    // Optional service/addons swap
    if (d.serviceId) {
      const { data: srv } = await admin
        .from("services")
        .select("id, name, price_clp, duration_minutes")
        .eq("business_id", ctx.business.id)
        .eq("id", d.serviceId)
        .single();

      if (srv) {
        let addonRows: Array<{
          id: string;
          name: string;
          price_clp: number;
          duration_minutes: number;
          addon_type: string;
        }> = [];
        if (d.addonIds && d.addonIds.length > 0) {
          const { data: rows } = await admin
            .from("service_addons")
            .select("id, name, price_clp, duration_minutes, addon_type")
            .eq("business_id", ctx.business.id)
            .in("id", d.addonIds);
          addonRows = rows || [];
        }

        const existingCustomItems = (
          (appt.items as Array<{
            item_type: string;
            unit_price_clp: number;
            quantity: number;
          }>) || []
        ).filter((i) => i.item_type === "custom");

        // Replace service & addon rows while keeping custom chair extras intact
        await admin
          .from("appointment_items")
          .delete()
          .eq("business_id", ctx.business.id)
          .eq("appointment_id", appt.id)
          .in("item_type", ["service", "addon"]);

        const newItems = [
          {
            business_id: ctx.business.id,
            appointment_id: appt.id,
            item_type: "service" as const,
            service_id: srv.id,
            addon_id: null,
            name_snapshot: srv.name,
            duration_minutes_snapshot: srv.duration_minutes,
            unit_price_clp: srv.price_clp,
            quantity: 1,
          },
          ...addonRows.map((a) => ({
            business_id: ctx.business.id,
            appointment_id: appt.id,
            item_type: "addon" as const,
            service_id: null,
            addon_id: a.id,
            name_snapshot: a.name,
            duration_minutes_snapshot: a.duration_minutes,
            unit_price_clp: a.price_clp,
            quantity: 1,
          })),
        ];

        await admin.from("appointment_items").insert(newItems);

        const customSum = existingCustomItems.reduce(
          (sum, c) => sum + (c.unit_price_clp || 0) * (c.quantity || 1),
          0
        );
        const addonsSum =
          addonRows.reduce((sum, a) => sum + (a.price_clp || 0), 0) + customSum;

        patch.service_subtotal_clp = srv.price_clp;
        patch.addons_subtotal_clp = addonsSum;
        patch.total_estimated_clp = Math.max(
          0,
          srv.price_clp + addonsSum + d.manualAdjustmentClp
        );
        patch.has_external_product = addonRows.some(
          (a) => a.addon_type === "new_client_check"
        );

        finalServiceLabel =
          addonRows.length > 0
            ? `${srv.name} + ${addonRows.map((a) => a.name).join(", ")}`
            : srv.name;
      }
    }

    const { error } = await admin
      .from("appointments")
      .update(patch)
      .eq("business_id", ctx.business.id)
      .eq("id", appt.id);

    if (error) throw new Error(error.message);

    if (d.notifyClientEmail && dateOrTimeChanged) {
      const clientObj = Array.isArray(appt.client) ? appt.client[0] : appt.client;
      if (clientObj?.email) {
        await sendBusinessEmail({
          businessId: ctx.business.id,
          to: clientObj.email,
          templateKey: "booking_rescheduled",
          appointmentId: appt.id,
          variables: {
            nombre: clientObj.first_name,
            codigo: appt.booking_code,
            servicio: finalServiceLabel,
            fecha: formatDateLongEs(d.appointmentDate),
            hora: d.startTime,
          },
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/clients");
    revalidatePath("/mi-cuenta");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error guardando los cambios.",
    };
  }
}

const QuickClientEditSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().trim().min(2, "Nombre requerido").max(60),
  lastName: z.string().trim().max(80).default(""),
  email: z.string().trim().email("Correo inválido"),
  phone: z.string().trim().max(25).default(""),
  instagramHandle: z.string().trim().max(60).default(""),
});

export async function quickEditClientFromAgendaAction(rawInput: unknown) {
  try {
    const ctx = await requireAdmin();
    const parsed = QuickClientEditSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Datos de clienta inválidos.",
      };
    }
    const d = parsed.data;
    const cleanPhone = d.phone.trim() ? normalizePhone(d.phone) : "";
    if (d.phone.trim() && !isValidPhone(cleanPhone)) {
      return { success: false as const, error: "WhatsApp inválido (ej. +56 9 1234 5678)." };
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("clients")
      .update({
        first_name: normalizePersonName(d.firstName),
        last_name: d.lastName.trim() ? normalizePersonName(d.lastName) : null,
        email: normalizeEmail(d.email),
        phone: cleanPhone || null,
        instagram_handle: normalizeInstagramHandle(d.instagramHandle) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", ctx.business.id)
      .eq("id", d.clientId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/clients");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error actualizando datos de clienta.",
    };
  }
}

export async function togglePublicAgendaOpenAction(isAgendaOpen: boolean) {
  try {
    const ctx = await requireAdmin();
    const bundle = await getActiveBusinessBundle();
    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: "booking",
        key: "booking_rules",
        value: {
          ...bundle.bookingRules,
          isAgendaOpen,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );

    if (error) throw new Error(error.message);

    revalidateTag("business-settings", "max");
    revalidatePath("/reservar");
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/schedule");
    return { success: true as const, isAgendaOpen };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error cambiando estado de la agenda.",
    };
  }
}

const QuickBlockSchema = z.object({
  staffId: z.string().uuid(),
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exceptionType: z.enum(["block_day", "block_range", "open_custom"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().max(180).optional(),
});

export async function quickCreateAgendaBlockAction(rawInput: unknown) {
  try {
    const ctx = await requireAdmin();
    const parsed = QuickBlockSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Datos de bloqueo inválidos.",
      };
    }

    const d = parsed.data;
    if (d.exceptionType !== "block_day") {
      if (!d.startTime || !d.endTime || timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) {
        return {
          success: false as const,
          error: "La hora de término debe ser posterior a la hora de inicio.",
        };
      }
    }

    const admin = createSupabaseAdminClient();
    const { data: created, error } = await admin
      .from("availability_exceptions")
      .insert({
        business_id: ctx.business.id,
        staff_id: d.staffId,
        exception_date: d.exceptionDate,
        exception_type: d.exceptionType,
        start_time: d.exceptionType === "block_day" ? null : d.startTime || null,
        end_time: d.exceptionType === "block_day" ? null : d.endTime || null,
        reason: d.reason || null,
      })
      .select("id, business_id, staff_id, exception_date, exception_type, start_time, end_time, reason")
      .single();

    if (error || !created) throw new Error(error?.message || "No se pudo crear el bloqueo.");

    revalidatePath("/reservar");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/schedule");
    return { success: true as const, exception: created as AvailabilityException };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo crear el bloqueo.",
    };
  }
}

export async function quickDeleteAgendaBlockAction(exceptionId: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("availability_exceptions")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", exceptionId);

    if (error) throw new Error(error.message);

    revalidatePath("/reservar");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/schedule");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo eliminar el bloqueo.",
    };
  }
}

const BulkShiftSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().optional(),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).default("00:00"),
  deltaMinutes: z.number().int().min(-180).max(180).refine((v) => v !== 0, {
    message: "El desplazamiento debe ser distinto de 0.",
  }),
  notifyEmail: z.boolean().default(false),
});

export interface ShiftedAppointmentSummary {
  id: string;
  bookingCode: string;
  clientName: string;
  clientPhone: string | null;
  oldStart: string;
  newStart: string;
  newEnd: string;
}

export async function bulkShiftDayAppointmentsAction(rawInput: unknown): Promise<
  | { success: true; shifted: ShiftedAppointmentSummary[] }
  | { success: false; error: string }
> {
  try {
    const ctx = await requireAdmin();
    const parsed = BulkShiftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Parámetros inválidos.",
      };
    }

    const d = parsed.data;
    const admin = createSupabaseAdminClient();

    let query = admin
      .from("appointments")
      .select(
        "id, booking_code, start_time, end_time, total_duration_minutes, rescheduled_count, client:clients(first_name, last_name, phone, email), items:appointment_items(name_snapshot)"
      )
      .eq("business_id", ctx.business.id)
      .eq("appointment_date", d.dateStr)
      .in("status", ["pending_deposit", "confirmed"])
      .order("start_time", { ascending: true });

    if (d.staffId) {
      query = query.eq("staff_id", d.staffId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const fromMin = timeToMinutes(d.fromTime);
    const targets = (rows || []).filter((r) => timeToMinutes(r.start_time) >= fromMin);

    if (targets.length === 0) {
      return {
        success: false,
        error: "No hay citas activas a partir de esa hora para correr.",
      };
    }

    // Validate bounds first
    for (const t of targets) {
      const nextStart = timeToMinutes(t.start_time) + d.deltaMinutes;
      const nextEnd = nextStart + t.total_duration_minutes;
      if (nextStart < 0 || nextEnd > 24 * 60) {
        return {
          success: false,
          error: `La cita ${t.booking_code} quedaría fuera del rango horario del día.`,
        };
      }
    }

    const shifted: ShiftedAppointmentSummary[] = [];
    for (const t of targets) {
      const oldStart = t.start_time.slice(0, 5);
      const nextStartMin = timeToMinutes(t.start_time) + d.deltaMinutes;
      const newStart = minutesToTime(nextStartMin);
      const newEnd = minutesToTime(nextStartMin + t.total_duration_minutes);

      await admin
        .from("appointments")
        .update({
          start_time: newStart,
          end_time: newEnd,
          rescheduled_count: (t.rescheduled_count || 0) + 1,
          reminder_48h_sent_at: null,
          reminder_24h_sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", ctx.business.id)
        .eq("id", t.id);

      const clientObj = Array.isArray(t.client) ? t.client[0] : t.client;
      const clientName = [clientObj?.first_name, clientObj?.last_name]
        .filter(Boolean)
        .join(" ") || "Clienta";

      shifted.push({
        id: t.id,
        bookingCode: t.booking_code,
        clientName,
        clientPhone: clientObj?.phone || null,
        oldStart,
        newStart,
        newEnd,
      });

      if (d.notifyEmail && clientObj?.email) {
        const serviceLabel =
          (t.items as Array<{ name_snapshot: string }> | undefined)
            ?.map((i) => i.name_snapshot)
            .join(" + ") || "Tu servicio";
        await sendBusinessEmail({
          businessId: ctx.business.id,
          to: clientObj.email,
          templateKey: "booking_rescheduled",
          appointmentId: t.id,
          variables: {
            nombre: clientObj.first_name || clientName,
            codigo: t.booking_code,
            servicio: serviceLabel,
            fecha: formatDateLongEs(d.dateStr),
            hora: newStart,
          },
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/mi-cuenta");
    return { success: true, shifted };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error corriendo citas del día.",
    };
  }
}

const EmergencyCloseDaySchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid(),
  reason: z.string().trim().min(2, "Indica un motivo breve").max(200),
  cancelAppointmentIds: z.array(z.string().uuid()).default([]),
});

export async function emergencyCloseDayAction(rawInput: unknown) {
  try {
    const ctx = await requireAdmin();
    const parsed = EmergencyCloseDaySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Datos inválidos.",
      };
    }

    const d = parsed.data;
    const admin = createSupabaseAdminClient();

    // 1. Ensure day block exists
    const { data: existingBlock } = await admin
      .from("availability_exceptions")
      .select("id")
      .eq("business_id", ctx.business.id)
      .eq("staff_id", d.staffId)
      .eq("exception_date", d.dateStr)
      .eq("exception_type", "block_day")
      .maybeSingle();

    if (!existingBlock) {
      await admin.from("availability_exceptions").insert({
        business_id: ctx.business.id,
        staff_id: d.staffId,
        exception_date: d.dateStr,
        exception_type: "block_day",
        start_time: null,
        end_time: null,
        reason: d.reason,
      });
    }

    // 2. Cancel selected appointments if requested
    if (d.cancelAppointmentIds.length > 0) {
      await admin
        .from("appointments")
        .update({
          status: "cancelled" as AppointmentStatus,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Cierre de emergencia: ${d.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", ctx.business.id)
        .in("id", d.cancelAppointmentIds);
    }

    revalidatePath("/reservar");
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/schedule");
    revalidatePath("/mi-cuenta");
    return {
      success: true as const,
      cancelledCount: d.cancelAppointmentIds.length,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error ejecutando cierre de emergencia.",
    };
  }
}
