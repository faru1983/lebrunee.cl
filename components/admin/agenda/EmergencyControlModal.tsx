"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Clock,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  bulkShiftDayAppointmentsAction,
  emergencyCloseDayAction,
  quickCreateAgendaBlockAction,
  quickDeleteAgendaBlockAction,
  togglePublicAgendaOpenAction,
  type ShiftedAppointmentSummary,
} from "@/app/actions/agendaActions";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { SaveButton } from "@/components/ui/SaveButton";
import type {
  AppointmentRecord,
  AvailabilityException,
  StaffMember,
} from "@/lib/types";
import {
  addDaysToIsoDate,
  formatDateLongEs,
  minutesToTime,
  timeToMinutes,
} from "@/lib/utils";
import {
  buildEmergencyCancelWhatsappUrl,
  buildRescheduleWhatsappUrl,
  getClientFullName,
} from "@/components/admin/agenda/agendaHelpers";

interface EmergencyControlModalProps {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultBlockStart?: string;
  today: string;
  nowMinutes: number;
  businessName: string;
  isAgendaOpen: boolean;
  staff: StaffMember[];
  appointments: AppointmentRecord[];
  exceptions: AvailabilityException[];
  onRefreshNeeded: (message?: string) => void;
  onAgendaOpenChanged: (isOpen: boolean) => void;
}

type EmergencyTab = "blocks" | "shift" | "close_day";

export function EmergencyControlModal({
  open,
  onClose,
  defaultDate,
  defaultBlockStart,
  today,
  nowMinutes,
  businessName,
  isAgendaOpen,
  staff,
  appointments,
  exceptions,
  onRefreshNeeded,
  onAgendaOpenChanged,
}: EmergencyControlModalProps) {
  const [tab, setTab] = useState<EmergencyTab>("blocks");
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [staffId, setStaffId] = useState(staff[0]?.id || "");

  // Block form
  const [blockType, setBlockType] = useState<"block_day" | "block_range" | "open_custom">(
    "block_range"
  );
  const [blockStart, setBlockStart] = useState(defaultBlockStart || "13:00");
  const [blockEnd, setBlockEnd] = useState(() => {
    if (!defaultBlockStart) return "15:00";
    const endMin = Math.min(23 * 60, timeToMinutes(defaultBlockStart) + 60);
    return minutesToTime(endMin);
  });
  const [blockReason, setBlockReason] = useState("");

  // Bulk shift form
  const [shiftFromTime, setShiftFromTime] = useState("08:00");
  const [shiftDelta, setShiftDelta] = useState(30);
  const [shiftNotifyEmail, setShiftNotifyEmail] = useState(false);
  const [shiftedResults, setShiftedResults] = useState<ShiftedAppointmentSummary[]>([]);

  // Emergency Close Day form (track unchecked IDs so all active appointments default to selected)
  const [closeReason, setCloseReason] = useState("Imprevisto de salud / emergencia personal");
  const [excludedCancelIds, setExcludedCancelIds] = useState<string[]>([]);
  const [closedClientsList, setClosedClientsList] = useState<AppointmentRecord[]>([]);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeDayAppointments = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.appointment_date === targetDate &&
            ["pending_deposit", "confirmed"].includes(a.status) &&
            (!staffId || a.staff_id === staffId)
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments, targetDate, staffId]
  );

  const selectedCancelIds = useMemo(
    () =>
      activeDayAppointments
        .map((a) => a.id)
        .filter((id) => !excludedCancelIds.includes(id)),
    [activeDayAppointments, excludedCancelIds]
  );

  const dayExceptions = useMemo(
    () =>
      exceptions.filter(
        (e) => e.exception_date === targetDate && (!staffId || e.staff_id === staffId)
      ),
    [exceptions, targetDate, staffId]
  );

  const impactedByBlock = useMemo(() => {
    if (blockType === "open_custom") return [];
    if (blockType === "block_day") return activeDayAppointments;
    const bStart = timeToMinutes(blockStart);
    const bEnd = timeToMinutes(blockEnd);
    return activeDayAppointments.filter((a) => {
      const aStart = timeToMinutes(a.start_time);
      const aEnd = timeToMinutes(a.end_time);
      return aStart < bEnd && aEnd > bStart;
    });
  }, [activeDayAppointments, blockType, blockStart, blockEnd]);

  const shiftPreview = useMemo(() => {
    const fromMin = timeToMinutes(shiftFromTime);
    return activeDayAppointments
      .filter((a) => timeToMinutes(a.start_time) >= fromMin)
      .map((a) => {
        const nextStart = timeToMinutes(a.start_time) + shiftDelta;
        const nextEnd = nextStart + a.total_duration_minutes;
        return {
          appt: a,
          oldStart: a.start_time.slice(0, 5),
          newStart: minutesToTime(Math.max(0, Math.min(23 * 60 + 55, nextStart))),
          newEnd: minutesToTime(Math.max(0, Math.min(23 * 60 + 59, nextEnd))),
          outOfBounds: nextStart < 0 || nextEnd > 24 * 60,
        };
      });
  }, [activeDayAppointments, shiftFromTime, shiftDelta]);

  async function handleToggleWebAgenda() {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await togglePublicAgendaOpenAction(!isAgendaOpen);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onAgendaOpenChanged(res.isAgendaOpen);
      setSuccessMsg(
        res.isAgendaOpen
          ? "Reservas web reabiertas al público."
          : "Reservas web pausadas de emergencia. Las clientas no podrán reservar hasta que la reabras."
      );
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) return;
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await quickCreateAgendaBlockAction({
        staffId,
        exceptionDate: targetDate,
        exceptionType: blockType,
        startTime: blockType === "block_day" ? undefined : blockStart,
        endTime: blockType === "block_day" ? undefined : blockEnd,
        reason: blockReason,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setBlockReason("");
      setSuccessMsg(
        blockType === "open_custom"
          ? "Turno especial abierto correctamente."
          : "Bloqueo guardado en la agenda."
      );
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  async function handlePresetBlockRestOfToday() {
    if (!staffId) return;
    const roundedStart = Math.min(22 * 60, Math.ceil(nowMinutes / 15) * 15);
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await quickCreateAgendaBlockAction({
        staffId,
        exceptionDate: today,
        exceptionType: "block_range",
        startTime: minutesToTime(roundedStart),
        endTime: "23:00",
        reason: "Bloqueo rápido resto de hoy",
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setTargetDate(today);
      setSuccessMsg(`Resto de hoy bloqueado desde las ${minutesToTime(roundedStart)} hrs.`);
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteBlock(id: string) {
    setBusy(true);
    try {
      await quickDeleteAgendaBlockAction(id);
      setSuccessMsg("Bloqueo eliminado.");
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyBulkShift(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShiftedResults([]);
    try {
      const res = await bulkShiftDayAppointmentsAction({
        dateStr: targetDate,
        staffId: staffId || undefined,
        fromTime: shiftFromTime,
        deltaMinutes: shiftDelta,
        notifyEmail: shiftNotifyEmail,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setShiftedResults(res.shifted);
      setSuccessMsg(
        `Se corrieron ${res.shifted.length} cita(s) ${shiftDelta > 0 ? `+${shiftDelta}` : shiftDelta} min. Puedes avisar a cada clienta con 1 toque abajo.`
      );
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  async function handleEmergencyCloseDay(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) return;
    if (
      selectedCancelIds.length > 0 &&
      !window.confirm(
        `Se bloqueará el día y se cancelarán ${selectedCancelIds.length} cita(s) seleccionadas. ¿Continuar?`
      )
    ) {
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const cancelledSnapshot = activeDayAppointments.filter((a) =>
        selectedCancelIds.includes(a.id)
      );
      const res = await emergencyCloseDayAction({
        dateStr: targetDate,
        staffId,
        reason: closeReason,
        cancelAppointmentIds: selectedCancelIds,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setClosedClientsList(cancelledSnapshot);
      setSuccessMsg(
        `Día bloqueado${res.cancelledCount > 0 ? ` y ${res.cancelledCount} cita(s) cancelada(s)` : ""}.`
      );
      onRefreshNeeded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      title="Control Rápido y Emergencias de Agenda"
    >
      <div className="space-y-4">
        {/* Top Master Switch: Public Web Bookings */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 ${
            isAgendaOpen
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-red-300 bg-red-50"
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1f141b]">
              Reservas Web Públicas (/reservar)
            </p>
            <p className="mt-0.5 text-xs text-[#4a3541]">
              {isAgendaOpen
                ? "Activas: las clientas pueden tomar horas nuevas desde la web."
                : "PAUSADAS: nadie puede agendar online hasta que vuelvas a abrir."}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleWebAgenda}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-bold text-white transition disabled:opacity-50 ${
              isAgendaOpen
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isAgendaOpen ? (
              <>
                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                <span>Pausar agenda web</span>
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                <span>Reabrir agenda web</span>
              </>
            )}
          </button>
        </div>

        {/* Shared Target Date & Staff Selector */}
        <div className="grid gap-3 rounded-2xl border border-[#f2e4eb] bg-[#fdf9fb] p-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">Fecha a gestionar</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
            />
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => setTargetDate(today)}
                className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4a3541] ring-1 ring-[#e2cbd7]"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setTargetDate(addDaysToIsoDate(today, 1))}
                className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4a3541] ring-1 ring-[#e2cbd7]"
              >
                Mañana
              </button>
            </div>
          </div>

          {staff.length > 1 ? (
            <div>
              <label className="mb-1 block text-xs font-semibold">Profesional</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              >
                {staff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col justify-center text-xs text-[#5d4754]">
              <span className="font-bold capitalize text-[#1f141b]">
                {formatDateLongEs(targetDate)}
              </span>
              <span>
                {activeDayAppointments.length} cita(s) activa(s) · {dayExceptions.length}{" "}
                excepción(es)
              </span>
            </div>
          )}
        </div>

        {/* Emergency Action Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#faf5f8] p-1">
          <button
            type="button"
            onClick={() => setTab("blocks")}
            className={`min-h-10 rounded-xl px-2 text-xs font-semibold ${
              tab === "blocks"
                ? "bg-[#1f141b] text-white"
                : "text-[#4a3541] hover:bg-white"
            }`}
          >
            Bloquear / Abrir
          </button>
          <button
            type="button"
            onClick={() => setTab("shift")}
            className={`min-h-10 rounded-xl px-2 text-xs font-semibold ${
              tab === "shift"
                ? "bg-[#1f141b] text-white"
                : "text-[#4a3541] hover:bg-white"
            }`}
          >
            Correr citas (± min)
          </button>
          <button
            type="button"
            onClick={() => setTab("close_day")}
            className={`min-h-10 rounded-xl px-2 text-xs font-semibold ${
              tab === "close_day"
                ? "bg-red-700 text-white"
                : "text-red-800 hover:bg-white"
            }`}
          >
            Cierre de emergencia
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            {successMsg}
          </div>
        )}

        {/* TAB 1: QUICK BLOCKS & SPECIAL OPENINGS */}
        {tab === "blocks" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handlePresetBlockRestOfToday}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
              >
                <Ban className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                <span>Bloquear resto de hoy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlockType("open_custom");
                  setBlockStart("10:00");
                  setBlockEnd("18:00");
                  setBlockReason("Cupo extraordinario abierto");
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>Abrir turno extra en día libre</span>
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-3 rounded-2xl border border-[#eedbe4] p-3.5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Tipo</label>
                  <select
                    value={blockType}
                    onChange={(e) =>
                      setBlockType(
                        e.target.value as "block_day" | "block_range" | "open_custom"
                      )
                    }
                    className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-2.5 text-sm"
                  >
                    <option value="block_range">Bloquear rango horario</option>
                    <option value="block_day">Bloquear día completo</option>
                    <option value="open_custom">Abrir horario especial</option>
                  </select>
                </div>

                {blockType !== "block_day" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Desde</label>
                      <input
                        type="time"
                        required
                        value={blockStart}
                        onChange={(e) => setBlockStart(e.target.value)}
                        className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Hasta</label>
                      <input
                        type="time"
                        required
                        value={blockEnd}
                        onChange={(e) => setBlockEnd(e.target.value)}
                        className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-2.5 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Motivo (opcional)</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ej. Almuerzo, trámite médico, feriado, apertura domingo..."
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              {/* Impact Warning if existing appointments overlap */}
              {impactedByBlock.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <p className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                    Atención: hay {impactedByBlock.length} cita(s) ya agendada(s) en ese horario
                  </p>
                  <p className="text-[11px]">
                    El bloqueo evitará nuevas reservas web, pero no cancelará automáticamente estas citas:
                  </p>
                  <ul className="space-y-1 pt-1">
                    {impactedByBlock.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span>
                          <strong>{a.start_time.slice(0, 5)}</strong> · {getClientFullName(a)} (
                          {a.booking_code})
                        </span>
                        {a.client?.phone && (
                          <a
                            href={
                              buildEmergencyCancelWhatsappUrl({
                                phone: a.client.phone,
                                firstName: a.client.first_name,
                                businessName,
                                bookingCode: a.booking_code,
                                dateStr: targetDate,
                                reason: blockReason || "ajuste de agenda",
                              }) || "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200"
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                            Avisar
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <SaveButton
                fullWidth
                busy={busy}
                label={
                  blockType === "open_custom"
                    ? "Abrir turno especial"
                    : "Guardar bloqueo en agenda"
                }
              />
            </form>

            {dayExceptions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#5d4754]">
                  Bloqueos y excepciones activas el {targetDate}:
                </p>
                {dayExceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className="flex items-center justify-between rounded-xl border border-[#f2e4eb] bg-[#fdfafc] px-3 py-2 text-xs"
                  >
                    <span>
                      <strong>
                        {exc.exception_type === "block_day"
                          ? "Día bloqueado"
                          : exc.exception_type === "block_range"
                          ? `Bloqueo ${exc.start_time?.slice(0, 5)}–${exc.end_time?.slice(0, 5)}`
                          : `Turno especial ${exc.start_time?.slice(0, 5)}–${exc.end_time?.slice(0, 5)}`}
                      </strong>
                      {exc.reason ? ` · ${exc.reason}` : ""}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteBlock(exc.id)}
                      aria-label="Eliminar excepción"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BULK SHIFT APPOINTMENTS */}
        {tab === "shift" && (
          <form onSubmit={handleApplyBulkShift} className="space-y-4">
            <p className="text-xs text-[#5d4754]">
              Ideal si te atrasaste o necesitas adelantar todas las citas restantes del día en un
              solo paso.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Aplicar a citas desde las
                </label>
                <input
                  type="time"
                  value={shiftFromTime}
                  onChange={(e) => setShiftFromTime(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Desplazamiento (minutos)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[-60, -30, -15, 15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setShiftDelta(d)}
                      className={`min-h-9 rounded-xl px-2.5 text-xs font-bold ${
                        shiftDelta === d
                          ? "bg-[var(--brand-primary)] text-white"
                          : "border border-[#e2cbd7] bg-white text-[#4a3541]"
                      }`}
                    >
                      {d > 0 ? `+${d}m` : `${d}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={shiftNotifyEmail}
                onChange={(e) => setShiftNotifyEmail(e.target.checked)}
                className="accent-[var(--brand-primary)]"
              />
              <span>Enviar también correo de reprogramación a cada clienta afectada</span>
            </label>

            {/* Live Preview */}
            <div className="space-y-1.5 rounded-2xl border border-[#eedbe4] bg-[#fdfafc] p-3 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-[#1f141b]">
                <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
                Vista previa ({shiftPreview.length} cita(s) se moverán)
              </p>
              {shiftPreview.length === 0 ? (
                <p className="text-[#7a6571]">
                  No hay citas activas desde las {shiftFromTime} el {targetDate}.
                </p>
              ) : (
                <ul className="space-y-1">
                  {shiftPreview.map((item) => (
                    <li key={item.appt.id} className="flex items-center justify-between">
                      <span className="font-medium text-[#1f141b]">
                        {getClientFullName(item.appt)}
                      </span>
                      <span
                        className={`font-bold ${
                          item.outOfBounds ? "text-red-700" : "text-[var(--brand-primary)]"
                        }`}
                      >
                        {item.oldStart} → {item.newStart} ({item.newEnd})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SaveButton
              fullWidth
              busy={busy}
              disabled={shiftPreview.length === 0 || shiftPreview.some((i) => i.outOfBounds)}
              label={`Correr ${shiftPreview.length} cita(s) ${shiftDelta > 0 ? `+${shiftDelta}` : shiftDelta} min`}
            />

            {shiftedResults.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                <p className="font-bold text-emerald-950">
                  Avisar por WhatsApp en 1 toque:
                </p>
                {shiftedResults.map((s) => {
                  const wa = buildRescheduleWhatsappUrl({
                    phone: s.clientPhone,
                    firstName: s.clientName.split(" ")[0] || s.clientName,
                    businessName,
                    bookingCode: s.bookingCode,
                    newDate: targetDate,
                    newStartTime: s.newStart,
                  });
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
                    >
                      <span>
                        <strong>{s.clientName}</strong> ({s.oldStart} → {s.newStart})
                      </span>
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#7a6571]">Sin teléfono</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        )}

        {/* TAB 3: EMERGENCY DAY CLOSURE */}
        {tab === "close_day" && (
          <form onSubmit={handleEmergencyCloseDay} className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-950">
              <p className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="h-4 w-4 text-red-700" aria-hidden="true" />
                Cierre total de emergencia para el {formatDateLongEs(targetDate)}
              </p>
              <p className="mt-1">
                Bloquea el día completo para nuevas reservas y te permite cancelar las citas
                afectadas para reagendarlas rápido por WhatsApp.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Motivo del cierre</label>
              <input
                type="text"
                required
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            {activeDayAppointments.length > 0 ? (
              <div className="space-y-1.5 rounded-2xl border border-[#eedbe4] p-3 text-xs">
                <p className="font-bold text-[#1f141b]">
                  Selecciona las citas a cancelar ({selectedCancelIds.length} de{" "}
                  {activeDayAppointments.length}):
                </p>
                {activeDayAppointments.map((a) => {
                  const checked = selectedCancelIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-[#fdfafc] px-2.5 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setExcludedCancelIds((prev) =>
                              checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                            )
                          }
                          className="accent-red-700"
                        />
                        <strong>{a.start_time.slice(0, 5)}</strong> · {getClientFullName(a)} (
                        {a.booking_code})
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#6c5763]">
                No hay citas activas este día; solo se agregará el bloqueo completo.
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-red-700 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              <span>
                Bloquear día
                {selectedCancelIds.length > 0
                  ? ` y cancelar ${selectedCancelIds.length} cita(s)`
                  : ""}
              </span>
            </button>

            {closedClientsList.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs">
                <p className="font-bold text-amber-950">
                  Avisar y reagendar por WhatsApp (abono vigente):
                </p>
                {closedClientsList.map((a) => {
                  const wa = buildEmergencyCancelWhatsappUrl({
                    phone: a.client?.phone,
                    firstName: a.client?.first_name || "Clienta",
                    businessName,
                    bookingCode: a.booking_code,
                    dateStr: targetDate,
                    reason: closeReason,
                  });
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
                    >
                      <span>
                        <strong>{getClientFullName(a)}</strong> ({a.start_time.slice(0, 5)})
                      </span>
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Enviar WhatsApp
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#7a6571]">Sin teléfono</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
