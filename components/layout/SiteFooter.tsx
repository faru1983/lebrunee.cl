import Link from "next/link";
import { Instagram, MapPin, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";
import type { ContactPublicSettings } from "@/lib/types";

interface SiteFooterProps {
  businessName: string;
  tagline: string | null;
  contactPublic: ContactPublicSettings;
}

export function SiteFooter({ businessName, tagline, contactPublic }: SiteFooterProps) {
  const waUrl = buildWhatsAppUrl(
    contactPublic.whatsappNumber,
    `Hola! Tengo una consulta sobre reservas en ${businessName}.`
  );

  return (
    <footer className="mt-auto border-t border-[#f1dfe8] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1.5">
          <p className="font-serif text-xl font-semibold text-[#1f141b]">{businessName}</p>
          {tagline && <p className="text-sm text-[#6c5763]">{tagline}</p>}
          <p className="flex items-center gap-1.5 text-xs text-[#7c6572]">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <span>{contactPublic.publicLocationLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a
            href={contactPublic.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#edd8e3] px-4 text-[#3c2733] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <Instagram className="h-4 w-4" />
            <span>{contactPublic.instagramHandle}</span>
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#edd8e3] px-4 text-[#3c2733] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center px-3 text-xs font-medium text-[#8a7581] transition hover:text-[#1f141b]"
          >
            Administración
          </Link>
        </div>
      </div>
    </footer>
  );
}
