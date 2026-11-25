"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Move,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  confirmAppointmentDepositAction,
  updateAppointmentStatusAction,
} from "@/app/actions/adminActions";
import {
  adminFullEditAppointmentAction,
  quickEditClientFromAgendaAction,
  type MoveConflictInfo,
} from "@/app/actions/agendaActions";
import { closeAppointmentWithPaymentAction } from "@/app/actions/crmFinanceActions";
import { SaveButton } from "@/components/ui/SaveButton";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type {
  AppointmentRecord,
  AppointmentStatus,
  PaymentMethodRecord,
  ServiceAddon,
  ServiceItem,
  StaffMember,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";
import {
  addMinutesToTimeStr,
  getClientFullName,
  STATUS_META,
} from "@/components/admin/agenda/agendaHelpers";

interface AppointmentDetailModalProps {
  appointment: AppointmentRecord | null;
  onClose: () => void;
  onUpdated: (message?: string) => void;
  paymentMethods: PaymentMethodRecord[];
  services?: ServiceItem[];
  addons?: ServiceAddon[];
  staff?: StaffMember[];
  businessName?: string;
  onStartMoveMode?: (appt: AppointmentRecord) => void;
}

const DURATION_PRESETS = [30, 45, 60, 75, 90, 105, 120, 150, 180];
const STATUS_OPTIONS: AppointmentStatus[] = [
  "pending_deposit",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
];

export function AppointmentDetailModal({
  appointment,
  onClose,
  onUpdated,
  paymentMethods,
  services = [],
  addons = [],
  staff = [],
  businessName = "el estudio",
  onStartMoveMode,
}: AppointmentDetailModalProps) {
  const [tab, setTab] = useState<"checkout" | "edit" | "client">(
    appointment?.status === "confirmed" ? "checkout" : "edit"
  );

  // Checkout state
  const [extras, setExtras] = useState<Array<{ name: string; priceClp: number }>>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState(5000);
  const [adjustment, setAdjustment] = useState(appointment?.manual_adjustment_clp || 0);
  const [methodId, setMethodId] = useState(paymentMethods[0]?.id || "");
  const [refNote, setRefNote] = useState("");

  // Full Edit state
  const initialServiceItem = appointment?.items?.find((i) => i.item_type === "service");
  const initialAddonIds = (appointment?.items || [])
    .filter((i) => i.item_type === "addon" && i.addon_id)
    .map((i) => i.addon_id as string);

  const [dateStr, setDateStr] = useState(appointment?.appointment_date || "");
  const [timeStr, setTimeStr] = useState(appointment?.start_time.slice(0, 5) || "10:00");
  const [staffId, setStaffId] = useState(appointment?.staff_id || staff[0]?.id || "");
  const [durationMin, setDurationMin] = useState(appointment?.total_duration_minutes || 60);
  const [bufferMin, setBufferMin] = useState(appointment?.buffer_minutes ?? 15);
  const [statusVal, setStatusVal] = useState<AppointmentStatus>(
    appointment?.status || "confirmed"
  );
  const [serviceId, setServiceId] = useState<string>(initialServiceItem?.service_id || "");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(initialAddonIds);
  const [autoSyncDuration, setAutoSyncDuration] = useState(true);
  const [editAdjustment, setEditAdjustment] = useState(appointment?.manual_adjustment_clp || 0);
  const [adminNotes, setAdminNotes] = useState(appointment?.admin_notes || "");
  const [clientNotes, setClientNotes] = useState(appointment?.client_notes || "");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<MoveConflictInfo | null>(null);

  // Quick client edit state
  const [cFirstName, setCFirstName] = useState(appointment?.client?.first_name || "");
  const [cLastName, setCLastName] = useState(appointment?.client?.last_name || "");
  const [cEmail, setCEmail] = useState(appointment?.client?.email || "");
  const [cPhone, setCPhone] = useState(appointment?.client?.phone || "");
  const [cIg, setCIg] = useState(appointment?.client?.instagram_handle || "");

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!appointment) return null;

  const baseItemsTotal = (appointment.items || []).reduce(
    (sum, i) => sum + (i.unit_price_clp || 0) * (i.quantity || 1),
    0
  );
  const extrasSum = extras.reduce((sum, e) => sum + (e.priceClp || 0), 0);
  const finalTotal = Math.max(0, baseItemsTotal + extrasSum + adjustment);
  const alreadyPaid = appointment.total_paid_clp || 0;
  const remainingBalance = Math.max(0, finalTotal - alreadyPaid);

  const waUrl = appointment.client?.phone
    ? buildWhatsAppUrl(
        appointment.client.phone,
        `Hola ${appointment.client.first_name}! Te escribimos desde ${businessName} por tu cita ${appointment.booking_code} del ${formatDateLongEs(dateStr || appointment.appointment_date)} a las ${timeStr} hrs.`
      )
    : null;

  function recalcDurationFromCatalog(nextServiceId: string, nextAddons: string[]) {
    if (!autoSyncDuration) return;
    const srv = services.find((s) => s.id === nextServiceId);
    if (!srv) return;
    const addonsDur = addons
      .filter((a) => nextAddons.includes(a.id))
      .reduce((acc, a) => acc + a.duration_minutes, 0);
    setDurationMin(Math.max(15, srv.duration_minutes + addonsDur));
  }

  function addExtra() {
    if (!extraName.trim()) return;
    setExtras((prev) => [
      ...prev,
      { name: extraName.trim(), priceClp: Number(extraPrice) || 0 },
    ]);
    setExtraName("");
    setExtraPrice(5000);
  }

  async function handleQuickApproveDeposit() {
    if (!appointment) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await confirmAppointmentDepositAction(
        appointment.id,
        appointment.deposit_required_clp
      );
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onUpdated(`Abono aprobado · Cita ${appointment.booking_code} confirmada.`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleInstantStatus(nextStatus: AppointmentStatus) {
    if (!appointment || nextStatus === appointment.status) return;
    if (
      nextStatus === "cancelled" &&
      !window.confirm("¿Seguro que deseas marcar esta cita como cancelada?")
    ) {
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await updateAppointmentStatusAction(appointment.id, nextStatus);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onUpdated(`Estado actualizado a ${STATUS_META[nextStatus].label}.`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await closeAppointmentWithPaymentAction({
        appointmentId: appointment.id,
        extras,
        manualAdjustmentClp: adjustment,
        amountPaidNowClp: remainingBalance,
        paymentMethodId: methodId || null,
        referenceNote: refNote,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onUpdated(`Cita ${appointment.booking_code} cerrada y cobrada.`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function submitFullEdit(forceOverride: boolean) {
    if (!appointment) return;
    setBusy(true);
    setErrorMsg(null);
    setPendingConflict(null);
    try {
      const res = await adminFullEditAppointmentAction({
        appointmentId: appointment.id,
        appointmentDate: dateStr,
        startTime: timeStr,
        staffId: staffId || undefined,
        durationMinutes: durationMin,
        bufferMinutes: bufferMin,
        status: statusVal,
        serviceId: serviceId || undefined,
        addonIds: serviceId ? selectedAddonIds : undefined,
        manualAdjustmentClp: editAdjustment,
        adminNotes,
        clientNotes,
        forceOverride,
        notifyClientEmail: notifyEmail,
      });
      if (!res.success) {
        if (res.conflict) {
          setPendingConflict(res.conflict);
        } else {
          setErrorMsg(res.error);
        }
        return;
      }
      onUpdated(`Cita ${appointment.booking_code} actualizada correctamente.`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleClientSave(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment?.client?.id) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await quickEditClientFromAgendaAction({
        clientId: appointment.client.id,
        firstName: cFirstName,
        lastName: cLastName,
        email: cEmail,
        phone: cPhone,
        instagramHandle: cIg,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onUpdated("Datos de la clienta actualizados.");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const meta = STATUS_META[appointment.status];

  return (
    <ModalDialog
      open={Boolean(appointment)}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      title={`Cita ${appointment.booking_code} · ${getClientFullName(appointment)}`}
    >
      <div className="space-y-4">
        {/* Client Header + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#f2e4eb] bg-[#faf5f8] p-3 text-xs">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold text-[#1f141b]">
                {getClientFullName(appointment)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-0.5 text-[#6c5763]">
              {formatDateLongEs(appointment.appointment_date)} ·{" "}
              <strong>
                {appointment.start_time.slice(0, 5)}–{appointment.end_time.slice(0, 5)}
              </strong>{" "}
              ({appointment.total_duration_minutes} min)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onStartMoveMode && (
              <button
                type="button"
                onClick={() => {
                  onStartMoveMode(appointment);
                  onClose();
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#e2cbd7] bg-white px-3 font-semibold text-[#1f141b] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                <Move className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Mover</span>
              </button>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
            )}
            {appointment.client?.id && (
              <Link
                href={`/admin/clients/${appointment.client.id}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#e2cbd7] bg-white px-3 font-semibold text-[var(--brand-primary)]"
              >
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ficha</span>
              </Link>
            )}
          </div>
        </div>

        {/* 1-tap Deposit Approval Banner when Pending */}
        {appointment.status === "pending_deposit" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5">
            <div className="text-xs text-amber-950">
              <strong>Abono pendiente:</strong> {formatClp(appointment.deposit_required_clp)}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleQuickApproveDeposit}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Aprobar abono y confirmar</span>
            </button>
          </div>
        )}

        {/* Quick Status Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-bold uppercase text-[#7a6571]">Estado:</span>
          {STATUS_OPTIONS.map((st) => {
            const active = appointment.status === st;
            const m = STATUS_META[st];
            return (
              <button
                key={st}
                type="button"
                disabled={busy || active}
                onClick={() => handleInstantStatus(st)}
                className={`min-h-8 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  active
                    ? `${m.badgeBg} ${m.badgeText} ring-1 ring-current`
                    : "border border-[#eedbe4] bg-white text-[#5d4754] hover:bg-[#fdf5f9]"
                }`}
              >
                {m.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Modal Mode Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#faf5f8] p-1">
          <button
            type="button"
            onClick={() => setTab("checkout")}
            className={`min-h-10 rounded-xl text-xs font-semibold transition ${
              tab === "checkout"
                ? "bg-[var(--brand-primary)] text-white shadow-xs"
                : "text-[#4a3541] hover:bg-white"
            }`}
          >
            Cobro / Cierre
          </button>
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`min-h-10 rounded-xl text-xs font-semibold transition ${
              tab === "edit"
                ? "bg-[var(--brand-primary)] text-white shadow-xs"
                : "text-[#4a3541] hover:bg-white"
            }`}
          >
            Editar cita
          </button>
          <button
            type="button"
            onClick={() => setTab("client")}
            className={`min-h-10 rounded-xl text-xs font-semibold transition ${
              tab === "client"
                ? "bg-[var(--brand-primary)] text-white shadow-xs"
                : "text-[#4a3541] hover:bg-white"
            }`}
          >
            Datos clienta
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        {pendingConflict && (
          <div
            role="alert"
            className="space-y-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-bold">Conflicto de horario detectado</p>
                <p className="mt-0.5">{pendingConflict.message}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => submitFullEdit(true)}
                className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-amber-700 px-3.5 text-xs font-bold text-white hover:bg-amber-800"
              >
                Guardar igual (Sobrecupo / Excepción)
              </button>
              <button
                type="button"
                onClick={() => setPendingConflict(null)}
                className="min-h-9 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950"
              >
                Elegir otra hora
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: CHECKOUT */}
        {tab === "checkout" && (
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-1.5 rounded-2xl border border-[#f2e4eb] p-3 text-xs">
              <p className="font-bold text-[#1f141b]">Servicios incluidos</p>
              {(appointment.items || []).map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.name_snapshot}</span>
                  <span className="font-semibold">{formatClp(it.unit_price_clp)}</span>
                </div>
              ))}
              {extras.map((ex, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[var(--brand-primary)]"
                >
                  <span>+ {ex.name}</span>
                  <span className="flex items-center gap-2 font-semibold">
                    {formatClp(ex.priceClp)}
                    <button
                      type="button"
                      onClick={() => setExtras((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Quitar extra"
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-dashed border-[#d9b8c8] p-3">
              <p className="text-xs font-semibold text-[#1f141b]">
                Agregar extra realizado en mesa (Nail Art, reparación, etc.)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Diseño mano alzada"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  className="min-h-10 flex-1 rounded-xl border border-[#e2cbd7] px-3 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(Number(e.target.value))}
                  className="min-h-10 w-24 rounded-xl border border-[#e2cbd7] px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addExtra}
                  aria-label="Agregar extra"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf0f6] text-[var(--brand-primary)]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Ajuste / descuento (ej. -2000)
                </label>
                <input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(Number(e.target.value))}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Medio de pago saldo</label>
                <select
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Nota del pago (opcional)</label>
              <input
                type="text"
                value={refNote}
                onChange={(e) => setRefNote(e.target.value)}
                placeholder="Ej. Pagado con débito en estudio"
                className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div className="rounded-2xl bg-emerald-50 p-3.5 text-xs text-emerald-950">
              <div className="flex justify-between">
                <span>Total final del servicio:</span>
                <strong>{formatClp(finalTotal)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Ya abonado / pagado:</span>
                <span>-{formatClp(alreadyPaid)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2 text-sm font-bold">
                <span>Saldo a cobrar hoy:</span>
                <span>{formatClp(remainingBalance)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Registrar {formatClp(remainingBalance)} y completar</span>
            </button>
          </form>
        )}

        {/* TAB 2: FULL FLEXIBLE EDIT */}
        {tab === "edit" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitFullEdit(false);
            }}
            className="space-y-4"
          >
            {/* Date + Time + Quick Nudges */}
            <div className="space-y-2.5 rounded-2xl border border-[#f2e4eb] bg-[#fdfafc] p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Fecha</label>
                  <input
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => {
                      setDateStr(e.target.value);
                      setPendingConflict(null);
                    }}
                    className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Hora inicio</label>
                  <input
                    type="time"
                    required
                    value={timeStr}
                    onChange={(e) => {
                      setTimeStr(e.target.value);
                      setPendingConflict(null);
                    }}
                    className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7a6571]">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Correr rápido:
                </span>
                {[-60, -30, -15, 15, 30, 60].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      setTimeStr((prev) => addMinutesToTimeStr(prev, delta));
                      setPendingConflict(null);
                    }}
                    className="min-h-7 rounded-lg border border-[#e2cbd7] bg-white px-2 text-[11px] font-semibold text-[#4a3541] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration + Buffer + Staff */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Duración (min)</label>
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={5}
                  value={durationMin}
                  onChange={(e) => {
                    setAutoSyncDuration(false);
                    setDurationMin(Math.max(15, Number(e.target.value) || 15));
                  }}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {DURATION_PRESETS.slice(0, 6).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAutoSyncDuration(false);
                        setDurationMin(p);
                      }}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        durationMin === p
                          ? "bg-[var(--brand-primary)] text-white"
                          : "bg-[#faf5f8] text-[#5d4754]"
                      }`}
                    >
                      {p}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Buffer limpieza (min)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  value={bufferMin}
                  onChange={(e) => setBufferMin(Math.max(0, Number(e.target.value) || 0))}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Estado</label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value as AppointmentStatus)}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_META[st].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {staff.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-semibold">Profesional asignada</label>
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
            )}

            {/* Service & Addons Swapper */}
            {services.length > 0 && (
              <div className="space-y-2.5 rounded-2xl border border-[#f2e4eb] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1f141b]">
                    Servicio y adicionales
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#6c5763]">
                    <input
                      type="checkbox"
                      checked={autoSyncDuration}
                      onChange={(e) => setAutoSyncDuration(e.target.checked)}
                      className="accent-[var(--brand-primary)]"
                    />
                    <span>Ajustar duración al cambiar</span>
                  </label>
                </div>

                <select
                  value={serviceId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setServiceId(nextId);
                    recalcDurationFromCatalog(nextId, selectedAddonIds);
                  }}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                >
                  <option value="">Mantener servicios actuales</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min · {formatClp(s.price_clp)})
                    </option>
                  ))}
                </select>

                {serviceId && addons.length > 0 && (
                  <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
                    {addons.map((a) => {
                      const checked = selectedAddonIds.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#f2e4eb] bg-[#fdfafc] px-2.5 py-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selectedAddonIds.filter((id) => id !== a.id)
                                : [...selectedAddonIds, a.id];
                              setSelectedAddonIds(next);
                              recalcDurationFromCatalog(serviceId, next);
                            }}
                            className="accent-[var(--brand-primary)]"
                          />
                          <span className="truncate">
                            {a.name} (+{a.duration_minutes}m · {formatClp(a.price_clp)})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">Notas internas</label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Notas privadas del salón..."
                  className="w-full rounded-xl border border-[#e2cbd7] p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Nota de la clienta</label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Comentarios de la clienta..."
                  className="w-full rounded-xl border border-[#e2cbd7] p-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid items-center gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Ajuste manual de precio (CLP)
                </label>
                <input
                  type="number"
                  value={editAdjustment}
                  onChange={(e) => setEditAdjustment(Number(e.target.value) || 0)}
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#faf5f8] p-2.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="accent-[var(--brand-primary)]"
                />
                <span>Avisar cambio de horario por correo (si cambió fecha/hora)</span>
              </label>
            </div>

            <SaveButton fullWidth busy={busy} label="Guardar cambios de la cita" />
          </form>
        )}

        {/* TAB 3: QUICK CLIENT DATA EDIT */}
        {tab === "client" && (
          <form onSubmit={handleClientSave} className="space-y-3.5">
            <p className="text-xs text-[#6c5763]">
              Corrige nombre, WhatsApp, correo o Instagram de la clienta sin salir de la agenda.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">Nombre</label>
                <input
                  type="text"
                  required
                  value={cFirstName}
                  onChange={(e) => setCFirstName(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Apellidos</label>
                <input
                  type="text"
                  value={cLastName}
                  onChange={(e) => setCLastName(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">WhatsApp</label>
                <input
                  type="tel"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">Instagram (opcional)</label>
                <input
                  type="text"
                  value={cIg}
                  onChange={(e) => setCIg(e.target.value)}
                  placeholder="@usuario"
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <SaveButton fullWidth busy={busy} label="Guardar datos de la clienta" />
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
