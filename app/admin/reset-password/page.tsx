import { getActiveBusinessBundle } from "@/lib/services/businessService";
import { AdminResetPasswordForm } from "@/components/admin/AdminResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const bundle = await getActiveBusinessBundle();
  const params = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh items-center justify-center bg-[#faf6f8] px-4 py-10"
    >
      <AdminResetPasswordForm
        businessName={bundle.business.name}
        initialError={params.error === "expired"}
      />
    </main>
  );
}
