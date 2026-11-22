"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Home,
  LayoutGrid,
  LogOut,
  MailCheck,
  Scissors,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { adminLogoutAction } from "@/app/actions/adminActions";
import type { MemberRole } from "@/lib/types";

interface AdminShellProps {
  businessName: string;
  memberName: string;
  role: MemberRole;
  children: React.ReactNode;
}

const DESKTOP_NAV_ITEMS = [
  { href: "/admin", label: "Hoy", icon: Home, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { href: "/admin/clients", label: "Clientas", icon: Users, exact: false },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet, exact: false },
  { href: "/admin/comunicaciones", label: "Comunicaciones", icon: MailCheck, exact: false },
  { href: "/admin/services", label: "Servicios", icon: Scissors, exact: false },
  { href: "/admin/schedule", label: "Horarios", icon: Clock, exact: false },
  { href: "/admin/settings", label: "Ajustes", icon: Settings, exact: false },
];

const MOBILE_NAV_ITEMS = [
  { href: "/admin", label: "Hoy", icon: Home, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { href: "/admin/clients", label: "Clientas", icon: Users, exact: false },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet, exact: false },
  { href: "/admin/more", label: "Más", icon: LayoutGrid, exact: false },
];

export function AdminShell({
  businessName,
  memberName,
  role,
  children,
}: AdminShellProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (href === "/admin/more") {
      return (
        pathname.startsWith("/admin/more") ||
        pathname.startsWith("/admin/services") ||
        pathname.startsWith("/admin/schedule") ||
        pathname.startsWith("/admin/comunicaciones") ||
        pathname.startsWith("/admin/settings")
      );
    }
    return exact ? pathname === href : pathname.startsWith(href);
  };

  return (
    <div className="min-h-dvh bg-[#faf6f8] text-[#1f141b] md:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#eedbe4] bg-white md:flex">
        <div className="border-b border-[#f5e7ee] px-5 py-5">
          <p className="font-serif text-2xl font-semibold text-[#1f141b]">
            {businessName}
          </p>
          <p className="mt-0.5 text-xs text-[#6c5763]">
            {memberName} · <span className="uppercase">{role}</span>
          </p>
        </div>

        <nav aria-label="Menú administración" className="flex-1 space-y-1 p-3">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--brand-primary)] text-white shadow-xs"
                    : "text-[#4a3541] hover:bg-[#fdf3f7] hover:text-[var(--brand-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-[#f5e7ee] p-3">
          <Link
            href="/"
            className="flex min-h-10 items-center justify-between rounded-xl px-3 text-xs font-semibold text-[#6c5763] hover:bg-[#fdf3f7] hover:text-[#1f141b]"
          >
            <span>Ver sitio público</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-8">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#eedbe4] bg-white/95 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-semibold text-[#1f141b]">
              {businessName}
            </p>
            <p className="truncate text-[11px] text-[#6c5763]">{memberName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              aria-label="Ver sitio público"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eedbe4] text-[#4a3541]"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <form action={adminLogoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eedbe4] text-red-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#eedbe4] bg-white/95 pb-safe backdrop-blur-md md:hidden"
      >
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                active ? "text-[var(--brand-primary)]" : "text-[#7a6571]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
