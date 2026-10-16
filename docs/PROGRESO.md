# Progreso Turbo 2.0

| Sesión | Estado | Cerrada el | Notas de uso |
| --- | --- | --- | --- |
| Fase 0 · Red de seguridad | cerrada | 2026-10-16 | `npm test` con WebKit: 13/13 worker, 24/24 pantallas |
| Fase 1 · Recortar | cerrada y publicada en `main` | 2026-10-16 | 4 pestañas, datos intactos, índice `idx_reminders_due`. WebKit en el PC de Joaquín: 14/14 worker, 28/28 pantallas. Después se agregó el arreglo de Capturar (ya no abre el teclado sola): 29/29 con Chromium; falta correr WebKit y confirmar en el iPhone que la barra ya no se descuadra |
| Sesión 1 · Avisos sin abrir | publicada en `main` el 2026-10-16, en prueba en el iPhone (cierra tras 2 días sin abrir) | | Avisos calculados por el servidor (cron) desde el respaldo y Google Calendar, push declarativo cifrado, número en el ícono, silencio 00:30–06:00 y en clases, día mínimo. `npm test` en la nube con Chromium: 36/36 worker, 34/34 pantallas. Falta: WebKit en el PC y la prueba de 2 días sin abrir con el iPhone bloqueado |
| Sesión 2 · Lista única dentro de Turbo | pendiente | | |
| Sesión 3 · Puente con Google y huecos | pendiente | | |
| Sesión 4 · Foco y Ahora de verdad | pendiente | | |
| Sesión 5 · Hábitos y juego | pendiente | | |
| Sesión 6 · Estudios desde el calendario | pendiente | | |
| Sesión 7 · Look con impeccable | pendiente | | |

Plan v2 acordado con Joaquín el 16-10-2026: avisos sin abrir y lista única primero, look al final (con impeccable), sin espera fija de 7 días. En su lugar hay un freno de uso: antes de cada sesión, Claude pregunta si abrió Turbo estos días y qué le molestó. Cada sesión termina publicada y probada en el iPhone el mismo día.

Siguiente: cerrar la Sesión 1. Ya está publicada: falta probarla en el iPhone bloqueado (Ajustes → Reconectar → Probar) y esperar 2 días sin abrir la app. Después: Sesión 2 (lista única: "dentista jueves 15:00" como evento en Día), `opusplan` · `high`. El ida y vuelta al instante con Google Calendar (Apps Script) es la Sesión 3.
