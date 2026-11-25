"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, GripVertical, Move, Plus } from "lucide-react";
import type {
  AppointmentRecord,
  AvailabilityException,
  AvailabilityRule,
} from "@/lib/types";
import { formatDateLongEs, minutesToTime } from "@/lib/utils";
import {
  clampMinutes,
  computeTimelineBounds,
  getClientFullName,
  getServiceSummary,
  layoutDayAppointments,
  resolveDayWorkingIntervals,
  snapMinutes,
  STATUS_META,
  WEEKDAY_SHORT_MON,
} from "@/components/admin/agenda/agendaHelpers";

const HOUR_HEIGHT = 64;
const PX_PER_MIN = HOUR_HEIGHT / 60;

interface WeekDragSession {
  appointment: AppointmentRecord;
  pointerId: number;
  startY: number;
  initialStartMin: number;
  currentStartMin: number;
  targetDate: string;
}

interface AgendaWeekViewProps {
  weekDates: string[];
  today: string;
  nowMinutes: number;
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  primaryStaffId: string;
  movingAppointment: AppointmentRecord | null;
  onStartMoveMode: (appt: AppointmentRecord) => void;
  onDropAppointment: (params: {
    appointment: AppointmentRecord;
    targetDate: string;
    targetStartTime: string;
    targetStaffId: string;
  }) => void;
  onOpenDetail: (appt: AppointmentRecord) => void;
  onSelectDay: (dateStr: string) => void;
  onSlotCreateAppointment: (dateStr: string, startTime: string, staffId: string) => void;
  onQuickApprove: (appt: AppointmentRecord) => void;
  busyId: string | null;
}

export function AgendaWeekView({
  weekDates,
  today,
  nowMinutes,
  appointments,
  rules,
  exceptions,
  primaryStaffId,
  movingAppointment,
  onStartMoveMode,
  onDropAppointment,
  onOpenDetail,
  onSelectDay,
  onSlotCreateAppointment,
  onQuickApprove,
  busyId,
}: AgendaWeekViewProps) {
  const weekSet = useMemo(() => new Set(weekDates), [weekDates]);
  const weekAppointments = useMemo(
    () => appointments.filter((a) => weekSet.has(a.appointment_date)),
    [appointments, weekSet]
  );

  const { startHour, endHour } = useMemo(
    () =>
      computeTimelineBounds({
        appointments: weekAppointments,
        rules,
        exceptions: exceptions.filter((e) => weekSet.has(e.exception_date)),
      }),
    [weekAppointments, rules, exceptions, weekSet]
  );

  const startMinBound = startHour * 60;
  const endMinBound = endHour * 60;
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const [drag, setDrag] = useState<WeekDragSession | null>(null);
  const dragRef = useRef<WeekDragSession | null>(null);
  const dayColRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!drag) {
      document.documentElement.classList.remove("agenda-dragging");
      return;
    }
    document.documentElement.classList.add("agenda-dragging");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrag(null);
        dragRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("agenda-dragging");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drag]);

  function beginDrag(
    e: React.PointerEvent<HTMLButtonElement>,
    appointment: AppointmentRecord
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startMin =
      Number(appointment.start_time.slice(0, 2)) * 60 +
      Number(appointment.start_time.slice(3, 5));
    const session: WeekDragSession = {
      appointment,
      pointerId: e.pointerId,
      startY: e.clientY,
      initialStartMin: startMin,
      currentStartMin: startMin,
      targetDate: appointment.appointment_date,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = session;
    setDrag(session);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const deltaMin = (e.clientY - active.startY) / PX_PER_MIN;
    const snapped = clampMinutes(
      snapMinutes(active.initialStartMin + deltaMin, 15),
      startMinBound,
      endMinBound - Math.min(active.appointment.total_duration_minutes, 60)
    );

    let targetDate = active.targetDate;
    for (const d of weekDates) {
      const el = dayColRefs.current[d];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        targetDate = d;
        break;
      }
    }

    const next = { ...active, currentStartMin: snapped, targetDate };
    dragRef.current = next;
    setDrag(next);
  }

  function finishDrag(e: React.PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDrag(null);
    if (cancelled) return;

    const changedDate = active.targetDate !== active.appointment.appointment_date;
    const changedTime = active.currentStartMin !== active.initialStartMin;
    if (!changedDate && !changedTime) return;

    onDropAppointment({
      appointment: active.appointment,
      targetDate: active.targetDate,
      targetStartTime: minutesToTime(active.currentStartMin),
      targetStaffId: active.appointment.staff_id,
    });
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    if (dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMin = clampMinutes(
      snapMinutes(startMinBound + offsetY / PX_PER_MIN, 15),
      startMinBound,
      endMinBound - 30
    );

    if (movingAppointment) {
      onDropAppointment({
        appointment: movingAppointment,
        targetDate: dateStr,
        targetStartTime: minutesToTime(clickedMin),
        targetStaffId: movingAppointment.staff_id,
      });
      return;
    }

    onSlotCreateAppointment(dateStr, minutesToTime(clickedMin), primaryStaffId);
  }

  return (
    <div className="space-y-3">
      {/* Desktop / Tablet 7-Day Interactive Timeline Grid */}
      <div className="hidden overflow-hidden rounded-3xl border border-[#eedbe4] bg-white shadow-xs md:block">
        {/* Week Headers */}
        <div
          className="grid border-b border-[#f3e3eb] bg-[#fdf9fb]"
          style={{ gridTemplateColumns: "54px repeat(7, minmax(0, 1fr))" }}
        >
          <div className="flex items-center justify-center border-r border-[#f3e3eb] py-2.5 text-[10px] font-bold uppercase text-[#7a6571]">
            Hora
          </div>
          {weekDates.map((d, idx) => {
            const isToday = d === today;
            const dayNum = Number(d.slice(8, 10));
            const dayAppts = weekAppointments.filter(
              (a) => a.appointment_date === d && a.status !== "cancelled"
            );
            const dayInfo = resolveDayWorkingIntervals(d, primaryStaffId, rules, exceptions);

            return (
              <div
                key={d}
                className={`flex flex-col items-center justify-center border-r border-[#f3e3eb] px-1.5 py-2 last:border-r-0 ${
                  isToday ? "bg-[#fff2f7]" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectDay(d)}
                    className="flex items-center gap-1.5 rounded-xl px-1.5 py-0.5 text-left hover:bg-white"
                    title="Abrir vista Día"
                  >
                    <span className="text-[11px] font-bold uppercase text-[#7a6571]">
                      {WEEKDAY_SHORT_MON[idx]}
                    </span>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? "bg-[var(--brand-primary)] text-white"
                          : "text-[#1f141b]"
                      }`}
                    >
                      {dayNum}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSlotCreateAppointment(d, "10:00", primaryStaffId)}
                    aria-label={`Nueva cita el ${d}`}
                    title="Agregar cita este día"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#7a6571] hover:bg-white hover:text-[var(--brand-primary)]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-1 flex items-center gap-1 text-[10px]">
                  {dayInfo.isBlockedAllDay ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">
                      <Ban className="h-2.5 w-2.5" aria-hidden="true" />
                      Bloqueado
                    </span>
                  ) : (
                    <span className="font-semibold text-[#7a6571]">
                      {dayAppts.length} {dayAppts.length === 1 ? "cita" : "citas"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable 7-Day Grid Body */}
        <div className="relative overflow-y-auto" style={{ maxHeight: "72vh" }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "54px repeat(7, minmax(0, 1fr))",
              minHeight: `${totalHeight}px`,
            }}
          >
            {/* Time Ruler */}
            <div
              className="relative select-none border-r border-[#f3e3eb] bg-[#fdfafc]"
              style={{ height: `${totalHeight}px` }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 flex justify-center text-[10px] font-semibold text-[#7a6571]"
                  style={{ top: `${(h - startHour) * HOUR_HEIGHT - 7}px` }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* 7 Day Columns */}
            {weekDates.map((d) => {
              const isToday = d === today;
              const dayInfo = resolveDayWorkingIntervals(d, primaryStaffId, rules, exceptions);
              const dayAppts = weekAppointments.filter((a) => a.appointment_date === d);
              const positioned = layoutDayAppointments(dayAppts);

              const nonWorkingBands: Array<{ startMin: number; endMin: number }> = [];
              if (!dayInfo.isBlockedAllDay) {
                if (dayInfo.workingRanges.length === 0) {
                  nonWorkingBands.push({ startMin: startMinBound, endMin: endMinBound });
                } else {
                  const sorted = [...dayInfo.workingRanges].sort(
                    (a, b) => a.startMin - b.startMin
                  );
                  let cur = startMinBound;
                  for (const w of sorted) {
                    if (w.startMin > cur) nonWorkingBands.push({ startMin: cur, endMin: w.startMin });
                    cur = Math.max(cur, w.endMin);
                  }
                  if (cur < endMinBound) nonWorkingBands.push({ startMin: cur, endMin: endMinBound });
                }
              }

              const showNow =
                isToday && nowMinutes >= startMinBound && nowMinutes <= endMinBound;

              return (
                <div
                  key={d}
                  ref={(el) => {
                    dayColRefs.current[d] = el;
                  }}
                  onClick={(e) => handleColumnClick(e, d)}
                  className={`relative border-r border-[#f3e3eb] last:border-r-0 ${
                    isToday ? "bg-[#fffbfd]" : ""
                  } ${movingAppointment ? "cursor-crosshair" : "cursor-pointer"}`}
                  style={{ height: `${totalHeight}px` }}
                >
                  {/* Gridlines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-[#f3e6ed]"
                      style={{
                        top: `${(h - startHour) * HOUR_HEIGHT}px`,
                        height: `${HOUR_HEIGHT}px`,
                      }}
                    />
                  ))}

                  {/* Closed shading */}
                  {nonWorkingBands.map((band, idx) => {
                    const top = Math.max(0, (band.startMin - startMinBound) * PX_PER_MIN);
                    const bottom = Math.min(
                      totalHeight,
                      (band.endMin - startMinBound) * PX_PER_MIN
                    );
                    if (bottom <= top) return null;
                    return (
                      <div
                        key={idx}
                        className="agenda-closed-hatch pointer-events-none absolute inset-x-0"
                        style={{ top: `${top}px`, height: `${bottom - top}px` }}
                      />
                    );
                  })}

                  {/* Blocked day / ranges */}
                  {dayInfo.isBlockedAllDay && (
                    <div className="agenda-blocked-hatch pointer-events-none absolute inset-0 z-10" />
                  )}
                  {dayInfo.blockedRanges.map((br) => (
                    <div
                      key={br.id}
                      className="agenda-blocked-hatch pointer-events-none absolute inset-x-0.5 z-10 rounded-lg border border-amber-300"
                      style={{
                        top: `${Math.max(0, (br.startMin - startMinBound) * PX_PER_MIN)}px`,
                        height: `${Math.max(18, (br.endMin - br.startMin) * PX_PER_MIN)}px`,
                      }}
                    />
                  ))}

                  {/* Now Line */}
                  {showNow && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-rose-500"
                      style={{ top: `${(nowMinutes - startMinBound) * PX_PER_MIN}px` }}
                    />
                  )}

                  {/* Drag Ghost */}
                  {drag && drag.targetDate === d && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-30 rounded-xl border-2 border-dashed border-[var(--brand-primary)] bg-[#fce7f1]/80 px-1.5 py-1 text-[10px] font-bold text-[var(--brand-primary)] shadow-md"
                      style={{
                        top: `${(drag.currentStartMin - startMinBound) * PX_PER_MIN}px`,
                        height: `${Math.max(
                          32,
                          drag.appointment.total_duration_minutes * PX_PER_MIN
                        )}px`,
                      }}
                    >
                      {minutesToTime(drag.currentStartMin)} ·{" "}
                      {drag.appointment.client?.first_name}
                    </div>
                  )}

                  {/* Appointments */}
                  {positioned.map((pos) => {
                    const appt = pos.appointment;
                    const meta = STATUS_META[appt.status];
                    const isDragged = drag?.appointment.id === appt.id;
                    const top = (pos.startMin - startMinBound) * PX_PER_MIN;
                    const height = Math.max(38, (pos.endMin - pos.startMin) * PX_PER_MIN - 2);
                    const widthPct = 100 / pos.totalColumns;
                    const leftPct = pos.column * widthPct;

                    return (
                      <article
                        key={appt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!movingAppointment) onOpenDetail(appt);
                        }}
                        className={`group absolute z-20 overflow-hidden rounded-xl border px-2 py-1 text-[11px] shadow-xs transition ${meta.cardBg} ${meta.cardBorder} ${
                          isDragged ? "opacity-35 ring-2 ring-[var(--brand-primary)]" : ""
                        } ${appt.status === "cancelled" ? "opacity-60" : ""}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      >
                        <div className={`absolute inset-y-0 left-0 w-1 ${meta.accentBar}`} />
                        <div className="flex items-start justify-between gap-0.5 pl-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-bold text-[#1f141b]">
                              {appt.start_time.slice(0, 5)} · {appt.client?.first_name}
                            </p>
                            {height >= 50 && (
                              <p className="truncate text-[10px] text-[#5d4754]">
                                {getServiceSummary(appt)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onPointerDown={(e) => beginDrag(e, appt)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(e) => finishDrag(e, false)}
                            onPointerCancel={(e) => finishDrag(e, true)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Arrastrar cita de ${getClientFullName(appt)}`}
                            title="Arrastrar a otro día u hora"
                            className="agenda-drag-handle shrink-0 rounded p-0.5 text-[#7a6571] opacity-70 hover:bg-white hover:text-[var(--brand-primary)] group-hover:opacity-100"
                          >
                            <GripVertical className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Compact 7-Day Stacked View (< md) */}
      <div className="space-y-2.5 md:hidden">
        {weekDates.map((d) => {
          const isToday = d === today;
          const dayAppts = weekAppointments.filter((a) => a.appointment_date === d);
          const dayInfo = resolveDayWorkingIntervals(d, primaryStaffId, rules, exceptions);

          return (
            <section
              key={d}
              className={`rounded-3xl border bg-white p-3.5 ${
                isToday ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/20" : "border-[#eedbe4]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDay(d)}
                  className="flex items-center gap-2 text-left"
                >
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                      isToday
                        ? "bg-[var(--brand-primary)] text-white"
                        : "bg-[#faf5f8] text-[#1f141b]"
                    }`}
                  >
                    {formatDateLongEs(d)}
                  </span>
                  {dayInfo.isBlockedAllDay && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      Bloqueado
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectDay(d)}
                    className="rounded-xl px-2 py-1 text-[11px] font-semibold text-[var(--brand-primary)]"
                  >
                    Ver día
                  </button>
                  <button
                    type="button"
                    onClick={() => onSlotCreateAppointment(d, "10:00", primaryStaffId)}
                    aria-label={`Nueva cita el ${d}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#eedbe4] text-[#4a3541]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {dayAppts.length === 0 ? (
                <p className="mt-2 text-xs text-[#8a7581]">Sin citas agendadas.</p>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {dayAppts.map((appt) => {
                    const meta = STATUS_META[appt.status];
                    return (
                      <div
                        key={appt.id}
                        onClick={() => onOpenDetail(appt)}
                        className={`relative flex items-center justify-between gap-2 overflow-hidden rounded-2xl border p-2.5 pl-3.5 ${meta.cardBg} ${meta.cardBorder}`}
                      >
                        <div className={`absolute inset-y-0 left-0 w-1.5 ${meta.accentBar}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1f141b]">
                            {appt.start_time.slice(0, 5)}–{appt.end_time.slice(0, 5)} ·{" "}
                            {getClientFullName(appt)}
                          </p>
                          <p className="truncate text-[11px] text-[#5d4754]">
                            {getServiceSummary(appt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {appt.status === "pending_deposit" && (
                            <button
                              type="button"
                              disabled={busyId === appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuickApprove(appt);
                              }}
                              aria-label="Aprobar abono"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartMoveMode(appt);
                            }}
                            aria-label="Mover cita"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#e2cbd7] bg-white text-[#4a3541]"
                          >
                            <Move className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
