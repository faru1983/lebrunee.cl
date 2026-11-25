"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  confirmAppointmentDepositAction,
  updateAppointmentStatusAction,
} from "@/app/actions/adminActions";
import { AppointmentDetailModal } from "@/components/admin/AppointmentDetailModal";
import { ManualAppointmentModal } from "@/components/admin/ManualAppointmentModal";
import type {
  AppointmentRecord,
  PaymentMethodRecord,
  ServiceAddon,
  ServiceItem,
  StaffMember,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";

interface AdminTodayClientProps {
  today: string;
  businessName: string;
  isAgendaOpen: boolean;
  todayAppointments: AppointmentRecord[];
  pendingDeposit: AppointmentRecord[];
  upcomingConfirmed: AppointmentRecord[];
  monthRevenueClp: number;
  monthAppointmentsCount: number;
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  paymentMethods: PaymentMethodRecord[];
  depositDefaultClp: number;
}

export function AdminTodayClient({
  today,
  businessName,
  isAgendaOpen,
  todayAppointments,
  pendingDeposit,
  upcomingConfirmed,
  monthRevenueClp,
  monthAppointmentsCount,
  services,
  addons,
  staff,
  paymentMethods,
  depositDefaultClp,
}: AdminTodayClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AppointmentRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function approveDeposit(appt: AppointmentRecord) {
    setBusyId(appt.id);
    try {
      const res = await confirmAppointmentDepositAction(
        appt.id,
        appt.deposit_required_clp
      );
      if (res.success) {
        setToast(`Abono aprobado · Cita ${appt.booking_code} confirmada`);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(apptId: string, status: "completed" | "cancelled" | "no_show") {
    if (status === "cancelled" && !window.confirm("¿Cancelar esta cita?")) return;
    setBusyId(apptId);
    try {
      const res = await updateAppointmentStatusAction(apptId, status);
      if (res.success) {
        setToast("Estado actualizado");
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] capitalize">
            {formatDateLongEs(today)}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">Hoy en el estudio</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/agenda?view=day"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#e2cbd7] bg-white px-3.5 text-xs font-semibold text-[#1f141b] hover:bg-[#fdf5f9]"
          >
            <CalendarRange className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />
            <span>Agenda Pro</span>
          </Link>
          <Link
            href="/admin/agenda?emergency=1"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold ${
              isAgendaOpen
                ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                : "border-red-300 bg-red-100 text-red-900"
            }`}
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>{isAgendaOpen ? "Emergencia" : "Web PAUSADA"}</span>
          </Link>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[var(--brand-accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Nueva cita</span>
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          {toast}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#eedbe4] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-[#7a6571]">Citas hoy</p>
          <p className="mt-1 text-2xl font-bold text-[#1f141b]">{todayAppointments.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-amber-800">Por aprobar</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{pendingDeposit.length}</p>
        </div>
        <div className="rounded-2xl border border-[#eedbe4] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-[#7a6571]">
            Ingresos mes ({monthAppointmentsCount})
          </p>
          <p className="mt-1 text-lg font-bold text-[#1f141b] sm:text-2xl">
            {formatClp(monthRevenueClp)}
          </p>
        </div>
      </div>

      {/* Pending Deposit Queue (1-tap approve) */}
      {pendingDeposit.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-800">
            <AlertCircle className="h-4 w-4" />
            Pendientes de confirmar abono ({pendingDeposit.length})
          </h2>

          <div className="space-y-3">
            {pendingDeposit.map((appt) => {
              const serviceLabel =
                appt.items?.map((i) => i.name_snapshot).join(" + ") || "Servicio";
              const waUrl = appt.client?.phone
                ? buildWhatsAppUrl(
                    appt.client.phone,
                    `Hola ${appt.client.first_name}! Revisamos tu solicitud ${appt.booking_code} para el ${formatDateLongEs(appt.appointment_date)} a las ${appt.start_time.slice(0, 5)}.`
                  )
                : null;

              return (
                <article
                  key={appt.id}
                  className="rounded-3xl border border-amber-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                          {appt.booking_code}
                        </span>
                        <span className="text-xs font-medium text-[#6c5763] capitalize">
                          {formatDateLongEs(appt.appointment_date)} ·{" "}
                          <strong>{appt.start_time.slice(0, 5)}</strong>
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-[#1f141b]">
                        {appt.client?.first_name} {appt.client?.last_name || ""}
                      </h3>
                      <p className="text-xs text-[#5d4754]">
                        {serviceLabel} · Abono {formatClp(appt.deposit_required_clp)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === appt.id}
                      onClick={() => approveDeposit(appt)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>Aprobar abono ({formatClp(appt.deposit_required_clp)})</span>
                    </button>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[#e2cbd7] px-3.5 text-xs font-semibold text-[#1f141b]"
                      >
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={busyId === appt.id}
                      onClick={() => setStatus(appt.id, "cancelled")}
                      aria-label="Cancelar solicitud"
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Today Timeline */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#6c5763]">
          Agenda de hoy
        </h2>

        {todayAppointments.length === 0 ? (
          <div className="rounded-3xl border border-[#eedbe4] bg-white p-8 text-center text-sm text-[#6c5763]">
            No tienes citas agendadas para hoy.
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppointments.map((appt) => {
              const serviceLabel =
                appt.items?.map((i) => i.name_snapshot).join(" + ") || "Servicio";
              const waUrl = appt.client?.phone
                ? buildWhatsAppUrl(
                    appt.client.phone,
                    `Hola ${appt.client.first_name}! Te escribo por tu cita de hoy a las ${appt.start_time.slice(0, 5)} hrs.`
                  )
                : null;
              const isDone = appt.status === "completed";

              return (
                <article
                  key={appt.id}
                  className={`rounded-3xl border bg-white p-4 ${
                    isDone ? "border-emerald-200 opacity-80" : "border-[#eedbe4]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--brand-primary)]">
                        <Clock className="h-4 w-4" />
                        {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-[#1f141b]">
                        {appt.client?.first_name} {appt.client?.last_name || ""}
                      </h3>
                      <p className="text-xs text-[#5d4754]">{serviceLabel}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        {appt.client?.is_new_client && (
                          <span className="rounded-full bg-pink-50 px-2.5 py-0.5 font-semibold text-[var(--brand-primary)]">
                            Clienta nueva
                          </span>
                        )}
                        {appt.has_external_product && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
                            Trae retiro externo
                          </span>
                        )}
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium text-neutral-700">
                          Abonado: {formatClp(appt.deposit_paid_clp)}
                        </span>
                      </div>
                    </div>

                    {isDone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Lista
                      </span>
                    )}
                  </div>

                  {!isDone && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f5e7ee] pt-3">
                      {appt.status === "pending_deposit" ? (
                        <button
                          type="button"
                          disabled={busyId === appt.id}
                          onClick={() => approveDeposit(appt)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprobar abono
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDetailTarget(appt)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3 text-xs font-semibold text-white"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Cerrar y cobrar / Editar
                        </button>
                      )}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold text-[#1f141b]"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming preview */}
      {upcomingConfirmed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6c5763]">
            Próximas confirmadas
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {upcomingConfirmed.slice(0, 6).map((appt) => (
              <button
                key={appt.id}
                type="button"
                onClick={() => setDetailTarget(appt)}
                className="flex items-center justify-between rounded-2xl border border-[#eedbe4] bg-white px-4 py-3 text-left text-xs transition hover:border-[var(--brand-primary)] hover:bg-[#fff9fb]"
              >
                <div>
                  <p className="font-bold text-[#1f141b]">
                    {appt.client?.first_name} {appt.client?.last_name || ""}
                  </p>
                  <p className="text-[#6c5763] capitalize">
                    {formatDateLongEs(appt.appointment_date)} · {appt.start_time.slice(0, 5)}
                  </p>
                </div>
                <span className="font-semibold text-[var(--brand-primary)]">
                  {appt.booking_code}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <ManualAppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => router.refresh()}
        services={services}
        addons={addons}
        staff={staff}
        defaultDate={today}
        depositDefaultClp={depositDefaultClp}
      />

      <AppointmentDetailModal
        key={detailTarget?.id || "none"}
        appointment={detailTarget}
        onClose={() => setDetailTarget(null)}
        onUpdated={(msg) => {
          setToast(msg || "Cita actualizada correctamente.");
          router.refresh();
        }}
        paymentMethods={paymentMethods}
        services={services}
        addons={addons}
        staff={staff}
        businessName={businessName}
      />
    </div>
  );
}
