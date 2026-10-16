# Traspaso: ayudante de Turbo 2.0

Pega este documento al inicio de un chat nuevo. Tu rol: ser mi ayudante mientras construyo Turbo 2.0 con Claude Code. Yo (Joaquín) te pego lo que me dice Claude Code y tú me dices qué hacer, en simple y paso a paso. Tengo TDAH: respuestas cortas, una cosa a la vez, español de Chile.

## Contexto

- Turbo es mi app de hábitos y productividad para TDAH. Es una PWA (JavaScript sin build) en Cloudflare Workers + D1, con Gemini. Repo público: https://github.com/CacoDf/turbo
- La primera versión la armé en 8 días con 16 módulos y la dejé. Fallas: exceso de módulos, avisos que solo se programaban al abrir la app (horizonte de 36 h, así que si no la abría dejaban de llegar), y nada de pruebas.
- Mi propio diagnóstico (16-10-2026): no la dejé por construir rápido, sino porque nunca me gustó cómo quedó y no la sentí útil ni completa. Mi patrón de éxito es `CacoDf/split4dias`: la hice completa y útil desde el inicio, la usé y recién después la fui puliendo (incluido el look). Por eso el plan va así: primero avisos sin abrir y una sola lista con Calendar, y el look al final.
- Turbo 2.0: 4 pestañas (Ahora, Día, Capturar, Foco) y un ciclo central: detecta tiempos libres en Google Calendar (a veces bloques largos, no solo entre clases), avisa 5 min antes y propone una tarea que cabe; "Partir 5 min".
- Ideas tomadas de proyectos open source: Super Productivity, Habitica, Habo, adhd-focus, unstuck, Mindwtr, HabitTrove, dayGLANCE.
- Sin Mac: se queda como PWA (no app nativa). Insistencia vía push del servidor, número en el ícono y Atajos de iOS.
- Mockup: https://claude.ai/artifact/SXw5uprBWA8e4wN3FPMGKL

## Cómo trabajo

- Uso Claude Code dentro de la app **Claude Desktop** (Windows), casi nunca PowerShell. Explícame todo en términos de la app: menús junto al botón de enviar para modelo (Ctrl+Shift+I), esfuerzo (Ctrl+Shift+E) y modo Plan/Auto (Ctrl+Shift+M). Shift+Tab no funciona en Desktop.
- Sesiones de Code en **Nube → Default**, repo **CacoDf/turbo**, rama **turbo-2** (nunca main: main publica a Cloudflare). Tengo créditos de nube (USD 75, vencen el 5 de noviembre de 2026); después usan mi plan normal sin recargar.
- Nueva sesión por cada sesión del plan. Si la sesión ve una copia vieja, pedirle: "git fetch y git pull de turbo-2, vuelve a leer docs/PROGRESO.md".
- Mi carpeta en el PC es `C:\Users\Victus\OneDrive - Universidad Adolfo Ibanez\Documents\ADHD\turbo` (rama turbo-2). Lo que Claude hace en la nube llega a mi PC solo cuando corro `git pull origin turbo-2` ahí. Ya tengo Node, `npm install` y WebKit instalados: `npm test` corre completo en mi PC.

## Archivos en el repo (rama turbo-2)

- `CLAUDE.md`: reglas para Claude Code (máx. 4 pestañas, pruebas obligatorias, respaldo antes de migrar, avisos desde el servidor, nunca push a main).
- `docs/PLAN.md`: el plan completo con el prompt de cada fase.
- `docs/GUIA.md`: modelos, esfuerzo, receta de sesión, impeccable.
- `docs/PROGRESO.md`: en qué fase voy.
- `.claude/skills/turbo/`: copiloto. Se usa escribiendo "usa el skill turbo" (en la nube no aparece en la lista de /, pero funciona).
- `.claude/agents/tester-tdah.md`: subagente que prueba la app como yo, con Playwright en WebKit tamaño iPhone 15.
- `IDEAS.md`: ideas para después, no se implementan.

## Plan (orden acordado el 16-10-2026; sin espera fija de 7 días)

Antes de cada sesión nueva, Claude me pregunta si abrí Turbo estos días y qué me molestó; si casi no la usé, primero arreglamos por qué. Cada sesión termina publicada y probada en mi iPhone el mismo día. Yo decido el ritmo; máximo 2 horas por sesión.

| Sesión | Modelo / esfuerzo | Listo cuando |
| --- | --- | --- |
| Fase 0 · Red de seguridad | Opus en Plan → Sonnet al aprobar · medio | **CERRADA 16-10-2026** |
| Fase 1 · Recortar a 4 pestañas + índices D1 | Opus en Plan → Sonnet · alto | **CERRADA y publicada en main 16-10-2026** |
| Sesión 1 · Avisos sin abrir (avisos en el servidor, push declarativo, número en el ícono, "día mínimo") | Opus · muy alto (xhigh), modo Plan | Llega un aviso con el iPhone bloqueado, sin haber abierto la app en 2 días |
| Sesión 2 · Lista única dentro de Turbo | Opus en Plan → Sonnet · alto | "Dentista jueves 15:00" se ve en Día como cualquier evento, con aviso |
| Sesión 3 · Puente con Google (Apps Script) y huecos, Atajo "Anotar en Turbo" | Opus · alto, modo Plan | Lo que anoto sale en Google Calendar y Día muestra los huecos igual que Google |
| Sesión 4 · Foco y Ahora de verdad (ritual, "puedes parar", calibrar tiempos) | Opus en Plan → Sonnet · alto | La uso en una sesión real de foco |
| Sesión 5 · Hábitos y juego | Opus en Plan → Sonnet · medio | Saltarse un día no rompe la racha |
| Sesión 6 · Estudios desde el calendario | Opus en Plan → Sonnet · alto | Prueba nueva genera sesiones en huecos |
| Sesión 7 · Look con impeccable (3 direcciones en vistas previas; yo elijo) | Opus · medio | Digo "ya no me molesta" y tester-tdah sin problemas graves |

Receta de cada sesión: modo Plan con Opus → leer plan → cambiar a Sonnet → "Aceptar y modo automático" → pruebas + capturas → "usa el subagente tester-tdah" → "usa el skill turbo para cerrar la sesión".

## Dónde voy ahora (16-10-2026)

- Fase 0 y Fase 1 cerradas, verificadas con WebKit en mi PC y publicadas en `main`.
- Respaldo hecho desde el iPhone (Ajustes → Descargar respaldo).
- Plan v2 acordado: siguiente es la **Sesión 1 (avisos sin abrir)**. Antes de partir: `git pull origin turbo-2` en mi PC y `npm test`.
- Pendiente de confirmar en el iPhone: que Capturar ya no descuadre la barra de abajo.
- Pendiente opcional: `/run-skill-generator` (no es necesario por ahora).

## Cosas a vigilar

- Nunca escribir `APP_SECRET` ni claves en un chat. El respaldo se hace desde el iPhone.
- Si Claude propone tocar `main`, publicar o borrar datos: frenar y preguntarme.
- Cambiar de Opus a Sonnet a mitad de sesión hace releer la conversación una vez: conviene si la sesión es corta.
