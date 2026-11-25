import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasValidServiceRoleKey,
} from "@/lib/supabase/server";
import type {
  AvailabilityException,
  AvailabilityFixedSlot,
  AvailabilityRule,
  BookingRulesSettings,
  BrandingSettings,
  Business,
  BusinessMemberRecord,
  BusinessPublicBundle,
  ContactPublicSettings,
  ExpenseCategoriesSettings,
  LandingContentSettings,
  NotificationSettings,
  PaymentBankSettings,
  PoliciesSettings,
  PrivateLocationSettings,
  RetentionRulesSettings,
  BirthdayRulesSettings,
  ServiceAddon,
  ServiceCategory,
  ServiceItem,
  StaffMember,
} from "@/lib/types";

function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function createPublicAnonClient() {
  if (!hasPublicSupabaseEnv()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: "#C81E6A",
  accentColor: "#9D174D",
  softBgColor: "#FFF7FA",
  logoUrl: "/images/brand-icon.svg",
  heroImageUrl: "/images/hero-nails.jpg",
  studioImageUrl: "/images/hero-nails.jpg",
};

const DEFAULT_CONTACT: ContactPublicSettings = {
  whatsappNumber: "56958596560",
  instagramHandle: "@lebrunee.n",
  instagramUrl: "https://www.instagram.com/lebrunee.n/",
  publicLocationLabel: "Santiago Centro · Metro Irarrázaval",
  adminNotificationEmail: "",
};

const DEFAULT_BOOKING_RULES: BookingRulesSettings = {
  isAgendaOpen: true,
  openMode: "rolling_days",
  rollingDays: 30,
  openUntilDate: null,
  slotMode: "dynamic",
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minAdvanceHours: 6,
  rescheduleCutoffHours: 48,
  holdExpiryMinutes: null,
  allowClientCancel: true,
  requireClientOtp: true,
  maxDailyAppointments: null,
  allowMultipleStaffSelection: false,
};

const DEFAULT_PAYMENT_BANK: PaymentBankSettings = {
  depositAmountClp: 15000,
  depositLabel: "Abono para reservar cupo",
  bankName: "",
  accountType: "",
  accountNumber: "",
  accountHolderName: "",
  accountHolderRut: "",
  transferEmail: "",
  whatsappReceiptTemplate:
    "Hola! Acabo de reservar mi cita ({{codigo}}) para {{servicio}} el {{fecha}} a las {{hora}}. Envío comprobante de abono ({{abono}}).",
};

const DEFAULT_LANDING: LandingContentSettings = {
  heroBadge: "Metro Irarrázaval · Uña Natural",
  heroTitle: "Empodera tus uñas en un espacio pensado solo para ti.",
  heroSubtitle:
    "Manicure Rusa y Esmaltado Permanente sobre uña natural. Atención personalizada, indolora y con protocolos estrictos de higiene.",
  aboutTitle: "Hola, soy Valentina",
  aboutBio:
    "Manicurista profesional con más de 5 años de experiencia en Esmaltado Permanente y Manicure Rusa.",
  aboutHighlights: [],
  importantNoticeTitle: "Antes de reservar",
  importantNoticeText: "Trabajo exclusivo sobre uña natural (no realizo extensiones).",
  coffeeBreakNote: "Incluye coffee break.",
};

const DEFAULT_POLICIES: PoliciesSettings = {
  reschedulePolicy: "Modificaciones hasta 48 horas antes usando el mismo abono.",
  latenessPolicy: "Tolerancia máxima de 10 minutos.",
  companionsPolicy: "Atención individual sin acompañantes.",
  extensionsPolicy: "No realizamos extensiones.",
  extraNotes: "",
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  autoRemindersEnabled: true,
  reminderHoursBefore: 24,
  secondReminderHoursBefore: 48,
  dailyEmailLimit: 100,
  transactionalReserve: 25,
  notifyNewBooking: true,
  notifyNewClientSignup: true,
};

const DEFAULT_RETENTION_RULES: RetentionRulesSettings = {
  retentionEnabled: false,
  daysSinceLastVisit: 21,
  cooldownDays: 30,
  whatsappTemplate:
    "Hola {{nombre}}! Ya pasaron {{dias}} días desde tu última cita ({{servicio}}) en {{negocio}}. Te dejo el link para agendar tu mantención: {{link_reserva}}",
};

const DEFAULT_BIRTHDAY_RULES: BirthdayRulesSettings = {
  birthdayEnabled: false,
  daysBefore: 0,
  whatsappTemplate:
    "¡Feliz cumpleaños {{nombre}}! Desde {{negocio}} queremos celebrar tu día contigo con un regalo especial en tu próxima cita. Agenda aquí: {{link_reserva}}",
};

const DEFAULT_EXPENSE_CATEGORIES = [
  "Insumos y Esmaltes",
  "Herramientas y Esterilización",
  "Arriendo y Servicios",
  "Coffee Break",
  "Marketing y Redes",
  "Otros",
];

const DEFAULT_BUSINESS: Business = {
  id: "00000000-0000-0000-0000-000000000000",
  slug: "lebrunee",
  custom_domain: "lebrunee.cl",
  name: "Lebrunee Nails",
  tagline: "Empodera tus uñas · Manicure profesional en uña natural",
  timezone: "America/Santiago",
  currency: "CLP",
  locale: "es-CL",
  is_active: true,
};

function buildFallbackBundle(): BusinessPublicBundle {
  return {
    business: DEFAULT_BUSINESS,
    branding: DEFAULT_BRANDING,
    contactPublic: DEFAULT_CONTACT,
    bookingRules: DEFAULT_BOOKING_RULES,
    paymentBank: DEFAULT_PAYMENT_BANK,
    landingContent: DEFAULT_LANDING,
    policies: DEFAULT_POLICIES,
    notifications: DEFAULT_NOTIFICATIONS,
    retentionRules: DEFAULT_RETENTION_RULES,
    birthdayRules: DEFAULT_BIRTHDAY_RULES,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  };
}

async function fetchBusinessBundleUncached(slug: string): Promise<BusinessPublicBundle> {
  const db = createPublicAnonClient();
  if (!db) {
    return buildFallbackBundle();
  }

  const { data: biz, error } = await db
    .from("businesses")
    .select("id, slug, custom_domain, name, tagline, timezone, currency, locale, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !biz) {
    throw new Error(`No se encontró el negocio activo (${slug}).`);
  }

  const { data: settingsRows } = await db
    .from("business_settings")
    .select("key, value")
    .eq("business_id", biz.id)
    .in("category", ["branding", "landing", "booking", "payment", "policies", "notifications"]);

  const map = new Map<string, Record<string, unknown>>();
  for (const row of settingsRows || []) {
    map.set(row.key, (row.value || {}) as Record<string, unknown>);
  }

  return {
    business: biz as Business,
    branding: { ...DEFAULT_BRANDING, ...(map.get("branding") || {}) } as BrandingSettings,
    contactPublic: {
      ...DEFAULT_CONTACT,
      ...(map.get("contact_public") || {}),
    } as ContactPublicSettings,
    bookingRules: {
      ...DEFAULT_BOOKING_RULES,
      ...(map.get("booking_rules") || {}),
    } as BookingRulesSettings,
    paymentBank: {
      ...DEFAULT_PAYMENT_BANK,
      ...(map.get("payment_bank") || {}),
    } as PaymentBankSettings,
    landingContent: {
      ...DEFAULT_LANDING,
      ...(map.get("landing_content") || {}),
    } as LandingContentSettings,
    policies: { ...DEFAULT_POLICIES, ...(map.get("policies") || {}) } as PoliciesSettings,
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...(map.get("notifications") || {}),
    } as NotificationSettings,
    retentionRules: {
      ...DEFAULT_RETENTION_RULES,
      ...(map.get("retention_rules") || {}),
    } as RetentionRulesSettings,
    birthdayRules: {
      ...DEFAULT_BIRTHDAY_RULES,
      ...(map.get("birthday_rules") || {}),
    } as BirthdayRulesSettings,
    expenseCategories:
      (map.get("expense_categories") as ExpenseCategoriesSettings | undefined)
        ?.categories || DEFAULT_EXPENSE_CATEGORIES,
  };
}

const getCachedBusinessBundle = unstable_cache(
  async (slug: string) => fetchBusinessBundleUncached(slug),
  ["business-public-bundle"],
  { revalidate: 60, tags: ["business-settings"] }
);

export async function getActiveBusinessBundle(slug?: string): Promise<BusinessPublicBundle> {
  if (!hasPublicSupabaseEnv()) {
    return buildFallbackBundle();
  }
  const targetSlug = slug || process.env.DEFAULT_BUSINESS_SLUG || "lebrunee";
  return getCachedBusinessBundle(targetSlug);
}

const getCachedPublicCatalog = unstable_cache(
  async (businessId: string) => {
    const db = createPublicAnonClient();
    if (!db) {
      return {
        categories: [] as ServiceCategory[],
        services: [] as ServiceItem[],
        addons: [] as ServiceAddon[],
        staff: [] as StaffMember[],
      };
    }
    const [categoriesRes, servicesRes, addonsRes, staffRes] = await Promise.all([
      db
        .from("service_categories")
        .select("id, business_id, name, description, display_order, is_active")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      db
        .from("services")
        .select(
          "id, business_id, category_id, name, slug, description, image_url, price_clp, is_price_from, duration_minutes, buffer_minutes, deposit_override_clp, is_featured, is_active, display_order"
        )
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      db
        .from("service_addons")
        .select(
          "id, business_id, name, description, price_clp, is_price_from, duration_minutes, addon_type, is_active, display_order"
        )
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      db
        .from("staff_members")
        .select("id, business_id, name, role_title, bio, avatar_url, is_active, display_order")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    return {
      categories: (categoriesRes.data || []) as ServiceCategory[],
      services: (servicesRes.data || []) as ServiceItem[],
      addons: (addonsRes.data || []) as ServiceAddon[],
      staff: (staffRes.data || []) as StaffMember[],
    };
  },
  ["public-catalog"],
  { revalidate: 60, tags: ["catalog"] }
);

export async function getPublicCatalog(businessId: string) {
  if (!hasPublicSupabaseEnv() || businessId === DEFAULT_BUSINESS.id) {
    return {
      categories: [] as ServiceCategory[],
      services: [] as ServiceItem[],
      addons: [] as ServiceAddon[],
      staff: [] as StaffMember[],
    };
  }
  return getCachedPublicCatalog(businessId);
}

export async function getScheduleConfig(businessId: string, staffId: string) {
  const db = createPublicAnonClient();
  if (!db) {
    return {
      rules: [] as AvailabilityRule[],
      fixedSlots: [] as AvailabilityFixedSlot[],
      exceptions: [] as AvailabilityException[],
    };
  }
  const [rulesRes, fixedRes, exceptionsRes] = await Promise.all([
    db
      .from("availability_rules")
      .select("id, business_id, staff_id, day_of_week, start_time, end_time, is_active")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    db
      .from("availability_fixed_slots")
      .select("id, business_id, staff_id, day_of_week, slot_time, is_active")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .order("slot_time", { ascending: true }),
    db
      .from("availability_exceptions")
      .select("id, business_id, staff_id, exception_date, exception_type, start_time, end_time, reason")
      .eq("business_id", businessId)
      .eq("staff_id", staffId),
  ]);

  return {
    rules: (rulesRes.data || []) as AvailabilityRule[],
    fixedSlots: (fixedRes.data || []) as AvailabilityFixedSlot[],
    exceptions: (exceptionsRes.data || []) as AvailabilityException[],
  };
}

export async function getPrivateLocationForServer(
  businessId: string
): Promise<PrivateLocationSettings> {
  if (!hasValidServiceRoleKey()) {
    return { exactAddress: "", addressNotes: "" };
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("business_settings")
    .select("value")
    .eq("business_id", businessId)
    .eq("key", "private_location")
    .maybeSingle();

  const val = (data?.value || {}) as Partial<PrivateLocationSettings>;
  return {
    exactAddress: val.exactAddress || "",
    addressNotes: val.addressNotes || "",
  };
}

export async function getAuthenticatedAdminContext(): Promise<{
  user: { id: string; email: string };
  member: BusinessMemberRecord;
  business: Business;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const bundle = await getActiveBusinessBundle();
  const { data: member } = await supabase
    .from("business_members")
    .select("id, business_id, user_id, role, display_name, email, is_active, created_at")
    .eq("business_id", bundle.business.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return null;

  return {
    user: { id: user.id, email: user.email || member.email },
    member: member as BusinessMemberRecord,
    business: bundle.business,
  };
}
