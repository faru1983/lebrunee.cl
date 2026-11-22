---
name: cierre-sesion
description: Pasos obligatorios al finalizar una sesión de trabajo relevante en lebrunee.cl.
---

# Skill: Cierre de Sesión Ordenado

1. Ejecuta `npx tsc --noEmit` si modificaste TypeScript, Server Actions, esquemas Zod o servicios.
2. Actualiza `.agents/context.md` (manteniendo máximo las últimas 5 sesiones).
3. Agrega una entrada resumida en `CHANGELOG.md` bajo `[Unreleased]`.
4. Verifica `git status` para asegurar que ningún archivo `.env*` o secreto quede incluido.
