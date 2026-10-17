# Ideas para después

Las ideas que no son de la sesión actual van aquí, no al código. En la revisión del domingo se elige máximo una.

Ya tienen sesión en `docs/PLAN.md` (no hace falta anotarlas): lista única con Google Calendar (sesiones 2 y 3), "saltar hoy" sin perder la racha (sesión 5), textos largos y look (sesión 7).

- Pareja congelada: `public/pareja.html` y el worker (`/api/share/*`) aún mandan el push "💌 Te mandaron ánimo", cuyo toque abre `/` sin mostrar nada. Decidir si se apaga en el servidor o se quita del todo.
- Ahora sin tareas no ofrece "Ver todas" (Tareas). Revisar si hace falta cuando el flujo de Capturar quede más pulido (sesión 7).
- Archivos congelados sin importar (`views/more.js`, `money.js`, `partner.js`, `shield.js`, `assistant.js`, `challenges.js`): borrarlos en una limpieza futura si pasan semanas sin tocarlos.

Lo que dijo Joaquín al partir la Sesión 2 (16-10-2026):
- WebKit en el PC no se ha corrido, pero en el iPhone todo funciona. Queda pendiente, sin apuro.
- La prueba de 2 días sin abrir la app (Sesión 1) sigue corriendo sola; se verá cuando pase.
- Google Calendar a veces se demora en aparecer: se agregó ↻ en Día (Sesión 2). Si Google mismo tarda en publicar su link iCal, lo arregla la Sesión 3 (Apps Script).
- La barra de pestañas flotaba más arriba en Capturar y Foco: se arregló en la Sesión 2; confirmar en el iPhone.
- Quiere Turbo y Google Calendar como uno solo, en los dos sentidos (ya en la Sesión 3).

Lo que dijo Joaquín al partir la Sesión 3 (16-10-2026):
- La está usando y probando sobre la marcha; nada le molestó. WebKit en el PC y la prueba de 2 días siguen pendientes, sin apuro.
- Los horarios de huecos podrían ir en Ajustes (hoy fijos: 08:30–20:00, desde 30 min). Solo si los quiere cambiar seguido.
- Puente con Google: el Apps Script pide `getTag` y `getMyStatus` evento por evento y la lectura tarda. Se puede acelerar leyendo la marca solo en el calendario "Turbo" (exige volver a pegar el código y crear una versión nueva de la implementación).

Lo que dijo Joaquín el 17-10-2026 (minutos de foco en Ahora):
- Le molestó que en Ahora el foco fuera siempre 25 y el descanso 5. Ya se arregló: las ruedas de Foco están en las tarjetas de tarea y de calendario. Lo usa sobre todo con bloques de estudio de Google en curso.
- Está chato de haber partido de un proyecto que siente mal hecho y lejos de dejarlo conforme. Antes de la Sesión 4: hacer con él la lista de lo que más le molesta hoy (máx. 5) y decidir juntos si se arregla dentro de Turbo o si conviene rehacer partes (ej. Ahora y Foco desde cero, con el mismo servidor y los mismos datos).
