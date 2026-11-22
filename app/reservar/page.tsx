import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BookingWizard } from "@/components/booking/BookingWizard";
import {
  getActiveBusinessBundle,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { getVerifiedClientProfile } from "@/lib/services/bookingService";
import { createSupabaseServerClient, hasValidServiceRoleKey } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const params = await searchParams;
  const bundle = await getActiveBusinessBundle();
  const catalog = await getPublicCatalog(bundle.business.id);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialClientProfile =
    user?.email && hasValidServiceRoleKey()
      ? await getVerifiedClientProfile({
          businessId: bundle.business.id,
          authUserId: user.id,
          email: user.email,
        })
      : null;

  return (
    <>
      <SiteHeader
        businessName={bundle.business.name}
        logoUrl={bundle.branding.logoUrl}
      />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <BookingWizard
          bundle={bundle}
          services={catalog.services}
          addons={catalog.addons}
          staff={catalog.staff}
          initialServiceId={params.service}
          initialVerifiedEmail={user?.email || null}
          initialClientProfile={initialClientProfile}
        />
      </main>
      <SiteFooter
        businessName={bundle.business.name}
        tagline={bundle.business.tagline}
        contactPublic={bundle.contactPublic}
      />
    </>
  );
}
