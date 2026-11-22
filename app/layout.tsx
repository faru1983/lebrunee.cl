import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { getActiveBusinessBundle } from "@/lib/services/businessService";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getActiveBusinessBundle();
  return {
    title: {
      default: `${bundle.business.name} — Manicure Profesional`,
      template: `%s | ${bundle.business.name}`,
    },
    description:
      bundle.business.tagline ||
      "Manicure Rusa y Esmaltado Permanente sobre uña natural. Agenda tu hora online.",
    applicationName: bundle.business.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: bundle.business.name,
    },
    icons: {
      icon: "/images/icon-192.png",
      apple: "/images/brand-icon.png",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const bundle = await getActiveBusinessBundle();
  return {
    themeColor: bundle.branding.primaryColor,
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bundle = await getActiveBusinessBundle();

  return (
    <html lang="es" className={`${jakarta.variable} ${cormorant.variable}`}>
      <body
        style={
          {
            "--brand-primary": bundle.branding.primaryColor,
            "--brand-accent": bundle.branding.accentColor,
            "--brand-soft": bundle.branding.softBgColor,
          } as React.CSSProperties
        }
        className="min-h-dvh flex flex-col selection:bg-[var(--brand-primary)] selection:text-white"
      >
        <a
          href="#main-content"
          className="visually-hidden fixed top-3 left-3 z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg"
        >
          Ir al contenido principal
        </a>
        {children}
        <PwaInstallPrompt businessName={bundle.business.name} />
      </body>
    </html>
  );
}
