# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Módulo CRM (`/admin/clients`, `/admin/clients/[id]`) con ficha técnica de uñas e historial de visitas/pagos.
- Módulo Finanzas (`/admin/finanzas`) con balance mensual, desglose por medio de pago/servicios, ventas rápidas y registro móvil de gastos.
- Modal de detalle y cierre de cita (`AppointmentDetailModal`) con cobro de saldo + extras en mesa y reprogramación desde Admin.
- Centro de Comunicaciones (`/admin/comunicaciones`) con regla configurable de recordatorio tras `XX` días desde la última cita (WhatsApp + Resend automático en cron diario) y medidor de cuota diaria.
- Cambio de contraseña propio dentro de `/admin/settings`.
- Estructura inicial Next.js 16, Tailwind CSS v4, TypeScript y configuración PWA (`app/manifest.ts`).
- Documentación profesional completa (`AGENTS.md`, `.agents/`, `docs/`, `docs/adr/`).
- Esquema inicial en Supabase (`initial_schema` y `seed_lebrunee_initial`) con soporte `business_id`, RLS y datos iniciales editables de Lebrunee.
- Landing editorial dinámica, motor de agenda configurable (`/reservar`), portal de clientas (`/mi-cuenta`) y panel administrativo mobile-first (`/admin`).

### Fixed
- `lib/services/businessService.ts` y `app/manifest.ts` ahora hacen fallback seguro en build-time si faltan variables públicas de Supabase durante la importación inicial en Vercel.
