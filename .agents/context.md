# Contexto Actual del Proyecto — Lebrunee

## Estado Vigente

- **Fase:** Etapa 3 completada (Separación Ajustes/Comunicaciones, Automatización de Cumpleaños + `birth_date` en formularios, separación `firstName`/`lastName`, y sincronización de URL por pestañas en Admin).
- **Repositorio GitHub:** `https://github.com/faru1983/lebrunee.cl`
- **Producción:** `https://lebrunee.vercel.app`
- **Supabase:** Proyecto `Lebrunee` (`fenbuqgveosoqcuvlrcv`, región `sa-east-1`). Migraciones aplicadas hasta `phase3_birthday_and_templates`.
- **Integraciones:** Resend ya configurado.
- **Pendiente de negocio:** Crear el perfil de Valentina en `/admin/settings?tab=equipo`, verificar si Resend también quedará como Custom SMTP en Supabase Auth, y conectar el dominio final `lebrunee.cl`.

## Últimos Cambios

### 25-11-2026 — Agenda Pro en Admin (Día/Semana/Mes/Lista, Drag & Drop y Control de Emergencias)
- **Centro de mando `/admin/agenda` (`AdminAgendaClient.tsx` + `components/admin/agenda/*`):** Rediseño completo inspirado en Mangomint/Fresha con 4 vistas interactivas sincronizadas por URL (`?view=day|week|month|list&date=YYYY-MM-DD&status=...`), carga dinámica de ventanas de fechas (`fetchAgendaWindowAction`), KPIs en vivo del período, búsqueda instantánea, filtro por profesional y sombreado visual de horarios laborales, bloqueos y turnos especiales.
- **Drag & Drop + Redimensionar + Modo Mover táctil:** En vistas Día y Semana (`AgendaDayView.tsx`, `AgendaWeekView.tsx`) los bloques se arrastran cada 15 min con Pointer Events (`setPointerCapture`, tecla `Escape` para cancelar) y se puede estirar el borde inferior para ajustar duración; en móvil y teclado existe el modo híbrido *"Tocar para levantar → Tocar horario destino"*. Tras mover, aparece un toast con **WhatsApp en 1 toque** y **Deshacer**, y si hay tope o fuera de turno ofrece confirmación de **Sobrecupo / Excepción** (`adminMoveAppointmentAction`).
- **Editor completo de citas (`AppointmentDetailModal.tsx` + `ManualAppointmentModal.tsx`):** Reprogramación con botones de corrimiento rápido (`±15/30/60m`), cambio de duración/buffer, cambio de servicio y adicionales con recálculo en servidor (`adminFullEditAppointmentAction`), cambio instantáneo de estado y pestaña de edición rápida de datos de clienta (`quickEditClientFromAgendaAction`). La creación manual ahora incluye buscador de clientas existentes y opción *"Horario libre / Sobrecupo"* (`allowOverride`).
- **Panel de Emergencias (`EmergencyControlModal.tsx` + `app/actions/agendaActions.ts`):** Pausar/reabrir reservas web en 1 toque (`togglePublicAgendaOpenAction`), bloqueos rápidos (*"Bloquear resto de hoy"*, rango, día completo o abrir turno especial) con alerta de citas afectadas, **corrimiento en bloque de citas del día (`bulkShiftDayAppointmentsAction`)** y **cierre de emergencia del día (`emergencyCloseDayAction`)** con generación automática de enlaces WhatsApp por clienta.

### 24-11-2026 — Aviso de nueva reserva al salón y correo completo de solicitud para clientas
- **Aviso interno por nueva reserva (`notifyNewBooking`):** Agregado `notifyNewBooking` a `NotificationSettings` (`lib/types.ts`, `businessService.ts`). Al reservar desde `/reservar` (`createBookingCore` en `lib/services/bookingService.ts`), se envía un correo interno (`templateKey: "admin_new_booking"`) a `adminNotificationEmail` (con fallback a `replyTo` de Resend, configurado actualmente en `contacto@lebrunee.cl`). Configurable desde `/admin/settings?tab=resend` (`AdminSettingsClient.tsx`).
- **Correo `booking_pending` mejorado + soporte CTA:** `emailService.ts` ahora auto-enlaza URLs en el cuerpo y soporta botón CTA (`ctaButton`). `booking_pending` (actualizado en `email_templates` y `fallbackTemplate`) ahora incluye datos bancarios completos de transferencia y botón/link directo a WhatsApp para enviar el comprobante, omitiendo referencias a la ubicación exacta.
- **Rediseño UX de `/admin/settings?tab=resend`:** Pestaña renombrada a **"Correos y Avisos"** (`AdminSettingsClient.tsx`), priorizando **Notificaciones al salón** arriba, **Plantillas de Correos a Clientas** en acordeones limpios con chips de variables, y dejando **Conexión técnica de envíos (Resend)** al final y colapsada por defecto cuando ya está configurada.

### 24-11-2026 — Corrección de longitud OTP y notificación configurable de nueva clienta
- **Notificación de nueva clienta en `/mi-cuenta`:** Agregado `notifyNewClientSignup` a `NotificationSettings` (`lib/types.ts`, `businessService.ts`). Cuando una clienta nueva crea su ficha por primera vez en `upsertVerifiedClientProfile` (`lib/services/bookingService.ts`), se envía un correo interno al `adminNotificationEmail` vía `sendBusinessEmail` (`templateKey: "admin_new_client_signup"` con `fallbackTemplate` en `emailService.ts`). No se dispara si la clienta agenda directo en `/reservar` ni al editar una ficha existente. Configurable desde `/admin/settings?tab=resend` (`AdminSettingsClient.tsx`).
- **Desajuste 8 vs 6 dígitos:** Supabase Auth estaba enviando códigos OTP de 8 dígitos mientras `ClientPortal.tsx` y `BookingWizard.tsx` tenían `maxLength={6}` y `pattern="\d{6}"`, truncando el código y causando `403 otp_expired`. Se actualizaron ambos inputs a `minLength={6}`, `maxLength={10}` y `pattern="\d{6,10}"` con etiquetas genéricas para soportar tanto 6 como 8 dígitos sin truncamiento.

### 23-11-2026 — Onboarding previo en `/mi-cuenta` (Magic Link + Mi Ficha + invitación WhatsApp)
- **Magic Link + código OTP de respaldo:** `/mi-cuenta` (`ClientPortal.tsx`) ahora envía enlace de acceso directo vía `emailRedirectTo` hacia `/auth/callback?next=/mi-cuenta` y mantiene el campo de código de 6 dígitos en la misma pantalla. `/auth/callback` (`app/auth/callback/route.ts`) vincula `auth_user_id` automáticamente y redirige a `/mi-cuenta?error=expired` si el enlace expira.
- **Tarjeta completa "Mi Ficha":** Agregados `UpsertClientProfileSchema` (`lib/types.ts`), `upsertVerifiedClientProfile` (`lib/services/bookingService.ts`) y `upsertClientProfileAction` (`app/actions/bookingActions.ts`). Cualquier clienta (incluso con 0 citas) puede registrar/editar nombre, apellidos, WhatsApp, Instagram y cumpleaños en `/mi-cuenta` y luego reservar en `/reservar` con todo precargado.
- **Invitación rápida para WhatsApp:** Agregados botones *"Copiar invitación WhatsApp"* y *"Solo enlace"* en `/admin/clients` (`AdminClientsClient.tsx`).

### 22-11-2026 — Orden y normalización del formulario Paso 3 en `/reservar`
- **Alineación y orden:** En `BookingWizard.tsx`, `WhatsApp` e `Instagram` comparten fila y `Fecha de cumpleaños (opcional)` ubica su texto de ayuda debajo del `<input>`, eliminando la desalineación vertical.
- **Normalización y máscaras:** Agregado `normalizeInstagramHandle` en `lib/utils.ts` (usado en `BookingWizard.tsx`, `bookingService.ts` y `crmFinanceActions.ts`). `Nombre`/`Apellidos` se normalizan con primera mayúscula (`normalizePersonName`), `Correo` e `Instagram` en minúsculas. `WhatsApp` e `Instagram` inician limpios, agregan `+56 ` / `@` al enfocar y vuelven a vacío en `onBlur` si no se completan; en DB se guardan en E.164 limpio (`+569...`) y handle sin `@`.
