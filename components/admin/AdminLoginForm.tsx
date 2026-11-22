"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm({
  businessName,
  showSetupLink,
}: {
  businessName: string;
  showSetupLink: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setErrorMsg("Correo o contraseña incorrectos.");
        return;
      }
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
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1f141b]">
          Panel {businessName}
        </h1>
        <p className="mt-1 text-sm text-[#6c5763]">
          Acceso exclusivo para administración y equipo.
        </p>
      </div>

      {showSetupLink && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <p className="font-semibold">¿Primera vez configurando el sistema?</p>
          <p className="mt-1">
            Aún no hay una cuenta dueña creada.{" "}
            <Link href="/admin/setup" className="font-bold underline">
              Ir a configuración inicial
            </Link>
          </p>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="mb-1 block text-sm font-medium">
            Correo electrónico
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            required
            autoComplete="username"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="admin-password" className="mb-1 block text-sm font-medium">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="admin-password"
              name="password"
              type={showPass ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 pr-12 text-base sm:text-sm"
            />
            <button
              type="button"
              aria-pressed={showPass}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#6c5763] hover:bg-neutral-100"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)]"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>Ingresar al panel</span>
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs font-medium text-[#6c5763] hover:underline">
          ← Volver a la página pública
        </Link>
      </div>
    </section>
  );
}
