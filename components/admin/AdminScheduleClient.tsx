"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import {
  addAvailabilityExceptionAction,
  deleteAvailabilityExceptionAction,
  saveScheduleSetupAction,
} from "@/app/actions/adminActions";
import type {
  AvailabilityException,
  AvailabilityFixedSlot,
  AvailabilityRule,
  BookingRulesSettings,
  StaffMember,
} from "@/lib/types";

interface AdminScheduleClientProps {
  staff: StaffMember[];
  initialStaffId: string;
  initialBookingRules: BookingRulesSettings;
  initialRules: AvailabilityRule[];
  initialFixedSlots: AvailabilityFixedSlot[];
  initialExceptions: AvailabilityException[];
}

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function AdminScheduleClient({
  staff,
  initialStaffId,
  initialBookingRules,
  initialRules,
  initialFixedSlots,
  initialExceptions,
}: AdminScheduleClientProps) {
  const router = useRouter();
  const [staffId] = useState(initialStaffId);
  const [bookingRules, setBookingRules] = useState<BookingRulesSettings>(initialBookingRules);
  const [rules, setRules] = useState(
    initialRules.map((r) => ({
      day_of_week: r.day_of_week,
      start_time: r.start_time.slice(0, 5),
      end_time: r.end_time.slice(0, 5),
      is_active: r.is_active,
    }))
  );
  const [fixedSlots, setFixedSlots] = useState(
    initialFixedSlots.map((f) => ({
      day_of_week: f.day_of_week,
      slot_time: f.slot_time.slice(0, 5),
      is_active: f.is_active,
    }))
  );
  const [newFixedTime, setNewFixedTime] = useState("10:00");

  // Exception form
  const [excDate, setExcDate] = useState("");
  const [excType, setExcType] = useState<"block_day" | "block_range" | "open_custom">(
    "block_day"
  );
  const [excStart, setExcStart] = useState("10:00");
  const [excEnd, setExcEnd] = useState("14:00");
  const [excReason, setExcReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [savedSchedule, setSavedSchedule] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function addShift(dayOfWeek: number) {
    setRules((prev) => [
      ...prev,
      { day_of_week: dayOfWeek, start_time: "10:00", end_time: "18:00", is_active: true },
    ]);
  }

  function removeShift(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function addFixedSlot() {
    if (!newFixedTime) return;
    if (fixedSlots.some((f) => f.slot_time === newFixedTime && f.day_of_week === null)) {
      return;
    }
    setFixedSlots((prev) =>
      [...prev, { day_of_week: null, slot_time: newFixedTime, is_active: true }].sort(
        (a, b) => a.slot_time.localeCompare(b.slot_time)
      )
    );
  }

  async function saveAllSchedule() {
    setBusy(true);
    setToast(null);
    setErrorMsg(null);
    try {
      const res = await saveScheduleSetupAction({
        staffId,
        bookingRules: bookingRules as unknown as Record<string, unknown>,
        rules,
        fixedSlots,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setToast("Agenda y reglas guardadas correctamente.");
      setSavedSchedule(true);
      window.setTimeout(() => setSavedSchedule(false), 3000);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddException(e: React.FormEvent) {
    e.preventDefault();
    if (!excDate) return;
    setBusy(true);
    try {
      const res = await addAvailabilityExceptionAction({
        staffId,
        exceptionDate: excDate,
        exceptionType: excType,
        startTime: excStart,
        endTime: excEnd,
        reason: excReason,
      });
      if (res.success) {
        setExcDate("");
        setExcReason("");
        setToast("Excepción agregada.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
            Horarios y Bloques
          </h1>
          <p className="text-xs text-[#6c5763]">
            Configura turnos, modo de bloques, apertura de agenda y excepciones ({staff[0]?.name}).
          </p>
        </div>

        <SaveButton
          type="button"
          busy={busy}
          saved={savedSchedule}
          onClick={saveAllSchedule}
          label="Guardar cambios"
        />
      </div>

      {toast && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          {toast}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="rounded-2xl bg-red-50 p-3.5 text-xs font-semibold text-red-800">
          {errorMsg}
        </div>
      )}

      {/* General Rules Card */}
      <section className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="text-base font-bold text-[#1f141b]">Reglas Generales de Agenda</h2>

        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={bookingRules.isAgendaOpen}
              onChange={(e) =>
                setBookingRules({ ...bookingRules, isAgendaOpen: e.target.checked })
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span>Agenda abierta al público</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={bookingRules.requireClientOtp}
              onChange={(e) =>
                setBookingRules({ ...bookingRules, requireClientOtp: e.target.checked })
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span>Exigir código OTP al correo al reservar</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={bookingRules.allowClientCancel}
              onChange={(e) =>
                setBookingRules({ ...bookingRules, allowClientCancel: e.target.checked })
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span>Permitir cancelar desde Mis Citas</span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="open-mode" className="mb-1 block text-xs font-semibold">
              Apertura de agenda
            </label>
            <select
              id="open-mode"
              value={bookingRules.openMode}
              onChange={(e) =>
                setBookingRules({
                  ...bookingRules,
                  openMode: e.target.value as "rolling_days" | "until_date",
                })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
            >
              <option value="rolling_days">Próximos N días</option>
              <option value="until_date">Hasta fecha específica</option>
            </select>
          </div>

          {bookingRules.openMode === "rolling_days" ? (
            <div>
              <label htmlFor="rolling-days" className="mb-1 block text-xs font-semibold">
                Días abiertos hacia adelante
              </label>
              <input
                id="rolling-days"
                type="number"
                min={1}
                max={180}
                value={bookingRules.rollingDays}
                onChange={(e) =>
                  setBookingRules({ ...bookingRules, rollingDays: Number(e.target.value) })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="open-until" className="mb-1 block text-xs font-semibold">
                Abierta hasta el día
              </label>
              <input
                id="open-until"
                type="date"
                value={bookingRules.openUntilDate || ""}
                onChange={(e) =>
                  setBookingRules({ ...bookingRules, openUntilDate: e.target.value || null })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="slot-mode" className="mb-1 block text-xs font-semibold">
              Modo de generación de horas
            </label>
            <select
              id="slot-mode"
              value={bookingRules.slotMode}
              onChange={(e) =>
                setBookingRules({
                  ...bookingRules,
                  slotMode: e.target.value as "dynamic" | "fixed_blocks",
                })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
            >
              <option value="dynamic">Intervalos dinámicos (según duración)</option>
              <option value="fixed_blocks">Bloques fijos (horas exactas)</option>
            </select>
          </div>

          {bookingRules.slotMode === "dynamic" && (
            <div>
              <label htmlFor="slot-step" className="mb-1 block text-xs font-semibold">
                Intervalo entre inicios (min)
              </label>
              <select
                id="slot-step"
                value={bookingRules.slotIntervalMinutes}
                onChange={(e) =>
                  setBookingRules({
                    ...bookingRules,
                    slotIntervalMinutes: Number(e.target.value),
                  })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              >
                <option value={15}>Cada 15 min</option>
                <option value={20}>Cada 20 min</option>
                <option value={30}>Cada 30 min</option>
                <option value={45}>Cada 45 min</option>
                <option value={60}>Cada 60 min</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="buffer-min" className="mb-1 block text-xs font-semibold">
              Descanso/limpieza entre citas (min)
            </label>
            <input
              id="buffer-min"
              type="number"
              min={0}
              max={60}
              value={bookingRules.bufferMinutes}
              onChange={(e) =>
                setBookingRules({ ...bookingRules, bufferMinutes: Number(e.target.value) })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="min-adv" className="mb-1 block text-xs font-semibold">
              Anticipación mínima reserva (horas)
            </label>
            <input
              id="min-adv"
              type="number"
              min={0}
              max={72}
              value={bookingRules.minAdvanceHours}
              onChange={(e) =>
                setBookingRules({
                  ...bookingRules,
                  minAdvanceHours: Number(e.target.value),
                })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="cutoff-hrs" className="mb-1 block text-xs font-semibold">
              Límite reprogramación clientas (horas)
            </label>
            <input
              id="cutoff-hrs"
              type="number"
              min={0}
              max={168}
              value={bookingRules.rescheduleCutoffHours}
              onChange={(e) =>
                setBookingRules({
                  ...bookingRules,
                  rescheduleCutoffHours: Number(e.target.value),
                })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Fixed Blocks Editor (shown when fixed_blocks is selected) */}
      {bookingRules.slotMode === "fixed_blocks" && (
        <section className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
          <div>
            <h2 className="text-base font-bold text-[#1f141b]">Bloques Horarios Fijos</h2>
            <p className="text-xs text-[#6c5763]">
              Define las horas exactas de inicio que se ofrecerán dentro de tus tramos laborales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {fixedSlots.map((slot, idx) => (
              <span
                key={`${slot.slot_time}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e2cbd7] bg-[#fff8fb] px-3.5 py-1.5 text-sm font-semibold"
              >
                {slot.slot_time}
                <button
                  type="button"
                  aria-label={`Quitar bloque ${slot.slot_time}`}
                  onClick={() =>
                    setFixedSlots((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              value={newFixedTime}
              onChange={(e) => setNewFixedTime(e.target.value)}
              className="min-h-11 rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
            <button
              type="button"
              onClick={addFixedSlot}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--brand-primary)] px-4 text-xs font-semibold text-[var(--brand-primary)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar bloque
            </button>
          </div>
        </section>
      )}

      {/* Weekly Multi-shift Schedule */}
      <section className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="text-base font-bold text-[#1f141b]">
          Jornada Semanal (Múltiples Tramos)
        </h2>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
            const dayShifts = rules
              .map((r, index) => ({ ...r, index }))
              .filter((r) => r.day_of_week === dow);

            return (
              <div
                key={dow}
                className="rounded-2xl border border-[#f2e4eb] bg-[#fdfafc] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#1f141b]">
                    {DAY_NAMES[dow]}
                  </span>
                  <button
                    type="button"
                    onClick={() => addShift(dow)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#e2cbd7] bg-white px-3 text-xs font-semibold text-[var(--brand-primary)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar tramo
                  </button>
                </div>

                {dayShifts.length === 0 ? (
                  <p className="mt-1 text-xs text-[#8a7581]">Cerrado</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {dayShifts.map((shift) => (
                      <div key={shift.index} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRules((prev) =>
                              prev.map((item, idx) =>
                                idx === shift.index ? { ...item, start_time: val } : item
                              )
                            );
                          }}
                          className="min-h-10 rounded-xl border border-[#e2cbd7] bg-white px-2.5 text-sm"
                        />
                        <span className="text-xs text-[#6c5763]">a</span>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRules((prev) =>
                              prev.map((item, idx) =>
                                idx === shift.index ? { ...item, end_time: val } : item
                              )
                            );
                          }}
                          className="min-h-10 rounded-xl border border-[#e2cbd7] bg-white px-2.5 text-sm"
                        />
                        <button
                          type="button"
                          aria-label="Eliminar tramo"
                          onClick={() => removeShift(shift.index)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Exceptions / Quick Blocks */}
      <section className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
          <CalendarOff className="h-4 w-4 text-[var(--brand-primary)]" />
          Bloqueos y Días Especiales
        </h2>

        <form onSubmit={handleAddException} className="grid gap-3 sm:grid-cols-4">
          <input
            type="date"
            required
            value={excDate}
            onChange={(e) => setExcDate(e.target.value)}
            className="min-h-11 rounded-xl border border-[#e2cbd7] px-3 text-sm"
          />
          <select
            value={excType}
            onChange={(e) =>
              setExcType(e.target.value as "block_day" | "block_range" | "open_custom")
            }
            className="min-h-11 rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
          >
            <option value="block_day">Bloquear día completo</option>
            <option value="block_range">Bloquear rango horario</option>
            <option value="open_custom">Abrir horario especial</option>
          </select>

          {excType !== "block_day" && (
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={excStart}
                onChange={(e) => setExcStart(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-2 text-sm"
              />
              <input
                type="time"
                value={excEnd}
                onChange={(e) => setExcEnd(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-2 text-sm"
              />
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Motivo (ej. Feriado)"
              value={excReason}
              onChange={(e) => setExcReason(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 shrink-0 rounded-xl bg-[#1f141b] px-4 text-xs font-semibold text-white"
            >
              Agregar
            </button>
          </div>
        </form>

        {initialExceptions.length > 0 && (
          <div className="space-y-2 pt-2">
            {initialExceptions.map((exc) => (
              <div
                key={exc.id}
                className="flex items-center justify-between rounded-2xl border border-[#f2e4eb] px-4 py-2.5 text-xs"
              >
                <div>
                  <strong>{exc.exception_date}</strong> ·{" "}
                  {exc.exception_type === "block_day"
                    ? "Día bloqueado"
                    : exc.exception_type === "block_range"
                    ? `Bloqueo ${exc.start_time?.slice(0, 5)}–${exc.end_time?.slice(0, 5)}`
                    : `Horario especial ${exc.start_time?.slice(0, 5)}–${exc.end_time?.slice(0, 5)}`}
                  {exc.reason ? ` (${exc.reason})` : ""}
                </div>
                <button
                  type="button"
                  aria-label="Eliminar excepción"
                  onClick={async () => {
                    await deleteAvailabilityExceptionAction(exc.id);
                    router.refresh();
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
