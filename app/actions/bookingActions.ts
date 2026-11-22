"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import {
  getAvailableDatesSummary,
  getAvailableSlotsForDate,
} from "@/lib/services/availabilityService";
import { getActiveBusinessBundle } from "@/lib/services/businessService";
import {
  createBookingCore,
  rescheduleClientAppointmentCore,
} from "@/lib/services/bookingService";
import { sendBusinessEmail } from "@/lib/services/emailService";
import {
  CreatePublicBookingSchema,
  RescheduleAppointmentSchema,
} from "@/lib/types";
import { formatDateLongEs, hoursUntilAppointment, normalizeEmail } from "@/lib/utils";

export async function getAvailableDatesAction(params: {
  staffId: string;
  durationMinutes: number;
  bufferMinutes?: number;
}) {
  const bundle = await getActiveBusinessBundle();
  return getAvailableDatesSummary({
    businessId: bundle.business.id,
    staffId: params.staffId,
    durationMinutes: params.durationMinutes,
    bufferMinutes: params.bufferMinutes,
    daysToCheck: 40,
  });
}

export async function getAvailableSlotsAction(params: {
  staffId: string;
  dateStr: string;
  durationMinutes: number;
  bufferMinutes?: number;
  excludeAppointmentId?: string;
}) {
  const bundle = await getActiveBusinessBundle();
  return getAvailableSlotsForDate({
    businessId: bundle.business.id,
    staffId: params.staffId,
    dateStr: params.dateStr,
    durationMinutes: params.durationMinutes,
    bufferMinutes: params.bufferMinutes,
    excludeAppointmentId: params.excludeAppointmentId,
  });
}

export async function createPublicBookingAction(rawInput: unknown) {
  try {
    if (!hasValidServiceRoleKey()) {
      return {
        success: false as const,
        error:
          "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para registrar reservas.",
      };
    }

    const parsed = CreatePublicBookingSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Revisa los datos ingresados.",
      };
    }

    const bundle = await getActiveBusinessBundle();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (bundle.bookingRules.requireClientOtp) {
      if (!user || normalizeEmail(user.email || "") !== normalizeEmail(parsed.data.email)) {
        return {
          success: false as const,
          error: "Debes validar tu correo con el código de verificación antes de confirmar.",
        };
      }
    }

    const result = await createBookingCore({
      input: parsed.data,
      source: "web",
      authUserId: user?.id || null,
      isAdmin: false,
    });

    revalidatePath("/reservar");
    revalidatePath("/mi-cuenta");
    revalidatePath("/admin");

    return {
      success: true as const,
      bookingCode: result.appointment.booking_code,
      appointmentDate: result.appointment.appointment_date,
      startTime: result.appointment.start_time.slice(0, 5),
      serviceName: result.serviceName,
      depositAmountClp: result.appointment.deposit_required_clp,
      totalEstimatedClp: result.appointment.total_estimated_clp,
      whatsappUrl: result.whatsappUrl,
      paymentBank: result.paymentBank,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo completar tu reserva.",
    };
  }
}

export async function linkClientSessionAction() {
  if (!hasValidServiceRoleKey()) return { ok: false };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false };

  const bundle = await getActiveBusinessBundle();
  const admin = createSupabaseAdminClient();
  await admin
    .from("clients")
    .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
    .eq("business_id", bundle.business.id)
    .eq("email", normalizeEmail(user.email))
    .is("auth_user_id", null);

  return { ok: true };
}

export async function updateClientBirthDateAction(birthDate: string) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      return { success: false as const, error: "Fecha inválida." };
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return { success: false as const, error: "Debes iniciar sesión." };
    }
    const bundle = await getActiveBusinessBundle();
    const admin = createSupabaseAdminClient();
    await admin
      .from("clients")
      .update({ birth_date: birthDate.trim(), updated_at: new Date().toISOString() })
      .eq("business_id", bundle.business.id)
      .or(`auth_user_id.eq.${user.id},email.eq.${normalizeEmail(user.email)}`);

    revalidatePath("/mi-cuenta");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "No pudimos guardar tu cumpleaños." };
  }
}

export async function rescheduleClientAppointmentAction(rawInput: unknown) {
  try {
    const parsed = RescheduleAppointmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false as const, error: "Datos inválidos para reprogramar." };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false as const, error: "Sesión expirada. Vuelve a ingresar." };
    }

    const bundle = await getActiveBusinessBundle();
    await rescheduleClientAppointmentCore({
      businessId: bundle.business.id,
      authUserId: user.id,
      appointmentId: parsed.data.appointmentId,
      newDate: parsed.data.appointmentDate,
      newStartTime: parsed.data.startTime,
    });

    revalidatePath("/mi-cuenta");
    revalidatePath("/reservar");
    revalidatePath("/admin");

    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo reprogramar la cita.",
    };
  }
}

export async function cancelClientAppointmentAction(appointmentId: string, reason?: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false as const, error: "Debes iniciar sesión." };
    }

    const bundle = await getActiveBusinessBundle();
    if (!bundle.bookingRules.allowClientCancel) {
      return {
        success: false as const,
        error: "Las cancelaciones se gestionan directamente por WhatsApp.",
      };
    }

    const admin = createSupabaseAdminClient();
    const { data: appt } = await admin
      .from("appointments")
      .select(
        "*, client:clients!inner(id, auth_user_id, first_name, email), items:appointment_items(name_snapshot)"
      )
      .eq("business_id", bundle.business.id)
      .eq("id", appointmentId)
      .single();

    if (!appt || appt.client?.auth_user_id !== user.id) {
      return { success: false as const, error: "Cita no encontrada." };
    }

    const hoursLeft = hoursUntilAppointment(
      appt.appointment_date,
      appt.start_time,
      bundle.business.timezone
    );
    if (hoursLeft < bundle.bookingRules.rescheduleCutoffHours) {
      return {
        success: false as const,
        error: `Solo puedes cancelar online hasta ${bundle.bookingRules.rescheduleCutoffHours} horas antes. Escríbenos por WhatsApp.`,
      };
    }

    await admin
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason?.trim() || "Cancelada por clienta",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    const serviceLabel =
      (appt.items as Array<{ name_snapshot: string }> | undefined)
        ?.map((i) => i.name_snapshot)
        .join(" + ") || "Tu servicio";

    if (appt.client?.email) {
      await sendBusinessEmail({
        businessId: bundle.business.id,
        to: appt.client.email,
        templateKey: "booking_cancelled",
        appointmentId: appt.id,
        variables: {
          nombre: appt.client.first_name,
          codigo: appt.booking_code,
          servicio: serviceLabel,
          fecha: formatDateLongEs(appt.appointment_date),
          hora: appt.start_time.slice(0, 5),
        },
      });
    }

    revalidatePath("/mi-cuenta");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error al cancelar la cita.",
    };
  }
}
