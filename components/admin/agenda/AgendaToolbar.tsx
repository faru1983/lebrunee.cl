"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { AppointmentStatus, StaffMember } from "@/lib/types";
import { formatClp } from "@/lib/utils";
import {
  formatMinutesAsDuration,
  type AgendaViewMode,
} from "@/components/admin/agenda/agendaHelpers";

export type AgendaFilterStatus = "all" | AppointmentStatus;

interface AgendaToolbarProps {
  viewMode: AgendaViewMode;
  onChangeView: (view: AgendaViewMode) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isLoadingWindow: boolean;
  isAgendaOpen: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  filterStatus: AgendaFilterStatus;
  onFilterStatusChange: (status: AgendaFilterStatus) => void;
  showCancelled: boolean;
  onToggleShowCancelled: () => void;
  staff: StaffMember[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  stats: {
    activeCount: number;
    pendingCount: number;
    estimatedRevenueClp: number;
    occupiedMinutes: number;
  };
  onNewAppointment: () => void;
  onOpenEmergency: () => void;
  liveAnnouncement: string;
}

const VIEW_TABS: Array<{ id: AgendaViewMode; label: string; icon: typeof Calendar }> = [
  { id: "day", label: "Día", icon: Calendar },
  { id: "week", label: "Semana", icon: CalendarRange },
  { id: "month", label: "Mes", icon: CalendarDays },
  { id: "list", label: "Lista", icon: List },
];

export function AgendaToolbar({
  viewMode,
  onChangeView,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  isLoadingWindow,
  isAgendaOpen,
  query,
  onQueryChange,
  filterStatus,
  onFilterStatusChange,
  showCancelled,
  onToggleShowCancelled,
  staff,
  selectedStaffId,
  onSelectStaff,
  stats,
  onNewAppointment,
  onOpenEmergency,
  liveAnnouncement,
}: AgendaToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Roving tabindex fallback only when native `focusgroup` is unsupported
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar) return;
    if ("focusGroup" in HTMLElement.prototype) return;

    const getItems = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));

    const items = getItems();
    items.forEach((btn, i) => {
      btn.tabIndex = i === 0 ? 0 : -1;
    });

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      const currentItems = getItems();
      if (target instanceof HTMLButtonElement && currentItems.includes(target)) {
        currentItems.forEach((b) => {
          b.tabIndex = b === target ? 0 : -1;
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const currentItems = getItems();
      const idx = currentItems.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;
      const rtl = getComputedStyle(bar).direction === "rtl";
      const delta =
        e.key === "ArrowRight"
          ? rtl
            ? -1
            : 1
          : e.key === "ArrowLeft"
          ? rtl
            ? 1
            : -1
          : 0;

      if (delta !== 0) {
        e.preventDefault();
        const next = currentItems[(idx + delta + currentItems.length) % currentItems.length];
        next?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        currentItems[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        currentItems[currentItems.length - 1]?.focus();
      }
    };

    bar.addEventListener("focusin", onFocusIn);
    bar.addEventListener("keydown", onKeyDown);
    return () => {
      bar.removeEventListener("focusin", onFocusIn);
      bar.removeEventListener("keydown", onKeyDown);
    };
  }, [viewMode]);

  return (
    <div className="space-y-3">
      {/* Screen reader status announcements outside the toolbar */}
      <p role="status" aria-live="polite" className="visually-hidden">
        {liveAnnouncement}
      </p>

      {/* Top Command Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
              Agenda Pro
            </h1>
            <button
              type="button"
              onClick={onOpenEmergency}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                isAgendaOpen
                  ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "bg-red-100 text-red-800 hover:bg-red-200"
              }`}
              title="Cambiar estado de reservas web o acciones de emergencia"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isAgendaOpen ? "bg-emerald-500" : "bg-red-600 animate-pulse"
                }`}
              />
              {isAgendaOpen ? "Web abierta" : "Web PAUSADA"}
            </button>
          </div>
          <p className="mt-0.5 text-xs text-[#6c5763] capitalize">
            {periodLabel}
            {isLoadingWindow ? " · Actualizando..." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenEmergency}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100"
          >
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
            <span>Emergencia / Bloqueos</span>
          </button>

          <button
            type="button"
            onClick={onNewAppointment}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Nueva cita</span>
          </button>
        </div>
      </div>

      {/* Period Summary Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#eedbe4] bg-white px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#7a6571]">Citas activas</p>
          <p className="mt-0.5 text-xl font-bold text-[#1f141b]">{stats.activeCount}</p>
        </div>

        <button
          type="button"
          onClick={() =>
            onFilterStatusChange(
              filterStatus === "pending_deposit" ? "all" : "pending_deposit"
            )
          }
          className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${
            stats.pendingCount > 0
              ? "border-amber-300 bg-amber-50/75 hover:bg-amber-50"
              : "border-[#eedbe4] bg-white hover:bg-[#fdf8fa]"
          } ${filterStatus === "pending_deposit" ? "ring-2 ring-amber-500" : ""}`}
        >
          <p className="flex items-center gap-1 text-[11px] font-medium text-amber-900">
            {stats.pendingCount > 0 && (
              <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden="true" />
            )}
            Por aprobar abono
          </p>
          <p className="mt-0.5 text-xl font-bold text-amber-950">{stats.pendingCount}</p>
        </button>

        <div className="rounded-2xl border border-[#eedbe4] bg-white px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#7a6571]">Estimado período</p>
          <p className="mt-0.5 text-lg font-bold text-[#1f141b] sm:text-xl">
            {formatClp(stats.estimatedRevenueClp)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#eedbe4] bg-white px-3.5 py-2.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-[#7a6571]">
            <Sparkles className="h-3 w-3 text-[var(--brand-primary)]" aria-hidden="true" />
            Tiempo ocupado
          </p>
          <p className="mt-0.5 text-lg font-bold text-[#1f141b] sm:text-xl">
            {formatMinutesAsDuration(stats.occupiedMinutes)}
          </p>
        </div>
      </div>

      {/* Main Calendar Toolbar (accessible ARIA toolbar + focusgroup) */}
      <div className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-3.5 sm:p-4">
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Controles de calendario"
          aria-controls="agenda-calendar-stage"
          {...({ focusgroup: "toolbar wrap" } as Record<string, string>)}
          className="flex flex-wrap items-center justify-between gap-2.5"
        >
          {/* Date navigation group */}
          <div
            role="group"
            aria-label="Navegación de fechas"
            className="inline-flex items-center gap-1 rounded-2xl border border-[#eedbe4] bg-[#fdf9fb] p-1"
          >
            <button
              type="button"
              onClick={onPrev}
              aria-label="Período anterior"
              title="Período anterior"
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-[#4a3541] transition hover:bg-white hover:text-[var(--brand-primary)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="min-h-9 rounded-xl px-3 text-xs font-bold text-[#1f141b] transition hover:bg-white hover:text-[var(--brand-primary)]"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Período siguiente"
              title="Período siguiente"
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-[#4a3541] transition hover:bg-white hover:text-[var(--brand-primary)]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <span
            role="separator"
            aria-orientation="vertical"
            className="hidden h-6 border-l border-[#eedbe4] sm:inline-block"
          />

          {/* View switcher group */}
          <div
            role="group"
            aria-label="Modo de vista"
            className="inline-flex items-center gap-1 rounded-2xl border border-[#eedbe4] bg-[#fdf9fb] p-1"
          >
            {VIEW_TABS.map((t) => {
              const Icon = t.icon;
              const pressed = viewMode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onChangeView(t.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#4a3541] transition hover:bg-white aria-pressed:bg-[var(--brand-primary)] aria-pressed:text-white aria-pressed:shadow-xs"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cancel visibility toggle */}
          <button
            type="button"
            aria-pressed={showCancelled}
            onClick={onToggleShowCancelled}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#e2cbd7] bg-white px-3 text-xs font-semibold text-[#4a3541] transition hover:bg-[#fdf5f9] aria-pressed:border-[#1f141b] aria-pressed:bg-[#1f141b] aria-pressed:text-white"
          >
            <span>{showCancelled ? "Ocultar canceladas" : "Ver canceladas"}</span>
          </button>
        </div>

        {/* Search, Staff & Status Chips Row */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <search className="flex-1">
            <label htmlFor="agenda-search" className="visually-hidden">
              Buscar por clienta, código o teléfono
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a6571]"
                aria-hidden="true"
              />
              <input
                id="agenda-search"
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Buscar clienta, código LB-... o WhatsApp"
                className="min-h-10 w-full rounded-2xl border border-[#e2cbd7] bg-[#fdfafc] pl-10 pr-4 text-sm focus:bg-white"
              />
            </div>
          </search>

          {staff.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0 text-[#7a6571]" aria-hidden="true" />
              <label htmlFor="agenda-staff-filter" className="visually-hidden">
                Filtrar profesional
              </label>
              <select
                id="agenda-staff-filter"
                value={selectedStaffId}
                onChange={(e) => onSelectStaff(e.target.value)}
                className="min-h-10 rounded-2xl border border-[#e2cbd7] bg-white px-3 text-xs font-semibold text-[#1f141b]"
              >
                <option value="all">Todas las profesionales</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: "all", label: "Todas" },
                { id: "pending_deposit", label: "Pendientes" },
                { id: "confirmed", label: "Confirmadas" },
                { id: "completed", label: "Realizadas" },
                { id: "cancelled", label: "Canceladas" },
                { id: "no_show", label: "No asistió" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={filterStatus === chip.id}
                onClick={() => onFilterStatusChange(chip.id)}
                className="min-h-9 shrink-0 rounded-full bg-[#faf5f8] px-3 text-xs font-semibold text-[#4a3541] transition hover:bg-[#f4e4ec] aria-pressed:bg-[var(--brand-primary)] aria-pressed:text-white"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
