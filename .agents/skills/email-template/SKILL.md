---
name: email-template
description: Estándar para crear o modificar correos transaccionales con Resend y control de cuota diaria.
---

# Skill: Plantillas de Email y Control de Cuota Resend

1. **Lectura Dinámica:** Nunca leas `RESEND_API_KEY` fijo; usa `getResendConfigForBusiness(businessId)` en `lib/services/emailService.ts`.
2. **Cuota Gratuita:** Antes de enviar correos no críticos (`reminder` o `campaign`), verifica el conteo del día en `email_logs` respetando `transactionalReserve` configurado en `business_settings`.
3. **Variables `{{...}}`:** Mantén compatibilidad con `{{nombre}}`, `{{codigo}}`, `{{servicio}}`, `{{fecha}}`, `{{hora}}`, `{{abono}}`, `{{direccion}}`, `{{negocio}}`.
4. **Auditoría:** Registra cada intento (`sent` | `failed` | `skipped`) en `email_logs` sin bloquear el flujo principal de reserva si Resend falla o aún no está configurado.
