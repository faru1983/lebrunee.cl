---
trigger: always_on
---

# Reglas de Oro y Arquitectura — Lebrunee (`lebrunee.cl`)

Este documento es la **fuente de verdad obligatoria** para cualquier desarrollador o agente de IA que trabaje en este proyecto.

> Antes de comenzar cualquier tarea, lee también [`.agents/context.md`](../context.md).

---

## 1. Reglas de Oro (Cero Excepciones)

| # | Regla | Detalle |
|---|-------|---------|
| 1 | **Zero Hardcoding de Negocio** | Prohibido escribir en el código nombres de salón, teléfonos, RUT, cuentas bancarias, direcciones exactas, API keys de Resend o políticas. Todo se lee desde `businesses`, `business_settings` y `business_integrations` vía `lib/services/businessService.ts`. |
| 2 | **Multi-Tenant Ready** | Toda tabla de negocio lleva `business_id`, política RLS habilitada e índices por `business_id`. Toda consulta de servicios filtra explícitamente por `business_id`. |
| 3 | **Zero Trust en Agenda y Finanzas** | Nunca confiar en precios, duraciones, horarios ni fechas de corte enviadas por el cliente. El servidor recalcula totales desde `services`/`service_addons`, valida disponibilidad real y aplica la regla de reprogramación (`rescheduleCutoffHours`). |
| 4 | **Secretos Cifrados** | Las credenciales externas configuradas en Admin (como Resend API Key) se cifran con AES-256-GCM (`lib/crypto.ts`) usando `APP_ENCRYPTION_KEY`, se guardan en `business_integrations` (sin políticas RLS públicas) y jamás se retornan al navegador sin enmascarar. |
| 5 | **Privacidad de Dirección Exacta** | `private_location` (`exactAddress`) nunca se expone en el cliente público ni en reservas `pending_deposit`. Solo se entrega al usuario autenticado cuando su cita está `confirmed` o `completed`, o en el correo de confirmación. |
| 6 | **Mobile-First & PWA Real** | Diseñar primero para pantallas de `375px` con targets táctiles ≥ `44px` e inputs ≥ `16px` (`text-base sm:text-sm`) para evitar zoom automático en Safari iOS. Mantener `app/manifest.ts` y metadatos PWA operativos. |
| 7 | **Tailwind CSS v4 Only** | Prohibido crear archivos `.css` adicionales o `<style>` sueltos. Solo utilidades Tailwind y `app/globals.css` (`@import "tailwindcss"` + `@theme` + CSS custom properties de marca). |
| 8 | **Arquitectura por Capas** | UI (`components/`, `app/**/page.tsx`) → Server Actions / Route Handlers (validación Zod + auth) → Servicios (`lib/services/*`) → Supabase (`lib/supabase/`). No duplicar lógica de negocio en componentes o rutas HTTP. |
| 9 | **Proxy File Convention** | Protección de rutas y refresco de sesión Supabase SSR en `proxy.ts` (Next.js 16). Prohibido crear `middleware.ts`. |
| 10 | **Iconografía Única y Celulares E.164** | Usar exclusivamente `lucide-react` para iconos de UI. Normalizar teléfonos a E.164 (`+56912345678`) con `lib/phone.ts`. |
| 11 | **Eficiencia para Capas Gratuitas** | Respetar cuota diaria de Resend (`email_logs` + reserva transaccional), evitar selects `SELECT *` innecesarios, no almacenar comprobantes binarios en Storage (comprobante vía WhatsApp), y mantener un cron diario máximo en `vercel.json`. |
| 12 | **Verificación Pragmática y Contexto AI** | Ejecutar `npx tsc --noEmit` tras cambios en contratos, DB, Server Actions o lógica de agenda. Actualizar `.agents/context.md` y `CHANGELOG.md` al cerrar cambios relevantes. |

---

## 2. Stack Tecnológico

- **Framework:** Next.js 16 (App Router, React 19, Server Components, Server Actions)
- **Estilos:** Tailwind CSS v4 + Google Fonts (`Cormorant Garamond` editorial + `Plus Jakarta Sans` UI)
- **Base de Datos y Auth:** Supabase (PostgreSQL + RLS + Supabase Auth dual: OTP email para clientas, email+password para administradoras)
- **Emails:** Resend (configurable por negocio desde `/admin/settings`) + React Email
- **Validación:** Zod 4
- **Iconos:** `lucide-react`
- **Hosting y Cron:** Vercel Hobby (cron diario `/api/cron/reminders`)

---

## 3. Protocolo de Cierre de Sesión

Al finalizar cambios relevantes:
1. Actualizar `.agents/context.md` (máximo últimas 5 sesiones).
2. Registrar el cambio en `CHANGELOG.md` bajo `[Unreleased]`.
3. Verificar que no existan secretos ni `.env*` en el tracking de Git.
