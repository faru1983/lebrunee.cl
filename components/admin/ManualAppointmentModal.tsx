"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createAdminAppointmentAction } from "@/app/actions/adminActions";
import { getAvailableSlotsAction } from "@/app/actions/bookingActions";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { ServiceAddon, ServiceItem, StaffMember, TimeSlotOption } from "@/lib/types";
import { formatClp } from "@/lib/utils";

interface ManualAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  defaultDate: string;
  depositDefaultClp: number;
}

export function ManualAppointmentModal({
  open,
  onClose,
  onCreated,
  services,
  addons,
  staff,
  defaultDate,
  depositDefaultClp,
}: ManualAppointmentModalProps) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(staff[0]?.id || "");
  const [dateStr, setDateStr] = useState(defaultDate);
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+56 9 ");
  const [confirmImmediately, setConfirmImmediately] = useState(true);
  const [depositPaidClp, setDepositPaidClp] = useState(depositDefaultClp);
  const [sendEmail, setSendEmail] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) || services[0];
  const totalDuration =
    (selectedService?.duration_minutes || 60) +
    addons
      .filter((a) => addonIds.includes(a.id))
      .reduce((acc, a) => acc + a.duration_minutes, 0);

  async function refreshSlots(nextDate: string, nextServiceId = serviceId, nextAddons = addonIds) {
    if (!staffId || !nextDate) return;
    setLoadingSlots(true);
    setErrorMsg(null);
    try {
      const srv = services.find((s) => s.id === nextServiceId) || services[0];
      const dur =
        (srv?.duration_minutes || 60) +
        addons
          .filter((a) => nextAddons.includes(a.id))
          .reduce((acc, a) => acc + a.duration_minutes, 0);

      const res = await getAvailableSlotsAction({
        staffId,
        dateStr: nextDate,
        durationMinutes: dur,
      });
      setSlots(res);
      setStartTime(res[0]?.startTime || "");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await createAdminAppointmentAction({
        serviceId,
        addonIds,
        staffId,
        appointmentDate: dateStr,
        startTime,
        fullName,
        email,
        phone,
        confirmImmediately,
        depositPaidClp: confirmImmediately ? depositPaidClp : 0,
        sendEmail,
        adminNotes,
      });

      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      setFullName("");
      setEmail("");
      setPhone("+56 9 ");
      setAdminNotes("");
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalDialog open={open} onClose={onClose} title="Nueva cita manual">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="m-service" className="mb-1 block text-xs font-semibold">
            Servicio
          </label>
          <select
            id="m-service"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              refreshSlots(dateStr, e.target.value, addonIds);
            }}
            className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} min · {formatClp(s.price_clp)})
              </option>
            ))}
          </select>
        </div>

        {addons.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold">Adicionales</span>
            {addons.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={addonIds.includes(a.id)}
                  onChange={() => {
                    const next = addonIds.includes(a.id)
                      ? addonIds.filter((x) => x !== a.id)
                      : [...addonIds, a.id];
                    setAddonIds(next);
                    refreshSlots(dateStr, serviceId, next);
                  }}
                  className="accent-[var(--brand-primary)]"
                />
                <span>
                  {a.name} (+{a.duration_minutes} min)
                </span>
              </label>
            ))}
          </div>
        )}

        {staff.length > 1 && (
          <div>
            <label htmlFor="m-staff" className="mb-1 block text-xs font-semibold">
              Profesional
            </label>
            <select
              id="m-staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
            >
              {staff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="m-date" className="mb-1 block text-xs font-semibold">
              Fecha ({totalDuration} min)
            </label>
            <input
              id="m-date"
              type="date"
              required
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                refreshSlots(e.target.value);
              }}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="m-time" className="mb-1 block text-xs font-semibold">
              Hora inicio
            </label>
            {loadingSlots ? (
              <div className="flex min-h-11 items-center gap-1 text-xs text-[#6c5763]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando...
              </div>
            ) : slots.length > 0 ? (
              <select
                id="m-time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              >
                {slots.map((sl) => (
                  <option key={sl.startTime} value={sl.startTime}>
                    {sl.startTime}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-1">
                <input
                  id="m-time"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => refreshSlots(dateStr)}
                  className="rounded-xl border border-[#e2cbd7] px-2 text-xs font-semibold"
                >
                  Ver
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="m-name" className="mb-1 block text-xs font-semibold">
              Nombre clienta
            </label>
            <input
              id="m-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="m-email" className="mb-1 block text-xs font-semibold">
              Correo
            </label>
            <input
              id="m-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="m-phone" className="mb-1 block text-xs font-semibold">
              WhatsApp
            </label>
            <input
              id="m-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-2xl bg-[#faf5f8] p-3 text-xs">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={confirmImmediately}
              onChange={(e) => setConfirmImmediately(e.target.checked)}
              className="accent-[var(--brand-primary)]"
            />
            <span>Confirmar abono ahora</span>
          </label>
          {confirmImmediately && (
            <div>
              <label htmlFor="m-dep" className="mb-1 block text-[11px] text-[#6c5763]">
                Monto abono recibido (CLP)
              </label>
              <input
                id="m-dep"
                type="number"
                min={0}
                value={depositPaidClp}
                onChange={(e) => setDepositPaidClp(Number(e.target.value))}
                className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              />
            </div>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="accent-[var(--brand-primary)]"
            />
            <span>Enviar correo a la clienta (si Resend está activo)</span>
          </label>
        </div>

        <div>
          <label htmlFor="m-notes" className="mb-1 block text-xs font-semibold">
            Notas internas (opcional)
          </label>
          <input
            id="m-notes"
            type="text"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !startTime}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>Guardar cita</span>
        </button>
      </form>
    </ModalDialog>
  );
}
