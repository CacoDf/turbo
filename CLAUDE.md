# Turbo 2.0

PWA para TDAH de Joaquín, usada en iPhone (Safari, agregada a la pantalla de inicio).
JavaScript sin build en `public/`, servidor en Cloudflare Workers + D1 (`src/worker.js`), IA con Gemini.
El plan completo, por fases y sesiones, está en @docs/PLAN.md. Trabaja solo en la sesión que Joaquín indique.

IMPORTANTE: en el primer mensaje de cada sesión, antes de cualquier otra cosa, usa el skill `turbo`: lee `docs/PROGRESO.md` y dile a Joaquín en qué fase o sesión va, qué modelo y esfuerzo poner y qué hacer. Al cerrar una sesión, úsalo otra vez.

## Comandos

- Probar la app en el PC: `python -m http.server 8787 --directory public` y abrir http://localhost:8787
- Instalar (una vez): `npm install` y `npx playwright install webkit`
- Pruebas: `npm test` (pruebas del worker con Miniflare + Playwright con WebKit en viewport iPhone 15). Capturas en `tests/capturas/`. Solo worker: `npm run test:worker`. Solo pantallas: `npm run test:ui`. WebKit es obligatorio; solo en la nube (sin WebKit) usa `TURBO_BROWSER=chromium npm test`.
- Respaldo de datos desde el servidor a `respaldos/*.json`: `npm run respaldo` (hazlo antes de cualquier migración; la carpeta no se sube a git).
- Al abrir una sesión, el hook `SessionStart` (`.claude/hooks/al-iniciar.mjs`) pasa a `turbo-2` y la trae al día desde GitHub. Nunca toca `main` ni cambios sin guardar. Si avisa que no pudo, ponla al día antes de leer `docs/PROGRESO.md`.
- Publicar: Cloudflare publica solo al subir a `main`. Trabaja en la rama `turbo-2` y nunca hagas push a `main` sin que Joaquín lo pida.

## Reglas de producto

- IMPORTANTE: máximo 4 pestañas: Ahora, Día, Capturar, Foco. Ajustes es un ícono, no una pestaña. No crees pantallas nuevas.
- Cada cambio debe quitarle toques o decisiones a Joaquín, no agregarle.
- Antes de empezar una sesión nueva, pregúntale si abrió Turbo estos días y qué le molestó. Si casi no la usó, arregla primero por qué en vez de construir más. No hay espera fija entre sesiones: el ritmo lo decide Joaquín (máximo 2 horas por sesión).
- Cada sesión termina publicada y probada en su iPhone el mismo día (merge a `main` solo cuando él lo pida).
- Las ideas que no son de la fase actual se anotan en `IDEAS.md`. No se implementan.
- Textos de la interfaz en español de Chile: cortos, directos y sin culpa. La gamificación no castiga ni quita puntos.
- Avisos: máximo 3 por hueco, frases que rotan, silencio durante clases y después de la hora de dormir.

## Reglas técnicas

- Nada está terminado sin `npm test` pasando y capturas en viewport de iPhone. Muestra la salida de las pruebas, no solo digas que pasaron.
- Los datos viven en localStorage (`turbo.v1`) con respaldo en D1. Ningún cambio de formato sin exportar un respaldo antes y sin una migración con prueba.
- D1 gratis: 5 millones de filas leídas y 100.000 escritas al día; si se pasa, las consultas fallan hasta las 00:00 UTC. El cron corre cada minuto: toda consulta del cron debe usar un índice.
- Secretos (`APP_SECRET`, `GEMINI_API_KEY`) solo en Cloudflare. Nunca en el código, en commits ni en el chat.
- La IA es opcional: todo flujo con Gemini tiene respaldo sin IA (ver `localParse` y `fallbackSteps` en `public/js/planner.js`).
- Los avisos los calcula el servidor (cron del worker), no el teléfono: tienen que seguir llegando aunque Joaquín pase días sin abrir la app.
- Notificaciones: Declarative Web Push (payload con `"web_push": 8030`, `title` y `navigate`), manteniendo el service worker como respaldo.
- Todo lo nuevo usa las variables CSS que ya existen, sin colores sueltos: el look se rehace al final (sesión 7) y debe costar poco.
- Sigue el patrón de `public/js/views/*.js` (`render`, `mount`, `actions`). Archivos de vista de menos de 300 líneas.
- Cuando agregues un archivo a `public/`, agrégalo también a la lista `SHELL` de `public/sw.js` y sube la versión de `CACHE`.

## Al terminar una tarea

- IMPORTANTE: antes de pedirle a Joaquín que pruebe, Claude usa la app como él. Abre la app local con Playwright en viewport de iPhone y hace los flujos de la sesión de punta a punta (y el cron del worker si hay avisos). Mira cada captura y arregla lo que falle o se vea mal. Recién entonces le pasa una lista corta de lo que solo se puede probar en el iPhone (teclado y barra reales de iOS, push con el teléfono bloqueado, su Google Calendar).
- Si cambió la interfaz, usa el subagente `tester-tdah` (en `.claude/agents/`) y arregla lo que más haría abandonar la app.
- Pide una revisión con un subagente sobre el diff, contra la fase correspondiente de docs/PLAN.md. Solo cuentan fallas de correctitud o de requisitos.
- Commits en español, descriptivos, uno por cambio lógico.
