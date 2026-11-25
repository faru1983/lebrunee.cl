"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt({ businessName }: { businessName: string }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const alreadyDismissed = window.localStorage.getItem("pwa_install_dismissed");
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (alreadyDismissed || isStandalone) return;

    const ua = window.navigator.userAgent;
    const isMobileUa =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isMobile = isMobileUa || (isCoarsePointer && window.innerWidth < 768);
    if (!isMobile) return;

    const isIos = /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS/i.test(ua);
    const isAdminOrAccount =
      window.location.pathname.startsWith("/admin") ||
      window.location.pathname.startsWith("/mi-cuenta");

    const timer =
      isIos && isAdminOrAccount
        ? window.setTimeout(() => {
            setShowIosTip(true);
            setDismissed(false);
          }, 0)
        : null;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (isAdminOrAccount) {
        setDismissed(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem("pwa_install_dismissed", "1");
    setDismissed(true);
  };

  if (dismissed || (!deferredPrompt && !showIosTip)) return null;

  return (
    <aside
      aria-label="Instalar aplicación"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#f1dfe8] bg-white/95 p-3.5 shadow-xl backdrop-blur-md md:hidden"
    >
      <img
        src="/images/icon-192.png"
        alt=""
        width={42}
        height={42}
        className="h-10 w-10 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-[#1f141b]">Instala {businessName} en tu celular</p>
        {deferredPrompt ? (
          <p className="text-[#6c5763]">Acceso directo sin abrir el navegador.</p>
        ) : (
          <p className="flex items-center gap-1 text-[#6c5763]">
            Toca <Share className="inline h-3.5 w-3.5" /> y luego{" "}
            <strong className="font-medium text-[#1f141b]">Agregar a inicio</strong>.
          </p>
        )}
      </div>
      {deferredPrompt && (
        <button
          type="button"
          onClick={async () => {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
            dismiss();
          }}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar sugerencia"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
