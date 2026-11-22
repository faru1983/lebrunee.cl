export function normalizePhone(input: string): string {
  const raw = input.trim().replace(/[^\d+]/g, "");
  if (!raw) return "";

  let digits = raw.startsWith("+") ? raw.slice(1) : raw;
  digits = digits.replace(/\D/g, "");

  // Chile mobile normalization: 9XXXXXXXX -> 569XXXXXXXX, 09XXXXXXXX -> 569XXXXXXXX
  if (digits.startsWith("09") && digits.length === 10) {
    digits = `56${digits.slice(1)}`;
  } else if (digits.startsWith("9") && digits.length === 9) {
    digits = `56${digits}`;
  } else if (digits.startsWith("5609") && digits.length === 12) {
    digits = `569${digits.slice(4)}`;
  }

  return digits ? `+${digits}` : "";
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  if (!normalized) return false;
  if (normalized.startsWith("+56")) {
    return /^\+569\d{8}$/.test(normalized);
  }
  return /^\+\d{9,15}$/.test(normalized);
}

export function toWhatsAppDigits(input: string): string {
  return normalizePhone(input).replace(/^\+/, "");
}

export function formatPhoneDisplay(input: string | null | undefined): string {
  if (!input) return "";
  const normalized = normalizePhone(input);
  if (/^\+569\d{8}$/.test(normalized)) {
    return `+56 9 ${normalized.slice(4, 8)} ${normalized.slice(8)}`;
  }
  return normalized || input;
}
