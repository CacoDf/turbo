# Progreso Turbo 2.0

| Sesión | Estado | Cerrada el | Notas de uso |
| --- | --- | --- | --- |
| Fase 0 · Red de seguridad | cerrada | 2026-10-16 | `npm test` con WebKit: 13/13 worker, 24/24 pantallas |
| Fase 1 · Recortar | cerrada y publicada en `main` | 2026-10-16 | 4 pestañas, datos intactos, índice `idx_reminders_due`. WebKit en el PC de Joaquín: 14/14 worker, 28/28 pantallas. Después se agregó el arreglo de Capturar (ya no abre el teclado sola): 29/29 con Chromium; falta correr WebKit y confirmar en el iPhone que la barra ya no se descuadra |
| Sesión 1 · Avisos sin abrir | pendiente | | |
| Sesión 2 · Lista única dentro de Turbo | pendiente | | |
| Sesión 3 · Puente con Google y huecos | pendiente | | |
| Sesión 4 · Foco y Ahora de verdad | pendiente | | |
| Sesión 5 · Hábitos y juego | pendiente | | |
| Sesión 6 · Estudios desde el calendario | pendiente | | |
| Sesión 7 · Look con impeccable | pendiente | | |

Plan v2 acordado con Joaquín el 16-10-2026: avisos sin abrir y lista única primero, look al final (con impeccable), sin espera fija de 7 días. En su lugar hay un freno de uso: antes de cada sesión, Claude pregunta si abrió Turbo estos días y qué le molestó. Cada sesión termina publicada y probada en el iPhone el mismo día.

Siguiente: Sesión 1 (avisos sin abrir), `opus` · `xhigh`, modo plan. Antes de partir: `git pull origin turbo-2` en el PC y `npm test` con WebKit.
