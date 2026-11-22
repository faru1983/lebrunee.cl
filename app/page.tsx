import Link from "next/link";
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Clock,
  Coffee,
  Instagram,
  MapPin,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  getActiveBusinessBundle,
  getPublicCatalog,
} from "@/lib/services/businessService";
import { formatClp } from "@/lib/utils";

export const revalidate = 60;

export default async function HomePage() {
  const bundle = await getActiveBusinessBundle();
  const catalog = await getPublicCatalog(bundle.business.id);
  const { branding, contactPublic, landingContent, policies, paymentBank, bookingRules } =
    bundle;

  return (
    <>
      <SiteHeader businessName={bundle.business.name} logoUrl={branding.logoUrl} />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* Hero Editorial */}
        <section className="relative overflow-hidden border-b border-[#f1dfe8] bg-gradient-to-b from-white via-[#fff9fb] to-[var(--brand-soft)]">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-12 md:py-16">
            <div className="space-y-6 md:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cfe0] bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[var(--brand-primary)] shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{landingContent.heroBadge}</span>
              </div>

              <h1 className="font-serif text-[clamp(2.3rem,1.4rem+3.4vw,4rem)] font-semibold leading-[1.06] tracking-tight text-[#1f141b]">
                {landingContent.heroTitle}
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-[#5d4754] sm:text-lg">
                {landingContent.heroSubtitle}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/reservar"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-7 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--brand-accent)]"
                >
                  <CalendarHeart className="h-4 w-4" />
                  <span>
                    {bookingRules.isAgendaOpen ? "Reservar mi hora" : "Ver disponibilidad"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#servicios"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#e7cddb] bg-white px-6 text-sm font-semibold text-[#3c2733] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  Ver servicios y valores
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs font-medium text-[#6c5763] sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
                  {contactPublic.publicLocationLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Coffee className="h-4 w-4 text-[var(--brand-primary)]" />
                  {landingContent.coffeeBreakNote}
                </span>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="relative mx-auto max-w-sm overflow-hidden rounded-[2rem] border border-[#f0dce6] bg-white p-2 shadow-xl md:max-w-none">
                <div className="aspect-[3/4] overflow-hidden rounded-[1.5rem]">
                  <img
                    src={branding.heroImageUrl || "/images/hero-nails.jpg"}
                    alt={`Trabajo de manicure sobre uña natural en ${bundle.business.name}`}
                    fetchPriority="high"
                    width={900}
                    height={1200}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#fff8fb] px-4 py-3 text-xs">
                  <span className="font-semibold text-[#1f141b]">
                    {contactPublic.instagramHandle}
                  </span>
                  <span className="text-[var(--brand-primary)] font-semibold">
                    Abono reserva {formatClp(paymentBank.depositAmountClp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Aviso importante (Uña natural / No extensiones) */}
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-[#f3d4e3] bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fdf0f6] text-[var(--brand-primary)]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--brand-primary)]">
                  {landingContent.importantNoticeTitle}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[#43303b]">
                  {landingContent.importantNoticeText}
                </p>
              </div>
            </div>
            <Link
              href="/reservar"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#e7cddb] px-5 text-xs font-semibold text-[#1f141b] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Agendar ahora
            </Link>
          </div>
        </section>

        {/* Catálogo de Servicios */}
        <section id="servicios" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Carta de Servicios
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-[#1f141b] sm:text-4xl">
                Elige el cuidado ideal para tus uñas
              </h2>
            </div>
            <p className="text-sm text-[#6c5763]">
              Valores referenciales en pesos chilenos · Tiempo aproximado por sesión.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.services.map((srv) => (
              <article
                key={srv.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[#f1dfe8] bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-[#fdf3f7]">
                  <img
                    src={srv.image_url || "/images/hero-nails.jpg"}
                    alt={srv.name}
                    loading="lazy"
                    width={600}
                    height={600}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6c5763]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3f7] px-2.5 py-1 font-medium text-[var(--brand-primary)]">
                      <Clock className="h-3.5 w-3.5" />
                      {srv.duration_minutes} min
                    </span>
                    <span className="text-sm font-bold text-[#1f141b]">
                      {srv.is_price_from ? "Desde " : ""}
                      {formatClp(srv.price_clp)}
                    </span>
                  </div>

                  <h3 className="mt-3 font-serif text-2xl font-semibold text-[#1f141b]">
                    {srv.name}
                  </h3>

                  {srv.description && (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#614d58]">
                      {srv.description}
                    </p>
                  )}

                  <Link
                    href={`/reservar?service=${srv.id}`}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#fdf3f7] px-4 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white"
                  >
                    <span>Agendar servicio</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Sobre Valentina & Experiencia */}
        <section
          id="experiencia"
          className="border-y border-[#f1dfe8] bg-white py-12 sm:py-16"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 md:grid-cols-12">
            <div className="space-y-4 md:col-span-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                La Experiencia
              </p>
              <h2 className="font-serif text-3xl font-semibold text-[#1f141b] sm:text-4xl">
                {landingContent.aboutTitle}
              </h2>
              <p className="text-base leading-relaxed text-[#54404c]">
                {landingContent.aboutBio}
              </p>

              {landingContent.aboutHighlights.length > 0 && (
                <ul className="space-y-2.5 pt-2">
                  {landingContent.aboutHighlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#3c2733]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-3">
                <a
                  href={contactPublic.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e7cddb] px-5 text-sm font-semibold text-[#1f141b] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  <Instagram className="h-4 w-4 text-[var(--brand-primary)]" />
                  <span>Ver trabajos en {contactPublic.instagramHandle}</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-6">
              <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-[#f1dfe8]">
                <img
                  src="/images/service-permanente.png"
                  alt="Esmaltado permanente en uñas naturales cortas"
                  loading="lazy"
                  width={600}
                  height={750}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-6 aspect-[4/5] overflow-hidden rounded-3xl border border-[#f1dfe8]">
                <img
                  src="/images/service-rusa.png"
                  alt="Manicure rusa con diseño delicado en uña natural"
                  loading="lazy"
                  width={600}
                  height={750}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Cómo reservar y Políticas */}
        <section id="politicas" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              Información Clara
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#1f141b] sm:text-4xl">
              Cómo funciona tu reserva
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#f1dfe8] bg-white p-6">
              <h3 className="text-base font-semibold text-[#1f141b]">
                Abono y Confirmación ({formatClp(paymentBank.depositAmountClp)})
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5d4754]">
                Al elegir tu horario te mostraremos los datos de transferencia y un botón
                directo a WhatsApp para enviarnos tu comprobante. Una vez validado, tu cita
                pasa a confirmada y desbloqueas la dirección exacta en{" "}
                <Link href="/mi-cuenta" className="font-semibold text-[var(--brand-primary)] underline">
                  Mis Citas
                </Link>
                .
              </p>
            </div>

            <div className="rounded-3xl border border-[#f1dfe8] bg-white p-6">
              <h3 className="text-base font-semibold text-[#1f141b]">
                Cambios y Reprogramación
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5d4754]">
                {policies.reschedulePolicy}
              </p>
            </div>

            <div className="rounded-3xl border border-[#f1dfe8] bg-white p-6">
              <h3 className="text-base font-semibold text-[#1f141b]">
                Puntualidad y Acompañantes
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5d4754]">
                {policies.latenessPolicy} {policies.companionsPolicy}
              </p>
            </div>

            <div className="rounded-3xl border border-[#f1dfe8] bg-white p-6">
              <h3 className="text-base font-semibold text-[#1f141b]">
                Reglas del Servicio
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5d4754]">
                {policies.extensionsPolicy} {policies.extraNotes}
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl bg-[var(--brand-primary)] p-7 text-center text-white shadow-lg sm:p-10">
            <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
              ¿Lista para tu próximo espacio de autocuidado?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/90 sm:text-base">
              Revisa las horas disponibles en tiempo real y reserva en menos de 2 minutos.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/reservar"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-[var(--brand-primary)] shadow-md transition hover:bg-[#fff4f9]"
              >
                <CalendarHeart className="h-4 w-4" />
                <span>Reservar mi hora</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter
        businessName={bundle.business.name}
        tagline={bundle.business.tagline}
        contactPublic={contactPublic}
      />
    </>
  );
}
