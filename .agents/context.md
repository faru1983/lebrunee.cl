# Contexto Actual del Proyecto — Lebrunee

## Estado Vigente

- **Fase:** Etapa 2 completada (CRM, Ficha Técnica, Finanzas/Caja/Gastos, Cierre de Citas con Cobro de Saldo, Centro de Comunicaciones y Recordatorio Configurable tras `XX` días).
- **Repositorio GitHub:** `https://github.com/faru1983/lebrunee.cl`
- **Producción:** `https://lebrunee.vercel.app`
- **Supabase:** Proyecto `Lebrunee` (`fenbuqgveosoqcuvlrcv`, región `sa-east-1`). Migraciones aplicadas hasta `phase2_crm_erp_retention`.
- **Pendiente de negocio:** Configurar Resend en `/admin/settings` cuando se cree la cuenta, crear el perfil de Valentina en Equipo y conectar el dominio final `lebrunee.cl`.

## Últimos Cambios

### 22-11-2026 — CRM, ERP Finanzas, Cierre de Citas y Recordatorio Configurable a XX Días
- **Migración `phase2_crm_erp_retention`**: agregada tabla `client_retention_logs` con RLS, `clients.retention_opt_out`, settings `retention_rules` y `expense_categories`, y plantilla `retention_followup`.
- **Gestión completa de citas (`AppointmentDetailModal.tsx`)**: reprogramación/notas desde Admin y cierre en mesa agregando extras, descuento automático de abono y registro de saldo en `payments`.
- **CRM (`/admin/clients` y `/admin/clients/[id]`)**: directorio buscable con filtro de mantención, historial y ficha técnica de uñas (`client_notes`).
- **Finanzas (`/admin/finanzas`)**: balance mensual (ingresos, gastos, utilidad neta, saldos por cobrar), desglose por medio de pago/servicio, ventas rápidas y CRUD móvil de gastos.
- **Comunicaciones (`/admin/comunicaciones` + `/api/cron/reminders`)**: regla configurable tras `XX` días sin visita (WhatsApp 1 toque + envío automático por Resend respetando cuota diaria) y cambio de contraseña en `/admin/settings`.

### 22-11-2026 — Inicialización Integral (Etapas 1 a 4)
- Creada estructura Next.js 16 + Tailwind CSS v4 + TypeScript + PWA.
- Creadas migraciones iniciales en Supabase (`initial_schema`, `seed_lebrunee_initial`, `fix_seed_image_urls`, `add_covering_indexes`) con `business_id`, RLS y datos iniciales editables de Lebrunee.
- Documentación base creada (`AGENTS.md`, `.agents/rules/rules.md`, `README.md`, `CHANGELOG.md`, `docs/*`, `docs/adr/*`).
- Blindado `businessService.ts` y `app/manifest.ts` (`force-dynamic`) para evitar errores de prerendering en `next build` cuando las variables de entorno aún no están cargadas en Vercel.
