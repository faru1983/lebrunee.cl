import type { MetadataRoute } from "next";
import { getActiveBusinessBundle } from "@/lib/services/businessService";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const bundle = await getActiveBusinessBundle();

  return {
    name: bundle.business.name,
    short_name: bundle.business.name.split(" ")[0] || "Lebrunee",
    description:
      bundle.business.tagline || "Sistema de reservas y gestión de salón.",
    start_url: "/admin",
    display: "standalone",
    background_color: bundle.branding.softBgColor || "#fff7fa",
    theme_color: bundle.branding.primaryColor || "#c81e6a",
    orientation: "portrait",
    icons: [
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/brand-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
