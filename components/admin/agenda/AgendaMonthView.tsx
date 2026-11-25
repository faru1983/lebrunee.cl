"use client";

import { useMemo } from "react";
import { Ban, Calendar, Check, MessageCircle, Move, Plus, Sparkles } from "lucide-react";
import type {
  AppointmentRecord,
  AvailabilityException,
  AvailabilityRule,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";
import {
  getClientFullName,
  getMonthGridDates,
  getServiceSummary,
  resolveDayWorkingIntervals,
  STATUS_META,
  WEEKDAY_SHORT_MON,
} from "@/components/admin/agenda/agendaHelpers";

interface AgendaMonthViewProps {
  activeDate: string;
  today: string;
  businessName: string;
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  primaryStaffId: string;
  movingAppointment: AppointmentRecord | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDayView: (dateStr: string) => void;
  onOpenDetail: (appt: AppointmentRecord) => void;
  onStartMoveMode: (appt: AppointmentRecord) => void;
  onQuickApprove: (appt: AppointmentRecord) => void;
  onCreateAppointmentForDate: (dateStr: string) => void;
  onQuickBlockDate: (dateStr: string) => void;
  busyId: string | null;
}

export function AgendaMonthView({
  activeDate,
  today,
  businessName,
  appointments,
  rules,
  exceptions,
  primaryStaffId,
  movingAppointment,
  onSelectDate,
  onOpenDayView,
  onOpenDetail,
  onStartMoveMode,
  onQuickApprove,
  onCreateAppointmentForDate,
  onQuickBlockDate,
  busyId,
}: AgendaMonthViewProps) {
  const monthGrid = useMemo(() => getMonthGridDates(activeDate), [activeDate]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>();
    for (const a of appointments) {
      const list = map.get(a.appointment_date) || [];
      list.push(a);
      map.set(a.appointment_date, list);
    }
    return map;
  }, [appointments]);

  const selectedDayAppts = appointmentsByDate.get(activeDate) || [];
  const selectedDayInfo = resolveDayWorkingIntervals(
    activeDate,
    primaryStaffId,
    rules,
    exceptions
  );

  return (
    <div className="space-y-4">
      {/* Month Calendar Grid */}
      <div className="overflow-hidden rounded-3xl border border-[#eedbe4] bg-white shadow-xs">
        <div className="grid grid-cols-7 border-b border-[#f3e3eb] bg-[#fdf9fb]">
          {WEEKDAY_SHORT_MON.map((dayName) => (
            <div
              key={dayName}
              className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#7a6571]"
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthGrid.cells.map((cell) => {
            const list = appointmentsByDate.get(cell.date) || [];
            const activeList = list.filter((a) => a.status !== "cancelled");
            const pendingCount = list.filter((a) => a.status === "pending_deposit").length;
            const isToday = cell.date === today;
            const isSelected = cell.date === activeDate;
            const dayNum = Number(cell.date.slice(8, 10));
            const dayInfo = resolveDayWorkingIntervals(
              cell.date,
              primaryStaffId,
              rules,
              exceptions
            );

            return (
              <div
                key={cell.date}
                onClick={() => {
                  if (movingAppointment) {
                    onOpenDayView(cell.date);
                  } else {
                    onSelectDate(cell.date);
                  }
                }}
                onDoubleClick={() => onOpenDayView(cell.date)}
                className={`min-h-[76px] cursor-pointer border-b border-r border-[#f3e6ed] p-1.5 transition sm:min-h-[112px] sm:p-2 ${
                  !cell.inMonth ? "bg-[#faf6f8]/70 text-[#a5919c]" : "bg-white"
                } ${isSelected ? "bg-[#fff4f9] ring-2 ring-inset ring-[var(--brand-primary)]" : "hover:bg-[#fdf8fa]"} ${
                  dayInfo.isBlockedAllDay ? "agenda-blocked-hatch" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday
                        ? "bg-[var(--brand-primary)] text-white"
                        : isSelected
                        ? "bg-[#fce7f1] text-[var(--brand-primary)]"
                        : ""
                    }`}
                  >
                    {dayNum}
                  </span>

                  <div className="flex items-center gap-1">
                    {dayInfo.isBlockedAllDay && (
                      <Ban className="h-3 w-3 text-amber-700" aria-label="Día bloqueado" />
                    )}
                    {dayInfo.specialOpens.length > 0 && (
                      <Sparkles
                        className="h-3 w-3 text-emerald-600"
                        aria-label="Horario especial"
                      />
                    )}
                    {pendingCount > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-500"
                        title={`${pendingCount} pendiente(s) de abono`}
                      />
                    )}
                  </div>
                </div>

                {/* Mobile compact dots */}
                <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                  {activeList.slice(0, 5).map((a) => (
                    <span
                      key={a.id}
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_META[a.status].dotColor}`}
                    />
                  ))}
                  {activeList.length > 5 && (
                    <span className="text-[9px] font-bold text-[#7a6571]">
                      +{activeList.length - 5}
                    </span>
                  )}
                </div>

                {/* Desktop appointment pills */}
                <div className="mt-1.5 hidden space-y-1 sm:block">
                  {list.slice(0, 3).map((a) => {
                    const meta = STATUS_META[a.status];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(a);
                        }}
                        className={`flex w-full items-center gap-1 truncate rounded-lg border px-1.5 py-0.5 text-left text-[10px] font-semibold transition ${meta.cardBg} ${meta.cardBorder} ${
                          a.status === "cancelled" ? "line-through opacity-60" : ""
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotColor}`} />
                        <span className="font-bold">{a.start_time.slice(0, 5)}</span>
                        <span className="truncate">{a.client?.first_name}</span>
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayView(cell.date);
                      }}
                      className="w-full text-left text-[10px] font-bold text-[var(--brand-primary)] hover:underline"
                    >
                      +{list.length - 3} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Interactive Detail Panel */}
      <section className="rounded-3xl border border-[#eedbe4] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f5e7ee] pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">
              Día seleccionado
            </p>
            <h2 className="font-serif text-2xl font-semibold capitalize text-[#1f141b]">
              {formatDateLongEs(activeDate)}
            </h2>
            {selectedDayInfo.isBlockedAllDay && (
              <p className="mt-0.5 text-xs font-semibold text-amber-800">
                Día bloqueado
                {selectedDayInfo.blockDayException?.reason
                  ? ` · ${selectedDayInfo.blockDayException.reason}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDayView(activeDate)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#e2cbd7] bg-white px-3 text-xs font-semibold text-[#1f141b] hover:bg-[#fdf5f9]"
            >
              <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
              <span>Abrir timeline del día</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickBlockDate(activeDate)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              <Ban className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              <span>Bloquear</span>
            </button>

            <button
              type="button"
              onClick={() => onCreateAppointmentForDate(activeDate)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--brand-accent)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Agendar cita</span>
            </button>
          </div>
        </div>

        {selectedDayAppts.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#7a6571]">
            No hay citas registradas para este día.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {selectedDayAppts.map((appt) => {
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
                  onClick={() => onOpenDetail(appt)}
                  className={`relative cursor-pointer overflow-hidden rounded-2xl border p-3 pl-4 transition ${meta.cardBg} ${meta.cardBorder}`}
                >
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${meta.accentBar}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1f141b]">
                        {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}{" "}
                        <span className="font-normal text-[#6c5763]">({appt.booking_code})</span>
                      </p>
                      <h3 className="mt-0.5 truncate text-sm font-bold text-[#1f141b]">
                        {getClientFullName(appt)}
                      </h3>
                      <p className="truncate text-xs text-[#5d4754]">
                        {getServiceSummary(appt)} · {formatClp(appt.total_estimated_clp)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                    >
                      {meta.shortLabel}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {appt.status === "pending_deposit" && (
                      <button
                        type="button"
                        disabled={busyId === appt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickApprove(appt);
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-semibold text-white"
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Aprobar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartMoveMode(appt);
                      }}
                      className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-[#e2cbd7] bg-white px-2.5 text-[11px] font-semibold text-[#1f141b]"
                    >
                      <Move className="h-3 w-3" aria-hidden="true" />
                      Mover
                    </button>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-[#e2cbd7] bg-white px-2.5 text-[11px] font-semibold text-emerald-700"
                      >
                        <MessageCircle className="h-3 w-3" aria-hidden="true" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
