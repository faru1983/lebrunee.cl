"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm({
  businessName,
  showSetupLink,
}: {
  businessName: string;
  showSetupLink: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setRecoveryMsg(null);
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

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setRecoveryMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg("Ingresa tu correo electrónico.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
      });
      if (error) {
        setErrorMsg(
          error.message || "No se pudo enviar el correo de recuperación."
        );
        return;
      }
      setRecoveryMsg(
        "Si el correo pertenece a una cuenta del equipo, enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o spam."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-[#eedbe4] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf0f6] text-[var(--brand-primary)]">
          {mode === "login" ? (
            <Lock className="h-5 w-5" />
          ) : (
            <Mail className="h-5 w-5" />
          )}
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1f141b]">
          {mode === "login" ? `Panel ${businessName}` : "Recuperar acceso"}
        </h1>
        <p className="mt-1 text-sm text-[#6c5763]">
          {mode === "login"
            ? "Acceso exclusivo para administración y equipo."
            : "Te enviaremos un enlace a tu correo para crear una nueva contraseña."}
        </p>
      </div>

      {showSetupLink && mode === "login" && (
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

      {recoveryMsg && (
        <div role="status" className="mb-4 rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {recoveryMsg}
        </div>
      )}

      {mode === "login" ? (
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="admin-password" className="block text-sm font-medium">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => {
                  setMode("recovery");
                  setErrorMsg(null);
                  setRecoveryMsg(null);
                }}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
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
      ) : (
        <form onSubmit={handleRecovery} className="space-y-4">
          <div>
            <label htmlFor="recovery-email" className="mb-1 block text-sm font-medium">
              Correo electrónico de tu cuenta
            </label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)]"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Enviar enlace de recuperación</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
              setRecoveryMsg(null);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#e2cbd7] px-6 text-xs font-semibold text-[#4a3541] hover:bg-[#fdf3f7]"
          >
            Volver a iniciar sesión
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs font-medium text-[#6c5763] hover:underline">
          ← Volver a la página pública
        </Link>
      </div>
    </section>
  );
}
