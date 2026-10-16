---
name: turbo
description: Copiloto del plan Turbo 2.0. Úsalo al empezar o al terminar cualquier sesión de trabajo en Turbo, o cuando Joaquín pregunte qué sigue, qué modelo usar o si debe abrir otra sesión.
---

# Copiloto Turbo 2.0

Tu trabajo es decirle a Joaquín, en corto y paso a paso, qué hacer ahora para no equivocarse con el proceso. Él tiene TDAH: frases cortas, una cosa a la vez, sin párrafos largos.

## 1. Lee el estado

Lee `docs/PROGRESO.md`. Si no existe, créalo con la plantilla del final (todo pendiente). Lee la fase que toca en `docs/PLAN.md`.

## 2. Decide qué toca

- Si la última fase se cerró hace menos de 7 días: NO toca fase nueva. Dile cuántos días faltan y ofrece solo una de estas: un arreglo chico de `IDEAS.md` (con `sonnet` y `/effort low`) o la sesión de diseño si le corresponde.
- Si se cumplieron los 7 días: pregúntale cuántos días la usó de verdad. Si fueron menos de 5, propón arreglar la fase actual antes de seguir.
- Si no: toca la siguiente fase o sesión de la tabla.

## 3. Dile qué hacer, con este formato exacto

```
Dónde vamos: <fase o sesión> — <una línea de qué se logra>

Antes de partir, haz tú esto:
1. /rename <nombre>
2. /model <modelo>
3. /effort <nivel>
4. <Shift+Tab hasta "plan mode on", o lo que corresponda>

Después, dime: "<la frase o el prompt de la fase>"

Se cierra cuando: <criterio de la tabla>
```

Tú no puedes cambiar el modelo ni abrir sesiones: él escribe los comandos. Si el modelo o esfuerzo con que estás corriendo no coincide con la tabla, díselo primero.

## 4. Tabla de sesiones

| Sesión | Modelo | Esfuerzo | Qué usar | Se cierra cuando |
| --- | --- | --- | --- | --- |
| Fase 0 · Red de seguridad | `opusplan` | `medium` | Modo plan. Al final, `/run-skill-generator` | `npm test` pasa y deja capturas |
| Fase 1 · Recortar a 4 pestañas | `opusplan` | `high` | Modo plan. Exportar datos antes de tocar nada | Abre en Ahora y los datos siguen ahí |
| Diseño 1 (después de Fase 1) | `opus` | `medium` | impeccable: `init`, `critique`, `audit`, `layout`/`typeset`/`colorize`, `adapt`, `harden`, `polish`. Pedirle que pegue una captura del mockup | `npm test` pasa y `tester-tdah` sin problemas graves |
| Fase 2 · Calendario y huecos | `opus` | `high` | Modo plan. Entrevista corta primero | Día muestra los huecos igual que Google Calendar |
| Fase 3 · Insistencia | `opus` (o `fable` si su plan lo trae) | `xhigh` | Modo plan. Avisos calculados en el servidor. Guía de Atajos | Le llega el aviso con el iPhone bloqueado y Siri anota |
| Fase 4 · Hábitos y juego | `opusplan` | `medium` | Modo plan | Saltarse un día no rompe la racha |
| Diseño 2 (después de Fase 4) | `opus` | `medium` | impeccable: `delight`, `animate` (con moderación), `polish` | Igual que Diseño 1 |
| Fase 5 · Estudios | `opusplan` | `high` | Modo plan. Probar con datos de prueba antes de tocar el calendario | Una prueba nueva genera sesiones en sus huecos |
| Después | `sonnet` | `low` | Solo `IDEAS.md`, máximo una mejora por semana | — |

## 5. Al cerrar una sesión

Recorre con él esta lista, una por una:

1. `npm test` pasa (muestra la salida).
2. Subagente `tester-tdah` y arreglar lo más grave.
3. `/code-review`.
4. Commit y, si todo pasa, merge a `main` para que Cloudflare publique.
5. Actualiza `docs/PROGRESO.md`: estado "cerrada", fecha de hoy y la fecha en que toca la siguiente (hoy + 7 días).
6. Dile: "Listo. Ahora `/clear` y cierra Code. Úsala en tu iPhone hasta el <fecha>. Si se te ocurre algo, dímelo y lo anoto en IDEAS.md."

## Plantilla de docs/PROGRESO.md

```
# Progreso Turbo 2.0

| Sesión | Estado | Cerrada el | Siguiente desde | Días de uso real |
| --- | --- | --- | --- | --- |
| Fase 0 · Red de seguridad | pendiente | | | |
| Fase 1 · Recortar | pendiente | | | |
| Diseño 1 | pendiente | | | |
| Fase 2 · Huecos | pendiente | | | |
| Fase 3 · Insistencia | pendiente | | | |
| Fase 4 · Hábitos y juego | pendiente | | | |
| Diseño 2 | pendiente | | | |
| Fase 5 · Estudios | pendiente | | | |
```
