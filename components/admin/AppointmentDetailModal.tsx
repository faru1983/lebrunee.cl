"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, Trash2, User } from "lucide-react";
import {
  adminUpdateAppointmentAction,
  closeAppointmentWithPaymentAction,
} from "@/app/actions/crmFinanceActions";
import { SaveButton } from "@/components/ui/SaveButton";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { AppointmentRecord, PaymentMethodRecord } from "@/lib/types";
import { formatClp } from "@/lib/utils";

interface AppointmentDetailModalProps {
  appointment: AppointmentRecord | null;
  onClose: () => void;
  onUpdated: () => void;
  paymentMethods: PaymentMethodRecord[];
}

export function AppointmentDetailModal({
  appointment,
  onClose,
  onUpdated,
  paymentMethods,
}: AppointmentDetailModalProps) {
  const [tab, setTab] = useState<"checkout" | "edit">(
    appointment?.status === "confirmed" ? "checkout" : "edit"
  );

  // Checkout state
  const [extras, setExtras] = useState<Array<{ name: string; priceClp: number }>>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState(5000);
  const [adjustment, setAdjustment] = useState(appointment?.manual_adjustment_clp || 0);
  const [methodId, setMethodId] = useState(paymentMethods[0]?.id || "");
  const [refNote, setRefNote] = useState("");

  // Edit state
  const [dateStr, setDateStr] = useState(appointment?.appointment_date || "");
  const [timeStr, setTimeStr] = useState(appointment?.start_time.slice(0, 5) || "10:00");
  const [adminNotes, setAdminNotes] = useState(appointment?.admin_notes || "");

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

  function addExtra() {
    if (!extraName.trim()) return;
    setExtras((prev) => [...prev, { name: extraName.trim(), priceClp: Number(extraPrice) || 0 }]);
    setExtraName("");
    setExtraPrice(5000);
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
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await adminUpdateAppointmentAction({
        appointmentId: appointment.id,
        appointmentDate: dateStr,
        startTime: timeStr,
        adminNotes,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalDialog
      open={Boolean(appointment)}
      onClose={onClose}
      title={`Cita ${appointment.booking_code} · ${appointment.client?.first_name || ""}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#faf5f8] p-3 text-xs">
          <div>
            <p className="font-bold text-[#1f141b]">
              {appointment.client?.first_name} {appointment.client?.last_name || ""}
            </p>
            <p className="text-[#6c5763]">{appointment.client?.email}</p>
          </div>
          {appointment.client?.id && (
            <Link
              href={`/admin/clients/${appointment.client.id}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#e2cbd7] bg-white px-3 font-semibold text-[var(--brand-primary)]"
            >
              <User className="h-3.5 w-3.5" />
              <span>Ver ficha</span>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("checkout")}
            className={`min-h-10 rounded-xl text-xs font-semibold ${
              tab === "checkout"
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[#eedbe4] bg-white text-[#4a3541]"
            }`}
          >
            Cerrar y cobrar saldo
          </button>
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`min-h-10 rounded-xl text-xs font-semibold ${
              tab === "edit"
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[#eedbe4] bg-white text-[#4a3541]"
            }`}
          >
            Editar / Reprogramar
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        {tab === "checkout" ? (
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
                <div key={idx} className="flex items-center justify-between text-[var(--brand-primary)]">
                  <span>+ {ex.name}</span>
                  <span className="flex items-center gap-2 font-semibold">
                    {formatClp(ex.priceClp)}
                    <button
                      type="button"
                      onClick={() =>
                        setExtras((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Quitar extra"
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {/* Add extra in chair */}
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
                  <Plus className="h-4 w-4" />
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Registrar {formatClp(remainingBalance)} y completar</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleEdit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Fecha</label>
                <input
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Hora inicio</label>
                <input
                  type="time"
                  required
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Notas internas</label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas privadas de la cita..."
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>

            {appointment.client_notes && (
              <div className="rounded-xl bg-[#faf5f8] p-3 text-xs text-[#5d4754]">
                <strong>Nota de la clienta:</strong> {appointment.client_notes}
              </div>
            )}

            <SaveButton
              fullWidth
              busy={busy}
              label="Guardar cambios de cita"
            />
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
