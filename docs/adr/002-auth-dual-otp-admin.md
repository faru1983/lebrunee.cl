# ADR-002: Autenticación Dual (OTP Clientas vs Email+Password Admin)

- **Estado:** Aceptado
- **Decisión:** Las clientas exploran catálogo y horarios sin cuenta; al confirmar su reserva o entrar a `/mi-cuenta` validan su correo vía código OTP de 6 dígitos (Supabase Auth). Las administradoras ingresan en `/admin/login` con correo y contraseña y se autorizan contra `business_members`.
- **Motivo:** Reduce fricción de conversión desde Instagram, evita problemas de Magic Links dentro de webviews/PWA y protege el panel administrativo.
