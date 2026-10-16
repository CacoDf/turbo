# Guía paso a paso en Claude Code

Esta guía es para Joaquín. El copiloto `/turbo` la aplica solo en cada sesión, así que no hace falta memorizarla.

## Antes de la primera sesión (una vez)

- [ ] Claude Code instalado y actualizado en el PC con Windows ([guía oficial](https://code.claude.com/docs/en/setup.md)).
- [ ] El repo en el PC, en la rama `turbo-2` (ver `docs/EMPEZAR.md`).
- [ ] Opcional: la extensión [Claude in Chrome](https://code.claude.com/docs/en/chrome.md), para ver a Claude usando la app en una ventana real.

Todo lo demás ya está en el repo: `CLAUDE.md` (reglas), `.claude/skills/turbo/` (copiloto), `.claude/agents/tester-tdah.md` (agente que prueba la app), `docs/PLAN.md`, `docs/PROGRESO.md` e `IDEAS.md`.

## Qué modelo y qué esfuerzo usar

Regla simple: **piensa con Opus, construye con Sonnet, y sube el esfuerzo solo cuando algo es difícil o toca tus datos.** En Pro y Max, Claude Code parte con Opus 5.5 en esfuerzo medio ([modelos](https://code.claude.com/docs/en/model-config.md)).

| Momento | Modelo | Esfuerzo | Por qué |
| --- | --- | --- | --- |
| Planificar e implementar una fase normal | `opusplan` | `high` | Opus arma el plan y Sonnet lo ejecuta |
| La sesión 1 (avisos) o un bug que no entiendes | `opus`, o `fable` si tu plan lo trae | `xhigh` | Arquitectura y depuración difícil |
| Cambios chicos: textos, colores | `sonnet` | `low` | Rápido y gasta poco |
| Diseño con impeccable | `opus` | `medium` | Juicio visual (recomendación, no regla oficial) |
| Agente que prueba la app | `sonnet` | `medium` | Ya viene fijado en su archivo |
| Una sola pregunta difícil | El que tengas | `ultrathink` en ese mensaje | Piensa más solo en ese turno |

- `/model opusplan` cambia el modelo. `/model` solo abre el selector: Enter lo deja como predeterminado y `s` solo para esta sesión.
- `/effort high` cambia el esfuerzo (`low`, `medium`, `high`, `xhigh`, `max`). No uses `max` salvo algo muy duro.
- `/usage` muestra cuánto del plan llevas. Si te acercas al límite, baja a `sonnet`.

## La receta de cada sesión

1. Abre la terminal en la carpeta del repo y escribe `claude` (en Desktop: + New session, Local, carpeta turbo).
2. El copiloto te saluda y te dice qué toca. Si no lo hace, escribe `/turbo`.
3. Renombra la sesión y ajusta modelo y esfuerzo en los menús junto a enviar, según te diga.
4. Selector de modo junto a enviar → **Plan**. Claude lee y propone, sin tocar nada.
5. Pega el prompt de la fase (está en `docs/PLAN.md`). Responde corto si pregunta.
6. Lee el plan (Ctrl+G para editarlo) y pregunta: "¿qué puede salir mal y cómo lo vas a probar?".
7. Aprueba y déjalo trabajar. Si se desvía, Esc. Si lo corriges dos veces y sigue mal, `/clear` y pídelo mejor.
8. Opcional: `/goal npm test pasa y hay capturas de las 4 pestañas, o para después de 20 turnos`.
9. "Usa el subagente tester-tdah para probar esta fase", después `/code-review`.
10. `/turbo` para cerrar: commit, merge (si tú lo pides), anotar en PROGRESO, `/clear` y a probarla hoy mismo en tu iPhone.

Tres reglas para pedir bien: di el resultado y cómo se comprueba; apunta a archivos con `@`; una fase por sesión (lo demás, "anótalo en IDEAS.md").

## Agentes que prueban la app

| Tester | Qué ve | Cuándo |
| --- | --- | --- |
| `tester-tdah` (subagente con Playwright) | La app en WebKit con tamaño de iPhone 15 | Al cerrar cada fase |
| Claude en Chrome (`claude --chrome`) | Una ventana de Chrome real mientras Claude hace clic | Para mirar o depurar |
| Tú, usándola en tu iPhone | Avisos reales, Atajos, Siri | Siempre |

Además: `/verify` comprueba un cambio contra la app corriendo y `/code-review` revisa el código con un subagente que no lo escribió ([skills incluidas](https://code.claude.com/docs/en/skills.md)).

## Diseño con impeccable

Una sola sesión, la 7, al final del plan. Con `opus` · `medium`:

1. `/impeccable init` (escribe PRODUCT.md y DESIGN.md). Contexto: "app para TDAH, iPhone, una mano, 3 minutos entre clases, sin culpa". Pega una captura del [mockup](https://claude.ai/artifact/SXw5uprBWA8e4wN3FPMGKL) como dirección.
2. `/impeccable critique` y `/impeccable audit`.
3. Arreglos puntuales: `layout`, `typeset`, `colorize`.
4. `/impeccable adapt` y `/impeccable harden`.
5. `/impeccable polish`. Después `npm test` y `tester-tdah`.

Antes de aplicar nada, pide 3 direcciones en una página de vistas previas (como hiciste con VANDAL), elige una y recién entonces se aplica a la app.

Al final de la misma sesión: `/impeccable delight` y `/impeccable animate`, con moderación.

## Fuentes

[Modelos y esfuerzo](https://code.claude.com/docs/en/model-config.md) · [Buenas prácticas](https://code.claude.com/docs/en/best-practices.md) · [/goal](https://code.claude.com/docs/en/goal.md) · [Subagentes](https://code.claude.com/docs/en/sub-agents.md) · [Skills](https://code.claude.com/docs/en/skills.md) · [Chrome](https://code.claude.com/docs/en/chrome.md) · [Playwright MCP](https://github.com/mcp/microsoft/playwright-mcp) · [Impeccable](https://www.mdskills.ai/plugins/impeccable)
