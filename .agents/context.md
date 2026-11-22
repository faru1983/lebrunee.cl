# Contexto Actual del Proyecto — Lebrunee

## Estado Vigente

- **Fase:** Etapa 1–4 (Construcción de base profesional, Supabase, Landing, Agenda Configurable, Portal Clientas y Panel Admin Mobile-First PWA).
- **Repositorio GitHub:** `https://github.com/faru1983/lebrunee.cl`
- **Supabase:** Proyecto `Lebrunee` (`fenbuqgveosoqcuvlrcv`, región `sa-east-1`). Migraciones `initial_schema` y `seed_lebrunee_initial` aplicadas.
- **Pendiente de entorno por usuario:** Pegar `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y Vercel, conectar GitHub ↔ Vercel (`lebrunee.vercel.app`), y configurar Resend en `/admin/settings` cuando se cree la cuenta.

## Últimos Cambios

### 22-11-2026 — Inicialización Integral (Etapas 1 a 4)
- Creada estructura Next.js 16 + Tailwind CSS v4 + TypeScript + PWA.
- Creadas migraciones iniciales en Supabase (`initial_schema`, `seed_lebrunee_initial`, `fix_seed_image_urls`, `add_covering_indexes`) con `business_id`, RLS y datos iniciales editables de Lebrunee.
- Documentación base creada (`AGENTS.md`, `.agents/rules/rules.md`, `README.md`, `CHANGELOG.md`, `docs/*`, `docs/adr/*`).
- Blindado `businessService.ts` y `app/manifest.ts` (`force-dynamic`) para evitar errores de prerendering en `next build` cuando las variables de entorno aún no están cargadas en Vercel.
