"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Search, Sparkles } from "lucide-react";
import { logRetentionWhatsappAction } from "@/app/actions/crmFinanceActions";
import type { ClientSummaryRecord, RetentionRulesSettings } from "@/lib/types";
import {
  buildWhatsAppUrl,
  formatClp,
  formatDateShortEs,
  resolveTemplate,
} from "@/lib/utils";

interface AdminClientsClientProps {
  businessName: string;
  clients: ClientSummaryRecord[];
  retentionRules: RetentionRulesSettings;
}

export function AdminClientsClient({
  businessName,
  clients,
  retentionRules,
}: AdminClientsClientProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "frequent" | "retention">("all");

  const minDays = retentionRules.daysSinceLastVisit || 21;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter === "frequent" && c.visitsCount < 2) return false;
      if (
        filter === "retention" &&
        (c.retention_opt_out ||
          c.hasUpcomingAppointment ||
          c.daysSinceLastVisit === null ||
          c.daysSinceLastVisit < minDays)
      ) {
        return false;
      }
      if (!q) return true;
      const fullName = `${c.first_name} ${c.last_name || ""}`.toLowerCase();
      return (
        fullName.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.instagram_handle || "").toLowerCase().includes(q)
      );
    });
  }, [clients, filter, minDays, query]);

  const retentionCount = useMemo(
    () =>
      clients.filter(
        (c) =>
          !c.retention_opt_out &&
          !c.hasUpcomingAppointment &&
          c.daysSinceLastVisit !== null &&
          c.daysSinceLastVisit >= minDays
      ).length,
    [clients, minDays]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">Clientas</h1>
          <p className="text-xs text-[#6c5763]">
            {clients.length} registradas · Ficha técnica de uñas e historial
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-4">
        <search>
          <label htmlFor="clients-search" className="visually-hidden">
            Buscar clienta
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a6571]" />
            <input
              id="clients-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, correo, WhatsApp o @instagram"
              className="min-h-11 w-full rounded-2xl border border-[#e2cbd7] pl-10 pr-4 text-sm"
            />
          </div>
        </search>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
              filter === "all"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[#faf5f8] text-[#4a3541]"
            }`}
          >
            Todas ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("frequent")}
            className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
              filter === "frequent"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[#faf5f8] text-[#4a3541]"
            }`}
          >
            Recurrentes (2+)
          </button>
          <button
            type="button"
            onClick={() => setFilter("retention")}
            className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
              filter === "retention"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            Mantención (+{minDays}d): {retentionCount}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-[#eedbe4] bg-white p-8 text-center text-sm text-[#6c5763]">
          No hay clientas que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => {
            const isDueRetention =
              !c.hasUpcomingAppointment &&
              c.daysSinceLastVisit !== null &&
              c.daysSinceLastVisit >= minDays;

            const waMessage = isDueRetention
              ? resolveTemplate(retentionRules.whatsappTemplate, {
                  nombre: c.first_name,
                  dias: c.daysSinceLastVisit || minDays,
                  servicio: c.lastServiceName || "tu última atención",
                  negocio: businessName,
                  link_reserva: `${typeof window !== "undefined" ? window.location.origin : ""}/reservar`,
                })
              : `Hola ${c.first_name}! Te escribimos desde ${businessName}.`;

            const waUrl = c.phone ? buildWhatsAppUrl(c.phone, waMessage) : null;

            return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-3xl border border-[#eedbe4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-base font-bold text-[#1f141b] hover:text-[var(--brand-primary)]"
                    >
                      {c.first_name} {c.last_name || ""}
                    </Link>
                    {c.visitsCount >= 2 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-primary)]">
                        <Sparkles className="h-3 w-3" />
                        {c.visitsCount} visitas
                      </span>
                    )}
                    {isDueRetention && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Hace {c.daysSinceLastVisit} días
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#6c5763]">
                    {c.email}
                    {c.instagram_handle ? ` · @${c.instagram_handle}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#5d4754]">
                    Total gastado: <strong>{formatClp(c.totalSpentClp)}</strong>
                    {c.lastVisitDate
                      ? ` · Última visita: ${formatDateShortEs(c.lastVisitDate)}`
                      : " · Sin citas completadas aún"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (isDueRetention && c.daysSinceLastVisit !== null) {
                          logRetentionWhatsappAction(c.id, c.daysSinceLastVisit);
                        }
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#e2cbd7] px-3 text-xs font-semibold text-[#1f141b]"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{isDueRetention ? "Recordar" : "WhatsApp"}</span>
                    </a>
                  )}
                  <Link
                    href={`/admin/clients/${c.id}`}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#fdf0f6] px-3.5 text-xs font-semibold text-[var(--brand-primary)]"
                  >
                    <span>Ficha</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
