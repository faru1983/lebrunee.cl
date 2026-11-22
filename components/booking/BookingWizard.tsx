"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import {
  createPublicBookingAction,
  getAvailableDatesAction,
} from "@/app/actions/bookingActions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BusinessPublicBundle,
  PaymentBankSettings,
  ServiceAddon,
  ServiceItem,
  StaffMember,
  TimeSlotOption,
} from "@/lib/types";
import {
  buildWhatsAppUrl,
  formatClp,
  formatDateLongEs,
  formatDateShortEs,
  normalizeEmail,
} from "@/lib/utils";

interface BookingWizardProps {
  bundle: BusinessPublicBundle;
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  initialServiceId?: string;
  initialVerifiedEmail: string | null;
}

interface DaySummary {
  date: string;
  slotsCount: number;
  slots: TimeSlotOption[];
}

interface BookingSuccessState {
  bookingCode: string;
  appointmentDate: string;
  startTime: string;
  serviceName: string;
  depositAmountClp: number;
  totalEstimatedClp: number;
  whatsappUrl: string;
  paymentBank: PaymentBankSettings;
}

export function BookingWizard({
  bundle,
  services,
  addons,
  staff,
  initialServiceId,
  initialVerifiedEmail,
}: BookingWizardProps) {
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services.find((s) => s.id === initialServiceId)?.id || services[0]?.id || ""
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || "");

  const [availableDays, setAvailableDays] = useState<DaySummary[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialVerifiedEmail || "");
  const [phone, setPhone] = useState("+56 9 ");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [isNewClient, setIsNewClient] = useState(true);
  const [clientNotes, setClientNotes] = useState("");

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(
    initialVerifiedEmail ? normalizeEmail(initialVerifiedEmail) : null
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<BookingSuccessState | null>(null);
  const [copiedBank, setCopiedBank] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || services[0],
    [services, selectedServiceId]
  );

  const selectedAddons = useMemo(
    () => addons.filter((a) => selectedAddonIds.includes(a.id)),
    [addons, selectedAddonIds]
  );

  const totalDuration = useMemo(() => {
    const base = selectedService?.duration_minutes || 60;
    const extra = selectedAddons.reduce((sum, a) => sum + a.duration_minutes, 0);
    return base + extra;
  }, [selectedService, selectedAddons]);

  const totalEstimatedPrice = useMemo(() => {
    const base = selectedService?.price_clp || 0;
    const extra = selectedAddons.reduce((sum, a) => sum + a.price_clp, 0);
    return base + extra;
  }, [selectedService, selectedAddons]);

  const depositRequired =
    selectedService?.deposit_override_clp ?? bundle.paymentBank.depositAmountClp;

  const isEmailAlreadyVerified = Boolean(
    !bundle.bookingRules.requireClientOtp ||
      (verifiedEmail && normalizeEmail(email) === verifiedEmail)
  );

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  async function loadAvailability() {
    if (!selectedStaffId || !selectedService) return;
    setLoadingDays(true);
    setErrorMsg(null);
    try {
      const days = await getAvailableDatesAction({
        staffId: selectedStaffId,
        durationMinutes: totalDuration,
        bufferMinutes:
          selectedService.buffer_minutes ?? bundle.bookingRules.bufferMinutes,
      });
      setAvailableDays(days);
      if (days.length > 0) {
        const keepCurrent = days.find((d) => d.date === selectedDate);
        const firstDay = keepCurrent || days[0];
        setSelectedDate(firstDay.date);
        if (!firstDay.slots.some((s) => s.startTime === selectedTime)) {
          setSelectedTime("");
        }
      } else {
        setSelectedDate("");
        setSelectedTime("");
      }
    } catch {
      setErrorMsg("No pudimos cargar los horarios disponibles. Intenta nuevamente.");
    } finally {
      setLoadingDays(false);
    }
  }

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const activeDaySlots = useMemo(() => {
    return availableDays.find((d) => d.date === selectedDate)?.slots || [];
  }, [availableDays, selectedDate]);

  async function handleSendOtp() {
    setErrorMsg(null);
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido para enviarte el código.");
      return;
    }

    setOtpBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
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
      setOtpSent(true);
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyAndSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedService || !selectedDate || !selectedTime) {
      setErrorMsg("Completa tu servicio, fecha y hora antes de confirmar.");
      return;
    }

    const cleanEmail = normalizeEmail(email);
    setSubmitting(true);

    try {
      if (bundle.bookingRules.requireClientOtp && !isEmailAlreadyVerified) {
        if (otpCode.trim().length < 6) {
          setErrorMsg("Ingresa el código de 6 dígitos que enviamos a tu correo.");
          setSubmitting(false);
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpCode.trim(),
          type: "email",
        });
        if (verifyErr) {
          setErrorMsg("El código es incorrecto o expiró. Solicita uno nuevo.");
          setSubmitting(false);
          return;
        }
        setVerifiedEmail(cleanEmail);
      }

      const res = await createPublicBookingAction({
        serviceId: selectedService.id,
        addonIds: selectedAddonIds,
        staffId: selectedStaffId,
        appointmentDate: selectedDate,
        startTime: selectedTime,
        fullName,
        email: cleanEmail,
        phone,
        instagramHandle,
        isNewClient,
        clientNotes,
      });

      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessData({
        bookingCode: res.bookingCode,
        appointmentDate: res.appointmentDate,
        startTime: res.startTime,
        serviceName: res.serviceName,
        depositAmountClp: res.depositAmountClp,
        totalEstimatedClp: res.totalEstimatedClp,
        whatsappUrl: res.whatsappUrl,
        paymentBank: res.paymentBank,
      });
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  }

  function copyBankDetails(bank: PaymentBankSettings) {
    const text = [
      bank.accountHolderName,
      bank.accountHolderRut,
      bank.bankName,
      bank.accountType,
      bank.accountNumber,
      bank.transferEmail,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  }

  const supportWaUrl = buildWhatsAppUrl(
    bundle.contactPublic.whatsappNumber,
    `Hola! Quisiera consultar por horarios disponibles en ${bundle.business.name}.`
  );

  if (services.length === 0) {
    return (
      <div className="rounded-3xl border border-[#f1dfe8] bg-white p-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">Reservar hora</h1>
        <p className="mt-2 text-sm text-[#6c5763]">
          Aún no hay servicios activos disponibles. Escríbenos por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {step < 4 && (
        <nav aria-label="Progreso de reserva" className="rounded-2xl border border-[#f1dfe8] bg-white px-4 py-3">
          <ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {[
              { n: 1, label: "1. Servicio" },
              { n: 2, label: "2. Día y Hora" },
              { n: 3, label: "3. Confirmar" },
            ].map((item) => {
              const active = step === item.n;
              const done = step > item.n;
              return (
                <li
                  key={item.n}
                  aria-current={active ? "step" : undefined}
                  className={`rounded-xl px-2 py-2 transition ${
                    active
                      ? "bg-[var(--brand-primary)] text-white"
                      : done
                      ? "bg-[#fdf0f6] text-[var(--brand-primary)]"
                      : "text-[#8a7581]"
                  }`}
                >
                  {item.label}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {errorMsg}
        </div>
      )}

      {/* STEP 1: Service & Add-ons */}
      {step === 1 && (
        <section className="space-y-6 rounded-3xl border border-[#f1dfe8] bg-white p-5 shadow-xs sm:p-7">
          <div>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-[#1f141b]">
              Elige tu servicio
            </h1>
            <p className="mt-1 text-sm text-[#6c5763]">
              {bundle.landingContent.importantNoticeText}
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-[#6c5763]">
              Servicios disponibles
            </legend>
            <div className="grid gap-3">
              {services.map((srv) => {
                const selected = srv.id === selectedServiceId;
                return (
                  <label
                    key={srv.id}
                    className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition ${
                      selected
                        ? "border-[var(--brand-primary)] bg-[#fff7fb] ring-1 ring-[var(--brand-primary)]"
                        : "border-[#eedbe4] bg-white hover:border-[#d8b4c6]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="service"
                        value={srv.id}
                        checked={selected}
                        onChange={() => setSelectedServiceId(srv.id)}
                        className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
                      />
                      <div>
                        <p className="font-semibold text-[#1f141b]">{srv.name}</p>
                        {srv.description && (
                          <p className="mt-0.5 text-xs leading-relaxed text-[#6c5763]">
                            {srv.description}
                          </p>
                        )}
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)]">
                          <Clock className="h-3.5 w-3.5" />
                          {srv.duration_minutes} min aprox.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#1f141b]">
                      {srv.is_price_from ? "Desde " : ""}
                      {formatClp(srv.price_clp)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {addons.length > 0 && (
            <fieldset className="space-y-3 border-t border-[#f3e5ec] pt-5">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#6c5763]">
                Adicionales / ¿Traes trabajo de otro salón?
              </legend>
              <div className="grid gap-2.5">
                {addons.map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition ${
                        checked
                          ? "border-[var(--brand-primary)] bg-[#fff7fb]"
                          : "border-[#eedbe4] bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(addon.id)}
                          className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        <div>
                          <p className="text-sm font-semibold text-[#1f141b]">
                            {addon.name}
                          </p>
                          {addon.description && (
                            <p className="text-xs text-[#6c5763]">{addon.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <p className="font-bold text-[#1f141b]">
                          +{addon.is_price_from ? "desde " : ""}
                          {formatClp(addon.price_clp)}
                        </p>
                        {addon.duration_minutes > 0 && (
                          <p className="text-[#6c5763]">+{addon.duration_minutes} min</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {bundle.bookingRules.allowMultipleStaffSelection && staff.length > 1 && (
            <fieldset className="space-y-2 border-t border-[#f3e5ec] pt-5">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#6c5763]">
                Profesional
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {staff.map((member) => (
                  <label
                    key={member.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                      selectedStaffId === member.id
                        ? "border-[var(--brand-primary)] bg-[#fff7fb]"
                        : "border-[#eedbe4]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="staff"
                      checked={selectedStaffId === member.id}
                      onChange={() => setSelectedStaffId(member.id)}
                      className="accent-[var(--brand-primary)]"
                    />
                    <span className="text-sm font-semibold">{member.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-3 rounded-2xl bg-[#fdf5f9] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-[#1f141b]">
                Duración reservada: {totalDuration} min · Total est.{" "}
                {selectedService?.is_price_from ? "desde " : ""}
                {formatClp(totalEstimatedPrice)}
              </p>
              <p className="text-xs text-[#6c5763]">
                Abono para reservar hoy: <strong>{formatClp(depositRequired)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setStep(2);
                await loadAvailability();
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-accent)]"
            >
              <span>Elegir fecha y hora</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Date & Time */}
      {step === 2 && (
        <section className="space-y-6 rounded-3xl border border-[#f1dfe8] bg-white p-5 shadow-xs sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-[#1f141b]">
                Elige día y hora
              </h1>
              <p className="mt-1 text-sm text-[#6c5763]">
                Bloques calculados para {selectedService?.name} ({totalDuration} min).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#e7cddb] px-3.5 text-xs font-semibold text-[#4a3541]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cambiar
            </button>
          </div>

          {loadingDays ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6c5763]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
              <span>Buscando horas disponibles...</span>
            </div>
          ) : availableDays.length === 0 ? (
            <div className="rounded-2xl border border-[#f3d4e3] bg-[#fff8fb] p-6 text-center">
              <Calendar className="mx-auto h-8 w-8 text-[var(--brand-primary)]" />
              <h2 className="mt-3 text-base font-semibold text-[#1f141b]">
                {bundle.bookingRules.isAgendaOpen
                  ? "No quedan cupos disponibles en las próximas fechas"
                  : "Agenda cerrada temporalmente"}
              </h2>
              <p className="mt-1 text-sm text-[#6c5763]">
                Si necesitas un horario especial o consultar por sobrecupo, escríbenos directo.
              </p>
              <a
                href={supportWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                Consultar por WhatsApp
              </a>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6c5763]">
                  Días disponibles
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {availableDays.map((day) => {
                    const active = day.date === selectedDate;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedTime("");
                        }}
                        className={`flex min-w-[104px] shrink-0 flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                          active
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-sm"
                            : "border-[#eedbe4] bg-white text-[#1f141b] hover:border-[var(--brand-primary)]"
                        }`}
                      >
                        <span className="text-xs font-semibold capitalize">
                          {formatDateShortEs(day.date)}
                        </span>
                        <span
                          className={`mt-1 text-[11px] ${
                            active ? "text-white/85" : "text-[#7a6571]"
                          }`}
                        >
                          {day.slotsCount} {day.slotsCount === 1 ? "cupo" : "cupos"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6c5763]">
                  Horarios para el {selectedDate ? formatDateLongEs(selectedDate) : ""}
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {activeDaySlots.map((slot) => {
                    const active = slot.startTime === selectedTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedTime(slot.startTime)}
                        className={`min-h-12 rounded-2xl border text-sm font-semibold transition ${
                          active
                            ? "border-[var(--brand-primary)] bg-[#fdf0f6] text-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]"
                            : "border-[#eedbe4] bg-white text-[#1f141b] hover:border-[var(--brand-primary)]"
                        }`}
                      >
                        {slot.startTime}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end border-t border-[#f3e5ec] pt-4">
                <button
                  type="button"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(3)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Continuar con tus datos</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* STEP 3: Contact + OTP + Confirm */}
      {step === 3 && (
        <form
          onSubmit={handleVerifyAndSubmit}
          className="space-y-5 rounded-3xl border border-[#f1dfe8] bg-white p-5 shadow-xs sm:p-7"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-[#1f141b]">
                Tus datos y confirmación
              </h1>
              <p className="mt-1 text-sm text-[#6c5763]">
                {selectedService?.name} · {formatDateLongEs(selectedDate)} a las{" "}
                <strong>{selectedTime} hrs</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#e7cddb] px-3.5 text-xs font-semibold text-[#4a3541]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Hora
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="full-name" className="mb-1 block text-sm font-medium text-[#1f141b]">
                Nombre completo <span className="text-red-600">*</span>
              </label>
              <input
                id="full-name"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                enterKeyHint="next"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Camila Rojas"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="client-email" className="mb-1 block text-sm font-medium text-[#1f141b]">
                Correo electrónico <span className="text-red-600">*</span>
              </label>
              <input
                id="client-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="client-phone" className="mb-1 block text-sm font-medium text-[#1f141b]">
                WhatsApp <span className="text-red-600">*</span>
              </label>
              <input
                id="client-phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                enterKeyHint="next"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="client-ig" className="mb-1 block text-sm font-medium text-[#1f141b]">
                Instagram (opcional)
              </label>
              <input
                id="client-ig"
                name="instagramHandle"
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@tuusuario"
                className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] bg-white px-4 text-base text-[#1f141b] sm:text-sm"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#1f141b]">
                <input
                  type="checkbox"
                  checked={isNewClient}
                  onChange={(e) => setIsNewClient(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                <span>Es mi primera visita</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="client-notes" className="mb-1 block text-sm font-medium text-[#1f141b]">
                Comentarios o idea de diseño (opcional)
              </label>
              <textarea
                id="client-notes"
                name="clientNotes"
                rows={2}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Ej. Me gustaría algo en tonos burdeo o diseño minimalista..."
                className="w-full rounded-2xl border border-[#e2cbd7] bg-white p-3.5 text-base text-[#1f141b] sm:text-sm"
              />
            </div>
          </div>

          {/* Inline OTP Verification when required */}
          {bundle.bookingRules.requireClientOtp && (
            <div className="rounded-2xl border border-[#f0cfe0] bg-[#fff8fb] p-4">
              {isEmailAlreadyVerified ? (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Correo verificado ({verifiedEmail}). Ya puedes confirmar tu solicitud.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    <div className="text-xs leading-relaxed text-[#4b3843] sm:text-sm">
                      <strong className="text-[#1f141b]">Verificación rápida sin contraseña:</strong>{" "}
                      te enviaremos un código de 6 dígitos a tu correo para cuidar tu cupo y darte acceso a <em>Mis Citas</em>.
                    </div>
                  </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      disabled={otpBusy}
                      onClick={handleSendOtp}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--brand-primary)] bg-white px-5 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[#fdf0f6]"
                    >
                      {otpBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Enviar código a mi correo</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="otp-code" className="block text-xs font-semibold text-[#1f141b]">
                        Código de 6 dígitos enviado a {normalizeEmail(email)}
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="otp-code"
                          name="otpCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="\d{6}"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="min-h-12 w-40 rounded-2xl border border-[#d6b3c5] bg-white px-4 text-center text-lg font-bold tracking-[0.25em] text-[#1f141b]"
                        />
                        <button
                          type="button"
                          disabled={otpBusy}
                          onClick={handleSendOtp}
                          className="min-h-11 px-3 text-xs font-semibold text-[var(--brand-primary)] underline"
                        >
                          Reenviar código
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-[#f9f4f6] p-4 text-xs leading-relaxed text-[#5a4551]">
            <strong>Resumen de políticas:</strong> {bundle.policies.reschedulePolicy}{" "}
            {bundle.policies.extensionsPolicy}
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              (bundle.bookingRules.requireClientOtp && !isEmailAlreadyVerified && !otpSent)
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Registrando solicitud...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Reservar cupo (Pendiente de abono)</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 4: Pending Confirmation + WhatsApp Link */}
      {step === 4 && successData && (
        <section className="space-y-6 rounded-3xl border border-[#f1dfe8] bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock className="h-7 w-7" />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)]">
              Código {successData.bookingCode} · Pendiente de confirmación
            </p>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-1 font-serif text-3xl font-semibold text-[#1f141b]">
              ¡Último paso para confirmar tu hora!
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#5d4754]">
              Tu solicitud para <strong>{successData.serviceName}</strong> el{" "}
              <strong>{formatDateLongEs(successData.appointmentDate)}</strong> a las{" "}
              <strong>{successData.startTime} hrs</strong> está pre-reservada. Envía tu abono de{" "}
              <strong>{formatClp(successData.depositAmountClp)}</strong> por WhatsApp para confirmarla.
            </p>
          </div>

          {/* Copyable Bank Info */}
          <div className="rounded-2xl border border-[#eedbe4] bg-[#fff9fc] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#1f141b]">
                Datos para transferencia ({formatClp(successData.depositAmountClp)})
              </h2>
              <button
                type="button"
                onClick={() => copyBankDetails(successData.paymentBank)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#e3c7d6] bg-white px-3 text-xs font-semibold text-[#1f141b] transition hover:border-[var(--brand-primary)]"
              >
                {copiedBank ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar datos</span>
                  </>
                )}
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[#7a6571]">Titular</dt>
                <dd className="font-medium">{successData.paymentBank.accountHolderName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#7a6571]">RUT</dt>
                <dd className="font-medium">{successData.paymentBank.accountHolderRut}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#7a6571]">Banco</dt>
                <dd className="font-medium">
                  {successData.paymentBank.bankName} · {successData.paymentBank.accountType}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#7a6571]">N° de cuenta</dt>
                <dd className="font-semibold text-[#1f141b]">
                  {successData.paymentBank.accountNumber}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[#7a6571]">Correo comprobante</dt>
                <dd className="font-medium">{successData.paymentBank.transferEmail}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={successData.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Enviar comprobante por WhatsApp ahora</span>
            </a>

            <Link
              href="/mi-cuenta"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#e7cddb] bg-white px-6 text-sm font-semibold text-[#3c2733] transition hover:border-[var(--brand-primary)]"
            >
              Ver el estado de mi cita en Mis Citas
            </Link>
          </div>

          <p className="text-center text-xs text-[#7a6571]">
            Apenas validemos tu transferencia, tu cita quedará confirmada y podrás ver la
            dirección exacta en <strong>Mis Citas</strong>.
          </p>
        </section>
      )}
    </div>
  );
}
