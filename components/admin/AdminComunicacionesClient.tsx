"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Save, Send, Sparkles } from "lucide-react";
import { saveEmailTemplateAction } from "@/app/actions/adminActions";
import {
  logRetentionWhatsappAction,
  saveRetentionRulesAction,
  sendRetentionEmailBatchAction,
} from "@/app/actions/crmFinanceActions";
import type {
  ClientSummaryRecord,
  EmailLogRecord,
  EmailTemplateRecord,
  RetentionRulesSettings,
} from "@/lib/types";
import { buildWhatsAppUrl, resolveTemplate } from "@/lib/utils";

interface AdminComunicacionesClientProps {
  businessName: string;
  retentionRules: RetentionRulesSettings;
  retentionTemplate: EmailTemplateRecord | null;
  candidates: ClientSummaryRecord[];
  sentToday: number;
  dailyEmailLimit: number;
  transactionalReserve: number;
  resendEnabled: boolean;
  logs: EmailLogRecord[];
}

export function AdminComunicacionesClient({
  businessName,
  retentionRules,
  retentionTemplate,
  candidates,
  sentToday,
  dailyEmailLimit,
  transactionalReserve,
  resendEnabled,
  logs,
}: AdminComunicacionesClientProps) {
  const router = useRouter();
  const [rules, setRules] = useState(retentionRules);
  const [tplSubject, setTplSubject] = useState(retentionTemplate?.subject || "");
  const [tplHeading, setTplHeading] = useState(retentionTemplate?.heading || "");
  const [tplBody, setTplBody] = useState(retentionTemplate?.body_text || "");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nonTransactionalCap = Math.max(0, dailyEmailLimit - transactionalReserve);
  const pctUsed = Math.min(100, Math.round((sentToday / Math.max(1, dailyEmailLimit)) * 100));

  async function saveRetentionConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setToast(null);
    try {
      const r1 = await saveRetentionRulesAction(rules);
      if (!r1.success) return setErrorMsg(r1.error);

      if (retentionTemplate) {
        const r2 = await saveEmailTemplateAction({
          id: retentionTemplate.id,
          subject: tplSubject,
          heading: tplHeading,
          bodyText: tplBody,
          isActive: true,
        });
        if (!r2.success) return setErrorMsg(r2.error);
      }

      setToast("Regla de recordatorio automático guardada.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runBatchNow() {
    if (!resendEnabled) {
      setErrorMsg("Activa primero tu cuenta Resend en Ajustes → Resend y Correos.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setToast(null);
    try {
      const res = await sendRetentionEmailBatchAction();
      if (!res.success) return setErrorMsg(res.error);
      setToast(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
            Comunicaciones y Mantención
          </h1>
          <p className="text-xs text-[#6c5763]">
            Recordatorios automáticos tras XX días desde la última visita + control de cuota Resend.
          </p>
        </div>

        <Link
          href="/admin/settings"
          className="inline-flex min-h-10 items-center rounded-full border border-[#e2cbd7] bg-white px-4 text-xs font-semibold text-[#1f141b]"
        >
          Configurar Resend
        </Link>
      </div>

      {/* Resend Quota Bar */}
      <section className="rounded-3xl border border-[#eedbe4] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <p className="font-bold text-[#1f141b]">
              Cuota diaria Resend: {sentToday} / {dailyEmailLimit} correos hoy
            </p>
            <p className="text-[#6c5763]">
              Cupo disponible para recordatorios/campañas hoy:{" "}
              <strong>{Math.max(0, nonTransactionalCap - sentToday)}</strong> (se reservan{" "}
              {transactionalReserve} para OTP y reservas nuevas).
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              resendEnabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {resendEnabled ? "Resend activo" : "Resend pendiente de activar"}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f5e7ee]">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)]"
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      </section>

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

      {/* Retention XX days rule */}
      <form
        onSubmit={saveRetentionConfig}
        className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
            <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
            Recordatorio automático tras XX días sin visita
          </h2>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={rules.retentionEnabled}
              onChange={(e) =>
                setRules({ ...rules, retentionEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span>Enviar automáticamente en el cron diario</span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">
              Días desde la última cita completada (XX)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={rules.daysSinceLastVisit}
              onChange={(e) =>
                setRules({ ...rules, daysSinceLastVisit: Number(e.target.value) })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">
              No volver a insistir antes de (días)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={rules.cooldownDays}
              onChange={(e) =>
                setRules({ ...rules, cooldownDays: Number(e.target.value) })
              }
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold">
            Mensaje preformateado para WhatsApp (variables: {"{{nombre}}"}, {"{{dias}}"},{" "}
            {"{{servicio}}"}, {"{{negocio}}"}, {"{{link_reserva}}"})
          </label>
          <textarea
            rows={2}
            value={rules.whatsappTemplate}
            onChange={(e) =>
              setRules({ ...rules, whatsappTemplate: e.target.value })
            }
            className="w-full rounded-xl border border-[#e2cbd7] p-3 text-xs"
          />
        </div>

        {retentionTemplate && (
          <div className="space-y-2.5 rounded-2xl border border-[#f2e4eb] bg-[#fdfafc] p-4">
            <p className="text-xs font-bold text-[#1f141b]">
              Plantilla de Correo (cuando Resend esté activo)
            </p>
            <input
              type="text"
              value={tplSubject}
              onChange={(e) => setTplSubject(e.target.value)}
              placeholder="Asunto"
              className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-xs font-semibold"
            />
            <input
              type="text"
              value={tplHeading}
              onChange={(e) => setTplHeading(e.target.value)}
              placeholder="Encabezado"
              className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-xs"
            />
            <textarea
              rows={2}
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              className="w-full rounded-xl border border-[#e2cbd7] bg-white p-2.5 text-xs"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          <span>Guardar configuración</span>
        </button>
      </form>

      {/* Eligible Candidates Today */}
      <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#1f141b]">
              Clientas listas para mantención hoy ({candidates.length})
            </h2>
            <p className="text-xs text-[#6c5763]">
              Cumplen +{rules.daysSinceLastVisit} días desde su última cita y no tienen otra agendada.
            </p>
          </div>
          {candidates.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={runBatchNow}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1f141b] px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar lote por correo</span>
            </button>
          )}
        </div>

        {candidates.length === 0 ? (
          <p className="text-xs text-[#7a6571]">
            Ninguna clienta cumple los {rules.daysSinceLastVisit} días todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => {
              const msg = resolveTemplate(rules.whatsappTemplate, {
                nombre: c.first_name,
                dias: c.daysSinceLastVisit || rules.daysSinceLastVisit,
                servicio: c.lastServiceName || "tu última atención",
                negocio: businessName,
                link_reserva: `${typeof window !== "undefined" ? window.location.origin : ""}/reservar`,
              });
              const waUrl = c.phone ? buildWhatsAppUrl(c.phone, msg) : null;

              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#f2e4eb] px-4 py-3 text-xs"
                >
                  <div>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-sm font-bold text-[#1f141b] hover:text-[var(--brand-primary)]"
                    >
                      {c.first_name} {c.last_name || ""}
                    </Link>
                    <p className="text-[#6c5763]">
                      Hace <strong>{c.daysSinceLastVisit} días</strong> ·{" "}
                      {c.lastServiceName || "Servicio"}
                    </p>
                  </div>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (c.daysSinceLastVisit !== null) {
                          logRetentionWhatsappAction(c.id, c.daysSinceLastVisit);
                        }
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Recordar por WhatsApp</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Email Logs */}
      <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
          <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
          Historial reciente de correos
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-[#7a6571]">Aún no hay envíos registrados.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#faf5f8] px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#1f141b]">{log.recipient_email}</p>
                  <p className="text-[11px] text-[#6c5763]">
                    {log.template_key} ·{" "}
                    {new Date(log.sent_at).toLocaleString("es-CL")}
                  </p>
                  {log.error_message && (
                    <p className="text-[11px] text-red-700">{log.error_message}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-semibold ${
                    log.status === "sent"
                      ? "bg-emerald-50 text-emerald-700"
                      : log.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
