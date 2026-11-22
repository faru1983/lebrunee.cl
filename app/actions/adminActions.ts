"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { countBusinessOwners } from "@/lib/services/adminService";
import {
  confirmAppointmentDepositCore,
  createBookingCore,
} from "@/lib/services/bookingService";
import {
  getActiveBusinessBundle,
  getAuthenticatedAdminContext,
} from "@/lib/services/businessService";
import { sendTestEmailForBusiness } from "@/lib/services/emailService";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasValidServiceRoleKey,
} from "@/lib/supabase/server";
import {
  AddonUpsertSchema,
  AppointmentStatus,
  CreateAdminAppointmentSchema,
  ServiceUpsertSchema,
} from "@/lib/types";
import { normalizeEmail, normalizePersonName, slugify } from "@/lib/utils";

async function requireAdmin() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) {
    throw new Error("Sesión administrativa requerida.");
  }
  return ctx;
}

export async function adminLogoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function setupInitialOwnerAction(input: {
  displayName: string;
  email: string;
  password: string;
  setupKey: string;
}) {
  try {
    if (!hasValidServiceRoleKey()) {
      return {
        success: false as const,
        error: "Primero pega SUPABASE_SERVICE_ROLE_KEY en tus variables de entorno.",
      };
    }

    const expectedKey = process.env.ADMIN_SETUP_KEY?.trim();
    if (!expectedKey || input.setupKey.trim() !== expectedKey) {
      return { success: false as const, error: "Llave de configuración inicial inválida." };
    }

    if (input.password.length < 8) {
      return {
        success: false as const,
        error: "La contraseña debe tener al menos 8 caracteres.",
      };
    }

    const bundle = await getActiveBusinessBundle();
    const ownersCount = await countBusinessOwners(bundle.business.id);
    if (ownersCount > 0) {
      return {
        success: false as const,
        error: "Ya existe una cuenta dueña configurada. Ingresa por /admin/login.",
      };
    }

    const admin = createSupabaseAdminClient();
    const email = normalizeEmail(input.email);
    const displayName = normalizePersonName(input.displayName);

    const { data: userCreated, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (authErr || !userCreated.user) {
      return {
        success: false as const,
        error: authErr?.message || "No se pudo crear el usuario en Supabase Auth.",
      };
    }

    const { data: member, error: memErr } = await admin
      .from("business_members")
      .insert({
        business_id: bundle.business.id,
        user_id: userCreated.user.id,
        role: "owner",
        display_name: displayName,
        email,
        is_active: true,
      })
      .select("id")
      .single();

    if (memErr || !member) {
      return { success: false as const, error: "Error vinculando cuenta al negocio." };
    }

    // Link existing default staff member if unassigned
    await admin
      .from("staff_members")
      .update({ member_id: member.id, name: displayName })
      .eq("business_id", bundle.business.id)
      .is("member_id", null);

    revalidatePath("/admin");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error inesperado en setup.",
    };
  }
}

export async function confirmAppointmentDepositAction(
  appointmentId: string,
  amountClp?: number
) {
  try {
    const ctx = await requireAdmin();
    await confirmAppointmentDepositCore({
      businessId: ctx.business.id,
      appointmentId,
      amountClp,
      adminUserId: ctx.user.id,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/mi-cuenta");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error al aprobar el abono.",
    };
  }
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
  reason?: string
) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.cancellation_reason = reason?.trim() || "Cancelada por administración";
    }

    const { error } = await admin
      .from("appointments")
      .update(patch)
      .eq("business_id", ctx.business.id)
      .eq("id", appointmentId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/mi-cuenta");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo actualizar el estado.",
    };
  }
}

export async function createAdminAppointmentAction(rawInput: unknown) {
  try {
    await requireAdmin();
    const parsed = CreateAdminAppointmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Revisa los campos de la cita.",
      };
    }

    const result = await createBookingCore({
      input: parsed.data,
      source: "admin",
      isAdmin: true,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    return {
      success: true as const,
      bookingCode: result.appointment.booking_code,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error creando cita manual.",
    };
  }
}

export async function upsertServiceAction(rawInput: unknown) {
  try {
    const ctx = await requireAdmin();
    const parsed = ServiceUpsertSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Datos de servicio inválidos.",
      };
    }

    const admin = createSupabaseAdminClient();
    const d = parsed.data;
    const baseSlug = slugify(d.name) || "servicio";

    if (d.id) {
      const { error } = await admin
        .from("services")
        .update({
          category_id: d.categoryId || null,
          name: d.name,
          description: d.description || null,
          image_url: d.imageUrl || null,
          price_clp: d.priceClp,
          is_price_from: d.isPriceFrom,
          duration_minutes: d.durationMinutes,
          buffer_minutes: d.bufferMinutes ?? null,
          is_featured: d.isFeatured,
          is_active: d.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", ctx.business.id)
        .eq("id", d.id);

      if (error) throw new Error(error.message);
    } else {
      const uniqueSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      const { error } = await admin.from("services").insert({
        business_id: ctx.business.id,
        category_id: d.categoryId || null,
        name: d.name,
        slug: uniqueSlug,
        description: d.description || null,
        image_url: d.imageUrl || "/images/hero-nails.jpg",
        price_clp: d.priceClp,
        is_price_from: d.isPriceFrom,
        duration_minutes: d.durationMinutes,
        buffer_minutes: d.bufferMinutes ?? null,
        is_featured: d.isFeatured,
        is_active: d.isActive,
      });

      if (error) throw new Error(error.message);
    }

    revalidateTag("catalog", "max");
    revalidatePath("/");
    revalidatePath("/reservar");
    revalidatePath("/admin/services");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando servicio.",
    };
  }
}

export async function deleteServiceAction(serviceId: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("services")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", serviceId);

    if (error) throw new Error(error.message);

    revalidateTag("catalog", "max");
    revalidatePath("/");
    revalidatePath("/reservar");
    revalidatePath("/admin/services");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo eliminar el servicio.",
    };
  }
}

export async function upsertAddonAction(rawInput: unknown) {
  try {
    const ctx = await requireAdmin();
    const parsed = AddonUpsertSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Datos inválidos.",
      };
    }

    const admin = createSupabaseAdminClient();
    const d = parsed.data;

    if (d.id) {
      const { error } = await admin
        .from("service_addons")
        .update({
          name: d.name,
          description: d.description || null,
          price_clp: d.priceClp,
          is_price_from: d.isPriceFrom,
          duration_minutes: d.durationMinutes,
          addon_type: d.addonType,
          is_active: d.isActive,
        })
        .eq("business_id", ctx.business.id)
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("service_addons").insert({
        business_id: ctx.business.id,
        name: d.name,
        description: d.description || null,
        price_clp: d.priceClp,
        is_price_from: d.isPriceFrom,
        duration_minutes: d.durationMinutes,
        addon_type: d.addonType,
        is_active: d.isActive,
      });
      if (error) throw new Error(error.message);
    }

    revalidateTag("catalog", "max");
    revalidatePath("/reservar");
    revalidatePath("/admin/services");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando adicional.",
    };
  }
}

export async function deleteAddonAction(addonId: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("service_addons")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", addonId);
    if (error) throw new Error(error.message);

    revalidateTag("catalog", "max");
    revalidatePath("/reservar");
    revalidatePath("/admin/services");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo eliminar el adicional.",
    };
  }
}

export async function saveScheduleSetupAction(payload: {
  staffId: string;
  bookingRules: Record<string, unknown>;
  rules: Array<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }>;
  fixedSlots: Array<{ day_of_week: number | null; slot_time: string; is_active: boolean }>;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: "booking",
        key: "booking_rules",
        value: payload.bookingRules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );

    await admin
      .from("availability_rules")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("staff_id", payload.staffId);

    if (payload.rules.length > 0) {
      await admin.from("availability_rules").insert(
        payload.rules.map((r) => ({
          business_id: ctx.business.id,
          staff_id: payload.staffId,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: r.is_active,
        }))
      );
    }

    await admin
      .from("availability_fixed_slots")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("staff_id", payload.staffId);

    if (payload.fixedSlots.length > 0) {
      await admin.from("availability_fixed_slots").insert(
        payload.fixedSlots.map((f) => ({
          business_id: ctx.business.id,
          staff_id: payload.staffId,
          day_of_week: f.day_of_week,
          slot_time: f.slot_time,
          is_active: f.is_active,
        }))
      );
    }

    revalidateTag("business-settings", "max");
    revalidatePath("/reservar");
    revalidatePath("/admin/schedule");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando horarios.",
    };
  }
}

export async function addAvailabilityExceptionAction(payload: {
  staffId: string;
  exceptionDate: string;
  exceptionType: "block_day" | "block_range" | "open_custom";
  startTime?: string;
  endTime?: string;
  reason?: string;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("availability_exceptions").insert({
      business_id: ctx.business.id,
      staff_id: payload.staffId,
      exception_date: payload.exceptionDate,
      exception_type: payload.exceptionType,
      start_time: payload.exceptionType === "block_day" ? null : payload.startTime || null,
      end_time: payload.exceptionType === "block_day" ? null : payload.endTime || null,
      reason: payload.reason?.trim() || null,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/reservar");
    revalidatePath("/admin/schedule");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo agregar la excepción.",
    };
  }
}

export async function deleteAvailabilityExceptionAction(id: string) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    await admin
      .from("availability_exceptions")
      .delete()
      .eq("business_id", ctx.business.id)
      .eq("id", id);

    revalidatePath("/reservar");
    revalidatePath("/admin/schedule");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo eliminar la excepción.",
    };
  }
}

export async function saveSettingsSectionAction(payload: {
  businessProfile?: { name: string; tagline: string };
  category:
    | "branding"
    | "landing"
    | "booking"
    | "payment"
    | "policies"
    | "notifications"
    | "private_location";
  key: string;
  value: Record<string, unknown>;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (payload.businessProfile) {
      await admin
        .from("businesses")
        .update({
          name: payload.businessProfile.name.trim(),
          tagline: payload.businessProfile.tagline.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ctx.business.id);
    }

    const { error } = await admin.from("business_settings").upsert(
      {
        business_id: ctx.business.id,
        category: payload.category,
        key: payload.key,
        value: payload.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,key" }
    );

    if (error) throw new Error(error.message);

    revalidateTag("business-settings", "max");
    revalidatePath("/");
    revalidatePath("/reservar");
    revalidatePath("/admin/settings");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando configuración.",
    };
  }
}

export async function saveResendIntegrationAction(payload: {
  isEnabled: boolean;
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}) {
  try {
    const ctx = await requireAdmin();
    if (ctx.member.role === "staff") {
      return { success: false as const, error: "Solo administradoras pueden editar Resend." };
    }

    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("business_integrations")
      .select("encrypted_secret, secret_hint")
      .eq("business_id", ctx.business.id)
      .eq("provider", "resend")
      .maybeSingle();

    let encryptedSecret = existing?.encrypted_secret || null;
    let secretHint = existing?.secret_hint || null;

    if (payload.apiKey && payload.apiKey.trim()) {
      encryptedSecret = encryptSecret(payload.apiKey.trim());
      secretHint = maskSecret(payload.apiKey.trim());
    }

    const { error } = await admin.from("business_integrations").upsert(
      {
        business_id: ctx.business.id,
        provider: "resend",
        is_enabled: payload.isEnabled,
        public_config: {
          fromEmail: normalizeEmail(payload.fromEmail),
          fromName: payload.fromName.trim(),
          replyTo: normalizeEmail(payload.replyTo || payload.fromEmail),
        },
        encrypted_secret: encryptedSecret,
        secret_hint: secretHint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,provider" }
    );

    if (error) throw new Error(error.message);

    revalidatePath("/admin/settings");
    return { success: true as const, secretHint };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando configuración de Resend.",
    };
  }
}

export async function sendTestEmailAction(toEmail: string) {
  try {
    const ctx = await requireAdmin();
    const res = await sendTestEmailForBusiness(ctx.business.id, normalizeEmail(toEmail));
    revalidatePath("/admin/settings");
    return res;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error enviando prueba.",
    };
  }
}

export async function saveEmailTemplateAction(payload: {
  id: string;
  subject: string;
  heading: string;
  bodyText: string;
  isActive: boolean;
}) {
  try {
    const ctx = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("email_templates")
      .update({
        subject: payload.subject,
        heading: payload.heading,
        body_text: payload.bodyText,
        is_active: payload.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", ctx.business.id)
      .eq("id", payload.id);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/settings");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error guardando plantilla.",
    };
  }
}

export async function createBusinessMemberAction(payload: {
  displayName: string;
  email: string;
  password: string;
  role: "admin" | "staff";
}) {
  try {
    const ctx = await requireAdmin();
    if (ctx.member.role !== "owner") {
      return {
        success: false as const,
        error: "Solo la cuenta dueña puede crear nuevos perfiles de administración.",
      };
    }

    if (payload.password.length < 8) {
      return {
        success: false as const,
        error: "La contraseña debe tener mínimo 8 caracteres.",
      };
    }

    const admin = createSupabaseAdminClient();
    const email = normalizeEmail(payload.email);
    const displayName = normalizePersonName(payload.displayName);

    const { data: userCreated, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (authErr || !userCreated.user) {
      return {
        success: false as const,
        error: authErr?.message || "No se pudo crear el usuario.",
      };
    }

    const { data: member, error: memErr } = await admin
      .from("business_members")
      .insert({
        business_id: ctx.business.id,
        user_id: userCreated.user.id,
        role: payload.role,
        display_name: displayName,
        email,
        is_active: true,
      })
      .select("id")
      .single();

    if (memErr || !member) {
      return { success: false as const, error: "Error guardando perfil del equipo." };
    }

    if (payload.role === "staff") {
      await admin.from("staff_members").insert({
        business_id: ctx.business.id,
        member_id: member.id,
        name: displayName,
        role_title: "Manicurista",
        is_active: true,
      });
    }

    revalidatePath("/admin/settings");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Error creando perfil.",
    };
  }
}

export async function toggleBusinessMemberAction(memberId: string, isActive: boolean) {
  try {
    const ctx = await requireAdmin();
    if (ctx.member.role !== "owner") {
      return { success: false as const, error: "Acción reservada a la dueña." };
    }

    const admin = createSupabaseAdminClient();
    await admin
      .from("business_members")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("business_id", ctx.business.id)
      .eq("id", memberId)
      .neq("role", "owner");

    revalidatePath("/admin/settings");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "No se pudo actualizar el usuario.",
    };
  }
}
