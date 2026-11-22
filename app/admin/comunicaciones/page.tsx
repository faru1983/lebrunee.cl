import { redirect } from "next/navigation";
import { getAdminMembersAndTemplates } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import {
  filterBirthdayDueToday,
  filterRetentionCandidates,
  getAdminClientsList,
  getUpcomingBirthdays,
} from "@/lib/services/crmService";
import { getResendIntegrationView } from "@/lib/services/emailService";
import { getCommunicationsOverview } from "@/lib/services/financeService";
import {
  AdminComunicacionesClient,
  type CommsTabKey,
} from "@/components/admin/AdminComunicacionesClient";

export const dynamic = "force-dynamic";

const TAB_MAP: Record<string, CommsTabKey> = {
  citas: "citas",
  mantencion: "mantencion",
  cumpleanos: "cumpleanos",
  historial: "historial",
};

export default async function AdminComunicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const resolvedParams = await searchParams;
  const initialTab: CommsTabKey =
    (resolvedParams.tab && TAB_MAP[resolvedParams.tab.toLowerCase()]) || "citas";

  const [bundle, clients, overview, resendView, memTpl] = await Promise.all([
    getActiveBusinessBundle(),
    getAdminClientsList(ctx.business.id, ctx.business.timezone),
    getCommunicationsOverview(ctx.business.id, ctx.business.timezone),
    getResendIntegrationView(ctx.business.id),
    getAdminMembersAndTemplates(ctx.business.id),
  ]);

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.business.timezone,
  }).format(new Date());

  const retentionCandidates = filterRetentionCandidates(clients, bundle.retentionRules);
  const birthdayDueToday = filterBirthdayDueToday(
    clients,
    bundle.birthdayRules,
    todayIso
  );
  const upcomingBirthdays = getUpcomingBirthdays(clients, todayIso, 14);

  const reminderUpcomingTemplate =
    memTpl.templates.find((t) => t.template_key === "reminder_upcoming") || null;
  const retentionTemplate =
    memTpl.templates.find((t) => t.template_key === "retention_followup") || null;
  const birthdayTemplate =
    memTpl.templates.find((t) => t.template_key === "birthday_gift") || null;

  return (
    <AdminComunicacionesClient
      key={initialTab}
      businessName={bundle.business.name}
      initialTab={initialTab}
      autoRemindersEnabled={bundle.notifications.autoRemindersEnabled}
      reminderUpcomingTemplate={reminderUpcomingTemplate}
      retentionRules={bundle.retentionRules}
      retentionTemplate={retentionTemplate}
      candidates={retentionCandidates}
      birthdayRules={bundle.birthdayRules}
      birthdayTemplate={birthdayTemplate}
      birthdayDueToday={birthdayDueToday}
      upcomingBirthdays={upcomingBirthdays}
      sentToday={overview.sentToday}
      dailyEmailLimit={bundle.notifications.dailyEmailLimit}
      transactionalReserve={bundle.notifications.transactionalReserve}
      resendEnabled={resendView.isEnabled}
      logs={overview.logs}
    />
  );
}
