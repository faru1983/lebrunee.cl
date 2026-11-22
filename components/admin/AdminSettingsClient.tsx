"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Mail,
  MapPin,
  Save,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  createBusinessMemberAction,
  saveEmailTemplateAction,
  saveResendIntegrationAction,
  saveSettingsSectionAction,
  sendTestEmailAction,
  toggleBusinessMemberAction,
} from "@/app/actions/adminActions";
import type { ResendIntegrationView } from "@/lib/services/emailService";
import type {
  BusinessMemberRecord,
  BusinessPublicBundle,
  EmailTemplateRecord,
  MemberRole,
  PrivateLocationSettings,
} from "@/lib/types";

interface AdminSettingsClientProps {
  bundle: BusinessPublicBundle;
  privateLocation: PrivateLocationSettings;
  resendView: ResendIntegrationView;
  members: BusinessMemberRecord[];
  templates: EmailTemplateRecord[];
  currentMemberRole: MemberRole;
}

type TabKey = "brand" | "location" | "bank" | "email" | "team";

export function AdminSettingsClient({
  bundle,
  privateLocation,
  resendView,
  members,
  templates,
  currentMemberRole,
}: AdminSettingsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("brand");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Brand & Landing
  const [bizName, setBizName] = useState(bundle.business.name);
  const [bizTagline, setBizTagline] = useState(bundle.business.tagline || "");
  const [branding, setBranding] = useState(bundle.branding);
  const [landing, setLanding] = useState(bundle.landingContent);

  // 2. Contact & Location
  const [contactPublic, setContactPublic] = useState(bundle.contactPublic);
  const [privLoc, setPrivLoc] = useState(privateLocation);

  // 3. Bank & Policies
  const [paymentBank, setPaymentBank] = useState(bundle.paymentBank);
  const [policies, setPolicies] = useState(bundle.policies);

  // 4. Resend & Notifications
  const [resendEnabled, setResendEnabled] = useState(resendView.isEnabled);
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState(resendView.fromEmail);
  const [resendFromName, setResendFromName] = useState(resendView.fromName);
  const [resendReplyTo, setResendReplyTo] = useState(resendView.replyTo);
  const [testEmailTo, setTestEmailTo] = useState(bundle.contactPublic.adminNotificationEmail);
  const [notifications, setNotifications] = useState(bundle.notifications);
  const [templateEdits, setTemplateEdits] = useState(templates);

  // 5. Team
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPass, setNewMemberPass] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "staff">("admin");

  function notifyOk(msg: string) {
    setErrorMsg(null);
    setToast(msg);
    router.refresh();
  }

  async function saveBrandTab(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r1 = await saveSettingsSectionAction({
        businessProfile: { name: bizName, tagline: bizTagline },
        category: "branding",
        key: "branding",
        value: branding as unknown as Record<string, unknown>,
      });
      const r2 = await saveSettingsSectionAction({
        category: "landing",
        key: "landing_content",
        value: landing as unknown as Record<string, unknown>,
      });
      if (!r1.success) return setErrorMsg(r1.error);
      if (!r2.success) return setErrorMsg(r2.error);
      notifyOk("Marca y textos de la landing actualizados.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLocationTab(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r1 = await saveSettingsSectionAction({
        category: "landing",
        key: "contact_public",
        value: contactPublic as unknown as Record<string, unknown>,
      });
      const r2 = await saveSettingsSectionAction({
        category: "private_location",
        key: "private_location",
        value: privLoc as unknown as Record<string, unknown>,
      });
      if (!r1.success) return setErrorMsg(r1.error);
      if (!r2.success) return setErrorMsg(r2.error);
      notifyOk("Ubicación pública, dirección privada y contacto guardados.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBankTab(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r1 = await saveSettingsSectionAction({
        category: "payment",
        key: "payment_bank",
        value: paymentBank as unknown as Record<string, unknown>,
      });
      const r2 = await saveSettingsSectionAction({
        category: "policies",
        key: "policies",
        value: policies as unknown as Record<string, unknown>,
      });
      if (!r1.success) return setErrorMsg(r1.error);
      if (!r2.success) return setErrorMsg(r2.error);
      notifyOk("Datos bancarios y políticas guardadas.");
    } finally {
      setBusy(false);
    }
  }

  async function saveResendTab(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r1 = await saveResendIntegrationAction({
        isEnabled: resendEnabled,
        apiKey: resendApiKey || undefined,
        fromEmail: resendFromEmail,
        fromName: resendFromName,
        replyTo: resendReplyTo,
      });
      const r2 = await saveSettingsSectionAction({
        category: "notifications",
        key: "notifications",
        value: notifications as unknown as Record<string, unknown>,
      });
      if (!r1.success) return setErrorMsg(r1.error);
      if (!r2.success) return setErrorMsg(r2.error);
      setResendApiKey("");
      notifyOk("Configuración de Resend y recordatorios guardada.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestEmail() {
    if (!testEmailTo) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await sendTestEmailAction(testEmailTo);
      if (!res.ok) setErrorMsg(res.message);
      else notifyOk(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await createBusinessMemberAction({
        displayName: newMemberName,
        email: newMemberEmail,
        password: newMemberPass,
        role: newMemberRole,
      });
      if (!res.success) return setErrorMsg(res.error);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberPass("");
      notifyOk("Perfil creado correctamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
          Configuración del Negocio
        </h1>
        <p className="text-xs text-[#6c5763]">
          Cerebro central: personaliza tu marca, dirección privada, banco, correos y cuentas sin tocar código.
        </p>
      </div>

      {/* Scrollable Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "brand", label: "Marca y Landing", icon: Building2 },
            { id: "location", label: "Ubicación", icon: MapPin },
            { id: "bank", label: "Banco y Políticas", icon: CreditCard },
            { id: "email", label: "Resend y Correos", icon: Mail },
            { id: "team", label: "Equipo", icon: Users },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setToast(null);
                setErrorMsg(null);
              }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--brand-primary)] text-white shadow-xs"
                  : "border border-[#eedbe4] bg-white text-[#4a3541]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
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

      {/* TAB 1: BRAND & LANDING */}
      {tab === "brand" && (
        <form onSubmit={saveBrandTab} className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Nombre del salón</label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Subtítulo / Tagline</label>
              <input
                type="text"
                value={bizTagline}
                onChange={(e) => setBizTagline(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Color principal</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="h-11 w-14 rounded-xl border border-[#e2cbd7] p-1"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="min-h-11 flex-1 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Color fondo suave</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.softBgColor}
                  onChange={(e) =>
                    setBranding({ ...branding, softBgColor: e.target.value })
                  }
                  className="h-11 w-14 rounded-xl border border-[#e2cbd7] p-1"
                />
                <input
                  type="text"
                  value={branding.softBgColor}
                  onChange={(e) =>
                    setBranding({ ...branding, softBgColor: e.target.value })
                  }
                  className="min-h-11 flex-1 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">URL Logo</label>
              <input
                type="text"
                value={branding.logoUrl}
                onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">URL Foto Portada Hero</label>
              <input
                type="text"
                value={branding.heroImageUrl}
                onChange={(e) =>
                  setBranding({ ...branding, heroImageUrl: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Etiqueta superior Hero</label>
              <input
                type="text"
                value={landing.heroBadge}
                onChange={(e) => setLanding({ ...landing, heroBadge: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Titular principal</label>
              <input
                type="text"
                value={landing.heroTitle}
                onChange={(e) => setLanding({ ...landing, heroTitle: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Bajada Hero</label>
              <textarea
                rows={2}
                value={landing.heroSubtitle}
                onChange={(e) =>
                  setLanding({ ...landing, heroSubtitle: e.target.value })
                }
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Presentación / Bio</label>
              <textarea
                rows={3}
                value={landing.aboutBio}
                onChange={(e) => setLanding({ ...landing, aboutBio: e.target.value })}
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">
                Aviso importante antes de reservar
              </label>
              <textarea
                rows={2}
                value={landing.importantNoticeText}
                onChange={(e) =>
                  setLanding({ ...landing, importantNoticeText: e.target.value })
                }
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Marca y Landing</span>
          </button>
        </form>
      )}

      {/* TAB 2: LOCATION & CONTACT */}
      {tab === "location" && (
        <form onSubmit={saveLocationTab} className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">WhatsApp (ej. 56958596560)</label>
              <input
                type="text"
                value={contactPublic.whatsappNumber}
                onChange={(e) =>
                  setContactPublic({ ...contactPublic, whatsappNumber: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Instagram (@usuario)</label>
              <input
                type="text"
                value={contactPublic.instagramHandle}
                onChange={(e) =>
                  setContactPublic({ ...contactPublic, instagramHandle: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">URL completa Instagram</label>
              <input
                type="url"
                value={contactPublic.instagramUrl}
                onChange={(e) =>
                  setContactPublic({ ...contactPublic, instagramUrl: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">
                Ubicación referencial pública (visible en la web)
              </label>
              <input
                type="text"
                value={contactPublic.publicLocationLabel}
                onChange={(e) =>
                  setContactPublic({
                    ...contactPublic,
                    publicLocationLabel: e.target.value,
                  })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4" />
              Dirección Exacta Privada (solo visible tras confirmar abono)
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold">Dirección exacta</label>
              <input
                type="text"
                value={privLoc.exactAddress}
                onChange={(e) => setPrivLoc({ ...privLoc, exactAddress: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Indicaciones de llegada / depto / timbre
              </label>
              <input
                type="text"
                value={privLoc.addressNotes}
                onChange={(e) => setPrivLoc({ ...privLoc, addressNotes: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Ubicación y Contacto</span>
          </button>
        </form>
      )}

      {/* TAB 3: BANK & POLICIES */}
      {tab === "bank" && (
        <form onSubmit={saveBankTab} className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
          <h2 className="text-sm font-bold text-[#1f141b]">Datos de Transferencia y Abono</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Monto abono (CLP)</label>
              <input
                type="number"
                min={0}
                value={paymentBank.depositAmountClp}
                onChange={(e) =>
                  setPaymentBank({
                    ...paymentBank,
                    depositAmountClp: Number(e.target.value),
                  })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Nombre titular</label>
              <input
                type="text"
                value={paymentBank.accountHolderName}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, accountHolderName: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">RUT titular</label>
              <input
                type="text"
                value={paymentBank.accountHolderRut}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, accountHolderRut: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Banco</label>
              <input
                type="text"
                value={paymentBank.bankName}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, bankName: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Tipo de cuenta</label>
              <input
                type="text"
                value={paymentBank.accountType}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, accountType: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">N° de cuenta</label>
              <input
                type="text"
                value={paymentBank.accountNumber}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, accountNumber: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Correo de transferencia</label>
              <input
                type="email"
                value={paymentBank.transferEmail}
                onChange={(e) =>
                  setPaymentBank({ ...paymentBank, transferEmail: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">
                Mensaje automático WhatsApp comprobante (variables: {"{{codigo}}"}, {"{{servicio}}"}, {"{{fecha}}"}, {"{{hora}}"}, {"{{abono}}"})
              </label>
              <textarea
                rows={2}
                value={paymentBank.whatsappReceiptTemplate}
                onChange={(e) =>
                  setPaymentBank({
                    ...paymentBank,
                    whatsappReceiptTemplate: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>
          </div>

          <h2 className="pt-3 text-sm font-bold text-[#1f141b]">Políticas del Salón</h2>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Política de reprogramación</label>
              <input
                type="text"
                value={policies.reschedulePolicy}
                onChange={(e) =>
                  setPolicies({ ...policies, reschedulePolicy: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Tolerancia de atraso</label>
              <input
                type="text"
                value={policies.latenessPolicy}
                onChange={(e) =>
                  setPolicies({ ...policies, latenessPolicy: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Política de acompañantes</label>
              <input
                type="text"
                value={policies.companionsPolicy}
                onChange={(e) =>
                  setPolicies({ ...policies, companionsPolicy: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Regla de extensiones</label>
              <input
                type="text"
                value={policies.extensionsPolicy}
                onChange={(e) =>
                  setPolicies({ ...policies, extensionsPolicy: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Banco y Políticas</span>
          </button>
        </form>
      )}

      {/* TAB 4: RESEND & EMAIL TEMPLATES */}
      {tab === "email" && (
        <div className="space-y-6">
          <form onSubmit={saveResendTab} className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1f141b]">
                  Conexión Resend (Guardada Cifrada)
                </h2>
                <p className="text-xs text-[#6c5763]">
                  Conecta tu cuenta cuando la tengas lista. La API Key se cifra con AES-256-GCM en el servidor.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={resendEnabled}
                  onChange={(e) => setResendEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                <span>Activar envíos Resend</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">
                  API Key de Resend{" "}
                  {resendView.hasApiKey && (
                    <span className="font-normal text-emerald-700">
                      (Actual: {resendView.secretHint})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder={
                    resendView.hasApiKey
                      ? "Deja vacío para conservar la clave actual"
                      : "re_..."
                  }
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Correo remitente</label>
                <input
                  type="email"
                  required
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="contacto@lebrunee.cl"
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Nombre remitente</label>
                <input
                  type="text"
                  required
                  value={resendFromName}
                  onChange={(e) => setResendFromName(e.target.value)}
                  placeholder="Lebrunee Nails"
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Reply-To</label>
                <input
                  type="email"
                  value={resendReplyTo}
                  onChange={(e) => setResendReplyTo(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={notifications.autoRemindersEnabled}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        autoRemindersEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  <span>Recordatorios automáticos diarios (24h / 48h)</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#f3e5ec] pt-4">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
              >
                <Save className="h-4 w-4" />
                <span>Guardar Resend</span>
              </button>

              <div className="flex flex-1 items-center gap-2">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="Correo para prueba"
                  className="min-h-11 flex-1 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleTestEmail}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[#e2cbd7] px-4 text-xs font-semibold"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Probar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Email Templates */}
          <div className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
            <h2 className="text-base font-bold text-[#1f141b]">
              Plantillas de Correo Editables
            </h2>
            <p className="text-xs text-[#6c5763]">
              Variables disponibles: {"{{nombre}}"}, {"{{codigo}}"}, {"{{servicio}}"},{" "}
              {"{{fecha}}"}, {"{{hora}}"}, {"{{abono}}"}, {"{{direccion}}"}, {"{{negocio}}"}
            </p>

            {templateEdits.map((tpl, idx) => (
              <div
                key={tpl.id}
                className="space-y-2.5 rounded-2xl border border-[#f2e4eb] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1f141b]">{tpl.name}</p>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={tpl.is_active}
                      onChange={(e) =>
                        setTemplateEdits((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, is_active: e.target.checked } : x
                          )
                        )
                      }
                    />
                    <span>Activa</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={tpl.subject}
                  onChange={(e) =>
                    setTemplateEdits((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, subject: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Asunto"
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold"
                />
                <input
                  type="text"
                  value={tpl.heading}
                  onChange={(e) =>
                    setTemplateEdits((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, heading: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Encabezado"
                  className="min-h-10 w-full rounded-xl border border-[#e2cbd7] px-3 text-xs"
                />
                <textarea
                  rows={2}
                  value={tpl.body_text}
                  onChange={(e) =>
                    setTemplateEdits((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, body_text: e.target.value } : x
                      )
                    )
                  }
                  className="w-full rounded-xl border border-[#e2cbd7] p-2.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await saveEmailTemplateAction({
                        id: tpl.id,
                        subject: tpl.subject,
                        heading: tpl.heading,
                        bodyText: tpl.body_text,
                        isActive: tpl.is_active,
                      });
                      notifyOk(`Plantilla "${tpl.name}" guardada.`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="min-h-9 rounded-full border border-[var(--brand-primary)] px-4 text-xs font-semibold text-[var(--brand-primary)]"
                >
                  Guardar plantilla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TEAM & ADMIN ACCOUNTS */}
      {tab === "team" && (
        <div className="space-y-5 rounded-3xl border border-[#eedbe4] bg-white p-5">
          <div>
            <h2 className="text-base font-bold text-[#1f141b]">
              Perfiles de Administración y Equipo
            </h2>
            <p className="text-xs text-[#6c5763]">
              La cuenta dueña puede crear nuevos perfiles de administradora o manicurista.
            </p>
          </div>

          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#f2e4eb] px-4 py-3 text-xs"
              >
                <div>
                  <p className="text-sm font-bold text-[#1f141b]">{m.display_name}</p>
                  <p className="text-[#6c5763]">
                    {m.email} · <span className="uppercase font-semibold">{m.role}</span>
                  </p>
                </div>
                {currentMemberRole === "owner" && m.role !== "owner" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleBusinessMemberAction(m.id, !m.is_active);
                      router.refresh();
                    }}
                    className={`min-h-9 rounded-full px-3 font-semibold ${
                      m.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {m.is_active ? "Activo (desactivar)" : "Inactivo (activar)"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {currentMemberRole === "owner" && (
            <form
              onSubmit={handleCreateMember}
              className="space-y-3 border-t border-[#f3e5ec] pt-4"
            >
              <h3 className="text-sm font-bold text-[#1f141b]">Crear nuevo perfil</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  placeholder="Nombre completo"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="min-h-11 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Correo de acceso"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="min-h-11 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Contraseña (mín. 8 caracteres)"
                  value={newMemberPass}
                  onChange={(e) => setNewMemberPass(e.target.value)}
                  className="min-h-11 rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as "admin" | "staff")}
                  className="min-h-11 rounded-xl border border-[#e2cbd7] bg-white px-3 text-sm"
                >
                  <option value="admin">Administradora (acceso completo)</option>
                  <option value="staff">Manicurista (agenda propia)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-full bg-[var(--brand-primary)] px-6 text-xs font-semibold text-white"
              >
                Crear perfil
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
