# Esquema de Base de Datos (Supabase PostgreSQL)

Todas las tablas operacionales incluyen `business_id` (`UUID` FK → `businesses.id`) y tienen **Row Level Security (RLS)** habilitado.

## Tablas Principales

| Tabla | Propósito | Acceso |
|-------|-----------|--------|
| `businesses` | Identidad del salón (`slug`, `custom_domain`, `timezone`, `currency`) | Lectura pública activa / Admin |
| `business_members` | Usuarios de administración (`owner`, `admin`, `staff`) | Propio usuario / Owner |
| `business_settings` | Configuración JSONB por categoría (`branding`, `landing`, `booking`, `payment`, `policies`, `notifications`, `private_location`) | Público excepto `private_location` |
| `business_integrations` | Config pública y `encrypted_secret` AES-256-GCM (Resend, etc.) | Solo `service_role` |
| `staff_members` | Profesionales que atienden (`Valentina Gutiérrez` inicial) | Lectura pública / Admin |
| `service_categories` | Categorías del catálogo | Lectura pública / Admin |
| `services` | Servicios con precio, indicador `desde`, duración y buffer opcional | Lectura pública / Admin |
| `service_addons` | Adicionales configurables (ej. retiro trabajo externo) | Lectura pública / Admin |
| `availability_rules` | Horarios semanales por día y múltiples tramos | Lectura pública / Admin |
| `availability_fixed_slots` | Bloques de inicio fijos cuando `slotMode = 'fixed_blocks'` | Lectura pública / Admin |
| `availability_exceptions` | Bloqueos puntuales o días especiales (`block_day`, `block_range`, `open_custom`) | Lectura pública / Admin |
| `clients` | CRM de clientas vinculable a `auth.users` (+ `retention_opt_out`) | Propia clienta / Admin |
| `client_notes` | Ficha técnica de uñas y notas privadas | Solo Admin |
| `client_retention_logs` | Auditoría de avisos de mantención (`email` / `whatsapp`) | Solo Admin |
| `appointments` | Reservas (`pending_deposit`, `confirmed`, `completed`, `cancelled`, `no_show`) | Propia clienta / Admin |
| `appointment_items` | Snapshot de servicios y extras elegidos | Propia clienta / Admin |
| `payment_methods` | Medios de pago configurables | Solo Admin |
| `payments` | Registro de abonos, saldos y ventas | Solo Admin |
| `expenses` | Registro de gastos del negocio | Solo Admin |
| `email_templates` | Plantillas editables con variables `{{...}}` | Solo Admin |
| `email_logs` | Auditoría y contador diario para proteger cuota gratuita de Resend | Solo Admin |
