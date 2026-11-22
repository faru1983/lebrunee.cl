"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2 } from "lucide-react";
import {
  deleteAddonAction,
  deleteServiceAction,
  upsertAddonAction,
  upsertServiceAction,
} from "@/app/actions/adminActions";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { ServiceAddon, ServiceCategory, ServiceItem } from "@/lib/types";
import { formatClp } from "@/lib/utils";

interface AdminServicesClientProps {
  categories: ServiceCategory[];
  services: ServiceItem[];
  addons: ServiceAddon[];
}

export function AdminServicesClient({
  categories,
  services,
  addons,
}: AdminServicesClientProps) {
  const router = useRouter();
  const [srvModal, setSrvModal] = useState(false);
  const [editingSrv, setEditingSrv] = useState<Partial<ServiceItem> | null>(null);

  const [addonModal, setAddonModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Partial<ServiceAddon> | null>(null);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function openNewService() {
    setEditingSrv({
      category_id: categories[0]?.id || null,
      name: "",
      description: "",
      image_url: "/images/hero-nails.jpg",
      price_clp: 20000,
      is_price_from: false,
      duration_minutes: 60,
      buffer_minutes: null,
      is_featured: false,
      is_active: true,
    });
    setSrvModal(true);
  }

  function openNewAddon() {
    setEditingAddon({
      name: "",
      description: "",
      price_clp: 5000,
      is_price_from: false,
      duration_minutes: 15,
      addon_type: "optional",
      is_active: true,
    });
    setAddonModal(true);
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSrv) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await upsertServiceAction({
        id: editingSrv.id,
        categoryId: editingSrv.category_id || null,
        name: editingSrv.name || "",
        description: editingSrv.description || "",
        imageUrl: editingSrv.image_url || "",
        priceClp: Number(editingSrv.price_clp || 0),
        isPriceFrom: Boolean(editingSrv.is_price_from),
        durationMinutes: Number(editingSrv.duration_minutes || 60),
        bufferMinutes:
          editingSrv.buffer_minutes === null || editingSrv.buffer_minutes === undefined
            ? null
            : Number(editingSrv.buffer_minutes),
        isFeatured: Boolean(editingSrv.is_featured),
        isActive: editingSrv.is_active ?? true,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setSrvModal(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAddon) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await upsertAddonAction({
        id: editingAddon.id,
        name: editingAddon.name || "",
        description: editingAddon.description || "",
        priceClp: Number(editingAddon.price_clp || 0),
        isPriceFrom: Boolean(editingAddon.is_price_from),
        durationMinutes: Number(editingAddon.duration_minutes || 0),
        addonType: editingAddon.addon_type || "optional",
        isActive: editingAddon.is_active ?? true,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setAddonModal(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Services */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#1f141b]">
              Servicios y Extras
            </h1>
            <p className="text-xs text-[#6c5763]">
              Todo cambio actualiza automáticamente la web y los bloques de duración.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewService}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo servicio</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((srv) => (
            <article
              key={srv.id}
              className="flex flex-col justify-between rounded-3xl border border-[#eedbe4] bg-white p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-[#1f141b]">{srv.name}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      srv.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {srv.is_active ? "Activo" : "Oculto"}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[var(--brand-primary)]">
                  {srv.is_price_from ? "Desde " : ""}
                  {formatClp(srv.price_clp)} · {srv.duration_minutes} min
                </p>
                {srv.description && (
                  <p className="mt-1 text-xs text-[#6c5763]">{srv.description}</p>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-[#f5e7ee] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSrv(srv);
                    setSrvModal(true);
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e2cbd7] text-xs font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${srv.name}`}
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar "${srv.name}"?`)) return;
                    await deleteServiceAction(srv.id);
                    router.refresh();
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-3 text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#1f141b]">
              Adicionales / Extras
            </h2>
            <p className="text-xs text-[#6c5763]">
              Ej. Retiro de trabajo externo, diseños Nail Art, reparación de uñas.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewAddon}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--brand-primary)] bg-white px-4 text-xs font-semibold text-[var(--brand-primary)]"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo adicional</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {addons.map((a) => (
            <article
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#eedbe4] bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-[#1f141b]">{a.name}</p>
                <p className="text-xs text-[#6c5763]">
                  +{a.is_price_from ? "desde " : ""}
                  {formatClp(a.price_clp)} · +{a.duration_minutes} min
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label={`Editar ${a.name}`}
                  onClick={() => {
                    setEditingAddon(a);
                    setAddonModal(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2cbd7]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${a.name}`}
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar "${a.name}"?`)) return;
                    await deleteAddonAction(a.id);
                    router.refresh();
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Service Modal */}
      <ModalDialog
        open={srvModal}
        onClose={() => setSrvModal(false)}
        title={editingSrv?.id ? "Editar servicio" : "Nuevo servicio"}
      >
        {editingSrv && (
          <form onSubmit={saveService} className="space-y-3.5">
            {errorMsg && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{errorMsg}</div>
            )}
            <div>
              <label htmlFor="s-name" className="mb-1 block text-xs font-semibold">
                Nombre del servicio
              </label>
              <input
                id="s-name"
                type="text"
                required
                value={editingSrv.name || ""}
                onChange={(e) => setEditingSrv({ ...editingSrv, name: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="s-price" className="mb-1 block text-xs font-semibold">
                  Valor (CLP)
                </label>
                <input
                  id="s-price"
                  type="number"
                  min={0}
                  required
                  value={editingSrv.price_clp ?? 0}
                  onChange={(e) =>
                    setEditingSrv({ ...editingSrv, price_clp: Number(e.target.value) })
                  }
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="s-dur" className="mb-1 block text-xs font-semibold">
                  Duración (min)
                </label>
                <input
                  id="s-dur"
                  type="number"
                  min={10}
                  required
                  value={editingSrv.duration_minutes ?? 60}
                  onChange={(e) =>
                    setEditingSrv({
                      ...editingSrv,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(editingSrv.is_price_from)}
                  onChange={(e) =>
                    setEditingSrv({ ...editingSrv, is_price_from: e.target.checked })
                  }
                  className="accent-[var(--brand-primary)]"
                />
                <span>Mostrar como &quot;Desde&quot;</span>
              </label>
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={editingSrv.is_active ?? true}
                  onChange={(e) =>
                    setEditingSrv({ ...editingSrv, is_active: e.target.checked })
                  }
                  className="accent-[var(--brand-primary)]"
                />
                <span>Visible al público</span>
              </label>
            </div>

            <div>
              <label htmlFor="s-desc" className="mb-1 block text-xs font-semibold">
                Descripción
              </label>
              <textarea
                id="s-desc"
                rows={2}
                value={editingSrv.description || ""}
                onChange={(e) =>
                  setEditingSrv({ ...editingSrv, description: e.target.value })
                }
                className="w-full rounded-xl border border-[#e2cbd7] p-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="s-img" className="mb-1 block text-xs font-semibold">
                URL de imagen
              </label>
              <input
                id="s-img"
                type="text"
                value={editingSrv.image_url || ""}
                onChange={(e) =>
                  setEditingSrv({ ...editingSrv, image_url: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white"
            >
              {busy ? "Guardando..." : "Guardar servicio"}
            </button>
          </form>
        )}
      </ModalDialog>

      {/* Addon Modal */}
      <ModalDialog
        open={addonModal}
        onClose={() => setAddonModal(false)}
        title={editingAddon?.id ? "Editar adicional" : "Nuevo adicional"}
      >
        {editingAddon && (
          <form onSubmit={saveAddon} className="space-y-3.5">
            <div>
              <label htmlFor="a-name" className="mb-1 block text-xs font-semibold">
                Nombre
              </label>
              <input
                id="a-name"
                type="text"
                required
                value={editingAddon.name || ""}
                onChange={(e) =>
                  setEditingAddon({ ...editingAddon, name: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="a-price" className="mb-1 block text-xs font-semibold">
                  Valor adicional (CLP)
                </label>
                <input
                  id="a-price"
                  type="number"
                  min={0}
                  value={editingAddon.price_clp ?? 0}
                  onChange={(e) =>
                    setEditingAddon({ ...editingAddon, price_clp: Number(e.target.value) })
                  }
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="a-dur" className="mb-1 block text-xs font-semibold">
                  Minutos extra
                </label>
                <input
                  id="a-dur"
                  type="number"
                  min={0}
                  value={editingAddon.duration_minutes ?? 0}
                  onChange={(e) =>
                    setEditingAddon({
                      ...editingAddon,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                  className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(editingAddon.is_price_from)}
                  onChange={(e) =>
                    setEditingAddon({ ...editingAddon, is_price_from: e.target.checked })
                  }
                  className="accent-[var(--brand-primary)]"
                />
                <span>Mostrar &quot;Desde&quot;</span>
              </label>
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={editingAddon.is_active ?? true}
                  onChange={(e) =>
                    setEditingAddon({ ...editingAddon, is_active: e.target.checked })
                  }
                  className="accent-[var(--brand-primary)]"
                />
                <span>Activo</span>
              </label>
            </div>

            <div>
              <label htmlFor="a-desc" className="mb-1 block text-xs font-semibold">
                Descripción
              </label>
              <input
                id="a-desc"
                type="text"
                value={editingAddon.description || ""}
                onChange={(e) =>
                  setEditingAddon({ ...editingAddon, description: e.target.value })
                }
                className="min-h-11 w-full rounded-xl border border-[#e2cbd7] px-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white"
            >
              {busy ? "Guardando..." : "Guardar adicional"}
            </button>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
