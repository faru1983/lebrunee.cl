import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ClientPortal } from "@/components/account/ClientPortal";
import {
  getActiveBusinessBundle,
  getPrivateLocationForServer,
} from "@/lib/services/businessService";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasValidServiceRoleKey,
} from "@/lib/supabase/server";
import type { AppointmentRecord } from "@/lib/types";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const bundle = await getActiveBusinessBundle();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let appointments: AppointmentRecord[] = [];
  let exactAddress: string | null = null;
  let addressNotes: string | null = null;
  let clientBirthDate: string | null = null;

  if (user?.email && hasValidServiceRoleKey()) {
    const admin = createSupabaseAdminClient();
    const cleanEmail = normalizeEmail(user.email);

    // Ensure auth_user_id link exists if client booked before verifying
    await admin
      .from("clients")
      .update({ auth_user_id: user.id })
      .eq("business_id", bundle.business.id)
      .eq("email", cleanEmail)
      .is("auth_user_id", null);

    const { data: client } = await admin
      .from("clients")
      .select("id, birth_date")
      .eq("business_id", bundle.business.id)
      .or(`auth_user_id.eq.${user.id},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (client) {
      clientBirthDate = client.birth_date || null;
      const { data: appts } = await admin
        .from("appointments")
        .select("*, staff:staff_members(id, name), items:appointment_items(*)")
        .eq("business_id", bundle.business.id)
        .eq("client_id", client.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      appointments = (appts || []) as AppointmentRecord[];

      const hasConfirmed = appointments.some((a) =>
        ["confirmed", "completed"].includes(a.status)
      );
      if (hasConfirmed) {
        const priv = await getPrivateLocationForServer(bundle.business.id);
        exactAddress = priv.exactAddress;
        addressNotes = priv.addressNotes;
      }
    }
  }

  return (
    <>
      <SiteHeader
        businessName={bundle.business.name}
        logoUrl={bundle.branding.logoUrl}
      />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <ClientPortal
          bundle={bundle}
          userEmail={user?.email || null}
          clientBirthDate={clientBirthDate}
          appointments={appointments}
          exactAddress={exactAddress}
          addressNotes={addressNotes}
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
