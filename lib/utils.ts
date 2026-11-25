import { toWhatsAppDigits } from "@/lib/phone";

export function formatClp(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimeShort(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export function timeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.slice(0, 5).split(":").map(Number);
  return hh * 60 + mm;
}

export function minutesToTime(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function getTodayInTimezone(timezone = "America/Santiago"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getNowMinutesInTimezone(timezone = "America/Santiago"): {
  today: string;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = Number(map.hour === "24" ? "0" : map.hour);
  const minute = Number(map.minute);
  return {
    today: `${map.year}-${map.month}-${map.day}`,
    minutes: hour * 60 + minute,
  };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function getDayOfWeekFromIsoDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDateLongEs(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dt);
}

export function formatDateShortEs(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

export function formatDateDdMmYyyy(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.trim().split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

export function normalizePersonName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase("es-CL") + w.slice(1).toLocaleLowerCase("es-CL") : ""))
    .join(" ");
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const clean = normalizePersonName(fullName);
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length <= 1) return { firstName: clean, lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeInstagramHandle(input: string): string {
  return input.trim().replace(/\s+/g, "").replace(/^@+/, "").toLowerCase();
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function resolveTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
    const val = variables[key.trim()];
    return val !== undefined ? String(val) : match;
  });
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = toWhatsAppDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function hoursUntilAppointment(
  appointmentDate: string,
  startTime: string,
  timezone = "America/Santiago"
): number {
  const { today, minutes } = getNowMinutesInTimezone(timezone);
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = appointmentDate.split("-").map(Number);
  const nowUtcMs = Date.UTC(y1, m1 - 1, d1) + minutes * 60_000;
  const targetUtcMs = Date.UTC(y2, m2 - 1, d2) + timeToMinutes(startTime) * 60_000;
  return (targetUtcMs - nowUtcMs) / 3_600_000;
}
