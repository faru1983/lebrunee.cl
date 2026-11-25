import { Resend } from "resend";
import { decryptSecret } from "@/lib/crypto";
import { createSupabaseAdminClient, hasValidServiceRoleKey } from "@/lib/supabase/server";
import { getActiveBusinessBundle } from "@/lib/services/businessService";
import { getTodayInTimezone, resolveTemplate } from "@/lib/utils";

export interface ResendIntegrationView {
  isEnabled: boolean;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  hasApiKey: boolean;
  secretHint: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
}

export async function getResendIntegrationView(
  businessId: string
): Promise<ResendIntegrationView> {
  if (!hasValidServiceRoleKey()) {
    return {
      isEnabled: false,
      fromEmail: "",
      fromName: "",
      replyTo: "",
      hasApiKey: false,
      secretHint: null,
      lastTestedAt: null,
      lastTestStatus: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("business_integrations")
    .select("is_enabled, public_config, encrypted_secret, secret_hint, last_tested_at, last_test_status")
    .eq("business_id", businessId)
    .eq("provider", "resend")
    .maybeSingle();

  const cfg = (data?.public_config || {}) as Record<string, string>;
  return {
    isEnabled: Boolean(data?.is_enabled),
    fromEmail: cfg.fromEmail || "",
    fromName: cfg.fromName || "",
    replyTo: cfg.replyTo || "",
    hasApiKey: Boolean(data?.encrypted_secret),
    secretHint: data?.secret_hint || null,
    lastTestedAt: data?.last_tested_at || null,
    lastTestStatus: data?.last_test_status || null,
  };
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyEscapedText(escapedText: string, primaryColor: string) {
  return escapedText.replace(
    /https?:\/\/[^\s<]+/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${primaryColor};font-weight:600;word-break:break-all;">${url}</a>`
  );
}

function buildBrandedHtml(params: {
  businessName: string;
  primaryColor: string;
  heading: string;
  bodyText: string;
  footerNote: string;
  ctaButton?: { label: string; url: string };
}) {
  const safeBody = linkifyEscapedText(
    escapeHtml(params.bodyText).replace(/\n/g, "<br/>"),
    params.primaryColor
  );

  const validCtaUrl =
    params.ctaButton && /^https?:\/\//i.test(params.ctaButton.url)
      ? params.ctaButton.url
      : null;

  const ctaHtml =
    validCtaUrl && params.ctaButton
      ? `<div style="margin:22px 0 6px;">
          <a href="${escapeHtml(validCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${params.primaryColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9999px;">
            ${escapeHtml(params.ctaButton.label)}
          </a>
        </div>`
      : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#fff7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1720;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f3dce7;">
      <tr>
        <td style="background:${params.primaryColor};padding:22px 28px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${params.businessName}</p>
          <h1 style="margin:6px 0 0;font-size:22px;line-height:1.25;">${params.heading}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;font-size:15px;line-height:1.65;color:#2f2430;">
          <p style="margin:0 0 18px;">${safeBody}</p>
          ${ctaHtml}
          <hr style="border:none;border-top:1px solid #f2e4eb;margin:22px 0;" />
          <p style="margin:0;font-size:12px;color:#7a6674;">${params.footerNote}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendBusinessEmail(params: {
  businessId: string;
  to: string;
  templateKey: string;
  variables: Record<string, string | number>;
  category?: "transactional" | "reminder" | "campaign";
  appointmentId?: string;
  ctaButton?: { label: string; url: string };
  fallbackTemplate?: {
    subject: string;
    heading: string;
    bodyText: string;
  };
}): Promise<{ status: "sent" | "skipped" | "failed"; reason?: string }> {
  if (!hasValidServiceRoleKey()) {
    return { status: "skipped", reason: "service_role no configurado" };
  }

  const category = params.category || "transactional";
  const admin = createSupabaseAdminClient();

  const { data: integration } = await admin
    .from("business_integrations")
    .select("is_enabled, public_config, encrypted_secret")
    .eq("business_id", params.businessId)
    .eq("provider", "resend")
    .maybeSingle();

  if (!integration?.is_enabled || !integration.encrypted_secret) {
    return { status: "skipped", reason: "Resend no activado aún" };
  }

  const bundle = await getActiveBusinessBundle();
  const today = getTodayInTimezone(bundle.business.timezone);
  const startOfDayUtc = `${today}T00:00:00.000Z`;

  const { count: sentTodayCount } = await admin
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .eq("status", "sent")
    .gte("sent_at", startOfDayUtc);

  const sentToday = sentTodayCount || 0;
  const dailyLimit = bundle.notifications.dailyEmailLimit || 100;
  const reserve = bundle.notifications.transactionalReserve || 25;

  const limitForCategory =
    category === "transactional" ? dailyLimit : Math.max(0, dailyLimit - reserve);

  if (sentToday >= limitForCategory) {
    await admin.from("email_logs").insert({
      business_id: params.businessId,
      appointment_id: params.appointmentId || null,
      recipient_email: params.to,
      template_key: params.templateKey,
      category,
      status: "skipped",
      error_message: `Cuota diaria alcanzada (${sentToday}/${limitForCategory})`,
    });
    return { status: "skipped", reason: "Cuota diaria alcanzada" };
  }

  const { data: tpl } = await admin
    .from("email_templates")
    .select("subject, heading, body_text, is_active")
    .eq("business_id", params.businessId)
    .eq("template_key", params.templateKey)
    .maybeSingle();

  if (tpl && !tpl.is_active) {
    return { status: "skipped", reason: "Plantilla desactivada" };
  }

  const vars: Record<string, string | number> = {
    negocio: bundle.business.name,
    ...params.variables,
  };

  const subject = resolveTemplate(
    tpl?.subject ||
      params.fallbackTemplate?.subject ||
      `Actualización de tu cita en ${bundle.business.name}`,
    vars
  );
  const heading = resolveTemplate(
    tpl?.heading || params.fallbackTemplate?.heading || bundle.business.name,
    vars
  );
  const bodyText = resolveTemplate(
    tpl?.body_text || params.fallbackTemplate?.bodyText || "",
    vars
  );

  try {
    const apiKey = decryptSecret(integration.encrypted_secret);
    const resend = new Resend(apiKey);
    const cfg = (integration.public_config || {}) as Record<string, string>;
    const fromEmail = cfg.fromEmail || "onboarding@resend.dev";
    const fromName = cfg.fromName || bundle.business.name;

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      replyTo: cfg.replyTo || fromEmail,
      subject,
      html: buildBrandedHtml({
        businessName: bundle.business.name,
        primaryColor: bundle.branding.primaryColor,
        heading,
        bodyText,
        footerNote: `${bundle.business.name} · ${bundle.contactPublic.publicLocationLabel}`,
        ctaButton: params.ctaButton,
      }),
    });

    if (result.error) {
      await admin.from("email_logs").insert({
        business_id: params.businessId,
        appointment_id: params.appointmentId || null,
        recipient_email: params.to,
        template_key: params.templateKey,
        category,
        status: "failed",
        error_message: result.error.message,
      });
      return { status: "failed", reason: result.error.message };
    }

    await admin.from("email_logs").insert({
      business_id: params.businessId,
      appointment_id: params.appointmentId || null,
      recipient_email: params.to,
      template_key: params.templateKey,
      category,
      status: "sent",
      provider_message_id: result.data?.id || null,
    });

    return { status: "sent" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando correo";
    await admin.from("email_logs").insert({
      business_id: params.businessId,
      appointment_id: params.appointmentId || null,
      recipient_email: params.to,
      template_key: params.templateKey,
      category,
      status: "failed",
      error_message: msg,
    });
    return { status: "failed", reason: msg };
  }
}

export async function sendTestEmailForBusiness(
  businessId: string,
  toEmail: string
): Promise<{ ok: boolean; message: string }> {
  const admin = createSupabaseAdminClient();
  const { data: integration } = await admin
    .from("business_integrations")
    .select("public_config, encrypted_secret")
    .eq("business_id", businessId)
    .eq("provider", "resend")
    .maybeSingle();

  if (!integration?.encrypted_secret) {
    return { ok: false, message: "Guarda primero una API Key válida de Resend." };
  }

  try {
    const bundle = await getActiveBusinessBundle();
    const apiKey = decryptSecret(integration.encrypted_secret);
    const resend = new Resend(apiKey);
    const cfg = (integration.public_config || {}) as Record<string, string>;
    const fromEmail = cfg.fromEmail || "onboarding@resend.dev";
    const fromName = cfg.fromName || bundle.business.name;

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toEmail,
      subject: `Prueba de correo exitosa — ${bundle.business.name}`,
      html: buildBrandedHtml({
        businessName: bundle.business.name,
        primaryColor: bundle.branding.primaryColor,
        heading: "¡Resend conectado correctamente!",
        bodyText: `Este es un correo de prueba enviado desde el panel de ${bundle.business.name}. Tu remitente (${fromEmail}) está listo para enviar confirmaciones y recordatorios.`,
        footerNote: `${bundle.business.name} · Correo de verificación`,
      }),
    });

    if (result.error) {
      await admin
        .from("business_integrations")
        .update({ last_tested_at: new Date().toISOString(), last_test_status: result.error.message })
        .eq("business_id", businessId)
        .eq("provider", "resend");
      return { ok: false, message: result.error.message };
    }

    await admin
      .from("business_integrations")
      .update({ last_tested_at: new Date().toISOString(), last_test_status: "OK" })
      .eq("business_id", businessId)
      .eq("provider", "resend");

    return { ok: true, message: `Correo de prueba enviado a ${toEmail}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    return { ok: false, message: msg };
  }
}
