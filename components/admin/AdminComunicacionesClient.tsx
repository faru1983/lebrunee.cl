"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Cake,
  CalendarClock,
  History,
  Mail,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { saveEmailTemplateAction } from "@/app/actions/adminActions";
import {
  logBirthdayWhatsappAction,
  logRetentionWhatsappAction,
  saveAppointmentReminderToggleAction,
  saveBirthdayRulesAction,
  saveRetentionRulesAction,
  sendBirthdayEmailBatchAction,
  sendRetentionEmailBatchAction,
} from "@/app/actions/crmFinanceActions";
import type {
  BirthdayRulesSettings,
  ClientSummaryRecord,
  EmailLogRecord,
  EmailTemplateRecord,
  RetentionRulesSettings,
} from "@/lib/types";
import { buildWhatsAppUrl, formatDateDdMmYyyy, resolveTemplate } from "@/lib/utils";

export type CommsTabKey = "citas" | "mantencion" | "cumpleanos" | "historial";

interface TemplateDraft {
  id: string;
  subject: string;
  heading: string;
  bodyText: string;
  isActive: boolean;
}

function makeDraft(tpl: EmailTemplateRecord | null): TemplateDraft | null {
  if (!tpl) return null;
  return {
    id: tpl.id,
    subject: tpl.subject,
    heading: tpl.heading,
    bodyText: tpl.body_text,
    isActive: tpl.is_active,
  };
}

function formatBirthDateCl(iso: string | null): string {
  return formatDateDdMmYyyy(iso);
}

function TemplateEditorFields({
  title,
  variablesHint,
  draft,
  onChange,
}: {
  title: string;
  variablesHint: string;
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
}) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-[#f2e4eb] bg-[#fdfafc] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#1f141b]">{title}</p>
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => onChange({ ...draft, isActive: e.target.checked })}
            className="h-4 w-4 accent-[var(--brand-primary)]"
          />
          <span>Plantilla activa</span>
        </label>
      </div>
      <p className="text-[11px] text-[#6c5763]">Variables: {variablesHint}</p>
      <input
        type="text"
        value={draft.subject}
        onChange={(e) => onChange({ ...draft, subject: e.target.value })}
        placeholder="Asunto"
        className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-xs font-semibold"
      />
      <input
        type="text"
        value={draft.heading}
        onChange={(e) => onChange({ ...draft, heading: e.target.value })}
        placeholder="Encabezado"
        className="min-h-10 w-full rounded-xl border border-[#e2cbd7] bg-white px-3 text-xs"
      />
      <textarea
        rows={2}
        value={draft.bodyText}
        onChange={(e) => onChange({ ...draft, bodyText: e.target.value })}
        className="w-full rounded-xl border border-[#e2cbd7] bg-white p-2.5 text-xs"
      />
    </div>
  );
}

interface AdminComunicacionesClientProps {
  businessName: string;
  initialTab?: CommsTabKey;
  autoRemindersEnabled: boolean;
  reminderUpcomingTemplate: EmailTemplateRecord | null;
  retentionRules: RetentionRulesSettings;
  retentionTemplate: EmailTemplateRecord | null;
  candidates: ClientSummaryRecord[];
  birthdayRules: BirthdayRulesSettings;
  birthdayTemplate: EmailTemplateRecord | null;
  birthdayDueToday: ClientSummaryRecord[];
  upcomingBirthdays: Array<ClientSummaryRecord & { daysUntilBirthday: number }>;
  sentToday: number;
  dailyEmailLimit: number;
  transactionalReserve: number;
  resendEnabled: boolean;
  logs: EmailLogRecord[];
}

export function AdminComunicacionesClient({
  businessName,
  initialTab = "citas",
  autoRemindersEnabled,
  reminderUpcomingTemplate,
  retentionRules,
  retentionTemplate,
  candidates,
  birthdayRules,
  birthdayTemplate,
  birthdayDueToday,
  upcomingBirthdays,
  sentToday,
  dailyEmailLimit,
  transactionalReserve,
  resendEnabled,
  logs,
}: AdminComunicacionesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<CommsTabKey>(initialTab);

  function handleSelectTab(nextTab: CommsTabKey) {
    setTab(nextTab);
    setToast(null);
    setErrorMsg(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", nextTab);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    }
  }

  // Tab 1: Citas
  const [autoReminders, setAutoReminders] = useState(autoRemindersEnabled);
  const [reminderDraft, setReminderDraft] = useState<TemplateDraft | null>(() =>
    makeDraft(reminderUpcomingTemplate)
  );

  // Tab 2: Mantención
  const [rules, setRules] = useState(retentionRules);
  const [retentionDraft, setRetentionDraft] = useState<TemplateDraft | null>(() =>
    makeDraft(retentionTemplate)
  );

  // Tab 3: Cumpleaños
  const [bdayRules, setBdayRules] = useState(birthdayRules);
  const [bdayDraft, setBdayDraft] = useState<TemplateDraft | null>(() =>
    makeDraft(birthdayTemplate)
  );

  const [busy, setBusy] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [lastSavedKey, setLastSavedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function notifyOk(msg: string, savedKey: string) {
    setErrorMsg(null);
    setToast(msg);
    setLastSavedKey(savedKey);
    window.setTimeout(() => {
      setLastSavedKey((cur) => (cur === savedKey ? null : cur));
    }, 3000);
    router.refresh();
  }

  const nonTransactionalCap = Math.max(0, dailyEmailLimit - transactionalReserve);
  const pctUsed = Math.min(100, Math.round((sentToday / Math.max(1, dailyEmailLimit)) * 100));

  async function saveCitasConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavingKey("citas");
    setErrorMsg(null);
    setToast(null);
    try {
      const r1 = await saveAppointmentReminderToggleAction({
        autoRemindersEnabled: autoReminders,
      });
      if (!r1.success) return setErrorMsg(r1.error);

      if (reminderDraft) {
        const r2 = await saveEmailTemplateAction(reminderDraft);
        if (!r2.success) return setErrorMsg(r2.error);
      }
      notifyOk("Recordatorios de citas actualizados.", "citas");
    } finally {
      setBusy(false);
      setSavingKey(null);
    }
  }

  async function saveRetentionConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavingKey("mantencion");
    setErrorMsg(null);
    setToast(null);
    try {
      const r1 = await saveRetentionRulesAction(rules);
      if (!r1.success) return setErrorMsg(r1.error);

      if (retentionDraft) {
        const r2 = await saveEmailTemplateAction(retentionDraft);
        if (!r2.success) return setErrorMsg(r2.error);
      }

      notifyOk("Regla de recordatorio de mantención guardada.", "mantencion");
    } finally {
      setBusy(false);
      setSavingKey(null);
    }
  }

  async function saveBirthdayConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavingKey("cumpleanos");
    setErrorMsg(null);
    setToast(null);
    try {
      const r1 = await saveBirthdayRulesAction(bdayRules);
      if (!r1.success) return setErrorMsg(r1.error);

      if (bdayDraft) {
        const r2 = await saveEmailTemplateAction(bdayDraft);
        if (!r2.success) return setErrorMsg(r2.error);
      }

      notifyOk("Automatización de regalo de cumpleaños guardada.", "cumpleanos");
    } finally {
      setBusy(false);
      setSavingKey(null);
    }
  }

  async function runRetentionBatchNow() {
    if (!resendEnabled) {
      setErrorMsg("Activa primero tu cuenta Resend en Ajustes → Resend y Correos.");
      return;
    }
    setBusy(true);
    setSavingKey("batch-mantencion");
    setErrorMsg(null);
    setToast(null);
    try {
      const res = await sendRetentionEmailBatchAction();
      if (!res.success) return setErrorMsg(res.error);
      notifyOk(res.message, "batch-mantencion");
    } finally {
      setBusy(false);
      setSavingKey(null);
    }
  }

  async function runBirthdayBatchNow() {
    if (!resendEnabled) {
      setErrorMsg("Activa primero tu cuenta Resend en Ajustes → Resend y Correos.");
      return;
    }
    setBusy(true);
    setSavingKey("batch-cumpleanos");
    setErrorMsg(null);
    setToast(null);
    try {
      const res = await sendBirthdayEmailBatchAction();
      if (!res.success) return setErrorMsg(res.error);
      notifyOk(res.message, "batch-cumpleanos");
    } finally {
      setBusy(false);
      setSavingKey(null);
    }
  }

  const bookingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/reservar` : "/reservar";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
            Comunicaciones y CRM
          </h1>
          <p className="text-xs text-[#6c5763]">
            Recordatorios de citas, mantención tras XX días, regalo de cumpleaños e historial Resend.
          </p>
        </div>

        <Link
          href="/admin/settings?tab=resend"
          className="inline-flex min-h-10 items-center rounded-full border border-[#e2cbd7] bg-white px-4 text-xs font-semibold text-[#1f141b]"
        >
          Configurar Resend
        </Link>
      </div>

      {/* URL-Synced Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            {
              id: "citas",
              label: "Recordatorios de Citas",
              icon: CalendarClock,
              badge: 0,
            },
            {
              id: "mantencion",
              label: "Mantención (XX días)",
              icon: Sparkles,
              badge: candidates.length,
            },
            {
              id: "cumpleanos",
              label: "Cumpleaños",
              icon: Cake,
              badge: birthdayDueToday.length,
            },
            {
              id: "historial",
              label: "Historial y Cuota",
              icon: History,
              badge: 0,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--brand-primary)] text-white shadow-xs"
                  : "border border-[#eedbe4] bg-white text-[#4a3541]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/25 text-white" : "bg-[#f6e8ef] text-[var(--brand-primary)]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
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

      {/* TAB 1: CITAS */}
      {tab === "citas" && (
        <form
          onSubmit={saveCitasConfig}
          className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
                <CalendarClock className="h-4 w-4 text-[var(--brand-primary)]" />
                Recordatorio automático de cita próxima
              </h2>
              <p className="text-xs text-[#6c5763]">
                El cron diario envía un aviso por correo (24h / 48h antes) a las reservas confirmadas.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={autoReminders}
                onChange={(e) => setAutoReminders(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand-primary)]"
              />
              <span>Activar recordatorios diarios</span>
            </label>
          </div>

          {reminderDraft && (
            <TemplateEditorFields
              title="Plantilla de correo: Recordatorio de cita"
              variablesHint="{{nombre}}, {{servicio}}, {{fecha}}, {{hora}}, {{direccion}}, {{negocio}}"
              draft={reminderDraft}
              onChange={setReminderDraft}
            />
          )}

          <SaveButton
            busy={savingKey === "citas"}
            saved={lastSavedKey === "citas"}
            disabled={busy}
            label="Guardar recordatorio de citas"
          />
        </form>
      )}

      {/* TAB 2: MANTENCIÓN */}
      {tab === "mantencion" && (
        <div className="space-y-6">
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

            {retentionDraft && (
              <TemplateEditorFields
                title="Plantilla de Correo (cuando Resend esté activo)"
                variablesHint="{{nombre}}, {{dias}}, {{servicio}}, {{negocio}}, {{link_reserva}}"
                draft={retentionDraft}
                onChange={setRetentionDraft}
              />
            )}

            <SaveButton
              busy={savingKey === "mantencion"}
              saved={lastSavedKey === "mantencion"}
              disabled={busy}
              label="Guardar configuración"
            />
          </form>

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
                <SaveButton
                  type="button"
                  variant="dark"
                  icon="send"
                  busy={savingKey === "batch-mantencion"}
                  saved={lastSavedKey === "batch-mantencion"}
                  disabled={busy}
                  onClick={runRetentionBatchNow}
                  label="Enviar lote por correo"
                  busyLabel="Enviando..."
                  savedLabel="¡Lote enviado!"
                />
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
                    link_reserva: bookingUrl,
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
        </div>
      )}

      {/* TAB 3: CUMPLEAÑOS */}
      {tab === "cumpleanos" && (
        <div className="space-y-6">
          <form
            onSubmit={saveBirthdayConfig}
            className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
                  <Cake className="h-4 w-4 text-[var(--brand-primary)]" />
                  Regalo de Cumpleaños Automático
                </h2>
                <p className="text-xs text-[#6c5763]">
                  Se envía una vez al año según la fecha de cumpleaños registrada (Día + Mes + Año).
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={bdayRules.birthdayEnabled}
                  onChange={(e) =>
                    setBdayRules({ ...bdayRules, birthdayEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                <span>Enviar automáticamente en el cron diario</span>
              </label>
            </div>

            <div className="max-w-xs">
              <label className="mb-1 block text-xs font-semibold">
                Días de anticipación (0 = el mismo día)
              </label>
              <input
                type="number"
                min={0}
                max={14}
                value={bdayRules.daysBefore}
                onChange={(e) =>
                  setBdayRules({ ...bdayRules, daysBefore: Number(e.target.value) })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">
                Mensaje de cumpleaños para WhatsApp (variables: {"{{nombre}}"},{" "}
                {"{{negocio}}"}, {"{{link_reserva}}"})
              </label>
              <textarea
                rows={2}
                value={bdayRules.whatsappTemplate}
                onChange={(e) =>
                  setBdayRules({ ...bdayRules, whatsappTemplate: e.target.value })
                }
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-xs"
              />
            </div>

            {bdayDraft && (
              <TemplateEditorFields
                title="Plantilla de Correo: Regalo de Cumpleaños"
                variablesHint="{{nombre}}, {{negocio}}, {{link_reserva}}"
                draft={bdayDraft}
                onChange={setBdayDraft}
              />
            )}

            <SaveButton
              busy={savingKey === "cumpleanos"}
              saved={lastSavedKey === "cumpleanos"}
              disabled={busy}
              label="Guardar regla de cumpleaños"
            />
          </form>

          {/* Elegibles hoy */}
          <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1f141b]">
                  Cumpleaños para saludar hoy ({birthdayDueToday.length})
                </h2>
                <p className="text-xs text-[#6c5763]">
                  Clientas cuya fecha objetivo coincide con hoy ({bdayRules.daysBefore === 0 ? "mismo día" : `${bdayRules.daysBefore} día(s) antes`}) y aún no reciben su saludo este año.
                </p>
              </div>
              {birthdayDueToday.length > 0 && (
                <SaveButton
                  type="button"
                  variant="dark"
                  icon="send"
                  busy={savingKey === "batch-cumpleanos"}
                  saved={lastSavedKey === "batch-cumpleanos"}
                  disabled={busy}
                  onClick={runBirthdayBatchNow}
                  label="Enviar regalos por correo"
                  busyLabel="Enviando..."
                  savedLabel="¡Regalos enviados!"
                />
              )}
            </div>

            {birthdayDueToday.length === 0 ? (
              <p className="text-xs text-[#7a6571]">
                No hay cumpleaños pendientes por saludar hoy.
              </p>
            ) : (
              <div className="space-y-2">
                {birthdayDueToday.map((c) => {
                  const msg = resolveTemplate(bdayRules.whatsappTemplate, {
                    nombre: c.first_name,
                    negocio: businessName,
                    link_reserva: bookingUrl,
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
                          Cumpleaños: <strong>{formatBirthDateCl(c.birth_date)}</strong>
                          {c.email ? ` · ${c.email}` : ""}
                        </p>
                      </div>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => logBirthdayWhatsappAction(c.id)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Saludar por WhatsApp</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Próximos 14 días */}
          <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <h2 className="text-base font-bold text-[#1f141b]">
              Próximos cumpleaños (próximos 14 días)
            </h2>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-[#7a6571]">
                Sin cumpleaños registrados en las próximas dos semanas.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingBirthdays.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#faf5f8] px-4 py-2.5 text-xs"
                  >
                    <div>
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-bold text-[#1f141b] hover:text-[var(--brand-primary)]"
                      >
                        {c.first_name} {c.last_name || ""}
                      </Link>
                      <p className="text-[11px] text-[#6c5763]">
                        {formatBirthDateCl(c.birth_date)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--brand-primary)]">
                      {c.daysUntilBirthday === 0
                        ? "¡Hoy!"
                        : `En ${c.daysUntilBirthday} día(s)`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: HISTORIAL Y CUOTA */}
      {tab === "historial" && (
        <div className="space-y-6">
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
      )}
    </div>
  );
}
