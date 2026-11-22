# Lebrunee (`lebrunee.cl`) — Plataforma Integral de Reservas y Gestión

Sistema web todo-en-uno **Mobile-First & PWA** para salones de manicure y estética, desarrollado inicialmente para **Lebrunee Nails** (Valentina Gutiérrez) y diseñado desde el día 1 con **arquitectura configurable y bases multi-inquilino** (`business_id`), optimizado para operar **100% en capas gratuitas** de GitHub, Vercel, Supabase y Resend.

## Características Principales

- **Landing Editorial Dinámica (`/`):** Identidad, colores, textos, servicios, políticas y ubicación referencial leídos desde Supabase (`business_settings`).
- **Motor de Agenda Profesional (`/reservar`):**
  - Modo **intervalos dinámicos** (cada 15/30/60 min según duración real + extras + buffer) o **bloques fijos**.
  - Múltiples tramos diarios (mañana / tarde), excepciones (bloquear día, rango o abrir día especial), apertura de agenda por días o fecha tope y pausa instantánea.
  - Cálculo Zero Trust en servidor para evitar dobles reservas.
- **Confirmación sin Fricción + WhatsApp:** Validación de clientas con código OTP de 6 dígitos al confirmar, datos bancarios copiables y botón directo a WhatsApp para enviar el comprobante del abono sin almacenar imágenes en servidor.
- **Portal de Clientas (`/mi-cuenta`):** Acceso con código al correo para revisar historial, ver la **dirección exacta** una vez confirmado el abono, reprogramar (dentro de las horas configuradas) o cancelar.
- **Panel Admin Mobile-First (`/admin`):** Vista `Hoy` pensada para operar con una mano, aprobación de abono en 1 toque, creación de citas manuales, gestor completo de horarios/servicios/adicionales, creación de administradoras y configuración cifrada de **Resend** desde la interfaz.
- **PWA Instalable:** `manifest.ts` + ícono propio para instalar en Android e iOS.

## Requisitos y Variables de Entorno

Copia `.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)
- `APP_ENCRYPTION_KEY` (64 hex chars / 32 bytes para cifrar credenciales en `business_integrations`)
- `CRON_SECRET` (para `/api/cron/reminders`)
- `ADMIN_SETUP_KEY` (llave de un solo uso para crear la primera cuenta `owner` en `/admin/setup`)
- `NEXT_PUBLIC_SITE_URL` y `DEFAULT_BUSINESS_SLUG` (`lebrunee`)

## Desarrollo Local

```bash
npm install
npm run dev
```

Documentación adicional en [`docs/`](docs/ARQUITECTURA.md).
