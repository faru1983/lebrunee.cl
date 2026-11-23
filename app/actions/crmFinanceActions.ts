"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAvailableSlotsForDate } from "@/lib/services/availabilityService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import {
  filterBirthdayDueToday,
  filterRetentionCandidates,
  getAdminClientsList,
} from "@/lib/services/crmService";
import { sendBusinessEmail } from "@/lib/services/emailService";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import {
  getTodayInTimezone,
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

// 1. Appointment Detail: Reschedule / Edit Notes / Checkout & Close Balance
export async function adminUpdateAppointmentAction(payload: {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  adminNotes: string;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: appt } = await admin
      .from("appointments")
      .select("id, staff_id, total_duration_minutes, buffer_minutes")
      .eq("business_id", ctx.business.id)
      .eq("id", payload.appointmentId)
      .single();

    if (!appt) return { success: false as const, error: "Cita no encontrada." };

    const slots = await getAvailableSlotsForDate({
      businessId: ctx.business.id,
      staffId: appt.staff_id,
      dateStr: payload.appointmentDate,
      durationMinutes: appt.total_duration_minutes,
      bufferMinutes: appt.buffer_minutes,
      excludeAppointmentId: appt.id,
      ignoreAdvanceRule: true,
    });

    if (slots.length > 0 && !slots.some((s) => s.startTime === payload.startTime)) {
      // Admin override is allowed if needed, or warn? Let's allow admin flexible time if no collision,
      // actually checking direct overlap only if slots list didn't forbid? Keeping admin flexible is key!
    }

    const endTime = minutesToTime(
      timeToMinutes(payload.startTime) + appt.total_duration_minutes
    );

    const { error } = await admin
      .from("appointments")
      .update({
        appointment_date: payload.appointmentDate,
        start_time: payload.startTime,
        end_time: endTime,
        admin_notes: payload.adminNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", ctx.business.id)
      .eq("id", appt.id);

    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/mi-cuenta");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error actualizando la cita.",
    };
  }
}

export async function closeAppointmentWithPaymentAction(payload: {
  appointmentId: string;
  extras: Array<{ name: string; priceClp: number }>;
  manualAdjustmentClp: number;
  amountPaidNowClp: number;
  paymentMethodId: string | null;
  referenceNote: string;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: appt } = await admin
      .from("appointments")
      .select("id, booking_code, client_id, service_subtotal_clp, addons_subtotal_clp, total_paid_clp")
      .eq("business_id", ctx.business.id)
      .eq("id", payload.appointmentId)
      .single();

    if (!appt) return { success: false as const, error: "Cita no encontrada." };

    const validExtras = payload.extras.filter(
      (e) => e.name.trim().length > 0 && e.priceClp >= 0
    );

    if (validExtras.length > 0) {
      await admin.from("appointment_items").insert(
        validExtras.map((e) => ({
          business_id: ctx.business.id,
          appointment_id: appt.id,
          item_type: "custom",
          service_id: null,
          addon_id: null,
          name_snapshot: e.name.trim(),
          duration_minutes_snapshot: 0,
          unit_price_clp: Math.round(e.priceClp),
          quantity: 1,
        }))
      );
    }

    const extrasTotal = validExtras.reduce((sum, e) => sum + Math.round(e.priceClp), 0);
    const { data: allItems } = await admin
      .from("appointment_items")
      .select("item_type, unit_price_clp, quantity")
      .eq("appointment_id", appt.id);

    const recomputedTotal = (allItems || []).reduce(
      (sum, i) => sum + (i.unit_price_clp || 0) * (i.quantity || 1),
      0
    );

    const newTotalPaid = (appt.total_paid_clp || 0) + Math.max(0, Math.round(payload.amountPaidNowClp));

    if (payload.amountPaidNowClp > 0) {
      await admin.from("payments").insert({
        business_id: ctx.business.id,
        appointment_id: appt.id,
        client_id: appt.client_id,
        payment_method_id: payload.paymentMethodId || null,
        payment_type: "balance",
        amount_clp: Math.round(payload.amountPaidNowClp),
        reference_note:
          payload.referenceNote.trim() || `Cierre cita ${appt.booking_code}`,
        recorded_by: ctx.user.id,
      });
    }

    await admin
      .from("appointments")
      .update({
        status: "completed",
        addons_subtotal_clp: (appt.addons_subtotal_clp || 0) + extrasTotal,
        manual_adjustment_clp: Math.round(payload.manualAdjustmentClp || 0),
        total_estimated_clp: recomputedTotal,
        total_paid_clp: newTotalPaid,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", ctx.business.id)
      .eq("id", appt.id);

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/finanzas");
    revalidatePath("/admin/clients");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error cerrando la cita.",
    };
  }
}

// 2. CRM: Update Client & Technical Nail Notes
export async function updateClientProfileAction(payload: {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  instagramHandle: string;
  tags: string[];
  notes: string;
  retentionOptOut: boolean;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const phone = normalizePhone(payload.phone);
    if (payload.phone.trim() && !isValidPhone(phone)) {
      return { success: false as const, error: "Teléfono WhatsApp inválido." };
    }

    const cleanBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate.trim())
      ? payload.birthDate.trim()
      : null;

    const { error } = await admin
      .from("clients")
      .update({
        first_name: normalizePersonName(payload.firstName),
        last_name: payload.lastName.trim() ? normalizePersonName(payload.lastName) : null,
        email: normalizeEmail(payload.email),
        phone: phone || null,
        birth_date: cleanBirthDate,
        instagram_handle: normalizeInstagramHandle(payload.instagramHandle) || null,
        tags: payload.tags,
        notes: payload.notes.trim() || null,
        retention_opt_out: payload.retentionOptOut,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", ctx.business.id)
      .eq("id", payload.clientId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${payload.clientId}`);
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error actualizando ficha de clienta.",
    };
  }
}

export async function addClientTechnicalNoteAction(payload: {
  clientId: string;
  note: string;
}) {
  try {
    const ctx = await requireAdmin();
    if (!payload.note.trim()) {
      return { success: false as const, error: "Escribe una nota antes de guardar." };
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("client_notes").insert({
      business_id: ctx.business.id,
      client_id: payload.clientId,
      note: payload.note.trim(),
      created_by: ctx.user.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/clients/${payload.clientId}`);
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error agregando nota técnica.",
    };
  }
}

export async function deleteClientTechnicalNoteAction(noteId: string, clientId: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    await admin
      .from("client_notes")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", noteId);

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo eliminar la nota.",
    };
  }
}

// 3. Finance: Direct Sale & Expenses
export async function recordDirectSaleAction(payload: {
  amountClp: number;
  paymentMethodId: string | null;
  clientId: string | null;
  referenceNote: string;
}) {
  try {
    const ctx = await requireAdmin();
    if (payload.amountClp <= 0) {
      return { success: false as const, error: "El monto debe ser mayor a 0." };
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("payments").insert({
      business_id: ctx.business.id,
      appointment_id: null,
      client_id: payload.clientId || null,
      payment_method_id: payload.paymentMethodId || null,
      payment_type: "direct_sale",
      amount_clp: Math.round(payload.amountClp),
      reference_note: payload.referenceNote.trim() || "Venta rápida",
      recorded_by: ctx.user.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/admin/finanzas");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error registrando venta.",
    };
  }
}

export async function addExpenseAction(payload: {
  expenseDate: string;
  category: string;
  description: string;
  amountClp: number;
  paymentMethodId: string | null;
}) {
  try {
    const ctx = await requireAdmin();
    if (payload.amountClp <= 0) {
      return { success: false as const, error: "El monto debe ser mayor a 0." };
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("expenses").insert({
      business_id: ctx.business.id,
      expense_date: payload.expenseDate,
      category: payload.category.trim() || "Otros",
      description: payload.description.trim() || null,
      amount_clp: Math.round(payload.amountClp),
      payment_method_id: payload.paymentMethodId || null,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/finanzas");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error registrando gasto.",
    };
  }
}

export async function deleteExpenseAction(expenseId: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    await admin
      .from("expenses")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", expenseId);
    revalidatePath("/admin/finanzas");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error eliminando gasto.",
    };
  }
}

// 4. Communications & Retention Reminders (XX days)
export async function saveRetentionRulesAction(payload: {
  retentionEnabled: boolean;
  daysSinceLastVisit: number;
  cooldownDays: number;
  whatsappTemplate: string;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: "notifications",
        key: "retention_rules",
        value: {
          retentionEnabled: payload.retentionEnabled,
          daysSinceLastVisit: Math.max(1, Math.round(payload.daysSinceLastVisit)),
          cooldownDays: Math.max(1, Math.round(payload.cooldownDays)),
          whatsappTemplate: payload.whatsappTemplate.trim(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );
    if (error) throw new Error(error.message);

    revalidateTag("business-settings", "max");
    revalidatePath("/admin/comunicaciones");
    revalidatePath("/admin/clients");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando regla de mantención.",
    };
  }
}

export async function logRetentionWhatsappAction(
  clientId: string,
  daysSinceLastVisit: number
) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    await admin.from("client_retention_logs").insert({
      business_id: ctx.business.id,
      client_id: clientId,
      channel: "whatsapp",
      days_since_last_visit: daysSinceLastVisit,
    });
    revalidatePath("/admin/comunicaciones");
    revalidatePath("/admin/clients");
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}

export async function sendRetentionEmailBatchAction() {
  try {
    const ctx = await requireAdmin();
    const bundle = await getActiveBusinessBundle();
    const clients = await getAdminClientsList(
      ctx.business.id,
      bundle.business.timezone
    );
    const candidates = filterRetentionCandidates(clients, bundle.retentionRules);

    if (candidates.length === 0) {
      return { success: true as const, sent: 0, skipped: 0, message: "No hay clientas elegibles hoy." };
    }

    const admin = createSupabaseAdminClient();
    const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lebrunee.cl"}/reservar`;
    let sent = 0;
    let skipped = 0;

    for (const c of candidates) {
      const res = await sendBusinessEmail({
        businessId: ctx.business.id,
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
        sent++;
        await admin.from("client_retention_logs").insert({
          business_id: ctx.business.id,
          client_id: c.id,
          channel: "email",
          days_since_last_visit: c.daysSinceLastVisit || bundle.retentionRules.daysSinceLastVisit,
        });
      } else {
        skipped++;
      }
    }

    revalidatePath("/admin/comunicaciones");
    revalidatePath("/admin/clients");
    return {
      success: true as const,
      sent,
      skipped,
      message: `Proceso terminado: ${sent} enviados, ${skipped} omitidos.`,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error enviando recordatorios.",
    };
  }
}

export async function saveAppointmentReminderToggleAction(payload: {
  autoRemindersEnabled: boolean;
}) {
  try {
    const ctx = await requireAdmin();
    const bundle = await getActiveBusinessBundle();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: "notifications",
        key: "notifications",
        value: {
          ...bundle.notifications,
          autoRemindersEnabled: payload.autoRemindersEnabled,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );
    if (error) throw new Error(error.message);

    revalidateTag("business-settings", "max");
    revalidatePath("/admin/comunicaciones");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando configuración.",
    };
  }
}

export async function saveBirthdayRulesAction(payload: {
  birthdayEnabled: boolean;
  daysBefore: number;
  whatsappTemplate: string;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: "notifications",
        key: "birthday_rules",
        value: {
          birthdayEnabled: payload.birthdayEnabled,
          daysBefore: Math.max(0, Math.min(30, Math.round(payload.daysBefore))),
          whatsappTemplate: payload.whatsappTemplate.trim(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );
    if (error) throw new Error(error.message);

    revalidateTag("business-settings", "max");
    revalidatePath("/admin/comunicaciones");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando regla de cumpleaños.",
    };
  }
}

export async function logBirthdayWhatsappAction(clientId: string) {
  try {
    const ctx = await requireAdmin();
    const bundle = await getActiveBusinessBundle();
    const today = getTodayInTimezone(bundle.business.timezone);
    const year = Number(today.slice(0, 4));
    const admin = createSupabaseAdminClient();
    await admin.from("client_birthday_logs").upsert(
      {
        business_id: ctx.business.id,
        client_id: clientId,
        birthday_year: year,
        channel: "whatsapp",
      },
      { onConflict: "business_id,client_id,birthday_year,channel" }
    );
    revalidatePath("/admin/comunicaciones");
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}

export async function sendBirthdayEmailBatchAction() {
  try {
    const ctx = await requireAdmin();
    const bundle = await getActiveBusinessBundle();
    const today = getTodayInTimezone(bundle.business.timezone);
    const currentYear = Number(today.slice(0, 4));

    const clients = await getAdminClientsList(
      ctx.business.id,
      bundle.business.timezone
    );
    const candidates = filterBirthdayDueToday(
      clients,
      bundle.birthdayRules,
      today
    );

    if (candidates.length === 0) {
      return {
        success: true as const,
        sent: 0,
        skipped: 0,
        message: "No hay cumpleaños programados para enviar hoy.",
      };
    }

    const admin = createSupabaseAdminClient();
    const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lebrunee.cl"}/reservar`;
    let sent = 0;
    let skipped = 0;

    for (const c of candidates) {
      const res = await sendBusinessEmail({
        businessId: ctx.business.id,
        to: c.email,
        templateKey: "birthday_gift",
        category: "reminder",
        variables: {
          nombre: c.first_name,
          link_reserva: bookingUrl,
        },
      });

      if (res.status === "sent") {
        sent++;
        await admin.from("client_birthday_logs").upsert(
          {
            business_id: ctx.business.id,
            client_id: c.id,
            birthday_year: currentYear,
            channel: "email",
          },
          { onConflict: "business_id,client_id,birthday_year,channel" }
        );
      } else {
        skipped++;
      }
    }

    revalidatePath("/admin/comunicaciones");
    return {
      success: true as const,
      sent,
      skipped,
      message: `Cumpleaños procesados: ${sent} enviados, ${skipped} omitidos.`,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error enviando cumpleaños.",
    };
  }
}
