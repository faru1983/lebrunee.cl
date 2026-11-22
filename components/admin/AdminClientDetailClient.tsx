"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  addClientTechnicalNoteAction,
  deleteClientTechnicalNoteAction,
  updateClientProfileAction,
} from "@/app/actions/crmFinanceActions";
import type {
  AppointmentRecord,
  ClientNoteRecord,
  ClientSummaryRecord,
} from "@/lib/types";
import { buildWhatsAppUrl, formatClp, formatDateLongEs } from "@/lib/utils";

interface AdminClientDetailClientProps {
  client: ClientSummaryRecord;
  appointments: AppointmentRecord[];
  notes: ClientNoteRecord[];
}

export function AdminClientDetailClient({
  client,
  appointments,
  notes,
}: AdminClientDetailClientProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name || "");
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone || "");
  const [instagram, setInstagram] = useState(client.instagram_handle || "");
  const [tagsText, setTagsText] = useState((client.tags || []).join(", "));
  const [generalNotes, setGeneralNotes] = useState(client.notes || "");
  const [optOut, setOptOut] = useState(client.retention_opt_out);

  const [techNote, setTechNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setToast(null);
    try {
      const res = await updateClientProfileAction({
        clientId: client.id,
        firstName,
        lastName,
        email,
        phone,
        instagramHandle: instagram,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: generalNotes,
        retentionOptOut: optOut,
      });
      if (!res.success) return setErrorMsg(res.error);
      setToast("Datos de la clienta actualizados.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTechNote(e: React.FormEvent) {
    e.preventDefault();
    if (!techNote.trim()) return;
    setBusy(true);
    try {
      const res = await addClientTechnicalNoteAction({
        clientId: client.id,
        note: techNote,
      });
      if (res.success) {
        setTechNote("");
        setToast("Nota técnica guardada.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const waUrl = phone
    ? buildWhatsAppUrl(phone, `Hola ${firstName}! Te escribimos desde Lebrunee.`)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/clients"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eedbe4] bg-white"
            aria-label="Volver a clientas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
              {client.first_name} {client.last_name || ""}
            </h1>
            <p className="text-xs text-[#6c5763]">{appointments.length} citas registradas</p>
          </div>
        </div>

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 text-xs font-semibold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Escribir por WhatsApp</span>
          </a>
        )}
      </div>

      {toast && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {toast}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Technical Nail Notes */}
      <section className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1f141b]">
          <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
          Ficha Técnica de Uñas y Bitácora
        </h2>

        <form onSubmit={addTechNote} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Ej. Base Rubber Nude 02 + francesa burdeo, cutícula sensible..."
            value={techNote}
            onChange={(e) => setTechNote(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-[#e2cbd7] px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-5 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar nota</span>
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-xs text-[#7a6571]">
            Sin notas técnicas todavía. Anota aquí tonos favoritos, alergias o tipo de uña.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-[#faf5f8] p-3 text-xs"
              >
                <div>
                  <p className="text-sm text-[#1f141b]">{n.note}</p>
                  <p className="mt-1 text-[11px] text-[#7a6571]">
                    {new Date(n.created_at).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar nota"
                  onClick={async () => {
                    await deleteClientTechnicalNoteAction(n.id, client.id);
                    router.refresh();
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Profile Editor */}
      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-3xl border border-[#eedbe4] bg-white p-5"
      >
        <h2 className="text-base font-bold text-[#1f141b]">Datos de Contacto</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">Nombre</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Apellido</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Instagram</label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">
              Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="VIP, Manicure Rusa, Café sin azúcar"
              className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold">Notas generales</label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={optOut}
            onChange={(e) => setOptOut(e.target.checked)}
            className="accent-[var(--brand-primary)]"
          />
          <span>No enviar recordatorios automáticos de mantención a esta clienta</span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1f141b] px-5 text-xs font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          <span>Guardar ficha</span>
        </button>
      </form>

      {/* History */}
      <section className="space-y-3 rounded-3xl border border-[#eedbe4] bg-white p-5">
        <h2 className="text-base font-bold text-[#1f141b]">Historial de Citas</h2>
        {appointments.length === 0 ? (
          <p className="text-xs text-[#7a6571]">Sin citas todavía.</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#f2e4eb] px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-bold text-[#1f141b]">
                    {a.items?.map((i) => i.name_snapshot).join(" + ")}
                  </p>
                  <p className="capitalize text-[#6c5763]">
                    {formatDateLongEs(a.appointment_date)} · {a.start_time.slice(0, 5)} ·{" "}
                    {a.booking_code}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1f141b]">{formatClp(a.total_paid_clp)}</p>
                  <p className="text-[11px] uppercase text-[#6c5763]">{a.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
