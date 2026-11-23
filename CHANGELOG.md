# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Onboarding previo en `/mi-cuenta`: acceso con **Magic Link** (1 clic vía `/auth/callback?next=/mi-cuenta`) + código OTP de 6 dígitos de respaldo, y tarjeta completa **"Mi Ficha"** (`upsertClientProfileAction`) para registrar/editar nombre, apellidos, WhatsApp, Instagram y cumpleaños incluso antes de la primera reserva.
- Botones **"Copiar invitación WhatsApp"** y **"Solo enlace"** en `/admin/clients` para difundir el link de registro previo de clientas.
- Flujo de recuperación de contraseña en Admin: opción **"¿Olvidaste tu contraseña?"** en `/admin/login` (`resetPasswordForEmail`), ruta de intercambio de sesión `/auth/callback` y pantalla `/admin/reset-password` para definir nueva clave.
- Regalo de cumpleaños automático en `/admin/comunicaciones?tab=cumpleanos` y cron diario `/api/cron/reminders`, respaldado por `clients.birth_date` y dedup anual en `client_birthday_logs`.
- Campo opcional de cumpleaños (`Día + Mes + Año`) y separación de `Nombre` + `Apellidos` en `/reservar`, creación manual de citas, `/mi-cuenta` y `/admin/clients/[id]`.
- Sincronización de pestañas y filtros por query string en Admin: `/admin/settings?tab=...`, `/admin/comunicaciones?tab=...`, `/admin/finanzas?tab=...` y `/admin/agenda?status=...`.

### Changed
- Actualizada URL fallback por defecto de `https://lebrunee.vercel.app` a `https://lebrunee.cl` en `app/robots.ts`, `app/sitemap.ts`, `app/api/cron/reminders/route.ts` y `app/actions/crmFinanceActions.ts`.
- Formulario Paso 3 en `/reservar` (`BookingWizard.tsx`): reordenamiento y alineación del campo `Fecha de cumpleaños (opcional)` (texto de ayuda debajo del input), normalización de `Nombre`/`Apellidos` (Title Case), correo e Instagram (minúsculas), y máscaras inteligentes en foco/blur para `WhatsApp` (`+56 ` al enfocar, vacío si no se completa y E.164 limpio `+569...` en DB) e `Instagram` (`@` al enfocar, vacío si queda solo `@` y guardado sin `@` en minúsculas).
- Flujo `/reservar` (Paso 3): cuando `requireClientOtp` está activo, ahora solicita primero el correo y código OTP antes del formulario; tras verificar (o si ya hay sesión activa en SSR), precarga automáticamente la ficha de `clients` (con resumen editable y opción *"Usar otro correo"*), y `createBookingCore` preserva `instagram_handle` existente si viene vacío.
- Eliminada duplicación entre `/admin/settings?tab=resend` (credenciales Resend + plantillas transaccionales de reserva) y `/admin/comunicaciones` (recordatorios de citas, mantención tras `XX` días, cumpleaños e historial/cuota Resend).

### Added (Etapas 1-2)
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
