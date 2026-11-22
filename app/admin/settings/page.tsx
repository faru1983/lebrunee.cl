import { redirect } from "next/navigation";
import { getAdminMembersAndTemplates } from "@/lib/services/adminService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import { getResendIntegrationView } from "@/lib/services/emailService";
import {
  AdminSettingsClient,
  type SettingsTabKey,
} from "@/components/admin/AdminSettingsClient";

export const dynamic = "force-dynamic";

const TAB_ALIASES: Record<string, SettingsTabKey> = {
  marca: "marca",
  brand: "marca",
  ubicacion: "ubicacion",
  location: "ubicacion",
  banco: "banco",
  bank: "banco",
  resend: "resend",
  email: "resend",
  equipo: "equipo",
  team: "equipo",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const resolvedParams = await searchParams;
  const initialTab: SettingsTabKey =
    (resolvedParams.tab && TAB_ALIASES[resolvedParams.tab.toLowerCase()]) || "marca";

  const [bundle, privateLocation, resendView, membersAndTemplates] = await Promise.all([
    getActiveBusinessBundle(),
    getPrivateLocationForServer(ctx.business.id),
    getResendIntegrationView(ctx.business.id),
    getAdminMembersAndTemplates(ctx.business.id),
  ]);

  return (
    <AdminSettingsClient
      key={initialTab}
      bundle={bundle}
      privateLocation={privateLocation}
      resendView={resendView}
      members={membersAndTemplates.members}
      templates={membersAndTemplates.templates}
      currentMemberRole={ctx.member.role}
      initialTab={initialTab}
    />
  );
}
