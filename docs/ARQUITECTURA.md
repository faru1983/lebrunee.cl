# Arquitectura del Sistema — Lebrunee

## Visión General

La aplicación sigue una arquitectura modular por capas donde **toda configuración comercial y visual reside en Supabase**, evitando valores hardcodeados para permitir reutilización inmediata en otros negocios y futura evolución a SaaS multi-inquilino.

```text
app/
├── page.tsx                  # Landing pública dinámica (Server Component)
├── reservar/                 # Wizard / flujo de reserva en tiempo real
├── mi-cuenta/                # Portal de clientas (OTP + reprogramación + dirección privada)
├── admin/                    # Panel Mobile-First PWA (Hoy, Agenda, Servicios, Horarios, Configuración)
├── api/
│   ├── cron/reminders/       # Cron diario Vercel (recordatorios + keep-alive Supabase)
│   └── health/               # Verificación ligera
└── actions/                  # Server Actions validados con Zod
lib/
├── supabase/                 # Clientes SSR, browser y service_role
├── crypto.ts                 # Cifrado AES-256-GCM para business_integrations
├── phone.ts                  # Normalización y formato E.164 (+569...)
├── types.ts                  # Tipos compartidos y schemas Zod
└── services/
    ├── businessService.ts    # Resolución de negocio (slug/dominio) y settings
    ├── availabilityService.ts# Motor de agenda (dinámico / bloques fijos / excepciones)
    ├── bookingService.ts     # Creación, confirmación, reprogramación y cancelación Zero Trust
    ├── emailService.ts       # Resend dinámico desde BD + control de cuota diaria
    └── adminService.ts       # CRUD de servicios, horarios, citas y equipo
```

## Seguridad y Privacidad

1. **Dirección Privada:** `private_location` se almacena en `business_settings` con `category = 'private_location'`, excluida de las políticas RLS públicas. Solo se revela cuando `appointment.status IN ('confirmed', 'completed')`.
2. **Secretos en BD:** `business_integrations.encrypted_secret` se cifra con AES-256-GCM en `lib/crypto.ts` y solo se lee desde el servidor (`service_role`).
3. **Auth Dual:**
   - Clientas: Supabase Auth Email OTP (código de 6 dígitos) + RLS por `auth_user_id`.
   - Administración: Supabase Auth Email + Password + verificación en `business_members`.
