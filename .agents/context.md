# Contexto Actual del Proyecto — Lebrunee

## Estado Vigente

- **Fase:** Etapa 3 completada (Separación Ajustes/Comunicaciones, Automatización de Cumpleaños + `birth_date` en formularios, separación `firstName`/`lastName`, y sincronización de URL por pestañas en Admin).
- **Repositorio GitHub:** `https://github.com/faru1983/lebrunee.cl`
- **Producción:** `https://lebrunee.vercel.app`
- **Supabase:** Proyecto `Lebrunee` (`fenbuqgveosoqcuvlrcv`, región `sa-east-1`). Migraciones aplicadas hasta `phase3_birthday_and_templates`.
- **Integraciones:** Resend ya configurado.
- **Pendiente de negocio:** Crear el perfil de Valentina en `/admin/settings?tab=equipo`, verificar si Resend también quedará como Custom SMTP en Supabase Auth, y conectar el dominio final `lebrunee.cl`.

## Últimos Cambios

### 23-11-2026 — Onboarding previo en `/mi-cuenta` (Magic Link + Mi Ficha + invitación WhatsApp)
- **Magic Link + código OTP de respaldo:** `/mi-cuenta` (`ClientPortal.tsx`) ahora envía enlace de acceso directo vía `emailRedirectTo` hacia `/auth/callback?next=/mi-cuenta` y mantiene el campo de código de 6 dígitos en la misma pantalla. `/auth/callback` (`app/auth/callback/route.ts`) vincula `auth_user_id` automáticamente y redirige a `/mi-cuenta?error=expired` si el enlace expira.
- **Tarjeta completa "Mi Ficha":** Agregados `UpsertClientProfileSchema` (`lib/types.ts`), `upsertVerifiedClientProfile` (`lib/services/bookingService.ts`) y `upsertClientProfileAction` (`app/actions/bookingActions.ts`). Cualquier clienta (incluso con 0 citas) puede registrar/editar nombre, apellidos, WhatsApp, Instagram y cumpleaños en `/mi-cuenta` y luego reservar en `/reservar` con todo precargado.
- **Invitación rápida para WhatsApp:** Agregados botones *"Copiar invitación WhatsApp"* y *"Solo enlace"* en `/admin/clients` (`AdminClientsClient.tsx`).

### 22-11-2026 — Orden y normalización del formulario Paso 3 en `/reservar`
- **Alineación y orden:** En `BookingWizard.tsx`, `WhatsApp` e `Instagram` comparten fila y `Fecha de cumpleaños (opcional)` ubica su texto de ayuda debajo del `<input>`, eliminando la desalineación vertical.
- **Normalización y máscaras:** Agregado `normalizeInstagramHandle` en `lib/utils.ts` (usado en `BookingWizard.tsx`, `bookingService.ts` y `crmFinanceActions.ts`). `Nombre`/`Apellidos` se normalizan con primera mayúscula (`normalizePersonName`), `Correo` e `Instagram` en minúsculas. `WhatsApp` e `Instagram` inician limpios, agregan `+56 ` / `@` al enfocar y vuelven a vacío en `onBlur` si no se completan; en DB se guardan en E.164 limpio (`+569...`) y handle sin `@`.

### 22-11-2026 — Verificación previa de correo y precarga de ficha en `/reservar`
- **Flujo OTP primero + Carga automática de ficha:** En `/reservar` (`BookingWizard.tsx`, `app/reservar/page.tsx`), cuando `requireClientOtp` está activo, el Paso 3 ahora solicita primero el correo y el código OTP de 6 dígitos; al validarse (o si ya existe sesión SSR activa), `getVerifiedClientProfile` (`lib/services/bookingService.ts`) + `getVerifiedClientProfileAction` (`app/actions/bookingActions.ts`) cargan automáticamente nombre, apellidos, WhatsApp, cumpleaños e Instagram desde `clients` con resumen editable en 1 toque.
- **Preservación de Instagram:** `createBookingCore` conserva `instagram_handle` previo si el campo viene vacío al actualizar una clienta existente.

### 22-11-2026 — Recuperación de contraseña en Admin
- **Login & Callback Auth:** Agregada opción *"¿Olvidaste tu contraseña?"* en `/admin/login` (`AdminLoginForm.tsx`), ruta `/auth/callback` (`app/auth/callback/route.ts`) para `exchangeCodeForSession`/`verifyOtp`, y pantalla `/admin/reset-password` (`AdminResetPasswordForm.tsx`) habilitada en `proxy.ts` y `app/admin/layout.tsx`.

### 22-11-2026 — Cumpleaños, Nombre/Apellido separado, URL Tabs y Orden Ajustes/Comunicaciones
- **Migración `phase3_birthday_and_templates`**: agregada columna `clients.birth_date` (`DATE`), tabla `client_birthday_logs` con restricción anual por canal (`UNIQUE (business_id, client_id, birthday_year, channel)`) + RLS, regla `birthday_rules` en `business_settings` y plantilla `birthday_gift`.
- **Formularios con Nombre + Apellidos + Cumpleaños opcional**: `/reservar`, modal manual en Admin, `/mi-cuenta` y detalle CRM `/admin/clients/[id]` solicitan `firstName`, `lastName` y `birth_date` (`Día + Mes + Año` con `autoComplete`).
- **Separación limpia**: `/admin/settings?tab=resend` administra credenciales Resend y las 4 plantillas transaccionales de reserva; `/admin/comunicaciones` centraliza `?tab=citas`, `?tab=mantencion`, `?tab=cumpleanos` y `?tab=historial` + cron diario.
- **Deep-linking de Admin por URL**: `?tab=` en `/admin/settings`, `/admin/comunicaciones`, `/admin/finanzas` (preservando `?month=`) y `?status=` en `/admin/agenda`.
