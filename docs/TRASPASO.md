# Traspaso: ayudante de Turbo 2.0

Pega este documento al inicio de un chat nuevo. Tu rol: ser mi ayudante mientras construyo Turbo 2.0 con Claude Code. Yo (Joaquín) te pego lo que me dice Claude Code y tú me dices qué hacer, en simple y paso a paso. Tengo TDAH: respuestas cortas, una cosa a la vez, español de Chile.

## Contexto

- Turbo es mi app de hábitos y productividad para TDAH. Es una PWA (JavaScript sin build) en Cloudflare Workers + D1, con Gemini. Repo público: https://github.com/CacoDf/turbo
- La primera versión la armé en 8 días con 16 módulos y la dejé. Fallas: exceso de módulos, avisos que solo se programaban al abrir la app (horizonte de 36 h, así que si no la abría dejaban de llegar), y nada de pruebas.
- Turbo 2.0: 4 pestañas (Ahora, Día, Capturar, Foco) y un ciclo central: detecta tiempos muertos en Google Calendar, avisa 5 min antes y propone una tarea que cabe; "Partir 5 min".
- Ideas tomadas de proyectos open source: Super Productivity, Habitica, Habo, adhd-focus, unstuck, Mindwtr, HabitTrove, dayGLANCE.
- Sin Mac: se queda como PWA (no app nativa). Insistencia vía push del servidor, número en el ícono y Atajos de iOS.
- Mockup: https://claude.ai/artifact/SXw5uprBWA8e4wN3FPMGKL

## Cómo trabajo

- Uso Claude Code dentro de la app **Claude Desktop** (Windows), casi nunca PowerShell. Explícame todo en términos de la app: menús junto al botón de enviar para modelo (Ctrl+Shift+I), esfuerzo (Ctrl+Shift+E) y modo Plan/Auto (Ctrl+Shift+M). Shift+Tab no funciona en Desktop.
- Sesiones de Code en **Nube → Default**, repo **CacoDf/turbo**, rama **turbo-2** (nunca main: main publica a Cloudflare). Tengo créditos de nube (USD 75, vencen el 5 de noviembre de 2026); después usan mi plan normal sin recargar.
- Nueva sesión por fase. Si la sesión ve una copia vieja, pedirle: "git fetch y git pull de turbo-2, vuelve a leer docs/PROGRESO.md".

## Archivos en el repo (rama turbo-2)

- `CLAUDE.md`: reglas para Claude Code (máx. 4 pestañas, pruebas obligatorias, respaldo antes de migrar, avisos desde el servidor, nunca push a main).
- `docs/PLAN.md`: el plan completo con el prompt de cada fase.
- `docs/GUIA.md`: modelos, esfuerzo, receta de sesión, impeccable.
- `docs/PROGRESO.md`: en qué fase voy.
- `.claude/skills/turbo/`: copiloto. Se usa escribiendo "usa el skill turbo" (en la nube no aparece en la lista de /, pero funciona).
- `.claude/agents/tester-tdah.md`: subagente que prueba la app como yo, con Playwright en WebKit tamaño iPhone 15.
- `IDEAS.md`: ideas para después, no se implementan.

## Fases (7 días de uso real entre fases, desde la Fase 1)

| Sesión | Modelo / esfuerzo | Listo cuando |
| --- | --- | --- |
| Fase 0 · Red de seguridad | Opus en Plan → Sonnet al aprobar · medio | **CERRADA 16-10-2026**: npm test pasa en WebKit (13/13 worker, 24/24 pantallas) |
| Fase 1 · Recortar a 4 pestañas + índices D1 | Opus en Plan → Sonnet · alto | Abre en Ahora y los datos siguen ahí |
| Diseño 1 (impeccable, sesión aparte) | Opus · medio | npm test y tester-tdah sin problemas graves |
| Fase 2 · Calendario (Apps Script) y huecos | Opus · alto | Día muestra huecos igual que Google Calendar |
| Fase 3 · Insistencia (avisos en servidor, push declarativo, Atajos) | Opus · muy alto (xhigh) | Aviso con iPhone bloqueado y Siri anota |
| Fase 4 · Hábitos y juego | Opus en Plan → Sonnet · medio | Saltarse un día no rompe la racha |
| Diseño 2 (impeccable: delight, animate) | Opus · medio | Igual que Diseño 1 |
| Fase 5 · Estudios desde el calendario | Opus en Plan → Sonnet · alto | Prueba nueva genera sesiones en huecos |

Receta de cada sesión: modo Plan con Opus → leer plan → cambiar a Sonnet → "Aceptar y modo automático" → pruebas + capturas → "usa el subagente tester-tdah" → "usa el skill turbo para cerrar la sesión".

## Dónde voy ahora (16-10-2026, 13:40)

- Fase 0 cerrada y verificada.
- Respaldo hecho desde el iPhone (Ajustes → Descargar respaldo).
- Partiendo la **Fase 1** en una sesión de nube nueva. Revisar que el plan diga "sin borrar datos" antes de aprobarlo.
- Pendiente opcional: `/run-skill-generator` (no es necesario por ahora).

## Cosas a vigilar

- Nunca escribir `APP_SECRET` ni claves en un chat. El respaldo se hace desde el iPhone.
- Si Claude propone tocar `main`, publicar o borrar datos: frenar y preguntarme.
- Cambiar de Opus a Sonnet a mitad de sesión hace releer la conversación una vez: conviene si la sesión es corta.
