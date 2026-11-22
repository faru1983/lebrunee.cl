"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  addExpenseAction,
  deleteExpenseAction,
  recordDirectSaleAction,
} from "@/app/actions/crmFinanceActions";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type {
  ExpenseRecord,
  PaymentMethodRecord,
  PaymentRecord,
} from "@/lib/types";
import { formatClp } from "@/lib/utils";

interface AdminFinanzasClientProps {
  today: string;
  finance: {
    monthIso: string;
    totalRevenueClp: number;
    totalExpensesClp: number;
    netProfitClp: number;
    pendingBalanceClp: number;
    payments: PaymentRecord[];
    expenses: ExpenseRecord[];
    byMethod: Array<{ name: string; totalClp: number }>;
    topServices: Array<{ name: string; count: number; totalClp: number }>;
  };
  paymentMethods: PaymentMethodRecord[];
  expenseCategories: string[];
}

export function AdminFinanzasClient({
  today,
  finance,
  paymentMethods,
  expenseCategories,
}: AdminFinanzasClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "ingresos" | "gastos">("resumen");
  const [saleModal, setSaleModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);

  // Direct sale form
  const [saleAmount, setSaleAmount] = useState(10000);
  const [saleMethodId, setSaleMethodId] = useState(paymentMethods[0]?.id || "");
  const [saleNote, setSaleNote] = useState("");

  // Expense form
  const [expDate, setExpDate] = useState(today);
  const [expCat, setExpCat] = useState(expenseCategories[0] || "Otros");
  const [expAmount, setExpAmount] = useState(0);
  const [expDesc, setExpDesc] = useState("");
  const [expMethodId, setExpMethodId] = useState(paymentMethods[0]?.id || "");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function submitDirectSale(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await recordDirectSaleAction({
        amountClp: Number(saleAmount),
        paymentMethodId: saleMethodId || null,
        clientId: null,
        referenceNote: saleNote,
      });
      if (res.success) {
        setSaleModal(false);
        setSaleNote("");
        setToast("Venta registrada.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await addExpenseAction({
        expenseDate: expDate,
        category: expCat,
        description: expDesc,
        amountClp: Number(expAmount),
        paymentMethodId: expMethodId || null,
      });
      if (res.success) {
        setExpenseModal(false);
        setExpAmount(0);
        setExpDesc("");
        setToast("Gasto registrado.");
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
            Finanzas y Caja
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-[#6c5763]">
            <label htmlFor="month-picker">Mes:</label>
            <input
              id="month-picker"
              type="month"
              value={finance.monthIso}
              onChange={(e) => {
                if (e.target.value) {
                  router.push(`/admin/finanzas?month=${e.target.value}`);
                }
              }}
              className="rounded-lg border border-[#e2cbd7] bg-white px-2 py-1 text-xs font-semibold text-[#1f141b]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setExpenseModal(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#e2cbd7] bg-white px-3.5 text-xs font-semibold text-[#1f141b]"
          >
            <Plus className="h-3.5 w-3.5 text-red-600" />
            <span>Gasto</span>
          </button>
          <button
            type="button"
            onClick={() => setSaleModal(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Venta rápida</span>
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {toast}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#eedbe4] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] font-medium text-[#6c5763]">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            Ingresos reales
          </p>
          <p className="mt-1 text-xl font-bold text-[#1f141b]">
            {formatClp(finance.totalRevenueClp)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#eedbe4] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] font-medium text-[#6c5763]">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
            Gastos del mes
          </p>
          <p className="mt-1 text-xl font-bold text-[#1f141b]">
            {formatClp(finance.totalExpensesClp)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <TrendingUp className="h-3.5 w-3.5" />
            Utilidad neta
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-950">
            {formatClp(finance.netProfitClp)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#eedbe4] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] font-medium text-[#6c5763]">
            <Wallet className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            Saldos por cobrar
          </p>
          <p className="mt-1 text-xl font-bold text-[#1f141b]">
            {formatClp(finance.pendingBalanceClp)}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(
          [
            { id: "resumen", label: "Resumen" },
            { id: "ingresos", label: `Ingresos (${finance.payments.length})` },
            { id: "gastos", label: `Gastos (${finance.expenses.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-10 rounded-full px-4 text-xs font-semibold ${
              tab === item.id
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[#eedbe4] bg-white text-[#4a3541]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <h2 className="text-sm font-bold text-[#1f141b]">Por medio de pago</h2>
            {finance.byMethod.length === 0 ? (
              <p className="text-xs text-[#7a6571]">Sin ingresos registrados este mes.</p>
            ) : (
              <div className="space-y-2.5">
                {finance.byMethod.map((m) => {
                  const pct =
                    finance.totalRevenueClp > 0
                      ? Math.round((m.totalClp / finance.totalRevenueClp) * 100)
                      : 0;
                  return (
                    <div key={m.name} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>{m.name}</span>
                        <strong>
                          {formatClp(m.totalClp)} ({pct}%)
                        </strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f5e7ee]">
                        <div
                          className="h-full rounded-full bg-[var(--brand-primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <h2 className="text-sm font-bold text-[#1f141b]">Servicios más solicitados</h2>
            {finance.topServices.length === 0 ? (
              <p className="text-xs text-[#7a6571]">Sin citas confirmadas este mes.</p>
            ) : (
              <div className="space-y-2">
                {finance.topServices.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-2xl bg-[#faf5f8] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#1f141b]">{s.name}</p>
                      <p className="text-[#6c5763]">{s.count} citas</p>
                    </div>
                    <strong className="text-[#1f141b]">{formatClp(s.totalClp)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "ingresos" && (
        <div className="space-y-2.5">
          {finance.payments.length === 0 ? (
            <div className="rounded-3xl border border-[#eedbe4] bg-white p-8 text-center text-sm text-[#6c5763]">
              No hay ingresos registrados en este mes.
            </div>
          ) : (
            finance.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-[#eedbe4] bg-white px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-bold text-[#1f141b]">
                    {p.reference_note || "Pago recibido"}
                  </p>
                  <p className="text-[#6c5763]">
                    {new Date(p.paid_at).toLocaleDateString("es-CL")} ·{" "}
                    {p.payment_method?.name || "Sin medio"} ·{" "}
                    {p.client
                      ? `${p.client.first_name} ${p.client.last_name || ""}`
                      : "Venta directa"}
                  </p>
                </div>
                <strong className="text-sm text-emerald-700">
                  +{formatClp(p.amount_clp)}
                </strong>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "gastos" && (
        <div className="space-y-2.5">
          {finance.expenses.length === 0 ? (
            <div className="rounded-3xl border border-[#eedbe4] bg-white p-8 text-center text-sm text-[#6c5763]">
              No hay gastos registrados en este mes.
            </div>
          ) : (
            finance.expenses.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-[#eedbe4] bg-white px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-bold text-[#1f141b]">{ex.category}</p>
                  <p className="text-[#6c5763]">
                    {ex.expense_date}
                    {ex.description ? ` · ${ex.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <strong className="text-sm text-red-700">
                    -{formatClp(ex.amount_clp)}
                  </strong>
                  <button
                    type="button"
                    aria-label="Eliminar gasto"
                    onClick={async () => {
                      if (!window.confirm("¿Eliminar este gasto?")) return;
                      await deleteExpenseAction(ex.id);
                      router.refresh();
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Direct Sale Modal */}
      <ModalDialog
        open={saleModal}
        onClose={() => setSaleModal(false)}
        title="Registrar venta rápida"
      >
        <form onSubmit={submitDirectSale} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold">Detalle / Concepto</label>
            <input
              type="text"
              required
              value={saleNote}
              onChange={(e) => setSaleNote(e.target.value)}
              placeholder="Ej. Aceite de cutículas / Gift card"
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Monto (CLP)</label>
              <input
                type="number"
                min={1}
                required
                value={saleAmount}
                onChange={(e) => setSaleAmount(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Medio de pago</label>
              <select
                value={saleMethodId}
                onChange={(e) => setSaleMethodId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white"
          >
            {busy ? "Guardando..." : "Registrar ingreso"}
          </button>
        </form>
      </ModalDialog>

      {/* Expense Modal */}
      <ModalDialog
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title="Registrar gasto"
      >
        <form onSubmit={submitExpense} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Fecha</label>
              <input
                type="date"
                required
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Categoría</label>
              <select
                value={expCat}
                onChange={(e) => setExpCat(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Monto (CLP)</label>
              <input
                type="number"
                min={1}
                required
                value={expAmount}
                onChange={(e) => setExpAmount(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Medio de pago</label>
              <select
                value={expMethodId}
                onChange={(e) => setExpMethodId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
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
            <label className="mb-1 block text-xs font-semibold">Descripción (opcional)</label>
            <input
              type="text"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder="Ej. Esmaltes nuevos + limas"
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-full bg-[#1f141b] text-sm font-semibold text-white"
          >
            {busy ? "Guardando..." : "Guardar gasto"}
          </button>
        </form>
      </ModalDialog>
    </div>
  );
}
