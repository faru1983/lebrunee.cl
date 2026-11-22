import { notFound, redirect } from "next/navigation";
import { getAuthenticatedAdminContext } from "@/lib/services/businessService";
import { getAdminClientDetail } from "@/lib/services/crmService";
import { AdminClientDetailClient } from "@/components/admin/AdminClientDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  const { id } = await params;
  const detail = await getAdminClientDetail(ctx.business.id, id);
  if (!detail) notFound();

  return (
    <AdminClientDetailClient
      client={detail.client}
      appointments={detail.appointments}
      notes={detail.notes}
    />
  );
}
