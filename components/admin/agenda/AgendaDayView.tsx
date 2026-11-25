"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  GripVertical,
  MessageCircle,
  Move,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  AppointmentRecord,
  AvailabilityException,
  AvailabilityRule,
  StaffMember,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, minutesToTime } from "@/lib/utils";
import {
  clampMinutes,
  computeTimelineBounds,
  getClientFullName,
  getServiceSummary,
  layoutDayAppointments,
  resolveDayWorkingIntervals,
  snapMinutes,
  STATUS_META,
} from "@/components/admin/agenda/agendaHelpers";

const HOUR_HEIGHT = 84; // px per 60 minutes (1.4px / min)
const PX_PER_MIN = HOUR_HEIGHT / 60;

interface DragSession {
  mode: "move" | "resize";
  appointment: AppointmentRecord;
  pointerId: number;
  startY: number;
  initialStartMin: number;
  initialDuration: number;
  currentStartMin: number;
  currentDuration: number;
  targetStaffId: string;
}

interface AgendaDayViewProps {
  dateStr: string;
  today: string;
  nowMinutes: number;
  businessName: string;
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  staff: StaffMember[];
  movingAppointment: AppointmentRecord | null;
  onStartMoveMode: (appt: AppointmentRecord) => void;
  onDropAppointment: (params: {
    appointment: AppointmentRecord;
    targetDate: string;
    targetStartTime: string;
    targetStaffId: string;
    targetDuration?: number;
  }) => void;
  onOpenDetail: (appt: AppointmentRecord) => void;
  onQuickApprove: (appt: AppointmentRecord) => void;
  onSlotCreateAppointment: (dateStr: string, startTime: string, staffId: string) => void;
  onSlotQuickBlock: (dateStr: string, startTime: string, staffId: string) => void;
  onDeleteException: (exceptionId: string) => void;
  busyId: string | null;
}

export function AgendaDayView({
  dateStr,
  today,
  nowMinutes,
  businessName,
  appointments,
  rules,
  exceptions,
  staff,
  movingAppointment,
  onStartMoveMode,
  onDropAppointment,
  onOpenDetail,
  onQuickApprove,
  onSlotCreateAppointment,
  onSlotQuickBlock,
  onDeleteException,
  busyId,
}: AgendaDayViewProps) {
  const columns = useMemo(
    () =>
      staff.length > 0
        ? staff
        : [{ id: "default", name: "Agenda", business_id: "", role_title: null, bio: null, avatar_url: null, is_active: true, display_order: 0 }],
    [staff]
  );

  const [mobileStaffIndex, setMobileStaffIndex] = useState(0);
  const safeMobileIdx = Math.min(mobileStaffIndex, Math.max(0, columns.length - 1));

  const dayAppointments = useMemo(
    () => appointments.filter((a) => a.appointment_date === dateStr),
    [appointments, dateStr]
  );

  const { startHour, endHour } = useMemo(
    () =>
      computeTimelineBounds({
        appointments: dayAppointments,
        rules,
        exceptions: exceptions.filter((e) => e.exception_date === dateStr),
      }),
    [dayAppointments, rules, exceptions, dateStr]
  );

  const startMinBound = startHour * 60;
  const endMinBound = endHour * 60;
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const [drag, setDrag] = useState<DragSession | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Quick slot action popover state
  const [slotPrompt, setSlotPrompt] = useState<{
    staffId: string;
    startMin: number;
  } | null>(null);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // Manage grabbing root class and Escape cancel
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
    e: React.PointerEvent<HTMLElement>,
    appointment: AppointmentRecord,
    mode: "move" | "resize"
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSlotPrompt(null);
    const startMin =
      Number(appointment.start_time.slice(0, 2)) * 60 +
      Number(appointment.start_time.slice(3, 5));
    const session: DragSession = {
      mode,
      appointment,
      pointerId: e.pointerId,
      startY: e.clientY,
      initialStartMin: startMin,
      initialDuration: appointment.total_duration_minutes,
      currentStartMin: startMin,
      currentDuration: appointment.total_duration_minutes,
      targetStaffId: appointment.staff_id,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = session;
    setDrag(session);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const deltaMin = (e.clientY - active.startY) / PX_PER_MIN;
    if (active.mode === "move") {
      const snapped = clampMinutes(
        snapMinutes(active.initialStartMin + deltaMin, 15),
        startMinBound,
        endMinBound - Math.min(active.initialDuration, 60)
      );
      // Detect cross-staff column hover
      let targetStaffId = active.targetStaffId;
      for (const col of columns) {
        const el = columnRefs.current[col.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          targetStaffId = col.id;
          break;
        }
      }
      const next = { ...active, currentStartMin: snapped, targetStaffId };
      dragRef.current = next;
      setDrag(next);
    } else {
      const snappedDur = clampMinutes(
        snapMinutes(active.initialDuration + deltaMin, 15),
        15,
        Math.min(480, endMinBound - active.initialStartMin)
      );
      const next = { ...active, currentDuration: snappedDur };
      dragRef.current = next;
      setDrag(next);
    }
  }

  function finishDrag(e: React.PointerEvent<HTMLElement>, cancelled = false) {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDrag(null);

    if (cancelled) return;

    const changedTime = active.currentStartMin !== active.initialStartMin;
    const changedStaff = active.targetStaffId !== active.appointment.staff_id;
    const changedDuration = active.currentDuration !== active.initialDuration;

    if (!changedTime && !changedStaff && !changedDuration) return;

    onDropAppointment({
      appointment: active.appointment,
      targetDate: dateStr,
      targetStartTime: minutesToTime(active.currentStartMin),
      targetStaffId: active.targetStaffId,
      targetDuration: changedDuration ? active.currentDuration : undefined,
    });
  }

  function handleBackgroundClick(
    e: React.MouseEvent<HTMLDivElement>,
    staffId: string
  ) {
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
        targetStaffId: staffId,
      });
      return;
    }

    setSlotPrompt((prev) =>
      prev && prev.staffId === staffId && prev.startMin === clickedMin
        ? null
        : { staffId, startMin: clickedMin }
    );
  }

  const showNowLine =
    dateStr === today && nowMinutes >= startMinBound && nowMinutes <= endMinBound;
  const nowTopPx = (nowMinutes - startMinBound) * PX_PER_MIN;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#eedbe4] bg-white shadow-xs">
      {/* Mobile staff switcher when multiple staff */}
      {columns.length > 1 && (
        <div className="flex items-center gap-1.5 border-b border-[#f3e3eb] bg-[#fdf9fb] px-3 py-2 md:hidden">
          {columns.map((col, idx) => (
            <button
              key={col.id}
              type="button"
              onClick={() => setMobileStaffIndex(idx)}
              className={`min-h-9 flex-1 rounded-xl px-3 text-xs font-semibold ${
                safeMobileIdx === idx
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-white text-[#4a3541]"
              }`}
            >
              {col.name}
            </button>
          ))}
        </div>
      )}

      {/* Column headers */}
      <div className="grid border-b border-[#f3e3eb] bg-[#fdf9fb]" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div className="flex items-center justify-center border-r border-[#f3e3eb] py-2.5 text-[11px] font-bold text-[#7a6571]">
          Hora
        </div>
        {columns.map((col, idx) => {
          const dayInfo = resolveDayWorkingIntervals(dateStr, col.id, rules, exceptions);
          const colAppts = dayAppointments.filter(
            (a) => a.staff_id === col.id && a.status !== "cancelled"
          );
          return (
            <div
              key={col.id}
              className={`flex flex-wrap items-center justify-between gap-2 border-r border-[#f3e3eb] px-3 py-2.5 last:border-r-0 ${
                columns.length > 1 && idx !== safeMobileIdx ? "hidden md:flex" : "flex"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#1f141b]">{col.name}</p>
                <p className="text-[11px] text-[#7a6571]">
                  {dayInfo.isBlockedAllDay
                    ? "Día bloqueado"
                    : dayInfo.workingRanges.length === 0
                    ? "Sin turno habitual"
                    : dayInfo.workingRanges
                        .map((r) => `${minutesToTime(r.startMin)}–${minutesToTime(r.endMin)}`)
                        .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {dayInfo.specialOpens.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Turno especial
                  </span>
                )}
                <span className="rounded-full bg-[#fceef4] px-2.5 py-0.5 text-[11px] font-bold text-[var(--brand-primary)]">
                  {colAppts.length} {colAppts.length === 1 ? "cita" : "citas"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Scrollable Timeline */}
      <div className="relative overflow-y-auto" style={{ maxHeight: "74vh" }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `60px repeat(${columns.length}, minmax(0, 1fr))`,
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
                className="absolute inset-x-0 flex justify-center text-[11px] font-semibold text-[#7a6571]"
                style={{ top: `${(h - startHour) * HOUR_HEIGHT - 8}px` }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Staff Timeline Columns */}
          {columns.map((col, colIdx) => {
            const dayInfo = resolveDayWorkingIntervals(dateStr, col.id, rules, exceptions);
            const colAppointments = dayAppointments.filter(
              (a) => a.staff_id === col.id || columns.length === 1
            );
            const positioned = layoutDayAppointments(colAppointments);

            // Compute closed-hour bands outside workingRanges
            const nonWorkingBands: Array<{ startMin: number; endMin: number }> = [];
            if (dayInfo.isBlockedAllDay) {
              // handled by full overlay
            } else if (dayInfo.workingRanges.length === 0) {
              nonWorkingBands.push({ startMin: startMinBound, endMin: endMinBound });
            } else {
              const sortedWork = [...dayInfo.workingRanges].sort(
                (a, b) => a.startMin - b.startMin
              );
              let cursor = startMinBound;
              for (const w of sortedWork) {
                if (w.startMin > cursor) {
                  nonWorkingBands.push({ startMin: cursor, endMin: w.startMin });
                }
                cursor = Math.max(cursor, w.endMin);
              }
              if (cursor < endMinBound) {
                nonWorkingBands.push({ startMin: cursor, endMin: endMinBound });
              }
            }

            return (
              <div
                key={col.id}
                ref={(el) => {
                  columnRefs.current[col.id] = el;
                }}
                onClick={(e) => handleBackgroundClick(e, col.id)}
                className={`relative border-r border-[#f3e3eb] last:border-r-0 ${
                  movingAppointment ? "cursor-crosshair bg-[#fffbfd]" : "cursor-pointer"
                } ${columns.length > 1 && colIdx !== safeMobileIdx ? "hidden md:block" : "block"}`}
                style={{ height: `${totalHeight}px` }}
              >
                {/* Hour & half-hour gridlines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-[#f2e4eb]"
                    style={{
                      top: `${(h - startHour) * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  >
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-[#f7edf2]"
                      style={{ top: `${HOUR_HEIGHT / 2}px` }}
                    />
                  </div>
                ))}

                {/* Non-working closed shading */}
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

                {/* Full day blocked overlay */}
                {dayInfo.isBlockedAllDay && dayInfo.blockDayException && (
                  <div className="agenda-blocked-hatch pointer-events-none absolute inset-0 z-10 flex items-start justify-center p-3">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-300 bg-white/95 px-3.5 py-2 text-xs font-semibold text-amber-950 shadow-sm">
                      <Ban className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      <span>
                        Día bloqueado
                        {dayInfo.blockDayException.reason
                          ? `: ${dayInfo.blockDayException.reason}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteException(dayInfo.blockDayException!.id);
                        }}
                        aria-label="Quitar bloqueo del día"
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Blocked time ranges */}
                {dayInfo.blockedRanges.map((br) => {
                  const top = Math.max(0, (br.startMin - startMinBound) * PX_PER_MIN);
                  const height = Math.max(26, (br.endMin - br.startMin) * PX_PER_MIN);
                  return (
                    <div
                      key={br.id}
                      onClick={(e) => e.stopPropagation()}
                      className="agenda-blocked-hatch absolute inset-x-1.5 z-10 flex items-start justify-between rounded-xl border border-amber-300 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <span className="truncate">
                        Bloqueo {minutesToTime(br.startMin)}–{minutesToTime(br.endMin)}
                        {br.reason ? ` · ${br.reason}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteException(br.id)}
                        aria-label="Eliminar bloqueo"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-red-600 hover:bg-white"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                {/* Click empty slot quick chooser */}
                {slotPrompt && slotPrompt.staffId === col.id && !movingAppointment && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-x-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-white/95 p-2.5 shadow-lg"
                    style={{
                      top: `${Math.min(
                        totalHeight - 68,
                        Math.max(4, (slotPrompt.startMin - startMinBound) * PX_PER_MIN)
                      )}px`,
                    }}
                  >
                    <span className="text-xs font-bold text-[#1f141b]">
                      Bloque {minutesToTime(slotPrompt.startMin)} hrs
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSlotCreateAppointment(
                            dateStr,
                            minutesToTime(slotPrompt.startMin),
                            col.id
                          );
                          setSlotPrompt(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-3 text-xs font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Agendar cita
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSlotQuickBlock(
                            dateStr,
                            minutesToTime(slotPrompt.startMin),
                            col.id
                          );
                          setSlotPrompt(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-950"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        Bloquear hora
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotPrompt(null)}
                        className="min-h-8 rounded-xl px-2 text-xs text-[#6c5763] hover:bg-neutral-100"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {/* Drag target ghost preview */}
                {drag && drag.targetStaffId === col.id && (
                  <div
                    className="pointer-events-none absolute inset-x-1.5 z-30 rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-[#fce7f1]/75 px-3 py-1.5 shadow-md"
                    style={{
                      top: `${(drag.currentStartMin - startMinBound) * PX_PER_MIN}px`,
                      height: `${Math.max(36, drag.currentDuration * PX_PER_MIN)}px`,
                    }}
                  >
                    <p className="text-xs font-bold text-[var(--brand-primary)]">
                      {minutesToTime(drag.currentStartMin)} –{" "}
                      {minutesToTime(drag.currentStartMin + drag.currentDuration)} (
                      {drag.currentDuration} min)
                    </p>
                    <p className="truncate text-[11px] font-semibold text-[#1f141b]">
                      {getClientFullName(drag.appointment)} · Suelta para ubicar
                    </p>
                  </div>
                )}

                {/* Current time indicator line */}
                {showNowLine && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: `${nowTopPx}px` }}
                  >
                    <span className="h-2.5 w-2.5 -translate-x-1 rounded-full bg-rose-600 shadow-xs" />
                    <div className="h-0.5 flex-1 bg-rose-500/85" />
                  </div>
                )}

                {/* Appointment Cards */}
                {positioned.map((pos) => {
                  const appt = pos.appointment;
                  const meta = STATUS_META[appt.status];
                  const isBeingDragged = drag?.appointment.id === appt.id;
                  const isBeingMoved = movingAppointment?.id === appt.id;
                  const top = (pos.startMin - startMinBound) * PX_PER_MIN;
                  const height = Math.max(48, (pos.endMin - pos.startMin) * PX_PER_MIN - 3);
                  const widthPct = 100 / pos.totalColumns;
                  const leftPct = pos.column * widthPct;
                  const compact = height < 74;

                  const waUrl = appt.client?.phone
                    ? buildWhatsAppUrl(
                        appt.client.phone,
                        `Hola ${appt.client.first_name}! Te escribimos desde ${businessName} por tu cita ${appt.booking_code} a las ${appt.start_time.slice(0, 5)} hrs.`
                      )
                    : null;

                  return (
                    <article
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!movingAppointment) onOpenDetail(appt);
                      }}
                      className={`group absolute z-20 flex flex-col overflow-hidden rounded-2xl border shadow-xs transition ${meta.cardBg} ${meta.cardBorder} ${
                        isBeingDragged ? "opacity-35 ring-2 ring-[var(--brand-primary)]" : ""
                      } ${
                        isBeingMoved
                          ? "ring-2 ring-[var(--brand-primary)] ring-offset-1"
                          : ""
                      } ${appt.status === "cancelled" ? "opacity-65" : ""}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${leftPct}% + 4px)`,
                        width: `calc(${widthPct}% - 8px)`,
                      }}
                    >
                      {/* Status accent bar */}
                      <div className={`absolute inset-y-0 left-0 w-1.5 ${meta.accentBar}`} />

                      <div className="flex min-h-0 flex-1 flex-col justify-between py-1.5 pl-3 pr-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="font-bold text-[#1f141b]">
                                {appt.start_time.slice(0, 5)}–{appt.end_time.slice(0, 5)}
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                              >
                                {meta.shortLabel}
                              </span>
                              {pos.hasOverlap && (
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                  Sobrecupo
                                </span>
                              )}
                            </div>

                            <p className="truncate text-sm font-bold text-[#1f141b]">
                              {getClientFullName(appt)}
                            </p>

                            {!compact && (
                              <p className="truncate text-xs text-[#5d4754]">
                                {getServiceSummary(appt)} · {formatClp(appt.total_estimated_clp)}
                              </p>
                            )}
                          </div>

                          {/* Drag Handle & Quick Controls */}
                          <div className="flex shrink-0 items-center gap-1">
                            {appt.status === "pending_deposit" && (
                              <button
                                type="button"
                                disabled={busyId === appt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onQuickApprove(appt);
                                }}
                                aria-label={`Aprobar abono de ${getClientFullName(appt)}`}
                                title="Aprobar abono en 1 clic"
                                className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                              >
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span className="hidden sm:inline">Aprobar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartMoveMode(appt);
                              }}
                              aria-label={`Mover cita de ${getClientFullName(appt)}`}
                              title="Mover cita (tocar horario destino)"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2cbd7] bg-white/90 text-[#4a3541] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                            >
                              <Move className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              onPointerDown={(e) => beginDrag(e, appt, "move")}
                              onPointerMove={handlePointerMove}
                              onPointerUp={(e) => finishDrag(e, false)}
                              onPointerCancel={(e) => finishDrag(e, true)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Arrastrar cita de ${getClientFullName(appt)} para cambiar hora`}
                              title="Arrastrar para mover bloque"
                              className="agenda-drag-handle hidden h-7 w-7 items-center justify-center rounded-lg border border-[#e2cbd7] bg-white/90 text-[#6c5763] hover:text-[var(--brand-primary)] sm:inline-flex"
                            >
                              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {!compact && (
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="font-semibold text-[#7a6571]">
                                {appt.booking_code}
                              </span>
                              {appt.client?.is_new_client && (
                                <span className="rounded-full bg-pink-100 px-1.5 py-0.5 font-semibold text-[var(--brand-primary)]">
                                  Nueva
                                </span>
                              )}
                              {appt.has_external_product && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                                  Retiro ext.
                                </span>
                              )}
                              {appt.admin_notes && (
                                <span className="max-w-[160px] truncate rounded-full bg-white/80 px-1.5 py-0.5 text-[#5d4754]">
                                  Nota: {appt.admin_notes}
                                </span>
                              )}
                            </div>

                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`WhatsApp a ${getClientFullName(appt)}`}
                                className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom edge resize handle (desktop) */}
                      <div
                        onPointerDown={(e) => beginDrag(e, appt, "resize")}
                        onPointerMove={handlePointerMove}
                        onPointerUp={(e) => finishDrag(e, false)}
                        onPointerCancel={(e) => finishDrag(e, true)}
                        onClick={(e) => e.stopPropagation()}
                        title="Arrastrar borde inferior para ajustar duración"
                        className="hidden h-2 w-full cursor-ns-resize items-center justify-center hover:bg-[var(--brand-primary)]/15 sm:flex"
                        style={{ touchAction: "none" }}
                      >
                        <span className="h-0.5 w-8 rounded-full bg-[#c9aebc]/70 opacity-0 transition group-hover:opacity-100" />
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
  );
}
