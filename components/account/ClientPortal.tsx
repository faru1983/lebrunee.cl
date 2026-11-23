"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  cancelClientAppointmentAction,
  getAvailableDatesAction,
  linkClientSessionAction,
  rescheduleClientAppointmentAction,
  upsertClientProfileAction,
} from "@/app/actions/bookingActions";
import { SaveButton } from "@/components/ui/SaveButton";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { formatPhoneDisplay, isValidPhone, normalizePhone } from "@/lib/phone";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AppointmentRecord,
  BusinessPublicBundle,
  TimeSlotOption,
  VerifiedClientProfile,
} from "@/lib/types";
import {
  buildWhatsAppUrl,
  formatClp,
  formatDateLongEs,
  formatDateShortEs,
  hoursUntilAppointment,
  normalizeEmail,
  normalizeInstagramHandle,
  normalizePersonName,
  resolveTemplate,
} from "@/lib/utils";

interface ClientPortalProps {
  bundle: BusinessPublicBundle;
  userEmail: string | null;
  initialProfile: VerifiedClientProfile | null;
  authError?: string | null;
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
  initialProfile,
  authError,
  appointments,
  exactAddress,
  addressNotes,
}: ClientPortalProps) {
  const router = useRouter();
  const initialHasCompleteProfile = Boolean(
    initialProfile?.firstName?.trim() && initialProfile?.phone?.trim()
  );

  // Profile state ("Mi Ficha")
  const [savedProfile, setSavedProfile] = useState<VerifiedClientProfile | null>(
    initialProfile
  );
  const [editingProfile, setEditingProfile] = useState(!initialHasCompleteProfile);
  const [firstName, setFirstName] = useState(
    initialProfile?.firstName ? normalizePersonName(initialProfile.firstName) : ""
  );
  const [lastName, setLastName] = useState(
    initialProfile?.lastName ? normalizePersonName(initialProfile.lastName) : ""
  );
  const [phone, setPhone] = useState(
    initialProfile?.phone ? formatPhoneDisplay(initialProfile.phone) : ""
  );
  const [instagramHandle, setInstagramHandle] = useState(() => {
    const clean = normalizeInstagramHandle(initialProfile?.instagramHandle || "");
    return clean ? `@${clean}` : "";
  });
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Passwordless login state (Magic Link + 6-digit OTP fallback)
  const [emailInput, setEmailInput] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    authError === "expired"
      ? "El enlace de acceso expiró o ya fue utilizado. Ingresa tu correo para recibir uno nuevo."
      : null
  );

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

  async function sendMagicLinkAndOtp(targetEmail?: string) {
    setErrorMsg(null);
    setMessage(null);
    const cleanEmail = normalizeEmail(targetEmail ?? emailInput);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido.");
      return;
    }

    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/mi-cuenta`;
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("rate") || error.status === 429) {
          setErrorMsg(
            "Se alcanzó el límite temporal de envíos de correo. Espera unos minutos o avísanos por WhatsApp."
          );
        } else {
          setErrorMsg(error.message);
        }
        return;
      }
      setEmailInput(cleanEmail);
      setLinkSent(true);
      setMessage(
        `¡Listo! Enviamos un enlace de acceso directo (y código de respaldo) a ${cleanEmail}.`
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLinkAndOtp();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    if (otpCode.trim().length < 6) {
      setErrorMsg("Ingresa el código de 6 dígitos que llegó a tu correo.");
      return;
    }
    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        email: normalizeEmail(emailInput),
        token: otpCode.trim(),
        type: "email",
      });
      if (error) {
        setErrorMsg("Código inválido o expirado. Solicita un nuevo correo.");
        return;
      }
      await linkClientSessionAction();
      router.refresh();
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setErrorMsg("Ingresa un número de WhatsApp válido (ej. +56 9 1234 5678).");
      return;
    }

    const cleanFirstName = normalizePersonName(firstName);
    const cleanLastName = normalizePersonName(lastName);
    const cleanIg = normalizeInstagramHandle(instagramHandle);

    setSavingProfile(true);
    try {
      const res = await upsertClientProfileAction({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phone: normalizedPhone,
        instagramHandle: cleanIg,
        birthDate: birthDate.trim(),
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setFirstName(res.profile.firstName);
      setLastName(res.profile.lastName);
      setPhone(formatPhoneDisplay(res.profile.phone));
      setInstagramHandle(res.profile.instagramHandle ? `@${res.profile.instagramHandle}` : "");
      setBirthDate(res.profile.birthDate || "");
      setSavedProfile(res.profile);
      setEditingProfile(false);
      setMessage(
        "¡Tu ficha quedó guardada! La próxima vez que agendes en /reservar tus datos aparecerán listos automáticamente."
      );
      router.refresh();
    } finally {
      setSavingProfile(false);
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
            <Mail className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            id="portal-login-heading"
            className="mt-3 font-serif text-3xl font-semibold text-[#1f141b]"
          >
            Mi Cuenta y Ficha
          </h1>
          <p className="mt-1 text-sm text-[#6c5763]">
            Ingresa sin contraseña para completar tu ficha de {bundle.business.name} o revisar tus
            citas. Te enviaremos un enlace de acceso directo a tu correo.
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-800"
          >
            {errorMsg}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mb-4 rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
          >
            {message}
          </div>
        )}

        {!linkSent ? (
          <form
            aria-labelledby="portal-login-heading"
            onSubmit={handleSendOtp}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="portal-email"
                className="mb-1 block text-sm font-medium text-[#1f141b]"
              >
                Correo electrónico <span aria-hidden="true" className="text-red-600">*</span>
              </label>
              <input
                id="portal-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="send"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onBlur={() => setEmailInput((v) => normalizeEmail(v))}
                placeholder="tu@correo.cl"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base text-[#1f141b] sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={authBusy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)] disabled:opacity-60"
            >
              {authBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>Enviar enlace de acceso</span>
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#eedbe4] bg-[#fff9fc] p-4 text-sm text-[#4a3541]">
              <p className="font-semibold text-[#1f141b]">Revisa tu correo electrónico</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6c5763]">
                Toca el botón de acceso directo que enviamos a{" "}
                <strong className="text-[#1f141b]">{emailInput}</strong> para entrar en un clic.
                Si no lo ves, revisa tu carpeta de Spam o Promociones.
              </p>
            </div>

            <form
              aria-labelledby="portal-otp-heading"
              onSubmit={handleVerifyOtp}
              className="space-y-3 border-t border-[#f3e5ec] pt-4"
            >
              <div>
                <h2
                  id="portal-otp-heading"
                  className="text-xs font-semibold text-[#6c5763]"
                >
                  ¿Prefieres ingresar el código sin salir de esta pantalla?
                </h2>
                <label
                  htmlFor="portal-otp"
                  className="mt-2 mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  Código de 6 dígitos
                </label>
                <input
                  id="portal-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="done"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-center text-lg font-bold tracking-[0.25em] text-[#1f141b]"
                />
              </div>
              <button
                type="submit"
                disabled={authBusy}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)] disabled:opacity-60"
              >
                {authBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>Entrar con código</span>
              </button>
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => sendMagicLinkAndOtp(emailInput)}
                  className="min-h-10 px-2 text-xs font-semibold text-[var(--brand-primary)] underline"
                >
                  Reenviar correo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkSent(false);
                    setOtpCode("");
                    setErrorMsg(null);
                    setMessage(null);
                  }}
                  className="min-h-10 px-2 text-xs font-semibold text-[#6c5763] underline"
                >
                  Usar otro correo
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    );
  }

  const hasCompleteProfile = Boolean(
    savedProfile?.firstName?.trim() && savedProfile?.phone?.trim()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#f1dfe8] bg-white p-5">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
            {savedProfile?.firstName ? `Hola, ${savedProfile.firstName}` : "Mi Cuenta"}
          </h1>
          <p className="text-xs text-[#6c5763]">{userEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reservar"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--brand-accent)]"
          >
            <span>Nueva reserva</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#e7cddb] px-3.5 text-xs font-semibold text-[#4a3541]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
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
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{message}</span>
          {hasCompleteProfile && appointments.length === 0 && (
            <Link
              href="/reservar"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white"
            >
              <span>Ir a reservar</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* Tarjeta Mi Ficha (Onboarding WhatsApp + edición permanente) */}
      {hasCompleteProfile && !editingProfile && savedProfile ? (
        <section
          aria-labelledby="client-profile-summary-heading"
          className="rounded-3xl border border-[#eedbe4] bg-[#fff9fc] p-5 shadow-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--brand-primary)] shadow-2xs">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="client-profile-summary-heading"
                  className="text-sm font-bold text-[#1f141b]"
                >
                  Mi ficha de clienta
                </h2>
                <p className="text-xs text-[#6c5763]">
                  Tus datos se precargarán automáticamente al reservar.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingProfile(true);
                setErrorMsg(null);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#e3c7d6] bg-white px-3.5 text-xs font-semibold text-[#1f141b] transition hover:border-[var(--brand-primary)]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editar datos</span>
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#7a6571]">Nombre completo</dt>
              <dd className="font-medium text-[#1f141b]">
                {savedProfile.firstName} {savedProfile.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#7a6571]">WhatsApp</dt>
              <dd className="font-medium text-[#1f141b]">
                {formatPhoneDisplay(savedProfile.phone)}
              </dd>
            </div>
            {savedProfile.instagramHandle && (
              <div>
                <dt className="text-xs text-[#7a6571]">Instagram</dt>
                <dd className="font-medium text-[#1f141b]">@{savedProfile.instagramHandle}</dd>
              </div>
            )}
            {savedProfile.birthDate && (
              <div>
                <dt className="text-xs text-[#7a6571]">Cumpleaños</dt>
                <dd className="font-medium text-[#1f141b]">{savedProfile.birthDate}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : (
        <section
          aria-labelledby="client-profile-form-heading"
          className="rounded-3xl border border-[#f1dfe8] bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf0f6] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{hasCompleteProfile ? "Actualizar ficha" : "Registro en 1 paso"}</span>
              </div>
              <h2
                id="client-profile-form-heading"
                className="mt-2 font-serif text-2xl font-semibold text-[#1f141b]"
              >
                {hasCompleteProfile
                  ? "Edita tus datos"
                  : `Completa tu ficha en ${bundle.business.name}`}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6c5763]">
                {hasCompleteProfile
                  ? "Mantén tu WhatsApp y cumpleaños al día para avisos y regalitos."
                  : "Guarda tus datos una sola vez: así la próxima vez agendarás en segundos sin volver a escribirlos."}
              </p>
            </div>
            {hasCompleteProfile && (
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(false);
                  setErrorMsg(null);
                }}
                className="min-h-10 shrink-0 rounded-full border border-[#e7cddb] px-3.5 text-xs font-semibold text-[#4a3541]"
              >
                Cancelar
              </button>
            )}
          </div>

          <form
            aria-labelledby="client-profile-form-heading"
            onSubmit={handleSaveProfile}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="portal-first-name"
                  className="mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  Nombre <span aria-hidden="true" className="text-red-600">*</span>
                </label>
                <input
                  id="portal-first-name"
                  name="firstName"
                  type="text"
                  required
                  autoComplete="given-name"
                  enterKeyHint="next"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onBlur={() => setFirstName((v) => (v.trim() ? normalizePersonName(v) : ""))}
                  placeholder="Ej. María José"
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="portal-last-name"
                  className="mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  Apellidos <span aria-hidden="true" className="text-red-600">*</span>
                </label>
                <input
                  id="portal-last-name"
                  name="lastName"
                  type="text"
                  required
                  autoComplete="family-name"
                  enterKeyHint="next"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onBlur={() => setLastName((v) => (v.trim() ? normalizePersonName(v) : ""))}
                  placeholder="Ej. González Pérez"
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="portal-phone"
                  className="mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  WhatsApp <span aria-hidden="true" className="text-red-600">*</span>
                </label>
                <input
                  id="portal-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                  enterKeyHint="next"
                  value={phone}
                  onFocus={() => {
                    if (!phone.trim()) setPhone("+56 ");
                  }}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => {
                    const digits = phone.replace(/\D/g, "");
                    if (!digits || digits === "56") {
                      setPhone("");
                      return;
                    }
                    setPhone(formatPhoneDisplay(phone));
                  }}
                  placeholder="+56 9 1234 5678"
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="portal-ig"
                  className="mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  Instagram (opcional)
                </label>
                <input
                  id="portal-ig"
                  name="instagramHandle"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={instagramHandle}
                  onFocus={() => {
                    if (!instagramHandle.trim()) setInstagramHandle("@");
                  }}
                  onChange={(e) => {
                    const cleaned = e.target.value
                      .replace(/\s+/g, "")
                      .toLowerCase()
                      .replace(/^@+/, "@");
                    setInstagramHandle(cleaned);
                  }}
                  onBlur={() => {
                    const clean = normalizeInstagramHandle(instagramHandle);
                    setInstagramHandle(clean ? `@${clean}` : "");
                  }}
                  placeholder="@tuusuario"
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="portal-bday"
                  className="mb-1 block text-sm font-medium text-[#1f141b]"
                >
                  Fecha de cumpleaños (opcional)
                </label>
                <input
                  id="portal-bday"
                  name="birthDate"
                  type="date"
                  autoComplete="bday"
                  aria-describedby="portal-bday-hint"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:max-w-xs sm:text-sm"
                />
                <p id="portal-bday-hint" className="mt-1 text-xs text-[#6c5763]">
                  Para enviarte un regalito especial en tu día.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <SaveButton
                busy={savingProfile}
                label={hasCompleteProfile ? "Guardar cambios" : "Guardar mi ficha"}
                className="w-full sm:w-auto"
              />
            </div>
          </form>
        </section>
      )}

      {appointments.length === 0 ? (
        <div className="rounded-3xl border border-[#f1dfe8] bg-white p-8 text-center">
          <p className="text-sm text-[#6c5763]">
            {hasCompleteProfile
              ? "Aún no tienes citas registradas. Tu ficha ya está lista para agendar en segundos."
              : "Aún no tienes citas registradas con este correo."}
          </p>
          <Link
            href="/reservar"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)]"
          >
            <span>Agendar mi primera hora</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
