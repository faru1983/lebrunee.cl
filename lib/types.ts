import { z } from "zod";

export type AppointmentStatus =
  | "pending_deposit"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type MemberRole = "owner" | "admin" | "staff";

export interface Business {
  id: string;
  slug: string;
  custom_domain: string | null;
  name: string;
  tagline: string | null;
  timezone: string;
  currency: string;
  locale: string;
  is_active: boolean;
}

export interface BrandingSettings {
  primaryColor: string;
  accentColor: string;
  softBgColor: string;
  logoUrl: string;
  heroImageUrl: string;
  studioImageUrl: string;
}

export interface ContactPublicSettings {
  whatsappNumber: string;
  instagramHandle: string;
  instagramUrl: string;
  publicLocationLabel: string;
  adminNotificationEmail: string;
}

export interface PrivateLocationSettings {
  exactAddress: string;
  addressNotes: string;
}

export interface BookingRulesSettings {
  isAgendaOpen: boolean;
  openMode: "rolling_days" | "until_date";
  rollingDays: number;
  openUntilDate: string | null;
  slotMode: "dynamic" | "fixed_blocks";
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minAdvanceHours: number;
  rescheduleCutoffHours: number;
  holdExpiryMinutes: number | null;
  allowClientCancel: boolean;
  requireClientOtp: boolean;
  maxDailyAppointments: number | null;
  allowMultipleStaffSelection: boolean;
}

export interface PaymentBankSettings {
  depositAmountClp: number;
  depositLabel: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  accountHolderRut: string;
  transferEmail: string;
  whatsappReceiptTemplate: string;
}

export interface LandingContentSettings {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBio: string;
  aboutHighlights: string[];
  importantNoticeTitle: string;
  importantNoticeText: string;
  coffeeBreakNote: string;
}

export interface PoliciesSettings {
  reschedulePolicy: string;
  latenessPolicy: string;
  companionsPolicy: string;
  extensionsPolicy: string;
  extraNotes: string;
}

export interface NotificationSettings {
  autoRemindersEnabled: boolean;
  reminderHoursBefore: number;
  secondReminderHoursBefore: number;
  dailyEmailLimit: number;
  transactionalReserve: number;
  notifyNewBooking: boolean;
  notifyNewClientSignup: boolean;
}

export interface RetentionRulesSettings {
  retentionEnabled: boolean;
  daysSinceLastVisit: number;
  cooldownDays: number;
  whatsappTemplate: string;
}

export interface BirthdayRulesSettings {
  birthdayEnabled: boolean;
  daysBefore: number;
  whatsappTemplate: string;
}

export interface ExpenseCategoriesSettings {
  categories: string[];
}

export interface PaymentMethodRecord {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
  display_order: number;
}

export interface PaymentRecord {
  id: string;
  business_id: string;
  appointment_id: string | null;
  client_id: string | null;
  payment_method_id: string | null;
  payment_type: "deposit" | "balance" | "direct_sale";
  amount_clp: number;
  reference_note: string | null;
  paid_at: string;
  payment_method?: { name: string } | null;
  client?: { first_name: string; last_name: string | null } | null;
}

export interface ExpenseRecord {
  id: string;
  business_id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount_clp: number;
  payment_method_id: string | null;
  created_at: string;
  payment_method?: { name: string } | null;
}

export interface ClientNoteRecord {
  id: string;
  business_id: string;
  client_id: string;
  appointment_id: string | null;
  note: string;
  photo_url: string | null;
  created_at: string;
}

export interface VerifiedClientProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  instagramHandle: string;
  isNewClient: boolean;
}

export interface ClientSummaryRecord {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  instagram_handle: string | null;
  is_new_client: boolean;
  tags: string[];
  notes: string | null;
  no_show_count: number;
  retention_opt_out: boolean;
  birth_date: string | null;
  created_at: string;
  visitsCount: number;
  totalSpentClp: number;
  lastVisitDate: string | null;
  lastServiceName: string | null;
  daysSinceLastVisit: number | null;
  hasUpcomingAppointment: boolean;
  lastRetentionSentAt: string | null;
  lastBirthdayYearSent: number | null;
}

export interface EmailLogRecord {
  id: string;
  recipient_email: string;
  template_key: string;
  category: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

export interface BusinessPublicBundle {
  business: Business;
  branding: BrandingSettings;
  contactPublic: ContactPublicSettings;
  bookingRules: BookingRulesSettings;
  paymentBank: PaymentBankSettings;
  landingContent: LandingContentSettings;
  policies: PoliciesSettings;
  notifications: NotificationSettings;
  retentionRules: RetentionRulesSettings;
  birthdayRules: BirthdayRulesSettings;
  expenseCategories: string[];
}

export interface StaffMember {
  id: string;
  business_id: string;
  name: string;
  role_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  display_order: number;
}

export interface ServiceCategory {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export interface ServiceItem {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price_clp: number;
  is_price_from: boolean;
  duration_minutes: number;
  buffer_minutes: number | null;
  deposit_override_clp: number | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

export interface ServiceAddon {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_clp: number;
  is_price_from: boolean;
  duration_minutes: number;
  addon_type: "optional" | "new_client_check";
  is_active: boolean;
  display_order: number;
}

export interface AvailabilityRule {
  id: string;
  business_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AvailabilityFixedSlot {
  id: string;
  business_id: string;
  staff_id: string;
  day_of_week: number | null;
  slot_time: string;
  is_active: boolean;
}

export interface AvailabilityException {
  id: string;
  business_id: string;
  staff_id: string;
  exception_date: string;
  exception_type: "block_day" | "block_range" | "open_custom";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface TimeSlotOption {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  staffId: string;
}

export interface AppointmentItemRecord {
  id: string;
  item_type: "service" | "addon" | "custom";
  service_id: string | null;
  addon_id: string | null;
  name_snapshot: string;
  duration_minutes_snapshot: number;
  unit_price_clp: number;
  quantity: number;
}

export interface AppointmentRecord {
  id: string;
  business_id: string;
  booking_code: string;
  public_token: string;
  client_id: string;
  staff_id: string;
  status: AppointmentStatus;
  appointment_date: string;
  start_time: string;
  end_time: string;
  total_duration_minutes: number;
  buffer_minutes: number;
  service_subtotal_clp: number;
  addons_subtotal_clp: number;
  manual_adjustment_clp: number;
  total_estimated_clp: number;
  deposit_required_clp: number;
  deposit_paid_clp: number;
  total_paid_clp: number;
  has_external_product: boolean;
  client_notes: string | null;
  admin_notes: string | null;
  source: "web" | "admin" | "whatsapp";
  hold_expires_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rescheduled_count: number;
  created_at: string;
  client?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
    phone: string | null;
    instagram_handle: string | null;
    is_new_client: boolean;
  };
  staff?: {
    id: string;
    name: string;
  };
  items?: AppointmentItemRecord[];
}

export interface BusinessMemberRecord {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailTemplateRecord {
  id: string;
  business_id: string;
  template_key: string;
  name: string;
  subject: string;
  heading: string;
  body_text: string;
  is_active: boolean;
}

export const CreatePublicBookingSchema = z.object({
  serviceId: z.string().uuid("Servicio inválido"),
  addonIds: z.array(z.string().uuid()).default([]),
  staffId: z.string().uuid("Profesional inválido"),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  firstName: z.string().trim().min(2, "Ingresa tu nombre").max(60),
  lastName: z.string().trim().min(2, "Ingresa tus apellidos").max(80),
  email: z.string().trim().email("Correo electrónico inválido"),
  phone: z.string().trim().min(8, "Ingresa un WhatsApp válido").max(25),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de cumpleaños inválida")
    .optional()
    .or(z.literal("")),
  instagramHandle: z.string().trim().max(60).optional().default(""),
  isNewClient: z.boolean().default(true),
  clientNotes: z.string().trim().max(500).optional().default(""),
});

export const CreateAdminAppointmentSchema = CreatePublicBookingSchema.extend({
  confirmImmediately: z.boolean().default(false),
  depositPaidClp: z.number().int().min(0).default(0),
  sendEmail: z.boolean().default(false),
  adminNotes: z.string().trim().max(500).optional().default(""),
  allowOverride: z.boolean().default(false),
});

export interface AgendaClientOption {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  instagram_handle: string | null;
  birth_date: string | null;
}

export const RescheduleAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const UpsertClientProfileSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresa tu nombre").max(60),
  lastName: z.string().trim().min(2, "Ingresa tus apellidos").max(80),
  phone: z.string().trim().min(8, "Ingresa un WhatsApp válido").max(25),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de cumpleaños inválida")
    .optional()
    .or(z.literal("")),
  instagramHandle: z.string().trim().max(60).optional().default(""),
});

export const ServiceUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, "Nombre requerido").max(100),
  description: z.string().trim().max(500).optional().default(""),
  imageUrl: z.string().trim().max(500).optional().default(""),
  priceClp: z.number().int().min(0),
  isPriceFrom: z.boolean().default(false),
  durationMinutes: z.number().int().min(10).max(480),
  bufferMinutes: z.number().int().min(0).max(120).nullable().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const AddonUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nombre requerido").max(100),
  description: z.string().trim().max(400).optional().default(""),
  priceClp: z.number().int().min(0),
  isPriceFrom: z.boolean().default(false),
  durationMinutes: z.number().int().min(0).max(240),
  addonType: z.enum(["optional", "new_client_check"]).default("optional"),
  isActive: z.boolean().default(true),
});
