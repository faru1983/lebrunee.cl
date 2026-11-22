import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import { getActiveBusinessBundle, getScheduleConfig } from "@/lib/services/businessService";
import type {
  AvailabilityException,
  AvailabilityFixedSlot,
  AvailabilityRule,
  BookingRulesSettings,
  TimeSlotOption,
} from "@/lib/types";
import {
  addDaysToIsoDate,
  getDayOfWeekFromIsoDate,
  getNowMinutesInTimezone,
  minutesToTime,
  timeToMinutes,
} from "@/lib/utils";

interface BusyWindow {
  startMin: number;
  endMin: number;
}

interface TimeRange {
  startMin: number;
  endMin: number;
}

function subtractRange(ranges: TimeRange[], block: TimeRange): TimeRange[] {
  const result: TimeRange[] = [];
  for (const r of ranges) {
    if (block.endMin <= r.startMin || block.startMin >= r.endMin) {
      result.push(r);
      continue;
    }
    if (block.startMin > r.startMin) {
      result.push({ startMin: r.startMin, endMin: block.startMin });
    }
    if (block.endMin < r.endMin) {
      result.push({ startMin: block.endMin, endMin: r.endMin });
    }
  }
  return result;
}

function resolveWorkingRangesForDate(
  dateStr: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[]
): TimeRange[] {
  const dayExceptions = exceptions.filter((e) => e.exception_date === dateStr);
  if (dayExceptions.some((e) => e.exception_type === "block_day")) {
    return [];
  }

  const customOpens = dayExceptions.filter(
    (e) => e.exception_type === "open_custom" && e.start_time && e.end_time
  );

  let working: TimeRange[] = [];
  if (customOpens.length > 0) {
    working = customOpens.map((e) => ({
      startMin: timeToMinutes(e.start_time!),
      endMin: timeToMinutes(e.end_time!),
    }));
  } else {
    const dow = getDayOfWeekFromIsoDate(dateStr);
    working = rules
      .filter((r) => r.day_of_week === dow && r.is_active)
      .map((r) => ({
        startMin: timeToMinutes(r.start_time),
        endMin: timeToMinutes(r.end_time),
      }));
  }

  const blockRanges = dayExceptions.filter(
    (e) => e.exception_type === "block_range" && e.start_time && e.end_time
  );
  for (const b of blockRanges) {
    working = subtractRange(working, {
      startMin: timeToMinutes(b.start_time!),
      endMin: timeToMinutes(b.end_time!),
    });
  }

  return working.filter((r) => r.endMin > r.startMin).sort((a, b) => a.startMin - b.startMin);
}

function isDateWithinBookingWindow(
  dateStr: string,
  todayStr: string,
  rules: BookingRulesSettings
): boolean {
  if (!rules.isAgendaOpen) return false;
  if (dateStr < todayStr) return false;

  if (rules.openMode === "until_date") {
    if (!rules.openUntilDate) return false;
    return dateStr <= rules.openUntilDate;
  }

  const maxDate = addDaysToIsoDate(todayStr, Math.max(1, rules.rollingDays));
  return dateStr <= maxDate;
}

export function computeSlotsForDate(params: {
  dateStr: string;
  staffId: string;
  durationMinutes: number;
  bufferMinutes: number;
  timezone: string;
  bookingRules: BookingRulesSettings;
  rules: AvailabilityRule[];
  fixedSlots: AvailabilityFixedSlot[];
  exceptions: AvailabilityException[];
  busyAppointments: Array<{
    start_time: string;
    end_time: string;
    buffer_minutes: number;
  }>;
  ignoreAdvanceRule?: boolean;
}): TimeSlotOption[] {
  const {
    dateStr,
    staffId,
    durationMinutes,
    bufferMinutes,
    timezone,
    bookingRules,
    rules,
    fixedSlots,
    exceptions,
    busyAppointments,
    ignoreAdvanceRule = false,
  } = params;

  const { today, minutes: nowMinutes } = getNowMinutesInTimezone(timezone);

  if (!ignoreAdvanceRule && !isDateWithinBookingWindow(dateStr, today, bookingRules)) {
    return [];
  }

  if (
    !ignoreAdvanceRule &&
    bookingRules.maxDailyAppointments !== null &&
    busyAppointments.length >= bookingRules.maxDailyAppointments
  ) {
    return [];
  }

  const workingRanges = resolveWorkingRangesForDate(dateStr, rules, exceptions);
  if (workingRanges.length === 0) return [];

  const busyWindows: BusyWindow[] = busyAppointments.map((a) => ({
    startMin: timeToMinutes(a.start_time),
    endMin: timeToMinutes(a.end_time) + (a.buffer_minutes || 0),
  }));

  const minAllowedStartToday =
    dateStr === today && !ignoreAdvanceRule
      ? nowMinutes + (bookingRules.minAdvanceHours || 0) * 60
      : -1;

  const candidateStarts = new Set<number>();

  if (bookingRules.slotMode === "fixed_blocks") {
    const dow = getDayOfWeekFromIsoDate(dateStr);
    const activeFixed = fixedSlots.filter(
      (f) => f.is_active && (f.day_of_week === null || f.day_of_week === dow)
    );
    for (const f of activeFixed) {
      const startMin = timeToMinutes(f.slot_time);
      const fitsInRange = workingRanges.some(
        (r) => startMin >= r.startMin && startMin + durationMinutes <= r.endMin
      );
      if (fitsInRange) {
        candidateStarts.add(startMin);
      }
    }
  } else {
    const step = Math.max(10, bookingRules.slotIntervalMinutes || 30);
    for (const range of workingRanges) {
      for (
        let startMin = range.startMin;
        startMin + durationMinutes <= range.endMin;
        startMin += step
      ) {
        candidateStarts.add(startMin);
      }
    }
  }

  const sortedStarts = Array.from(candidateStarts).sort((a, b) => a - b);
  const available: TimeSlotOption[] = [];

  for (const startMin of sortedStarts) {
    if (dateStr < today && !ignoreAdvanceRule) continue;
    if (dateStr === today && startMin < minAllowedStartToday) continue;

    const serviceEndMin = startMin + durationMinutes;
    const occupiedEndMin = serviceEndMin + bufferMinutes;

    const overlaps = busyWindows.some(
      (busy) => startMin < busy.endMin && occupiedEndMin > busy.startMin
    );

    if (!overlaps) {
      available.push({
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(serviceEndMin),
        staffId,
      });
    }
  }

  return available;
}

export async function getAvailableSlotsForDate(params: {
  businessId: string;
  staffId: string;
  dateStr: string;
  durationMinutes: number;
  bufferMinutes?: number;
  excludeAppointmentId?: string;
  ignoreAdvanceRule?: boolean;
}): Promise<TimeSlotOption[]> {
  const [bundle, schedule] = await Promise.all([
    getActiveBusinessBundle(),
    getScheduleConfig(params.businessId, params.staffId),
  ]);

  let busyAppointments: Array<{
    id: string;
    start_time: string;
    end_time: string;
    buffer_minutes: number;
    hold_expires_at: string | null;
  }> = [];

  if (hasValidServiceRoleKey()) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("appointments")
      .select("id, start_time, end_time, buffer_minutes, hold_expires_at")
      .eq("business_id", params.businessId)
      .eq("staff_id", params.staffId)
      .eq("appointment_date", params.dateStr)
      .in("status", ["pending_deposit", "confirmed", "completed"]);

    const nowIso = new Date().toISOString();
    busyAppointments = (data || []).filter(
      (row) =>
        row.id !== params.excludeAppointmentId &&
        (!row.hold_expires_at || row.hold_expires_at > nowIso)
    );
  }

  return computeSlotsForDate({
    dateStr: params.dateStr,
    staffId: params.staffId,
    durationMinutes: params.durationMinutes,
    bufferMinutes: params.bufferMinutes ?? bundle.bookingRules.bufferMinutes,
    timezone: bundle.business.timezone,
    bookingRules: bundle.bookingRules,
    rules: schedule.rules,
    fixedSlots: schedule.fixedSlots,
    exceptions: schedule.exceptions,
    busyAppointments,
    ignoreAdvanceRule: params.ignoreAdvanceRule,
  });
}

export async function getAvailableDatesSummary(params: {
  businessId: string;
  staffId: string;
  durationMinutes: number;
  bufferMinutes?: number;
  daysToCheck?: number;
}): Promise<Array<{ date: string; slotsCount: number; slots: TimeSlotOption[] }>> {
  const [bundle, schedule] = await Promise.all([
    getActiveBusinessBundle(),
    getScheduleConfig(params.businessId, params.staffId),
  ]);

  const { today } = getNowMinutesInTimezone(bundle.business.timezone);
  const daysLimit = Math.min(params.daysToCheck ?? 35, 60);
  const endDate = addDaysToIsoDate(today, daysLimit);

  let allBusy: Array<{
    appointment_date: string;
    start_time: string;
    end_time: string;
    buffer_minutes: number;
    hold_expires_at: string | null;
  }> = [];

  if (hasValidServiceRoleKey()) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("appointments")
      .select("appointment_date, start_time, end_time, buffer_minutes, hold_expires_at")
      .eq("business_id", params.businessId)
      .eq("staff_id", params.staffId)
      .gte("appointment_date", today)
      .lte("appointment_date", endDate)
      .in("status", ["pending_deposit", "confirmed", "completed"]);

    const nowIso = new Date().toISOString();
    allBusy = (data || []).filter(
      (row) => !row.hold_expires_at || row.hold_expires_at > nowIso
    );
  }

  const busyByDate = new Map<string, typeof allBusy>();
  for (const row of allBusy) {
    const list = busyByDate.get(row.appointment_date) || [];
    list.push(row);
    busyByDate.set(row.appointment_date, list);
  }

  const results: Array<{ date: string; slotsCount: number; slots: TimeSlotOption[] }> = [];
  for (let offset = 0; offset <= daysLimit; offset++) {
    const dateStr = addDaysToIsoDate(today, offset);
    const slots = computeSlotsForDate({
      dateStr,
      staffId: params.staffId,
      durationMinutes: params.durationMinutes,
      bufferMinutes: params.bufferMinutes ?? bundle.bookingRules.bufferMinutes,
      timezone: bundle.business.timezone,
      bookingRules: bundle.bookingRules,
      rules: schedule.rules,
      fixedSlots: schedule.fixedSlots,
      exceptions: schedule.exceptions,
      busyAppointments: busyByDate.get(dateStr) || [],
    });

    if (slots.length > 0) {
      results.push({ date: dateStr, slotsCount: slots.length, slots });
    }
  }

  return results;
}
