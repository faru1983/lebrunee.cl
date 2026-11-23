import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getActiveBusinessBundle } from "@/lib/services/businessService";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasValidServiceRoleKey,
} from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/utils";

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/mi-cuenta";
  }
  return raw;
}

async function linkClientIfApplicable(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  nextPath: string
) {
  if (
    !hasValidServiceRoleKey() ||
    (!nextPath.startsWith("/mi-cuenta") && !nextPath.startsWith("/reservar"))
  ) {
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  try {
    const bundle = await getActiveBusinessBundle();
    const admin = createSupabaseAdminClient();
    await admin
      .from("clients")
      .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
      .eq("business_id", bundle.business.id)
      .eq("email", normalizeEmail(user.email))
      .is("auth_user_id", null);
  } catch {
    // Non-blocking: /mi-cuenta and /reservar also link on render
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await linkClientIfApplicable(supabase, nextPath);
      return NextResponse.redirect(`${origin}${nextPath}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      await linkClientIfApplicable(supabase, nextPath);
      return NextResponse.redirect(`${origin}${nextPath}`);
    }
  }

  let fallback = "/admin/login";
  if (nextPath.includes("reset-password")) {
    fallback = "/admin/reset-password?error=expired";
  } else if (nextPath.startsWith("/mi-cuenta")) {
    fallback = "/mi-cuenta?error=expired";
  } else if (nextPath.startsWith("/reservar")) {
    fallback = "/reservar?error=expired";
  }

  return NextResponse.redirect(`${origin}${fallback}`);
}
