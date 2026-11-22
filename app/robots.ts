import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lebrunee.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/reservar"],
        disallow: ["/admin", "/mi-cuenta", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
