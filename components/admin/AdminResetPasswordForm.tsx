"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminResetPasswordForm({
  businessName,
  initialError,
}: {
  businessName: string;
  initialError?: boolean;
}) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    initialError
      ? "El enlace de recuperación es inválido o expiró. Solicita uno nuevo desde el acceso."
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setHasSession(true);
      }
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
        session
      ) {
        setHasSession(true);
        setErrorMsg(null);
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(
          error.message || "No se pudo actualizar la contraseña. Intenta solicitar otro enlace."
        );
        return;
      }

      setSuccessMsg("Contraseña actualizada correctamente. Redirigiendo al panel...");
      setTimeout(() => {
        router.push("/admin");
        router.refresh();
      }, 1200);
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
          Nueva contraseña
        </h1>
        <p className="mt-1 text-sm text-[#6c5763]">
          Restablece tu acceso al panel de {businessName}.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-800"
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="mb-4 rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
        >
          {successMsg}
        </div>
      )}

      {checkingSession ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6c5763]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verificando enlace de recuperación...</span>
        </div>
      ) : !hasSession ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[#6c5763]">
            No encontramos una sesión de recuperación activa. El enlace puede haber
            expirado o ya fue utilizado.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)]"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reset-password"
              className="mb-1 block text-sm font-medium"
            >
              Nueva contraseña (mín. 8 caracteres)
            </label>
            <div className="relative">
              <input
                id="reset-password"
                name="new-password"
                type={showPass ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
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

          <div>
            <label
              htmlFor="reset-password-confirm"
              className="mb-1 block text-sm font-medium"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="reset-password-confirm"
              name="confirm-password"
              type={showPass ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-[#e2cbd7] px-4 text-base sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy || Boolean(successMsg)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent)] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Guardar nueva contraseña</span>
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/admin/login"
          className="text-xs font-medium text-[#6c5763] hover:underline"
        >
          ← Volver al acceso de administración
        </Link>
      </div>
    </section>
  );
}
