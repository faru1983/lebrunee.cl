"use client";

import { useMemo } from "react";
import { Check, MessageCircle, Move, XCircle } from "lucide-react";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";
import {
  getClientFullName,
  getServiceSummary,
  STATUS_META,
} from "@/components/admin/agenda/agendaHelpers";

interface AgendaListViewProps {
  appointments: AppointmentRecord[];
  businessName: string;
  busyId: string | null;
  onApprove: (appt: AppointmentRecord) => void;
  onStatus: (id: string, status: AppointmentStatus) => void;
  onOpenDetail: (appt: AppointmentRecord) => void;
  onStartMoveMode: (appt: AppointmentRecord) => void;
}

export function AgendaListView({
  appointments,
  businessName,
  busyId,
  onApprove,
  onStatus,
  onOpenDetail,
  onStartMoveMode,
}: AgendaListViewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>();
    for (const a of appointments) {
      const list = map.get(a.appointment_date) || [];
      list.push(a);
      map.set(a.appointment_date, list);
    }
    return Array.from(map.entries()).sort(([d1], [d2]) => d1.localeCompare(d2));
  }, [appointments]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-3xl border border-[#eedbe4] bg-white p-10 text-center text-sm text-[#6c5763]">
        No hay citas que coincidan con el filtro en este período.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([dateStr, items]) => (
        <section key={dateStr} className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] capitalize">
              {formatDateLongEs(dateStr)}
            </h2>
            <span className="text-xs font-semibold text-[#7a6571]">
              {items.length} {items.length === 1 ? "cita" : "citas"}
            </span>
          </div>

          <div className="space-y-2.5">
            {items.map((appt) => {
              const meta = STATUS_META[appt.status];
              const waUrl = appt.client?.phone
                ? buildWhatsAppUrl(
                    appt.client.phone,
                    `Hola ${appt.client.first_name}! Te escribimos desde ${businessName} por tu cita ${appt.booking_code} del ${formatDateLongEs(appt.appointment_date)} a las ${appt.start_time.slice(0, 5)} hrs.`
                  )
                : null;

              return (
                <article
                  key={appt.id}
                  className="relative overflow-hidden rounded-3xl border border-[#eedbe4] bg-white p-4 pl-5 transition hover:border-[#dfb8cb]"
                >
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${meta.accentBar}`} />

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-[var(--brand-primary)]">
                          {appt.booking_code}
                        </span>
                        <span className="font-bold text-[#1f141b]">
                          {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}
                        </span>
                        <span className="text-[#6c5763]">
                          ({appt.total_duration_minutes} min)
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-[#1f141b]">
                        {getClientFullName(appt)}
                      </h3>
                      <p className="text-xs text-[#6c5763]">
                        {getServiceSummary(appt)} · Est. {formatClp(appt.total_estimated_clp)} ·
                        Pagado {formatClp(appt.total_paid_clp)}
                      </p>
                      {appt.admin_notes && (
                        <p className="mt-1 text-xs italic text-[#5d4754]">
                          Nota interna: {appt.admin_notes}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${meta.badgeBg} ${meta.badgeText}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {appt.status === "pending_deposit" && (
                      <button
                        type="button"
                        disabled={busyId === appt.id}
                        onClick={() => onApprove(appt)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Aprobar abono
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenDetail(appt)}
                      className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3.5 text-xs font-semibold ${
                        appt.status === "confirmed"
                          ? "bg-[var(--brand-primary)] text-white"
                          : "border border-[#e2cbd7] text-[#1f141b]"
                      }`}
                    >
                      {appt.status === "confirmed" ? "Cobrar / Editar" : "Ver / Editar"}
                    </button>

                    {["pending_deposit", "confirmed"].includes(appt.status) && (
                      <button
                        type="button"
                        onClick={() => onStartMoveMode(appt)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold text-[#1f141b] hover:bg-[#fdf5f9]"
                      >
                        <Move className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
                        Mover en calendario
                      </button>
                    )}

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        WhatsApp
                      </a>
                    )}

                    {["pending_deposit", "confirmed"].includes(appt.status) && (
                      <button
                        type="button"
                        disabled={busyId === appt.id}
                        onClick={() => onStatus(appt.id, "cancelled")}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Cancelar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
