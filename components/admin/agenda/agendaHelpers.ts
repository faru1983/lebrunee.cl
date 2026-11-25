import type {
  AppointmentRecord,
  AppointmentStatus,
  AvailabilityException,
  AvailabilityRule,
} from "@/lib/types";
import {
  addDaysToIsoDate,
  buildWhatsAppUrl,
  formatDateLongEs,
  getDayOfWeekFromIsoDate,
  minutesToTime,
  timeToMinutes,
} from "@/lib/utils";

export type AgendaViewMode = "day" | "week" | "month" | "list";

export const STATUS_META: Record<
  AppointmentStatus,
  {
    label: string;
    shortLabel: string;
    cardBg: string;
    cardBorder: string;
    accentBar: string;
    badgeBg: string;
    badgeText: string;
    dotColor: string;
  }
> = {
  pending_deposit: {
    label: "Pendiente abono",
    shortLabel: "Pendiente",
    cardBg: "bg-amber-50/95 hover:bg-amber-50",
    cardBorder: "border-amber-300",
    accentBar: "bg-amber-500",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-900",
    dotColor: "bg-amber-500",
  },
  confirmed: {
    label: "Confirmada",
    shortLabel: "Confirmada",
    cardBg: "bg-[#fff5f9] hover:bg-[#ffedf5]",
    cardBorder: "border-[#e6a4c1]",
    accentBar: "bg-[var(--brand-primary)]",
    badgeBg: "bg-[#fce7f1]",
    badgeText: "text-[#8e1549]",
    dotColor: "bg-[var(--brand-primary)]",
  },
  completed: {
    label: "Realizada",
    shortLabel: "Realizada",
    cardBg: "bg-emerald-50/90 hover:bg-emerald-50",
    cardBorder: "border-emerald-300",
    accentBar: "bg-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-900",
    dotColor: "bg-emerald-600",
  },
  cancelled: {
    label: "Cancelada",
    shortLabel: "Cancelada",
    cardBg: "bg-neutral-100/80 hover:bg-neutral-100",
    cardBorder: "border-neutral-300",
    accentBar: "bg-neutral-400",
    badgeBg: "bg-neutral-200",
    badgeText: "text-neutral-700",
    dotColor: "bg-neutral-400",
  },
  no_show: {
    label: "No asistió",
    shortLabel: "No asistió",
    cardBg: "bg-rose-50/75 hover:bg-rose-50",
    cardBorder: "border-rose-300",
    accentBar: "bg-rose-500",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-900",
    dotColor: "bg-rose-500",
  },
};

export const WEEKDAY_SHORT_MON = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Monday-based week start for Chile / Spanish calendar conventions */
export function getWeekStartMonday(isoDate: string): string {
  const dow = getDayOfWeekFromIsoDate(isoDate); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysToIsoDate(isoDate, offset);
}

export function getWeekDates(isoDate: string): string[] {
  const monday = getWeekStartMonday(isoDate);
  return Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(monday, i));
}

export function getMonthGridDates(isoDate: string): {
  year: number;
  month: number; // 1..12
  firstOfMonth: string;
  lastOfMonth: string;
  cells: Array<{ date: string; inMonth: boolean }>;
} {
  const [y, m] = isoDate.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

  const gridStart = getWeekStartMonday(firstOfMonth);
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = addDaysToIsoDate(gridStart, i);
    cells.push({
      date: d,
      inMonth: Number(d.slice(5, 7)) === m,
    });
  }
  // Drop the last row if completely outside the month
  const trimmed = cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
  return { year: y, month: m, firstOfMonth, lastOfMonth, cells: trimmed };
}

export function addMonthsToIsoDate(isoDate: string, deltaMonths: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetFirst = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const ty = targetFirst.getUTCFullYear();
  const tm = targetFirst.getUTCMonth() + 1;
  const maxDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return `${ty}-${String(tm).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function formatMonthTitleEs(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(dt);
}

export function formatWeekRangeEs(weekDates: string[]): string {
  if (weekDates.length === 0) return "";
  const start = weekDates[0];
  const end = weekDates[weekDates.length - 1];
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const fmtMonth = (y: number, m: number) =>
    new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "short" })
      .format(new Date(Date.UTC(y, m - 1, 15, 12, 0, 0)))
      .replace(".", "");

  if (m1 === m2 && y1 === y2) {
    return `${d1} – ${d2} ${fmtMonth(y2, m2)} ${y2}`;
  }
  if (y1 === y2) {
    return `${d1} ${fmtMonth(y1, m1)} – ${d2} ${fmtMonth(y2, m2)} ${y2}`;
  }
  return `${d1} ${fmtMonth(y1, m1)} ${y1} – ${d2} ${fmtMonth(y2, m2)} ${y2}`;
}

export function getServiceSummary(appt: AppointmentRecord): string {
  if (!appt.items || appt.items.length === 0) return "Servicio";
  return appt.items.map((i) => i.name_snapshot).join(" + ");
}

export function getClientFullName(appt: AppointmentRecord): string {
  return [appt.client?.first_name, appt.client?.last_name].filter(Boolean).join(" ") || "Clienta";
}

export function snapMinutes(mins: number, step = 15): number {
  return Math.round(mins / step) * step;
}

export function clampMinutes(mins: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, mins));
}

export function computeTimelineBounds(params: {
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}): { startHour: number; endHour: number } {
  let minHour = 9;
  let maxHour = 20;

  for (const r of params.rules) {
    if (!r.is_active) continue;
    minHour = Math.min(minHour, Math.floor(timeToMinutes(r.start_time) / 60));
    maxHour = Math.max(maxHour, Math.ceil(timeToMinutes(r.end_time) / 60));
  }

  for (const e of params.exceptions) {
    if (e.start_time) {
      minHour = Math.min(minHour, Math.floor(timeToMinutes(e.start_time) / 60));
    }
    if (e.end_time) {
      maxHour = Math.max(maxHour, Math.ceil(timeToMinutes(e.end_time) / 60));
    }
  }

  for (const a of params.appointments) {
    minHour = Math.min(minHour, Math.floor(timeToMinutes(a.start_time) / 60));
    maxHour = Math.max(maxHour, Math.ceil(timeToMinutes(a.end_time) / 60));
  }

  return {
    startHour: Math.max(6, Math.min(minHour, 9)),
    endHour: Math.min(23, Math.max(maxHour, 20)),
  };
}

export interface PositionedAppointment {
  appointment: AppointmentRecord;
  startMin: number;
  endMin: number;
  column: number;
  totalColumns: number;
  hasOverlap: boolean;
}

/**
 * Computes side-by-side column positions for overlapping appointments (overbooks)
 * so every appointment remains 100% readable and clickable.
 */
export function layoutDayAppointments(
  appointments: AppointmentRecord[]
): PositionedAppointment[] {
  const sorted = [...appointments]
    .map((a) => {
      const startMin = timeToMinutes(a.start_time);
      const rawEnd = timeToMinutes(a.end_time);
      const endMin = Math.max(startMin + 20, rawEnd);
      return { appointment: a, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  // Group into connected overlap clusters
  const clusters: Array<typeof sorted> = [];
  let currentCluster: typeof sorted = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result: PositionedAppointment[] = [];
  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const assigned: Array<{
      item: (typeof sorted)[number];
      column: number;
    }> = [];

    for (const item of cluster) {
      let colIdx = colEnds.findIndex((end) => end <= item.startMin);
      if (colIdx === -1) {
        colIdx = colEnds.length;
        colEnds.push(item.endMin);
      } else {
        colEnds[colIdx] = item.endMin;
      }
      assigned.push({ item, column: colIdx });
    }

    const totalColumns = Math.max(1, colEnds.length);
    for (const entry of assigned) {
      result.push({
        appointment: entry.item.appointment,
        startMin: entry.item.startMin,
        endMin: entry.item.endMin,
        column: entry.column,
        totalColumns,
        hasOverlap: totalColumns > 1,
      });
    }
  }

  return result;
}

export function resolveDayWorkingIntervals(
  dateStr: string,
  staffId: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[]
): {
  isBlockedAllDay: boolean;
  blockDayException: AvailabilityException | null;
  workingRanges: Array<{ startMin: number; endMin: number; isSpecial?: boolean }>;
  blockedRanges: Array<{
    id: string;
    startMin: number;
    endMin: number;
    reason: string | null;
  }>;
  specialOpens: AvailabilityException[];
} {
  const dayExcs = exceptions.filter(
    (e) => e.exception_date === dateStr && e.staff_id === staffId
  );
  const blockDayException =
    dayExcs.find((e) => e.exception_type === "block_day") || null;

  const specialOpens = dayExcs.filter(
    (e) => e.exception_type === "open_custom" && e.start_time && e.end_time
  );

  const blockedRanges = dayExcs
    .filter((e) => e.exception_type === "block_range" && e.start_time && e.end_time)
    .map((e) => ({
      id: e.id,
      startMin: timeToMinutes(e.start_time!),
      endMin: timeToMinutes(e.end_time!),
      reason: e.reason,
    }));

  if (blockDayException) {
    return {
      isBlockedAllDay: true,
      blockDayException,
      workingRanges: [],
      blockedRanges,
      specialOpens,
    };
  }

  let workingRanges: Array<{ startMin: number; endMin: number; isSpecial?: boolean }> = [];
  if (specialOpens.length > 0) {
    workingRanges = specialOpens.map((e) => ({
      startMin: timeToMinutes(e.start_time!),
      endMin: timeToMinutes(e.end_time!),
      isSpecial: true,
    }));
  } else {
    const dow = getDayOfWeekFromIsoDate(dateStr);
    workingRanges = rules
      .filter((r) => r.staff_id === staffId && r.day_of_week === dow && r.is_active)
      .map((r) => ({
        startMin: timeToMinutes(r.start_time),
        endMin: timeToMinutes(r.end_time),
      }));
  }

  return {
    isBlockedAllDay: false,
    blockDayException: null,
    workingRanges,
    blockedRanges,
    specialOpens,
  };
}

export function buildRescheduleWhatsappUrl(params: {
  phone: string | null | undefined;
  firstName: string;
  businessName: string;
  bookingCode: string;
  newDate: string;
  newStartTime: string;
}): string | null {
  if (!params.phone) return null;
  const msg = `Hola ${params.firstName}! Te escribimos desde ${params.businessName}. Actualizamos tu cita ${params.bookingCode} para el ${formatDateLongEs(params.newDate)} a las ${params.newStartTime} hrs. ¿Te acomoda este nuevo horario?`;
  return buildWhatsAppUrl(params.phone, msg);
}

export function buildEmergencyCancelWhatsappUrl(params: {
  phone: string | null | undefined;
  firstName: string;
  businessName: string;
  bookingCode: string;
  dateStr: string;
  reason: string;
}): string | null {
  if (!params.phone) return null;
  const msg = `Hola ${params.firstName}! Te escribimos desde ${params.businessName}. Por un imprevisto (${params.reason}) debemos reagendar tu cita ${params.bookingCode} del ${formatDateLongEs(params.dateStr)}. Tu abono queda 100% vigente, ¿qué día y horario te acomoda mejor?`;
  return buildWhatsAppUrl(params.phone, msg);
}

export function formatMinutesAsDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function addMinutesToTimeStr(timeStr: string, delta: number): string {
  const next = clampMinutes(timeToMinutes(timeStr) + delta, 0, 23 * 60 + 45);
  return minutesToTime(next);
}
