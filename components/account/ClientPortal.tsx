"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  XCircle,
} from "lucide-react";
import {
  cancelClientAppointmentAction,
  getAvailableDatesAction,
  linkClientSessionAction,
  rescheduleClientAppointmentAction,
} from "@/app/actions/bookingActions";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AppointmentRecord,
  BusinessPublicBundle,
  TimeSlotOption,
} from "@/lib/types";
import {
  buildWhatsAppUrl,
  formatClp,
  formatDateLongEs,
  formatDateShortEs,
  hoursUntilAppointment,
  normalizeEmail,
  resolveTemplate,
} from "@/lib/utils";

interface ClientPortalProps {
  bundle: BusinessPublicBundle;
  userEmail: string | null;
  appointments: AppointmentRecord[];
  exactAddress: string | null;
  addressNotes: string | null;
}

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  pending_deposit: {
    label: "Pendiente de confirmación",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  completed: {
    label: "Realizada",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  no_show: {
    label: "No asistió",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export function ClientPortal({
  bundle,
  userEmail,
  appointments,
  exactAddress,
  addressNotes,
}: ClientPortalProps) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRecord | null>(
    null
  );
  const [days, setDays] = useState<
    Array<{ date: string; slotsCount: number; slots: TimeSlotOption[] }>
  >([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [pickedDate, setPickedDate] = useState("");
  const [pickedTime, setPickedTime] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizeEmail(emailInput),
        options: { shouldCreateUser: true },
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setOtpSent(true);
      setMessage(`Enviamos un código de 6 dígitos a ${normalizeEmail(emailInput)}.`);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        email: normalizeEmail(emailInput),
        token: otpCode.trim(),
        type: "email",
      });
      if (error) {
        setErrorMsg("Código inválido o expirado.");
        return;
      }
      await linkClientSessionAction();
      router.refresh();
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  async function openReschedule(appt: AppointmentRecord) {
    setRescheduleTarget(appt);
    setPickedDate("");
    setPickedTime("");
    setErrorMsg(null);
    setLoadingDays(true);
    try {
      const available = await getAvailableDatesAction({
        staffId: appt.staff_id,
        durationMinutes: appt.total_duration_minutes,
        bufferMinutes: appt.buffer_minutes,
      });
      setDays(available);
      if (available.length > 0) {
        setPickedDate(available[0].date);
      }
    } finally {
      setLoadingDays(false);
    }
  }

  async function confirmReschedule() {
    if (!rescheduleTarget || !pickedDate || !pickedTime) return;
    setActionBusy(true);
    setErrorMsg(null);
    try {
      const res = await rescheduleClientAppointmentAction({
        appointmentId: rescheduleTarget.id,
        appointmentDate: pickedDate,
        startTime: pickedTime,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setRescheduleTarget(null);
      setMessage("¡Tu hora fue reprogramada manteniendo tu abono!");
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel(apptId: string) {
    if (!window.confirm("¿Segura que deseas cancelar esta cita?")) return;
    setActionBusy(true);
    setErrorMsg(null);
    try {
      const res = await cancelClientAppointmentAction(apptId);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setMessage("Cita cancelada correctamente.");
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  if (!userEmail) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-[#f1dfe8] bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf0f6] text-[var(--brand-primary)]">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1f141b]">
            Mis Citas
          </h1>
          <p className="mt-1 text-sm text-[#6c5763]">
            Ingresa con tu correo sin contraseña. Te enviaremos un código de 6 dígitos.
          </p>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}
        {message && (
          <div role="status" className="mb-4 rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            {message}
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="portal-email" className="mb-1 block text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="portal-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="tu@correo.cl"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={authBusy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)]"
            >
              {authBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Enviar código de acceso</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="portal-otp" className="mb-1 block text-sm font-medium">
                Código de 6 dígitos
              </label>
              <input
                id="portal-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-center text-lg font-bold tracking-[0.25em]"
              />
            </div>
            <button
              type="submit"
              disabled={authBusy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white"
            >
              {authBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Entrar a Mis Citas</span>
            </button>
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-center text-xs font-semibold text-[#6c5763] underline"
            >
              Usar otro correo
            </button>
          </form>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#f1dfe8] bg-white p-5">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">Mis Citas</h1>
          <p className="text-xs text-[#6c5763]">{userEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reservar"
            className="inline-flex min-h-10 items-center rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
          >
            Nueva reserva
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#e7cddb] px-3.5 text-xs font-semibold text-[#4a3541]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">
          {errorMsg}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="rounded-3xl border border-[#f1dfe8] bg-white p-8 text-center">
          <p className="text-sm text-[#6c5763]">Aún no tienes citas registradas con este correo.</p>
          <Link
            href="/reservar"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white"
          >
            Agendar mi primera hora
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const badge = STATUS_BADGE[appt.status] || STATUS_BADGE.pending_deposit;
            const serviceLabel =
              appt.items?.map((i) => i.name_snapshot).join(" + ") || "Servicio";
            const hoursLeft = hoursUntilAppointment(
              appt.appointment_date,
              appt.start_time,
              bundle.business.timezone
            );
            const canModify =
              ["pending_deposit", "confirmed"].includes(appt.status) &&
              hoursLeft >= bundle.bookingRules.rescheduleCutoffHours;

            const waReceiptText = resolveTemplate(
              bundle.paymentBank.whatsappReceiptTemplate,
              {
                codigo: appt.booking_code,
                servicio: serviceLabel,
                fecha: formatDateLongEs(appt.appointment_date),
                hora: appt.start_time.slice(0, 5),
                abono: formatClp(appt.deposit_required_clp),
                nombre: "",
              }
            );
            const waUrl = buildWhatsAppUrl(
              bundle.contactPublic.whatsappNumber,
              waReceiptText
            );

            return (
              <article
                key={appt.id}
                className="rounded-3xl border border-[#f1dfe8] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold tracking-wider text-[var(--brand-primary)]">
                      {appt.booking_code}
                    </span>
                    <h2 className="font-serif text-2xl font-semibold text-[#1f141b]">
                      {serviceLabel}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[#5d4754]">
                      <Clock className="h-4 w-4 text-[var(--brand-primary)]" />
                      <span className="capitalize">
                        {formatDateLongEs(appt.appointment_date)}
                      </span>{" "}
                      · <strong>{appt.start_time.slice(0, 5)} hrs</strong> (
                      {appt.total_duration_minutes} min)
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {appt.status === "confirmed" && exactAddress && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Dirección exacta del estudio
                    </p>
                    <p className="mt-1 flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <span>
                        {exactAddress}
                        {addressNotes ? ` — ${addressNotes}` : ""}
                      </span>
                    </p>
                  </div>
                )}

                {appt.status === "pending_deposit" && (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-amber-950">
                      Envía tu comprobante de abono ({formatClp(appt.deposit_required_clp)}) por
                      WhatsApp para confirmar la cita y ver la dirección exacta.
                    </p>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enviar comprobante
                    </a>
                  </div>
                )}

                {["pending_deposit", "confirmed"].includes(appt.status) && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#f3e5ec] pt-4">
                    {canModify ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openReschedule(appt)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#e2cbd7] px-4 text-xs font-semibold text-[#1f141b] transition hover:border-[var(--brand-primary)]"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Reprogramar hora
                        </button>
                        {bundle.bookingRules.allowClientCancel && (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleCancel(appt.id)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar cita
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[#7a6571]">
                        Faltan menos de {bundle.bookingRules.rescheduleCutoffHours}h para tu cita.
                        Para cambios urgentes escríbenos por WhatsApp.
                      </p>
                    )}
                    <span className="text-xs font-medium text-[#6c5763]">
                      Total est. {formatClp(appt.total_estimated_clp)}
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ModalDialog
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="Reprogramar cita"
      >
        {loadingDays ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
            <span>Cargando horarios...</span>
          </div>
        ) : days.length === 0 ? (
          <p className="text-sm text-[#6c5763]">No hay cupos próximos disponibles.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setPickedDate(d.date);
                    setPickedTime("");
                  }}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${
                    d.date === pickedDate
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-[#e2cbd7]"
                  }`}
                >
                  {formatDateShortEs(d.date)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(days.find((d) => d.date === pickedDate)?.slots || []).map((s) => (
                <button
                  key={s.startTime}
                  type="button"
                  onClick={() => setPickedTime(s.startTime)}
                  className={`min-h-11 rounded-xl border text-xs font-semibold ${
                    pickedTime === s.startTime
                      ? "border-[var(--brand-primary)] bg-[#fdf0f6] text-[var(--brand-primary)]"
                      : "border-[#e2cbd7]"
                  }`}
                >
                  {s.startTime}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!pickedDate || !pickedTime || actionBusy}
              onClick={confirmReschedule}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionBusy ? "Guardando..." : "Confirmar nuevo horario"}
            </button>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
