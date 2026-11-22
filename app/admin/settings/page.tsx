import { redirect } from "next/navigation";
import { getAdminMembersAndTemplates } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import { getResendIntegrationView } from "@/lib/services/emailService";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const [bundle, privateLocation, resendView, membersAndTemplates] = await Promise.all([
    getActiveBusinessBundle(),
    getPrivateLocationForServer(ctx.business.id),
    getResendIntegrationView(ctx.business.id),
    getAdminMembersAndTemplates(ctx.business.id),
  ]);

  return (
    <AdminSettingsClient
      bundle={bundle}
      privateLocation={privateLocation}
      resendView={resendView}
      members={membersAndTemplates.members}
      templates={membersAndTemplates.templates}
      currentMemberRole={ctx.member.role}
    />
  );
}
