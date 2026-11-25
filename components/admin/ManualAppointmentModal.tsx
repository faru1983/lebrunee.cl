"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert, UserCheck } from "lucide-react";
import { createAdminAppointmentAction } from "@/app/actions/adminActions";
import { getAvailableSlotsAction } from "@/app/actions/bookingActions";
import { SaveButton } from "@/components/ui/SaveButton";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type {
  AgendaClientOption,
  ServiceAddon,
  ServiceItem,
  StaffMember,
  TimeSlotOption,
} from "@/lib/types";
import { formatClp } from "@/lib/utils";

interface ManualAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  clients?: AgendaClientOption[];
  defaultDate: string;
  defaultTime?: string;
  defaultStaffId?: string;
  depositDefaultClp: number;
}

export function ManualAppointmentModal({
  open,
  onClose,
  onCreated,
  services,
  addons,
  staff,
  clients = [],
  defaultDate,
  defaultTime = "",
  defaultStaffId,
  depositDefaultClp,
}: ManualAppointmentModalProps) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(defaultStaffId || staff[0]?.id || "");
  const [dateStr, setDateStr] = useState(defaultDate);
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startTime, setStartTime] = useState(defaultTime || "10:00");
  const [allowOverride, setAllowOverride] = useState(Boolean(defaultTime));

  const [clientQuery, setClientQuery] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+56 9 ");
  const [birthDate, setBirthDate] = useState("");
  const [confirmImmediately, setConfirmImmediately] = useState(true);
  const [depositPaidClp, setDepositPaidClp] = useState(depositDefaultClp);
  const [sendEmail, setSendEmail] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const matchedClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .filter((c) => {
        const full = `${c.first_name} ${c.last_name || ""}`.toLowerCase();
        return (
          full.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone || "").includes(q)
        );
      })
      .slice(0, 6);
  }, [clients, clientQuery]);

  const selectedService = services.find((s) => s.id === serviceId) || services[0];
  const totalDuration =
    (selectedService?.duration_minutes || 60) +
    addons
      .filter((a) => addonIds.includes(a.id))
      .reduce((acc, a) => acc + a.duration_minutes, 0);

  async function refreshSlots(
    nextDate: string,
    nextServiceId = serviceId,
    nextAddons = addonIds,
    nextStaffId = staffId
  ) {
    if (!nextStaffId || !nextDate) return;
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
        staffId: nextStaffId,
        dateStr: nextDate,
        durationMinutes: dur,
      });
      setSlots(res);
      if (!allowOverride && res.length > 0 && !res.some((r) => r.startTime === startTime)) {
        setStartTime(res[0].startTime);
      }
    } finally {
      setLoadingSlots(false);
    }
  }

  function applyExistingClient(c: AgendaClientOption) {
    setFirstName(c.first_name);
    setLastName(c.last_name || "");
    setEmail(c.email);
    setPhone(c.phone || "+56 9 ");
    setBirthDate(c.birth_date || "");
    setClientQuery("");
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
        firstName,
        lastName,
        email,
        phone,
        birthDate,
        confirmImmediately,
        depositPaidClp: confirmImmediately ? depositPaidClp : 0,
        sendEmail,
        adminNotes,
        allowOverride,
      });

      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("+56 9 ");
      setBirthDate("");
      setAdminNotes("");
      setClientQuery("");
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalDialog open={open} onClose={onClose} title="Nueva cita manual" maxWidthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Quick Existing Client Picker */}
        {clients.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-[#f2e4eb] bg-[#fdf9fb] p-3">
            <label
              htmlFor="m-client-lookup"
              className="flex items-center gap-1.5 text-xs font-bold text-[#1f141b]"
            >
              <UserCheck className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
              Autocompletar clienta existente (opcional)
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a6571]"
                aria-hidden="true"
              />
              <input
                id="m-client-lookup"
                type="search"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Escribe nombre, correo o WhatsApp..."
                className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white pl-9 pr-3 text-xs"
              />
            </div>
            {matchedClients.length > 0 && (
              <div className="grid gap-1 pt-1">
                {matchedClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyExistingClient(c)}
                    className="flex items-center justify-between rounded-xl border border-[#eedbe4] bg-white px-3 py-2 text-left text-xs hover:border-[var(--brand-primary)] hover:bg-[#fff6fa]"
                  >
                    <span className="font-bold text-[#1f141b]">
                      {c.first_name} {c.last_name || ""}
                    </span>
                    <span className="text-[11px] text-[#6c5763]">
                      {c.phone || c.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
            <div className="grid gap-1.5 sm:grid-cols-2">
              {addons.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#f2e4eb] px-2.5 py-1.5 text-xs"
                >
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
              onChange={(e) => {
                setStaffId(e.target.value);
                refreshSlots(dateStr, serviceId, addonIds, e.target.value);
              }}
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Buscando...
              </div>
            ) : !allowOverride && slots.length > 0 ? (
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
                  onClick={() => {
                    setAllowOverride(false);
                    refreshSlots(dateStr);
                  }}
                  title="Ver bloques libres"
                  className="rounded-xl border border-[#e2cbd7] px-2.5 text-xs font-semibold"
                >
                  Libres
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admin Override Toggle */}
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-950">
          <input
            type="checkbox"
            checked={allowOverride}
            onChange={(e) => setAllowOverride(e.target.checked)}
            className="accent-amber-700"
          />
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Horario libre / Sobrecupo (permitir cualquier hora aunque esté fuera de turno)</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="m-fname" className="mb-1 block text-xs font-semibold">
              Nombre clienta
            </label>
            <input
              id="m-fname"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="m-lname" className="mb-1 block text-xs font-semibold">
              Apellidos
            </label>
            <input
              id="m-lname"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
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
          <div className="sm:col-span-2">
            <label htmlFor="m-bday" className="mb-1 block text-xs font-semibold">
              Cumpleaños (opcional)
            </label>
            <input
              id="m-bday"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
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

        <SaveButton
          fullWidth
          busy={busy}
          disabled={!startTime}
          label="Guardar cita"
          busyLabel="Creando cita..."
        />
      </form>
    </ModalDialog>
  );
}
