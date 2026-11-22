"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Plus, Search, XCircle } from "lucide-react";
import {
  confirmAppointmentDepositAction,
  updateAppointmentStatusAction,
} from "@/app/actions/adminActions";
import { ManualAppointmentModal } from "@/components/admin/ManualAppointmentModal";
import type {
  AppointmentRecord,
  AppointmentStatus,
  ServiceAddon,
  ServiceItem,
  StaffMember,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";

interface AdminAgendaClientProps {
  today: string;
  appointments: AppointmentRecord[];
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  depositDefaultClp: number;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_deposit: "Pendiente",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export function AdminAgendaClient({
  today,
  appointments,
  services,
  addons,
  staff,
  depositDefaultClp,
}: AdminAgendaClientProps) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<"all" | AppointmentStatus>("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (!q) return true;
      const clientName = `${a.client?.first_name || ""} ${a.client?.last_name || ""}`.toLowerCase();
      return (
        clientName.includes(q) ||
        a.booking_code.toLowerCase().includes(q) ||
        (a.client?.phone || "").includes(q)
      );
    });
  }, [appointments, filterStatus, query]);

  async function handleApprove(appt: AppointmentRecord) {
    setBusyId(appt.id);
    try {
      await confirmAppointmentDepositAction(appt.id, appt.deposit_required_clp);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatus(id: string, status: AppointmentStatus) {
    if (status === "cancelled" && !window.confirm("¿Cancelar esta cita?")) return;
    setBusyId(id);
    try {
      await updateAppointmentStatusAction(id, status);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">Agenda General</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva cita</span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-4">
        <search>
          <label htmlFor="agenda-search" className="visually-hidden">
            Buscar por clienta o código
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a6571]" />
            <input
              id="agenda-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código LB-... o teléfono"
              className="min-h-11 w-full rounded-2xl border border-[#e2cbd7] pl-10 pr-4 text-sm"
            />
          </div>
        </search>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "all", label: "Todas" },
              { id: "pending_deposit", label: "Pendientes" },
              { id: "confirmed", label: "Confirmadas" },
              { id: "completed", label: "Realizadas" },
              { id: "cancelled", label: "Canceladas" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
                filterStatus === tab.id
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-[#faf5f8] text-[#4a3541]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-[#eedbe4] bg-white p-8 text-center text-sm text-[#6c5763]">
          No hay citas que coincidan con el filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const serviceLabel =
              appt.items?.map((i) => i.name_snapshot).join(" + ") || "Servicio";
            const waUrl = appt.client?.phone
              ? buildWhatsAppUrl(
                  appt.client.phone,
                  `Hola ${appt.client.first_name}! Te escribimos desde Lebrunee por tu cita ${appt.booking_code}.`
                )
              : null;

            return (
              <article
                key={appt.id}
                className="rounded-3xl border border-[#eedbe4] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[var(--brand-primary)]">
                        {appt.booking_code}
                      </span>
                      <span className="capitalize text-[#5d4754]">
                        {formatDateLongEs(appt.appointment_date)} ·{" "}
                        <strong>{appt.start_time.slice(0, 5)}</strong>
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-[#1f141b]">
                      {appt.client?.first_name} {appt.client?.last_name || ""}
                    </h2>
                    <p className="text-xs text-[#6c5763]">
                      {serviceLabel} · {appt.total_duration_minutes} min · Est.{" "}
                      {formatClp(appt.total_estimated_clp)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#faf5f8] px-3 py-1 text-xs font-semibold text-[#4a3541]">
                    {STATUS_LABELS[appt.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {appt.status === "pending_deposit" && (
                    <button
                      type="button"
                      disabled={busyId === appt.id}
                      onClick={() => handleApprove(appt)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprobar abono
                    </button>
                  )}
                  {appt.status === "confirmed" && (
                    <button
                      type="button"
                      disabled={busyId === appt.id}
                      onClick={() => handleStatus(appt.id, "completed")}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-3.5 text-xs font-semibold text-white"
                    >
                      Marcar realizada
                    </button>
                  )}
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                      WhatsApp
                    </a>
                  )}
                  {["pending_deposit", "confirmed"].includes(appt.status) && (
                    <button
                      type="button"
                      disabled={busyId === appt.id}
                      onClick={() => handleStatus(appt.id, "cancelled")}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
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
    </div>
  );
}
