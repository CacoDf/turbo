# Progreso Turbo 2.0

| Sesión | Estado | Cerrada el | Notas de uso |
| --- | --- | --- | --- |
| Fase 0 · Red de seguridad | cerrada | 2026-10-16 | `npm test` con WebKit: 13/13 worker, 24/24 pantallas |
| Fase 1 · Recortar | cerrada y publicada en `main` | 2026-10-16 | 4 pestañas, datos intactos, índice `idx_reminders_due`. WebKit en el PC de Joaquín: 14/14 worker, 28/28 pantallas. Después se agregó el arreglo de Capturar (ya no abre el teclado sola): 29/29 con Chromium; falta correr WebKit y confirmar en el iPhone que la barra ya no se descuadra |
| Sesión 1 · Avisos sin abrir | publicada en `main` y probada en el iPhone (todo bien) | 2026-10-16 | Avisos calculados por el servidor (cron) desde el respaldo y Google Calendar, push declarativo cifrado, número en el ícono, silencio 00:30–06:00 y en clases, día mínimo. `npm test` en la nube con Chromium: 36/36 worker, 34/34 pantallas. Falta: WebKit en el PC y la prueba de 2 días sin abrir con el iPhone bloqueado |
| Sesión 2 · Lista única dentro de Turbo | cerrada, publicada y probada en el iPhone (todo bien) | 2026-10-16 | Capturar decide tarea o evento ("dentista jueves 15:00" → evento en Día con aviso del cron), dictado con comas se separa, ↻ en Día, barra pegada abajo. Nube con Chromium: 45/45 worker, 41/41 pantallas. Claude la probó como usuario (Playwright + cron local) antes de pasársela. Después: eventos que se topan van lado a lado en Día. En el iPhone: barra arreglada, dentista detectado y visible junto a Google |
| Sesión 3 · Puente con Google y huecos | cerrada, publicada y probada en el iPhone (todo bien) | 2026-10-16 | Huecos de 08:30 a 20:00 de lunes a viernes (fin de semana solo entre cosas), desde 30 min, en Día y Ahora, con aviso (máx. 3 por hueco y 3 huecos al día). Puente con Apps Script en los dos sentidos (calendario "Turbo"), conectado y probado por Joaquín: crear, mover en Google y borrar. Atajo "Anotar en Turbo". Nube con Chromium: 81/81 worker, 53/53 pantallas. La primera lectura de Google fue lenta: ahora la app muestra lo último leído y actualiza por detrás |
| Sesión 4 · Foco y Ahora de verdad | pendiente (adelanto publicado) | | 16-10-2026: se adelantó a pedido de Joaquín elegir minutos de foco y descanso (ej. 37 / 10), descanso con "otra vuelta" y alarma suave. El resto de la sesión (ritual, "puedes parar", estimado contra real, Atajo "Partir 5 min") sigue pendiente |
| Sesión 5 · Hábitos y juego | pendiente | | |
| Sesión 6 · Estudios desde el calendario | pendiente | | |
| Sesión 7 · Look con impeccable | pendiente | | |

Plan v2 acordado con Joaquín el 16-10-2026: avisos sin abrir y lista única primero, look al final (con impeccable), sin espera fija de 7 días. En su lugar hay un freno de uso: antes de cada sesión, Claude pregunta si abrió Turbo estos días y qué le molestó. Cada sesión termina publicada y probada en el iPhone el mismo día.

Siguiente: Sesión 4 (Foco y Ahora de verdad). Antes, preguntarle cómo le fue con los avisos de hueco y el Atajo. De la Sesión 1 queda pendiente confirmar que los avisos siguen llegando tras 2 días sin abrir la app.
