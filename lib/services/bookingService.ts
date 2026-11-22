import { randomInt } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAvailableSlotsForDate } from "@/lib/services/availabilityService";
import {
  getActiveBusinessBundle,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import { sendBusinessEmail } from "@/lib/services/emailService";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type {
  AppointmentRecord,
  CreateAdminAppointmentSchema,
  CreatePublicBookingSchema,
} from "@/lib/types";
import {
  buildWhatsAppUrl,
  formatClp,
  formatDateLongEs,
  hoursUntilAppointment,
  minutesToTime,
  normalizeEmail,
  normalizePersonName,
  resolveTemplate,
  timeToMinutes,
} from "@/lib/utils";
import type { z } from "zod";

function generateBookingCode(businessName: string): string {
  const letters = businessName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "BK";
  const num = randomInt(1000, 9999);
  return `${letters}-${num}`;
}

export async function createBookingCore(params: {
  input:
    | z.infer<typeof CreatePublicBookingSchema>
    | z.infer<typeof CreateAdminAppointmentSchema>;
  source: "web" | "admin" | "whatsapp";
  authUserId?: string | null;
  isAdmin?: boolean;
}) {
  const { input, source, authUserId = null, isAdmin = false } = params;
  const admin = createSupabaseAdminClient();
  const bundle = await getActiveBusinessBundle();
  const businessId = bundle.business.id;

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) {
    throw new Error("El número de WhatsApp debe ser válido (ej. +56 9 1234 5678).");
  }

  // Zero-trust catalog lookup
  const { data: service, error: srvErr } = await admin
    .from("services")
    .select("id, name, price_clp, duration_minutes, buffer_minutes, deposit_override_clp, is_active")
    .eq("business_id", businessId)
    .eq("id", input.serviceId)
    .eq("is_active", true)
    .single();

  if (srvErr || !service) {
    throw new Error("El servicio seleccionado ya no está disponible.");
  }

  let addons: Array<{
    id: string;
    name: string;
    price_clp: number;
    duration_minutes: number;
    addon_type: string;
  }> = [];

  if (input.addonIds.length > 0) {
    const { data: addonRows } = await admin
      .from("service_addons")
      .select("id, name, price_clp, duration_minutes, addon_type")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .in("id", input.addonIds);
    addons = addonRows || [];
  }

  const totalDuration =
    service.duration_minutes +
    addons.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const effectiveBuffer = service.buffer_minutes ?? bundle.bookingRules.bufferMinutes;

  const serviceSubtotal = service.price_clp;
  const addonsSubtotal = addons.reduce((acc, a) => acc + (a.price_clp || 0), 0);
  const totalEstimated = serviceSubtotal + addonsSubtotal;
  const depositRequired =
    service.deposit_override_clp ?? bundle.paymentBank.depositAmountClp;

  // Verify availability on the server
  const availableSlots = await getAvailableSlotsForDate({
    businessId,
    staffId: input.staffId,
    dateStr: input.appointmentDate,
    durationMinutes: totalDuration,
    bufferMinutes: effectiveBuffer,
    ignoreAdvanceRule: isAdmin,
  });

  const matchingSlot = availableSlots.find((s) => s.startTime === input.startTime);
  if (!matchingSlot) {
    throw new Error(
      "La hora elegida ya no está disponible. Por favor elige otro bloque libre."
    );
  }

  const startMin = timeToMinutes(input.startTime);
  const endTime = minutesToTime(startMin + totalDuration);

  // Upsert Client
  const firstName = normalizePersonName(input.firstName);
  const lastName = normalizePersonName(input.lastName);
  const birthDate = input.birthDate?.trim() || null;
  const cleanIg = input.instagramHandle
    ? input.instagramHandle.replace(/^@/, "").trim()
    : null;

  const { data: existingClient } = await admin
    .from("clients")
    .select("id, auth_user_id, birth_date")
    .eq("business_id", businessId)
    .eq("email", email)
    .maybeSingle();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
    await admin
      .from("clients")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        phone,
        instagram_handle: cleanIg,
        birth_date: birthDate || existingClient.birth_date || null,
        auth_user_id: existingClient.auth_user_id || authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
  } else {
    const { data: createdClient, error: cliErr } = await admin
      .from("clients")
      .insert({
        business_id: businessId,
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName || null,
        phone,
        instagram_handle: cleanIg,
        birth_date: birthDate,
        is_new_client: input.isNewClient,
      })
      .select("id")
      .single();

    if (cliErr || !createdClient) {
      throw new Error("No pudimos registrar los datos de la clienta.");
    }
    clientId = createdClient.id;
  }

  const adminInput = input as z.infer<typeof CreateAdminAppointmentSchema>;
  const confirmNow = Boolean(isAdmin && adminInput.confirmImmediately);
  const depositPaid = confirmNow
    ? adminInput.depositPaidClp || depositRequired
    : 0;

  const holdExpiresAt =
    !confirmNow && bundle.bookingRules.holdExpiryMinutes
      ? new Date(Date.now() + bundle.bookingRules.holdExpiryMinutes * 60_000).toISOString()
      : null;

  const bookingCode = generateBookingCode(bundle.business.name);

  const { data: appointment, error: apptErr } = await admin
    .from("appointments")
    .insert({
      business_id: businessId,
      booking_code: bookingCode,
      client_id: clientId,
      staff_id: input.staffId,
      status: confirmNow ? "confirmed" : "pending_deposit",
      appointment_date: input.appointmentDate,
      start_time: input.startTime,
      end_time: endTime,
      total_duration_minutes: totalDuration,
      buffer_minutes: effectiveBuffer,
      service_subtotal_clp: serviceSubtotal,
      addons_subtotal_clp: addonsSubtotal,
      total_estimated_clp: totalEstimated,
      deposit_required_clp: depositRequired,
      deposit_paid_clp: depositPaid,
      total_paid_clp: depositPaid,
      has_external_product: addons.some((a) => a.addon_type === "new_client_check"),
      client_notes: input.clientNotes || null,
      admin_notes: isAdmin ? adminInput.adminNotes || null : null,
      source,
      hold_expires_at: holdExpiresAt,
      confirmed_at: confirmNow ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (apptErr || !appointment) {
    throw new Error("No se pudo guardar la reserva. Intenta nuevamente.");
  }

  const itemsPayload = [
    {
      business_id: businessId,
      appointment_id: appointment.id,
      item_type: "service",
      service_id: service.id,
      addon_id: null,
      name_snapshot: service.name,
      duration_minutes_snapshot: service.duration_minutes,
      unit_price_clp: service.price_clp,
      quantity: 1,
    },
    ...addons.map((a) => ({
      business_id: businessId,
      appointment_id: appointment.id,
      item_type: "addon" as const,
      service_id: null,
      addon_id: a.id,
      name_snapshot: a.name,
      duration_minutes_snapshot: a.duration_minutes,
      unit_price_clp: a.price_clp,
      quantity: 1,
    })),
  ];

  await admin.from("appointment_items").insert(itemsPayload);

  if (confirmNow && depositPaid > 0) {
    await admin.from("payments").insert({
      business_id: businessId,
      appointment_id: appointment.id,
      client_id: clientId,
      payment_type: "deposit",
      amount_clp: depositPaid,
      reference_note: `Abono inicial cita ${bookingCode}`,
    });
  }

  const fullServiceName =
    addons.length > 0
      ? `${service.name} + ${addons.map((a) => a.name).join(", ")}`
      : service.name;
  const dateHuman = formatDateLongEs(input.appointmentDate);

  const whatsappText = resolveTemplate(bundle.paymentBank.whatsappReceiptTemplate, {
    codigo: bookingCode,
    servicio: fullServiceName,
    fecha: dateHuman,
    hora: input.startTime,
    abono: formatClp(depositRequired),
    nombre: firstName,
  });

  const whatsappUrl = buildWhatsAppUrl(bundle.contactPublic.whatsappNumber, whatsappText);

  const shouldSendEmail = !isAdmin || Boolean(adminInput.sendEmail);
  if (shouldSendEmail) {
    const privateLoc = confirmNow
      ? await getPrivateLocationForServer(businessId)
      : null;

    await sendBusinessEmail({
      businessId,
      to: email,
      templateKey: confirmNow ? "booking_confirmed" : "booking_pending",
      appointmentId: appointment.id,
      variables: {
        nombre: firstName,
        codigo: bookingCode,
        servicio: fullServiceName,
        fecha: dateHuman,
        hora: input.startTime,
        abono: formatClp(depositRequired),
        direccion: privateLoc?.exactAddress || bundle.contactPublic.publicLocationLabel,
      },
    });
  }

  return {
    appointment: appointment as AppointmentRecord,
    serviceName: fullServiceName,
    whatsappUrl,
    paymentBank: bundle.paymentBank,
  };
}

export async function confirmAppointmentDepositCore(params: {
  businessId: string;
  appointmentId: string;
  amountClp?: number;
  paymentMethodId?: string | null;
  referenceNote?: string;
  adminUserId: string;
}) {
  const admin = createSupabaseAdminClient();
  const bundle = await getActiveBusinessBundle();

  const { data: appt, error } = await admin
    .from("appointments")
    .select(
      "*, client:clients(id, first_name, last_name, email, phone), items:appointment_items(name_snapshot)"
    )
    .eq("business_id", params.businessId)
    .eq("id", params.appointmentId)
    .single();

  if (error || !appt) {
    throw new Error("Cita no encontrada.");
  }
  if (appt.status === "confirmed") {
    return { alreadyConfirmed: true };
  }

  const paidAmount = params.amountClp ?? appt.deposit_required_clp;

  await admin
    .from("appointments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      deposit_paid_clp: paidAmount,
      total_paid_clp: (appt.total_paid_clp || 0) + paidAmount,
      hold_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appt.id)
    .eq("business_id", params.businessId);

  if (paidAmount > 0) {
    await admin.from("payments").insert({
      business_id: params.businessId,
      appointment_id: appt.id,
      client_id: appt.client_id,
      payment_method_id: params.paymentMethodId || null,
      payment_type: "deposit",
      amount_clp: paidAmount,
      reference_note: params.referenceNote || `Abono aprobado cita ${appt.booking_code}`,
      recorded_by: params.adminUserId,
    });
  }

  const privateLoc = await getPrivateLocationForServer(params.businessId);
  const serviceLabel =
    (appt.items as Array<{ name_snapshot: string }> | undefined)
      ?.map((i) => i.name_snapshot)
      .join(" + ") || "Tu servicio";

  if (appt.client?.email) {
    await sendBusinessEmail({
      businessId: params.businessId,
      to: appt.client.email,
      templateKey: "booking_confirmed",
      appointmentId: appt.id,
      variables: {
        nombre: appt.client.first_name,
        codigo: appt.booking_code,
        servicio: serviceLabel,
        fecha: formatDateLongEs(appt.appointment_date),
        hora: appt.start_time.slice(0, 5),
        abono: formatClp(paidAmount),
        direccion: `${privateLoc.exactAddress}${privateLoc.addressNotes ? ` (${privateLoc.addressNotes})` : ""}`,
      },
    });
  }

  return { alreadyConfirmed: false, bookingCode: appt.booking_code, businessName: bundle.business.name };
}

export async function rescheduleClientAppointmentCore(params: {
  businessId: string;
  authUserId: string;
  appointmentId: string;
  newDate: string;
  newStartTime: string;
}) {
  const admin = createSupabaseAdminClient();
  const bundle = await getActiveBusinessBundle();

  const { data: appt } = await admin
    .from("appointments")
    .select(
      "*, client:clients!inner(id, auth_user_id, first_name, email), items:appointment_items(name_snapshot)"
    )
    .eq("business_id", params.businessId)
    .eq("id", params.appointmentId)
    .single();

  if (!appt || appt.client?.auth_user_id !== params.authUserId) {
    throw new Error("No tienes permiso para modificar esta cita.");
  }

  if (!["pending_deposit", "confirmed"].includes(appt.status)) {
    throw new Error("Solo puedes reprogramar citas activas.");
  }

  const hoursLeft = hoursUntilAppointment(
    appt.appointment_date,
    appt.start_time,
    bundle.business.timezone
  );
  if (hoursLeft < bundle.bookingRules.rescheduleCutoffHours) {
    throw new Error(
      `Las modificaciones autónomas solo están permitidas con al menos ${bundle.bookingRules.rescheduleCutoffHours} horas de anticipación. Escríbenos por WhatsApp para ayudarte.`
    );
  }

  const slots = await getAvailableSlotsForDate({
    businessId: params.businessId,
    staffId: appt.staff_id,
    dateStr: params.newDate,
    durationMinutes: appt.total_duration_minutes,
    bufferMinutes: appt.buffer_minutes,
    excludeAppointmentId: appt.id,
  });

  if (!slots.some((s) => s.startTime === params.newStartTime)) {
    throw new Error("El horario elegido ya no está disponible.");
  }

  const endTime = minutesToTime(
    timeToMinutes(params.newStartTime) + appt.total_duration_minutes
  );

  await admin
    .from("appointments")
    .update({
      appointment_date: params.newDate,
      start_time: params.newStartTime,
      end_time: endTime,
      rescheduled_count: (appt.rescheduled_count || 0) + 1,
      reminder_48h_sent_at: null,
      reminder_24h_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appt.id);

  const serviceLabel =
    (appt.items as Array<{ name_snapshot: string }> | undefined)
      ?.map((i) => i.name_snapshot)
      .join(" + ") || "Tu servicio";

  if (appt.client?.email) {
    await sendBusinessEmail({
      businessId: params.businessId,
      to: appt.client.email,
      templateKey: "booking_rescheduled",
      appointmentId: appt.id,
      variables: {
        nombre: appt.client.first_name,
        codigo: appt.booking_code,
        servicio: serviceLabel,
        fecha: formatDateLongEs(params.newDate),
        hora: params.newStartTime,
      },
    });
  }

  return { ok: true };
}
