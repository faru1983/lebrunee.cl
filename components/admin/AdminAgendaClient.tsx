"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  MessageCircle,
  Move,
  RotateCcw,
  X,
} from "lucide-react";
import {
  confirmAppointmentDepositAction,
  updateAppointmentStatusAction,
} from "@/app/actions/adminActions";
import {
  adminMoveAppointmentAction,
  fetchAgendaWindowAction,
  quickDeleteAgendaBlockAction,
  type MoveConflictInfo,
} from "@/app/actions/agendaActions";
import { AppointmentDetailModal } from "@/components/admin/AppointmentDetailModal";
import { ManualAppointmentModal } from "@/components/admin/ManualAppointmentModal";
import { AgendaDayView } from "@/components/admin/agenda/AgendaDayView";
import { AgendaListView } from "@/components/admin/agenda/AgendaListView";
import { AgendaMonthView } from "@/components/admin/agenda/AgendaMonthView";
import {
  AgendaToolbar,
  type AgendaFilterStatus,
} from "@/components/admin/agenda/AgendaToolbar";
import { AgendaWeekView } from "@/components/admin/agenda/AgendaWeekView";
import { EmergencyControlModal } from "@/components/admin/agenda/EmergencyControlModal";
import {
  addMonthsToIsoDate,
  buildRescheduleWhatsappUrl,
  formatMonthTitleEs,
  formatWeekRangeEs,
  getClientFullName,
  getMonthGridDates,
  getWeekDates,
  type AgendaViewMode,
} from "@/components/admin/agenda/agendaHelpers";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type {
  AgendaClientOption,
  AppointmentRecord,
  AppointmentStatus,
  AvailabilityException,
  AvailabilityRule,
  PaymentMethodRecord,
  ServiceAddon,
  ServiceItem,
  StaffMember,
} from "@/lib/types";
import { addDaysToIsoDate, formatDateLongEs } from "@/lib/utils";

export type { AgendaFilterStatus };

interface AdminAgendaClientProps {
  today: string;
  nowMinutes: number;
  businessName: string;
  initialIsAgendaOpen: boolean;
  initialView?: AgendaViewMode;
  initialDate?: string;
  initialStatus?: AgendaFilterStatus;
  initialOpenEmergency?: boolean;
  initialWindowFrom: string;
  initialWindowTo: string;
  appointments: AppointmentRecord[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  clients: AgendaClientOption[];
  services: ServiceItem[];
  addons: ServiceAddon[];
  staff: StaffMember[];
  paymentMethods: PaymentMethodRecord[];
  depositDefaultClp: number;
}

interface PendingOverrideDrop {
  appointment: AppointmentRecord;
  targetDate: string;
  targetStartTime: string;
  targetStaffId: string;
  targetDuration?: number;
  conflict: MoveConflictInfo;
}

interface ActionToast {
  message: string;
  whatsappUrl?: string | null;
  undoPayload?: {
    appointmentId: string;
    appointmentDate: string;
    startTime: string;
    staffId: string;
    durationMinutes: number;
  };
}

export function AdminAgendaClient({
  today,
  nowMinutes,
  businessName,
  initialIsAgendaOpen,
  initialView = "week",
  initialDate,
  initialStatus = "all",
  initialOpenEmergency = false,
  initialWindowFrom,
  initialWindowTo,
  appointments: initialAppointments,
  rules,
  exceptions: initialExceptions,
  clients,
  services,
  addons,
  staff,
  paymentMethods,
  depositDefaultClp,
}: AdminAgendaClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [viewMode, setViewMode] = useState<AgendaViewMode>(initialView);
  const [activeDate, setActiveDate] = useState<string>(initialDate || today);
  const [filterStatus, setFilterStatus] = useState<AgendaFilterStatus>(initialStatus);
  const [showCancelled, setShowCancelled] = useState<boolean>(
    initialStatus === "cancelled" || initialStatus === "no_show"
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [isAgendaOpen, setIsAgendaOpen] = useState(initialIsAgendaOpen);

  // Live agenda window data (expands automatically when navigating months/weeks)
  const [windowRange, setWindowRange] = useState({
    from: initialWindowFrom,
    to: initialWindowTo,
  });
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(initialAppointments);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>(initialExceptions);
  const [isLoadingWindow, setIsLoadingWindow] = useState(false);

  // Modals & Interactive states
  const [manualModal, setManualModal] = useState<{
    open: boolean;
    date: string;
    time: string;
    staffId?: string;
  }>({ open: false, date: today, time: "" });
  const [detailTarget, setDetailTarget] = useState<AppointmentRecord | null>(null);
  const [emergencyModal, setEmergencyModal] = useState<{
    open: boolean;
    date: string;
    blockStart?: string;
  }>({ open: initialOpenEmergency, date: initialDate || today });

  const [movingAppointment, setMovingAppointment] = useState<AppointmentRecord | null>(null);
  const [overridePrompt, setOverridePrompt] = useState<PendingOverrideDrop | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ActionToast | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const primaryStaffId = staff[0]?.id || "";

  const syncUrl = useCallback(
    (nextView: AgendaViewMode, nextDate: string, nextStatus: AgendaFilterStatus) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      params.set("view", nextView);
      params.set("date", nextDate);
      params.set("status", nextStatus);
      params.delete("emergency");
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname]
  );

  const reloadWindow = useCallback(
    async (fromDate: string, toDate: string) => {
      setIsLoadingWindow(true);
      try {
        const res = await fetchAgendaWindowAction({ fromDate, toDate });
        if (res.success) {
          setAppointments(res.appointments);
          setExceptions(res.exceptions);
          setWindowRange({ from: fromDate, to: toDate });
        }
      } finally {
        setIsLoadingWindow(false);
      }
    },
    []
  );

  const ensureDateCovered = useCallback(
    (targetDate: string) => {
      const marginFrom = addDaysToIsoDate(targetDate, -10);
      const marginTo = addDaysToIsoDate(targetDate, 35);
      if (marginFrom < windowRange.from || marginTo > windowRange.to) {
        const nextFrom = addDaysToIsoDate(targetDate, -35);
        const nextTo = addDaysToIsoDate(targetDate, 65);
        void reloadWindow(nextFrom, nextTo);
      }
    },
    [windowRange, reloadWindow]
  );

  function handleChangeView(nextView: AgendaViewMode) {
    setViewMode(nextView);
    syncUrl(nextView, activeDate, filterStatus);
    setLiveAnnouncement(`Vista cambiada a ${nextView}`);
  }

  function handleNavigateDate(nextDate: string, switchToView?: AgendaViewMode) {
    const targetView = switchToView || viewMode;
    setActiveDate(nextDate);
    if (switchToView) setViewMode(switchToView);
    syncUrl(targetView, nextDate, filterStatus);
    ensureDateCovered(nextDate);
  }

  function handleStepPeriod(direction: -1 | 1) {
    if (viewMode === "day") {
      handleNavigateDate(addDaysToIsoDate(activeDate, direction));
    } else if (viewMode === "week") {
      handleNavigateDate(addDaysToIsoDate(activeDate, direction * 7));
    } else if (viewMode === "month") {
      handleNavigateDate(addMonthsToIsoDate(activeDate, direction));
    } else {
      handleNavigateDate(addDaysToIsoDate(activeDate, direction * 14));
    }
  }

  function handleSelectStatus(nextStatus: AgendaFilterStatus) {
    setFilterStatus(nextStatus);
    if (nextStatus === "cancelled" || nextStatus === "no_show") {
      setShowCancelled(true);
    }
    syncUrl(viewMode, activeDate, nextStatus);
  }

  const weekDates = useMemo(() => getWeekDates(activeDate), [activeDate]);
  const monthMeta = useMemo(() => getMonthGridDates(activeDate), [activeDate]);

  const periodLabel = useMemo(() => {
    if (viewMode === "day") return formatDateLongEs(activeDate);
    if (viewMode === "week") return formatWeekRangeEs(weekDates);
    if (viewMode === "month") return formatMonthTitleEs(activeDate);
    return `Lista general (${windowRange.from} a ${windowRange.to})`;
  }, [viewMode, activeDate, weekDates, windowRange]);

  const visibleStaff = useMemo(
    () =>
      selectedStaffId === "all"
        ? staff
        : staff.filter((s) => s.id === selectedStaffId),
    [staff, selectedStaffId]
  );

  const filteredAppointments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (selectedStaffId !== "all" && a.staff_id !== selectedStaffId) return false;
      if (filterStatus !== "all") {
        if (a.status !== filterStatus) return false;
      } else if (!showCancelled && (a.status === "cancelled" || a.status === "no_show")) {
        return false;
      }
      if (!q) return true;
      const fullName = getClientFullName(a).toLowerCase();
      return (
        fullName.includes(q) ||
        a.booking_code.toLowerCase().includes(q) ||
        (a.client?.phone || "").includes(q) ||
        (a.client?.email || "").toLowerCase().includes(q)
      );
    });
  }, [appointments, selectedStaffId, filterStatus, showCancelled, query]);

  // Period KPIs matching the currently visible timeframe
  const periodStats = useMemo(() => {
    const weekSet = new Set(weekDates);
    const inPeriod = appointments.filter((a) => {
      if (selectedStaffId !== "all" && a.staff_id !== selectedStaffId) return false;
      if (viewMode === "day") return a.appointment_date === activeDate;
      if (viewMode === "week") return weekSet.has(a.appointment_date);
      if (viewMode === "month") {
        return (
          a.appointment_date >= monthMeta.firstOfMonth &&
          a.appointment_date <= monthMeta.lastOfMonth
        );
      }
      return true;
    });

    const active = inPeriod.filter((a) =>
      ["pending_deposit", "confirmed", "completed"].includes(a.status)
    );
    return {
      activeCount: active.length,
      pendingCount: inPeriod.filter((a) => a.status === "pending_deposit").length,
      estimatedRevenueClp: active.reduce((sum, a) => sum + (a.total_estimated_clp || 0), 0),
      occupiedMinutes: active.reduce((sum, a) => sum + (a.total_duration_minutes || 0), 0),
    };
  }, [appointments, selectedStaffId, viewMode, activeDate, weekDates, monthMeta]);

  async function refreshCurrentWindow(toastMessage?: string) {
    await reloadWindow(windowRange.from, windowRange.to);
    router.refresh();
    if (toastMessage) {
      setToast({ message: toastMessage });
      setLiveAnnouncement(toastMessage);
    }
  }

  async function handleQuickApprove(appt: AppointmentRecord) {
    setBusyId(appt.id);
    try {
      const res = await confirmAppointmentDepositAction(appt.id, appt.deposit_required_clp);
      if (res.success) {
        await refreshCurrentWindow(
          `Abono aprobado · Cita ${appt.booking_code} confirmada.`
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleQuickStatus(id: string, status: AppointmentStatus) {
    if (status === "cancelled" && !window.confirm("¿Cancelar esta cita?")) return;
    setBusyId(id);
    try {
      const res = await updateAppointmentStatusAction(id, status);
      if (res.success) {
        await refreshCurrentWindow("Estado de cita actualizado.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function executeMove(params: {
    appointment: AppointmentRecord;
    targetDate: string;
    targetStartTime: string;
    targetStaffId: string;
    targetDuration?: number;
    forceOverride?: boolean;
  }) {
    setBusyId(params.appointment.id);
    try {
      const res = await adminMoveAppointmentAction({
        appointmentId: params.appointment.id,
        appointmentDate: params.targetDate,
        startTime: params.targetStartTime,
        staffId: params.targetStaffId,
        durationMinutes: params.targetDuration,
        forceOverride: Boolean(params.forceOverride),
        notifyClientEmail: false,
      });

      if (!res.success) {
        if (res.conflict) {
          setOverridePrompt({
            appointment: params.appointment,
            targetDate: params.targetDate,
            targetStartTime: params.targetStartTime,
            targetStaffId: params.targetStaffId,
            targetDuration: params.targetDuration,
            conflict: res.conflict,
          });
        } else {
          setToast({ message: res.error });
        }
        return;
      }

      // Optimistically patch local list and refresh server cache
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === params.appointment.id
            ? {
                ...a,
                appointment_date: res.appointment.appointment_date,
                start_time: res.appointment.start_time,
                end_time: res.appointment.end_time,
                staff_id: res.appointment.staff_id,
                total_duration_minutes: res.appointment.total_duration_minutes,
              }
            : a
        )
      );
      setMovingAppointment(null);
      setOverridePrompt(null);

      const waUrl = buildRescheduleWhatsappUrl({
        phone: params.appointment.client?.phone,
        firstName: params.appointment.client?.first_name || "Clienta",
        businessName,
        bookingCode: params.appointment.booking_code,
        newDate: res.appointment.appointment_date,
        newStartTime: res.appointment.start_time.slice(0, 5),
      });

      const msg = `Cita ${params.appointment.booking_code} (${getClientFullName(params.appointment)}) movida al ${formatDateLongEs(res.appointment.appointment_date)} · ${res.appointment.start_time.slice(0, 5)} hrs.`;
      setToast({
        message: msg,
        whatsappUrl: waUrl,
        undoPayload: {
          appointmentId: params.appointment.id,
          appointmentDate: params.appointment.appointment_date,
          startTime: params.appointment.start_time.slice(0, 5),
          staffId: params.appointment.staff_id,
          durationMinutes: params.appointment.total_duration_minutes,
        },
      });
      setLiveAnnouncement(msg);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndoMove() {
    if (!toast?.undoPayload) return;
    const u = toast.undoPayload;
    setBusyId(u.appointmentId);
    try {
      const res = await adminMoveAppointmentAction({
        appointmentId: u.appointmentId,
        appointmentDate: u.appointmentDate,
        startTime: u.startTime,
        staffId: u.staffId,
        durationMinutes: u.durationMinutes,
        forceOverride: true,
      });
      if (res.success) {
        await refreshCurrentWindow("Movimiento deshecho · Cita devuelta a su horario anterior.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteException(exceptionId: string) {
    if (!window.confirm("¿Eliminar este bloqueo de la agenda?")) return;
    setBusyId(exceptionId);
    try {
      const res = await quickDeleteAgendaBlockAction(exceptionId);
      if (res.success) {
        await refreshCurrentWindow("Bloqueo eliminado de la agenda.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <AgendaToolbar
        viewMode={viewMode}
        onChangeView={handleChangeView}
        periodLabel={periodLabel}
        onPrev={() => handleStepPeriod(-1)}
        onNext={() => handleStepPeriod(1)}
        onToday={() => handleNavigateDate(today)}
        isLoadingWindow={isLoadingWindow}
        isAgendaOpen={isAgendaOpen}
        query={query}
        onQueryChange={setQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={handleSelectStatus}
        showCancelled={showCancelled}
        onToggleShowCancelled={() => setShowCancelled((v) => !v)}
        staff={staff}
        selectedStaffId={selectedStaffId}
        onSelectStaff={setSelectedStaffId}
        stats={periodStats}
        onNewAppointment={() =>
          setManualModal({ open: true, date: activeDate, time: "", staffId: primaryStaffId })
        }
        onOpenEmergency={() =>
          setEmergencyModal({ open: true, date: activeDate })
        }
        liveAnnouncement={liveAnnouncement}
      />

      {/* Sticky Move Mode Banner (Mobile + Desktop Tap-to-Place) */}
      {movingAppointment && (
        <div
          role="region"
          aria-label="Modo mover cita activo"
          className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[#1f141b] px-4 py-3 text-xs text-white shadow-lg md:top-3"
        >
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 shrink-0 text-pink-300" aria-hidden="true" />
            <span>
              <strong>Moviendo:</strong> {getClientFullName(movingAppointment)} (
              {movingAppointment.total_duration_minutes} min) ·{" "}
              <span className="text-pink-200">
                Toca cualquier horario en el calendario (puedes cambiar de día o semana) para
                ubicarla.
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMovingAppointment(null)}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white/15 px-3 font-bold text-white hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Cancelar
          </button>
        </div>
      )}

      {/* Contextual Action Toast (with WhatsApp + Undo after drag/move!) */}
      {toast && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-950"
        >
          <span>{toast.message}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {toast.whatsappUrl && (
              <a
                href={toast.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Avisar por WhatsApp
              </a>
            )}
            {toast.undoPayload && (
              <button
                type="button"
                onClick={handleUndoMove}
                className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-emerald-300 bg-white px-2.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Deshacer
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Cerrar notificación"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-emerald-800 hover:bg-emerald-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Main Calendar Stage */}
      <div id="agenda-calendar-stage">
        {viewMode === "day" && (
          <AgendaDayView
            dateStr={activeDate}
            today={today}
            nowMinutes={nowMinutes}
            businessName={businessName}
            appointments={filteredAppointments}
            rules={rules}
            exceptions={exceptions}
            staff={visibleStaff}
            movingAppointment={movingAppointment}
            onStartMoveMode={(appt) => setMovingAppointment(appt)}
            onDropAppointment={(payload) => executeMove(payload)}
            onOpenDetail={(appt) => setDetailTarget(appt)}
            onQuickApprove={handleQuickApprove}
            onSlotCreateAppointment={(date, time, staffId) =>
              setManualModal({ open: true, date, time, staffId })
            }
            onSlotQuickBlock={(date, time) =>
              setEmergencyModal({ open: true, date, blockStart: time })
            }
            onDeleteException={handleDeleteException}
            busyId={busyId}
          />
        )}

        {viewMode === "week" && (
          <AgendaWeekView
            weekDates={weekDates}
            today={today}
            nowMinutes={nowMinutes}
            appointments={filteredAppointments}
            rules={rules}
            exceptions={exceptions}
            primaryStaffId={visibleStaff[0]?.id || primaryStaffId}
            movingAppointment={movingAppointment}
            onStartMoveMode={(appt) => setMovingAppointment(appt)}
            onDropAppointment={(payload) => executeMove(payload)}
            onOpenDetail={(appt) => setDetailTarget(appt)}
            onSelectDay={(d) => handleNavigateDate(d, "day")}
            onSlotCreateAppointment={(date, time, staffId) =>
              setManualModal({ open: true, date, time, staffId })
            }
            onQuickApprove={handleQuickApprove}
            busyId={busyId}
          />
        )}

        {viewMode === "month" && (
          <AgendaMonthView
            activeDate={activeDate}
            today={today}
            businessName={businessName}
            appointments={filteredAppointments}
            rules={rules}
            exceptions={exceptions}
            primaryStaffId={visibleStaff[0]?.id || primaryStaffId}
            movingAppointment={movingAppointment}
            onSelectDate={(d) => handleNavigateDate(d)}
            onOpenDayView={(d) => handleNavigateDate(d, "day")}
            onOpenDetail={(appt) => setDetailTarget(appt)}
            onStartMoveMode={(appt) => {
              setMovingAppointment(appt);
              handleNavigateDate(appt.appointment_date, "day");
            }}
            onQuickApprove={handleQuickApprove}
            onCreateAppointmentForDate={(d) =>
              setManualModal({ open: true, date: d, time: "10:00", staffId: primaryStaffId })
            }
            onQuickBlockDate={(d) =>
              setEmergencyModal({ open: true, date: d })
            }
            busyId={busyId}
          />
        )}

        {viewMode === "list" && (
          <AgendaListView
            appointments={filteredAppointments}
            businessName={businessName}
            busyId={busyId}
            onApprove={handleQuickApprove}
            onStatus={handleQuickStatus}
            onOpenDetail={(appt) => setDetailTarget(appt)}
            onStartMoveMode={(appt) => {
              setMovingAppointment(appt);
              handleNavigateDate(appt.appointment_date, "day");
            }}
          />
        )}
      </div>

      {/* Conflict Override Confirmation Dialog (for Drag & Drop or Tap-to-Place) */}
      <ModalDialog
        open={Boolean(overridePrompt)}
        onClose={() => setOverridePrompt(null)}
        title="Confirmar movimiento con excepción"
      >
        {overridePrompt && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="text-xs">
                <p className="font-bold">
                  Destino: {formatDateLongEs(overridePrompt.targetDate)} a las{" "}
                  {overridePrompt.targetStartTime} hrs
                </p>
                <p className="mt-1">{overridePrompt.conflict.message}</p>
              </div>
            </div>

            <p className="text-xs text-[#5d4754]">
              Como administradora tienes control total: puedes forzar el movimiento como sobrecupo o
              horario especial, o cancelar y elegir otro bloque.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setOverridePrompt(null)}
                className="min-h-11 rounded-full border border-[#e2cbd7] px-4 text-xs font-semibold text-[#4a3541]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId === overridePrompt.appointment.id}
                onClick={() =>
                  executeMove({
                    ...overridePrompt,
                    forceOverride: true,
                  })
                }
                className="min-h-11 rounded-full bg-amber-700 px-5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                Mover igual (Forzar)
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Manual Appointment Modal */}
      <ManualAppointmentModal
        key={
          manualModal.open
            ? `${manualModal.date}-${manualModal.time}-${manualModal.staffId || ""}`
            : "closed"
        }
        open={manualModal.open}
        onClose={() => setManualModal((prev) => ({ ...prev, open: false }))}
        onCreated={() => void refreshCurrentWindow("Cita manual creada en la agenda.")}
        services={services}
        addons={addons}
        staff={staff}
        clients={clients}
        defaultDate={manualModal.date}
        defaultTime={manualModal.time}
        defaultStaffId={manualModal.staffId}
        depositDefaultClp={depositDefaultClp}
      />

      {/* Quick-Edit, Checkout & Client Modal */}
      <AppointmentDetailModal
        key={detailTarget?.id || "none"}
        appointment={detailTarget}
        onClose={() => setDetailTarget(null)}
        onUpdated={(msg) => void refreshCurrentWindow(msg || "Cita actualizada.")}
        paymentMethods={paymentMethods}
        services={services}
        addons={addons}
        staff={staff}
        businessName={businessName}
        onStartMoveMode={(appt) => {
          setMovingAppointment(appt);
          if (viewMode === "list" || viewMode === "month") {
            handleNavigateDate(appt.appointment_date, "day");
          }
        }}
      />

      {/* Emergency & Operational Control Modal */}
      <EmergencyControlModal
        key={
          emergencyModal.open
            ? `${emergencyModal.date}-${emergencyModal.blockStart || ""}`
            : "closed"
        }
        open={emergencyModal.open}
        onClose={() => setEmergencyModal((prev) => ({ ...prev, open: false }))}
        defaultDate={emergencyModal.date}
        defaultBlockStart={emergencyModal.blockStart}
        today={today}
        nowMinutes={nowMinutes}
        businessName={businessName}
        isAgendaOpen={isAgendaOpen}
        staff={staff}
        appointments={appointments}
        exceptions={exceptions}
        onRefreshNeeded={(msg) => void refreshCurrentWindow(msg)}
        onAgendaOpenChanged={(next) => setIsAgendaOpen(next)}
      />
    </div>
  );
}
