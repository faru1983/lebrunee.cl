import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, LogOut, MailCheck, Scissors, Settings } from "lucide-react";
import { adminLogoutAction } from "@/app/actions/adminActions";
import { getAuthenticatedAdminContext } from "@/lib/services/businessService";

export const dynamic = "force-dynamic";

const MORE_LINKS = [
  {
    href: "/admin/services",
    title: "Servicios y Extras",
    desc: "Precios, duraciones y adicionales como retiro externo.",
    icon: Scissors,
  },
  {
    href: "/admin/schedule",
    title: "Horarios y Bloques",
    desc: "Turnos semanales, bloques fijos vs dinámicos y bloqueos.",
    icon: Clock,
  },
  {
    href: "/admin/comunicaciones",
    title: "Comunicaciones y Mantención",
    desc: "Recordatorios automáticos tras XX días y cuota de Resend.",
    icon: MailCheck,
  },
  {
    href: "/admin/settings",
    title: "Configuración del Negocio",
    desc: "Marca, dirección privada, banco, Resend y perfiles de equipo.",
    icon: Settings,
  },
];

export default async function AdminMorePage() {
  const ctx = await getAuthenticatedAdminContext();
  if (!ctx) redirect("/admin/login");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
          Más herramientas
        </h1>
        <p className="text-xs text-[#6c5763]">
          {ctx.member.display_name} · {ctx.business.name}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MORE_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3.5 rounded-3xl border border-[#eedbe4] bg-white p-5 transition hover:border-[var(--brand-primary)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fdf0f6] text-[var(--brand-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1f141b]">{item.title}</h2>
                <p className="mt-0.5 text-xs text-[#6c5763]">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <form action={adminLogoutAction}>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white text-sm font-semibold text-red-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </form>
    </div>
  );
}
