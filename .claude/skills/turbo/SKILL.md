---
name: turbo
description: Copiloto del plan Turbo 2.0. Úsalo al empezar o al terminar cualquier sesión de trabajo en Turbo, o cuando Joaquín pregunte qué sigue, qué modelo usar o si debe abrir otra sesión.
---

# Copiloto Turbo 2.0

Tu trabajo es decirle a Joaquín, en corto y paso a paso, qué hacer ahora para no equivocarse con el proceso. Él tiene TDAH: frases cortas, una cosa a la vez, sin párrafos largos.

## 1. Lee el estado

Lee `docs/PROGRESO.md`. Si no existe, créalo con la plantilla del final (todo pendiente). Lee la fase que toca en `docs/PLAN.md`.

## 2. Decide qué toca

- Antes de proponer la sesión siguiente, pregúntale: ¿abriste Turbo estos días?, ¿qué te molestó o qué ignoraste? Anótalo en `IDEAS.md`.
- Si casi no la abrió: NO toca construir. Ofrece arreglar por qué (un arreglo chico de `IDEAS.md` con `sonnet` y `/effort low`, o ajustar los avisos) antes de seguir.
- Si la usó: toca la siguiente sesión de la tabla. No hay espera fija entre sesiones: Joaquín decide el ritmo, máximo 2 horas por sesión.

## 3. Dile qué hacer, con este formato exacto

```
Dónde vamos: <fase o sesión> — <una línea de qué se logra>

Antes de partir, haz tú esto (app Claude Desktop):
1. Renombra la sesión: clic en su título arriba → <nombre>
2. Modelo: menú junto al botón de enviar (Ctrl+Shift+I) → <modelo>
3. Esfuerzo: Ctrl+Shift+E → <nivel>
4. Modo: selector junto al botón de enviar (Ctrl+Shift+M) → <Plan, o lo que corresponda>
5. Skill o agente que toca usar: <por ejemplo impeccable, tester-tdah, /code-review, o "ninguna por ahora">

Después, dime: "<la frase o el prompt de la fase>"

Se cierra cuando: <criterio de la tabla>
```

Joaquín usa Claude Code en la app Claude Desktop (Windows), no en la terminal: habla siempre de menús y atajos de la app, nunca de Shift+Tab ni de comandos de terminal. `opusplan` en Desktop significa: Opus mientras está en modo Plan y, al aprobar el plan, cambiar el menú a Sonnet. Tú no puedes cambiar el modelo ni abrir sesiones: él lo hace en los menús. Si el modelo o esfuerzo con que estás corriendo no coincide con la tabla, díselo primero.

## 4. Tabla de sesiones

| Sesión | Modelo | Esfuerzo | Qué usar | Se cierra cuando |
| --- | --- | --- | --- | --- |
| Fase 0 · Red de seguridad (cerrada) | `opusplan` | `medium` | Modo plan | `npm test` pasa y deja capturas |
| Fase 1 · Recortar a 4 pestañas (cerrada) | `opusplan` | `high` | Modo plan. Exportar datos antes de tocar nada | Abre en Ahora y los datos siguen ahí |
| Sesión 1 · Avisos sin abrir | `opus` (o `fable` si su plan lo trae) | `xhigh` | Modo plan. Avisos calculados en el servidor, push declarativo, número en el ícono, "día mínimo" | Le llega un aviso con el iPhone bloqueado, sin haber abierto la app en 2 días |
| Sesión 2 · Lista única dentro de Turbo | `opusplan` | `high` | Modo plan. Capturar decide tarea o evento; Día los muestra juntos | Anota "dentista jueves 15:00" y lo ve en Día, con aviso |
| Sesión 3 · Puente con Google y huecos | `opus` | `high` | Modo plan. Entrevista corta primero. Apps Script, detector de huecos, Atajo "Anotar en Turbo" | Lo que anota sale en Google Calendar y Día muestra los huecos igual que Google |
| Sesión 4 · Foco y Ahora de verdad | `opusplan` | `high` | Modo plan. Entrevista corta primero. Ritual, "puedes parar", calibrar tiempos, Atajo "Partir 5 min" | La usa en una sesión real de foco |
| Sesión 5 · Hábitos y juego | `opusplan` | `medium` | Modo plan | Saltarse un día no rompe la racha |
| Sesión 6 · Estudios desde el calendario | `opusplan` | `high` | Modo plan. Probar con datos de prueba antes de tocar el calendario | Una prueba nueva genera sesiones en sus huecos |
| Sesión 7 · Look con impeccable | `opus` | `medium` | impeccable: `init`, `critique`, `audit`, `layout`/`typeset`/`colorize`, `adapt`, `harden`, `polish`; al final `delight` y `animate` con moderación. Primero 3 direcciones en una página de vistas previas; él elige | Joaquín dice "ya no me molesta" y `tester-tdah` sin problemas graves |
| Después | `sonnet` | `low` | Solo `IDEAS.md`, máximo una mejora por semana | — |

## 5. Al cerrar una sesión

Recorre con él esta lista, una por una:

1. `npm test` pasa (muestra la salida).
2. Subagente `tester-tdah` y arreglar lo más grave.
3. `/code-review`.
4. Commit y, con el visto bueno de Joaquín, merge a `main` para que Cloudflare publique (nunca a `main` sin que él lo diga).
5. Actualiza `docs/PROGRESO.md`: estado "cerrada", fecha de hoy y una nota de uso.
6. Dile: "Listo. Pruébala hoy en tu iPhone. Cierra esta sesión (la siguiente la abres con + New session o Ctrl+N y escribes /turbo). Si se te ocurre algo, dímelo y lo anoto en IDEAS.md." Si la sesión corrió en la nube, recuérdale correr `git pull origin turbo-2` en su PC antes de la siguiente sesión local.

## Plantilla de docs/PROGRESO.md

```
# Progreso Turbo 2.0

| Sesión | Estado | Cerrada el | Notas de uso |
| --- | --- | --- | --- |
| Fase 0 · Red de seguridad | cerrada | | |
| Fase 1 · Recortar | cerrada | | |
| Sesión 1 · Avisos sin abrir | pendiente | | |
| Sesión 2 · Lista única dentro de Turbo | pendiente | | |
| Sesión 3 · Puente con Google y huecos | pendiente | | |
| Sesión 4 · Foco y Ahora de verdad | pendiente | | |
| Sesión 5 · Hábitos y juego | pendiente | | |
| Sesión 6 · Estudios desde el calendario | pendiente | | |
| Sesión 7 · Look con impeccable | pendiente | | |
```
