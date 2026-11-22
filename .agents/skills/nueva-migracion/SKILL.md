---
name: nueva-migracion
description: Checklist obligatorio al crear o modificar tablas en Supabase para lebrunee.cl.
---

# Skill: Nueva Migración SQL Segura y Multi-Tenant

Cada vez que agregues o modifiques tablas en Supabase:

1. **Multi-Tenant:** Incluye `business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE`.
2. **Índices:** Agrega índice compuesto empezando por `business_id` en columnas de consulta frecuente.
3. **RLS Obligatorio:** Ejecuta `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en la misma migración.
4. **Políticas Mínimas:**
   - Si contiene PII o finanzas (`clients`, `appointments`, `payments`, `expenses`, `email_logs`), prohíbe acceso `anon`.
   - Para tablas administrables, usa `public.is_business_admin(business_id)`.
5. **Documentación:** Actualiza `docs/ESQUEMA-BD.md` y `.agents/context.md`.
