import Link from "next/link";
import { CalendarHeart, UserCheck } from "lucide-react";

interface SiteHeaderProps {
  businessName: string;
  logoUrl: string;
}

export function SiteHeader({ businessName, logoUrl }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#f1dfe8]/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src={logoUrl || "/images/brand-icon.svg"}
            alt={businessName}
            width={38}
            height={38}
            className="h-9 w-9 rounded-full object-cover shadow-sm"
          />
          <span className="font-serif text-xl font-semibold tracking-tight text-[#1f141b] sm:text-2xl">
            {businessName}
          </span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden items-center gap-6 text-sm font-medium text-[#54404c] md:flex">
          <Link href="/#servicios" className="transition hover:text-[var(--brand-primary)]">
            Servicios
          </Link>
          <Link href="/#experiencia" className="transition hover:text-[var(--brand-primary)]">
            Sobre el estudio
          </Link>
          <Link href="/#politicas" className="transition hover:text-[var(--brand-primary)]">
            Políticas
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/mi-cuenta"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#e7cddb] bg-white px-3.5 text-xs font-semibold text-[#3c2733] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:px-4 sm:text-sm"
          >
            <UserCheck className="h-4 w-4" />
            <span>Mis Citas</span>
          </Link>
          <Link
            href="/reservar"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-accent)] sm:px-5 sm:text-sm"
          >
            <CalendarHeart className="h-4 w-4" />
            <span>Reservar</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
