# Contexto Actual del Proyecto — Lebrunee

## Estado Vigente

- **Fase:** Etapa 3 completada (Separación Ajustes/Comunicaciones, Automatización de Cumpleaños + `birth_date` en formularios, separación `firstName`/`lastName`, y sincronización de URL por pestañas en Admin).
- **Repositorio GitHub:** `https://github.com/faru1983/lebrunee.cl`
- **Producción:** `https://lebrunee.vercel.app`
- **Supabase:** Proyecto `Lebrunee` (`fenbuqgveosoqcuvlrcv`, región `sa-east-1`). Migraciones aplicadas hasta `phase3_birthday_and_templates`.
- **Pendiente de negocio:** Configurar Resend en `/admin/settings?tab=resend` cuando se cree la cuenta, crear el perfil de Valentina en `/admin/settings?tab=equipo` y conectar el dominio final `lebrunee.cl`.

## Últimos Cambios

### 22-11-2026 — Cumpleaños, Nombre/Apellido separado, URL Tabs y Orden Ajustes/Comunicaciones
- **Migración `phase3_birthday_and_templates`**: agregada columna `clients.birth_date` (`DATE`), tabla `client_birthday_logs` con restricción anual por canal (`UNIQUE (business_id, client_id, birthday_year, channel)`) + RLS, regla `birthday_rules` en `business_settings` y plantilla `birthday_gift`.
- **Formularios con Nombre + Apellidos + Cumpleaños opcional**: `/reservar`, modal manual en Admin, `/mi-cuenta` y detalle CRM `/admin/clients/[id]` solicitan `firstName`, `lastName` y `birth_date` (`Día + Mes + Año` con `autoComplete`).
- **Separación limpia**: `/admin/settings?tab=resend` administra credenciales Resend y las 4 plantillas transaccionales de reserva; `/admin/comunicaciones` centraliza `?tab=citas`, `?tab=mantencion`, `?tab=cumpleanos` y `?tab=historial` + cron diario.
- **Deep-linking de Admin por URL**: `?tab=` en `/admin/settings`, `/admin/comunicaciones`, `/admin/finanzas` (preservando `?month=`) y `?status=` en `/admin/agenda`.

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
