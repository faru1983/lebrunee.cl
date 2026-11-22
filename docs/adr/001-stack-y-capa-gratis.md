# ADR-001: Stack y Optimización para Capas Gratuitas

- **Estado:** Aceptado
- **Decisión:** Utilizar Next.js 16 + Tailwind CSS v4 + Supabase + Resend + Vercel Hobby.
- **Consecuencias y Mitigaciones:**
  - Comprobantes de pago se envían vía enlace WhatsApp en lugar de guardar imágenes en Supabase Storage (ahorro total de 1 GB gratis).
  - Cron diario único en Vercel (`/api/cron/reminders`) que envía recordatorios y mantiene activo el proyecto Supabase (evita pausa tras 7 días).
  - Control diario de envíos en `email_logs` reservando cuota para correos transaccionales críticos.
