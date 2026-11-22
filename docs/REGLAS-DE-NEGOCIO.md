# Reglas de Negocio (Configurables desde Admin)

Valores cargados inicialmente para **Lebrunee Nails**, todos modificables desde `/admin/settings` sin editar código:

1. **Especialidad:** Trabajo exclusivo sobre **uña natural** (no se realizan extensiones).
2. **Duración Real de Cita:** `duración del servicio + duración de adicionales elegidos (ej. retiro externo +30 min) + buffer de limpieza entre citas`.
3. **Ubicación Privada:** En la landing se muestra solo referencia pública (*Santiago Centro · Cercano a Metro Irarrázaval*). La dirección exacta se revela únicamente tras validar el abono (`confirmed`).
4. **Reserva y Abono:**
   - Las citas web nacen en estado `pending_deposit` con código corto (`LB-XXXX`).
   - La clienta recibe los datos bancarios y un enlace directo a WhatsApp para enviar su comprobante (sin almacenar capturas en el servidor).
   - Al validar la transferencia, la administradora aprueba en 1 toque → pasa a `confirmed`, se registra el pago en `payments` y se notifica por correo si Resend está activo.
5. **Reprogramación:** Permitida desde `/mi-cuenta` hasta `rescheduleCutoffHours` (48h por defecto) antes de la cita, conservando el mismo abono.
6. **Motor de Agenda:** Soporta modo **dinámico** (intervalos configurables cada 15/30/60 min) y modo **bloques fijos** (horas exactas predefinidas), además de apertura por días hacia adelante o fecha tope.
