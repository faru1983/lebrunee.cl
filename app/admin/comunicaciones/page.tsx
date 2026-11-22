import { redirect } from "next/navigation";
import { getAdminMembersAndTemplates } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import {
  filterRetentionCandidates,
  getAdminClientsList,
} from "@/lib/services/crmService";
import { getResendIntegrationView } from "@/lib/services/emailService";
import { getCommunicationsOverview } from "@/lib/services/financeService";
import { AdminComunicacionesClient } from "@/components/admin/AdminComunicacionesClient";

export const dynamic = "force-dynamic";

export default async function AdminComunicacionesPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const [bundle, clients, overview, resendView, memTpl] = await Promise.all([
    getActiveBusinessBundle(),
    getAdminClientsList(ctx.business.id, ctx.business.timezone),
    getCommunicationsOverview(ctx.business.id, ctx.business.timezone),
    getResendIntegrationView(ctx.business.id),
    getAdminMembersAndTemplates(ctx.business.id),
  ]);

  const retentionCandidates = filterRetentionCandidates(clients, bundle.retentionRules);
  const retentionTemplate =
    memTpl.templates.find((t) => t.template_key === "retention_followup") || null;

  return (
    <AdminComunicacionesClient
      businessName={bundle.business.name}
      retentionRules={bundle.retentionRules}
      retentionTemplate={retentionTemplate}
      candidates={retentionCandidates}
      sentToday={overview.sentToday}
      dailyEmailLimit={bundle.notifications.dailyEmailLimit}
      transactionalReserve={bundle.notifications.transactionalReserve}
      resendEnabled={resendView.isEnabled}
      logs={overview.logs}
    />
  );
}
