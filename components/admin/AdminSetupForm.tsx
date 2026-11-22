"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { setupInitialOwnerAction } from "@/app/actions/adminActions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminSetupForm({
  businessName,
  serviceKeyConfigured,
}: {
  businessName: string;
  serviceKeyConfigured: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Valentina Gutiérrez");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await setupInitialOwnerAction({
        displayName,
        email,
        password,
        setupKey,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      setDone(true);
      router.push("/admin");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-[#eedbe4] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf0f6] text-[var(--brand-primary)]">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1f141b]">
          Cuenta Inicial · {businessName}
        </h1>
        <p className="mt-1 text-sm text-[#6c5763]">
          Crea la cuenta dueña principal para comenzar a administrar tu salón.
        </p>
      </div>

      {!serviceKeyConfigured && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
          <p className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4" />
            Falta configurar SUPABASE_SERVICE_ROLE_KEY
          </p>
          <p className="mt-1">
            Copia la clave <code>service_role</code> desde Supabase Dashboard → Project
            Settings → API y agrégala en <code>.env.local</code> (y en Vercel).
          </p>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      {done ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-900">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
          <p className="mt-2 font-semibold">¡Cuenta creada! Entrando al panel...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="setup-name" className="mb-1 block text-sm font-medium">
              Nombre completo
            </label>
            <input
              id="setup-name"
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="setup-email" className="mb-1 block text-sm font-medium">
              Correo de acceso
            </label>
            <input
              id="setup-email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="valentina@lebrunee.cl"
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="setup-pass" className="mb-1 block text-sm font-medium">
              Contraseña (mínimo 8 caracteres)
            </label>
            <input
              id="setup-pass"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="setup-key" className="mb-1 block text-sm font-medium">
              Llave de configuración (ADMIN_SETUP_KEY)
            </label>
            <input
              id="setup-key"
              type="password"
              required
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !serviceKeyConfigured}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Crear cuenta dueña</span>
          </button>
        </form>
      )}

      <div className="mt-5 text-center">
        <Link href="/admin/login" className="text-xs font-medium text-[#6c5763] underline">
          Ir a iniciar sesión
        </Link>
      </div>
    </section>
  );
}
