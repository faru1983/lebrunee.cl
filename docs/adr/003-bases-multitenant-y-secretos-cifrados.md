# ADR-003: Bases Multi-Inquilino y Secretos Cifrados en Admin

- **Estado:** Aceptado
- **Decisión:** Todas las tablas incorporan `business_id` y RLS. Las credenciales externas (Resend API Key) se guardan en `business_integrations` cifradas con AES-256-GCM (`APP_ENCRYPTION_KEY`) desde el panel `/admin/settings`.
- **Motivo:** Permite operar hoy para un solo negocio (`DEFAULT_BUSINESS_SLUG=lebrunee`) sin complejidad SaaS en UI, pero listo para clonar o escalar a múltiples salones sin migraciones destructivas.
