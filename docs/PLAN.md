# Turbo 2.0: plan para una app TDAH que sí uses

16 de octubre de 2026 · Joaquín

Mockup de las pantallas: https://claude.ai/artifact/SXw5uprBWA8e4wN3FPMGKL (dirección para impeccable, no un plano exacto). Guía de uso de Claude Code: `docs/GUIA.md`. Estado actual: `docs/PROGRESO.md`.

## Resumen

No cambies de app ni partas de cero: reconstruye turbo como **Turbo 2.0**, más chica, sobre la misma infraestructura gratis que ya tienes en Cloudflare.

- Turbo falló por exceso (16 módulos en 8 días), porque sus avisos dejaban de llegar si no la abrías, y por falta de pulido.
- Turbo 2.0 tiene 4 pestañas y un ciclo central: detecta tus tiempos muertos en Google Calendar, te avisa y te ayuda a partir en 5 minutos.
- La insistencia llega por avisos escalonados, el número en el ícono y los Atajos de iOS (Siri, pantalla bloqueada y automatizaciones).
- Sin Mac, una app nativa no conviene: con cuenta gratis vence cada 7 días y no tiene notificaciones push.
- Se construye en 6 fases con Claude Code, cada una seguida de 7 días de uso real. Plan B sin programar: Super Productivity + Habitica desde la App Store.

## Diagnóstico: por qué turbo no funcionó

Turbo no falló por falta de funciones. Falló por exceso de módulos, por no tener forma de alcanzarte fuera de la app y por construirse en un solo sprint sin probarla en tu día real.

Lo que muestra el repo:

- 9 commits entre el 22 y el 30 de septiembre de 2026, en 3 fases. Cerca de 5.500 líneas de código.
- 16 módulos, 11 de ellos escondidos en la pestaña "Más". Ninguna prueba automática.
- Los datos viven en el teléfono (localStorage) con respaldo en Cloudflare. La infraestructura es buena y cuesta $0: se puede reutilizar.
- El horario semanal se ingresa a mano y los eventos de Google se importan aparte. La app sabía cuántos minutos libres tenías, pero nunca te avisaba de ellos.

Lo que sí sirvió, aunque fuera unos días: Ahora + Foco, Hábitos + Rutinas, Vaciar cabeza con IA y Calendario/Estudios (este último, mal pensado).

| Lo que pasó | Causa probable | Qué cambia en Turbo 2.0 |
| --- | --- | --- |
| Me olvidaba de abrirla | Los avisos se calculaban en el teléfono (`computeReminders` en `planner.js`), solo al abrir la app y para las 36 horas siguientes. Si no la abrías un día y medio, dejaban de llegar | El servidor calcula los avisos solo, y te busca con avisos escalonados, Atajos de iOS y número en el ícono |
| Se volvió aburrida | Recompensa fija (XP que sube autos) que se vuelve predecible | Recompensas variables y temporadas cortas que se renuevan |
| Faltaba pulido | 3 fases en 8 días, sin pruebas y sin una semana de uso real entre fases | Cada fase se usa 7 días antes de construir la siguiente, con pruebas |
| Tiempos muertos entre clases | La app usaba el tiempo libre para elegir tarea, pero no detectaba huecos ni avisaba de ellos | Detector de huecos que avisa y propone una tarea que cabe |

El patrón de construir todo en un hiperfoco de 8 días y después soltarlo es parte del problema. Por eso el plan pone reglas para Joaquín y para Claude Code, no solo funciones.

## Lo que encontré en GitHub y qué robarle a cada uno

Ningún proyecto open source cubre hábitos, tareas, foco, gamificación y calendario a la vez. Combinar 3 apps obliga a abrir 3 apps: justo la fricción que hizo soltar turbo. Se usan como catálogo de ideas ya probadas y se meten en una sola app.

| Proyecto | Comunidad | Qué es | En iPhone | Qué le robamos |
| --- | --- | --- | --- | --- |
| [Super Productivity](https://apps.apple.com/us/app/-/id1482572463) | ~18.000–20.000 estrellas, desde 2016 | Tareas, timeboxing, Pomodoro, sin cuentas | App Store gratis, 4,8 (34 notas) | Ayudante anti-procrastinación con técnicas de TCC, estimado vs real, cierre del día |
| [Habitica](https://selfhostyourself.com/alternative-to/habitica) | ~14.100 estrellas | Hábitos, diarias y tareas como un RPG | App Store gratis | Separar hábitos, diarias y tareas. Premios que tú defines y compras con oro |
| [Mindwtr](https://github.com/topics/adhd) | ~2.200 estrellas | Método GTD offline, con servidor MCP | iOS y Android | Bandeja de entrada única: todo entra ahí y se ordena después |
| [Habo](https://gittrend.io/repo/xpavle00/Habo) | ~1.500 estrellas, GPL-3.0 | Rastreador de hábitos minimalista | [App Store gratis](https://apps.apple.com/app/id1670223360), con widget | Hábitos sí/no, numéricos o "saltar" sin romper la racha |
| [HabitTrove](https://selfhostyourself.com/services/habittrove) | ~600–680 estrellas, AGPL-3.0 | Hábitos que dan monedas canjeables | PWA | Lista de deseos: premios reales que compras con monedas |
| [adhd-focus](https://github.com/emanuelet/adhd-focus) | Pocas estrellas | Capa TDAH sobre Todoist | Web | Solo 3 tareas por día y un ritual de 30 segundos antes de cada foco |
| [unstuck](https://github.com/azchad-commits/unstuck) | Sin estrellas, muy pensado | Planificador para ceguera temporal | PWA y Capacitor | "Solo los primeros 5 minutos", aviso cuando subestimas tiempos, "puedes parar" al terminar |
| [dayGLANCE](https://github.com/krelltunez/dayGLANCE) | Sin dato | Bloques de tiempo con Pomodoro | PWA | Vista del día en bloques, importación de Google Calendar por iCal |

Plan B si algún día no quieres programar: Super Productivity + Habitica desde la App Store.

## La decisión: PWA, no app nativa

Sin Mac, lo mejor es seguir con turbo como PWA en Cloudflare y darle "manos" en el iPhone con los Atajos de iOS.

| Criterio | PWA (Turbo 2.0) | Nativa sin Mac (SwiftUI + compilación en la nube + SideStore) |
| --- | --- | --- |
| Instalación | Safari → Agregar a inicio. Desde iOS 26 cualquier sitio se instala como app | Con cuenta Apple gratis, la app vence cada 7 días y SideStore la renueva |
| Límites | Ninguno práctico | Máximo 3 apps activas y 10 apps nuevas por semana |
| Notificaciones | Push web (iOS 16.4+) y push declarativo (iOS 18.4+), que no se pierde si falla el código | Solo avisos locales: la cuenta gratis no permite push |
| Fuera de la app | Número en el ícono y Atajos: Siri, Centro de Control, pantalla bloqueada, botón de Acción | Widgets en teoría, no confirmados con cuenta gratis |
| Iterar con Claude Code | Pruebas en el PC y publicas al subir a GitHub | Compilación en la nube y reinstalación por cada cambio |

Cambio técnico importante: turbo hoy manda un push vacío y el teléfono pide el mensaje después. Pasarlo a push declarativo hace que el aviso llegue aunque falle el código de la app.

## El diseño de Turbo 2.0

Turbo 2.0 hace una sola cosa bien: cada vez que se abre un hueco en el día, dice qué hacer en él y ayuda a partir en 5 minutos.

El ciclo: Google Calendar → detector de huecos → aviso 5 min antes → Ahora (1 tarea que cabe) → Foco (partir 5 min) → XP y racha → siguiente hueco. Lo que se captura entra a la misma bandeja de la que Ahora elige.

### Cuatro pestañas, nada más

| Pestaña | Qué hace | Idea tomada de |
| --- | --- | --- |
| Ahora | Lo que pasa ahora, el próximo hueco y UNA tarea que cabe. Botón grande: "Partir 5 min" | turbo (Ahora) y adhd-focus |
| Día | Google Calendar con los huecos marcados, rutinas de mañana y noche, y hábitos | dayGLANCE y turbo (Rutinas) |
| Capturar | Hablar o escribir. La IA lo vuelve tareas con tiempo estimado y primer paso físico | Mindwtr y goblin.tools |
| Foco | Barra que se achica, ritual de 30 segundos, "puedes parar" al final, aprende cuánto subestimas | unstuck, adhd-focus y Super Productivity |

Ajustes queda como un ícono arriba, no como pestaña.

### Tiempos muertos

- Detectar cada hueco de 15 minutos o más entre la hora de despertar y la de dormir.
- Corto (15–30 min): algo rápido o un hábito. Medio (30–60): sesión de estudio. Largo (más de 60): bloque de foco con pausas.
- Elegir la tarea que cabe, la más urgente y la que calza con la energía (un toque: baja, media, alta) y con el contexto (solo celular o con computador).
- Avisar 5 minutos antes. Si dice "ahora no", ofrecer la siguiente.

### Estudios sin pantalla propia

Las pruebas salen del calendario cuando un evento dice Prueba, Certamen, Control, Examen o Entrega. La app reparte sesiones hacia atrás y las mete en los huecos. El calendario es la única fuente, sin horario manual.

### Hábitos que perdonan

- Cada hábito se ancla a un momento: "después de almorzar, 10 minutos de orden" (planes si-entonces; Gawrilow y Gollwitzer, 2008).
- Racha semanal (por ejemplo 5 de 7), no diaria. Saltarse un día no afecta la formación del hábito, que tomó 66 días en promedio, rango 18 a 254 (Lally et al., 2009).
- Botón "saltar hoy" y opción de reparar una racha al día siguiente. Una racha rota baja el compromiso, menos cuando se puede reparar (Silverman y Barasch, 2023).

### Gamificación que no se gasta

- El garage se queda, pero da XP por **partir** (los primeros 5 minutos), no solo por terminar.
- Bonus sorpresa de vez en cuando.
- Temporadas de 4 semanas con 3 desafíos nuevos y un auto exclusivo.
- Premios reales de la lista ("un capítulo de serie", "tarde libre sin culpa").
- Nada de castigos ni vidas que se pierden.

### Lo que sale (congelado, no borrado)

Plata, Pareja, Escudo, Metas y Desafíos sueltos salen de la navegación. Ánimo queda como un toque de energía dentro de Ahora. La Secretaria deja de ser un chat y queda como Capturar más el plan de la mañana. Todo sigue en git.

## Insistencia: la app busca a Joaquín

Los avisos los calcula el servidor cada minuto, no el teléfono, así que siguen llegando aunque pasen días sin abrir la app.

| Momento | Aviso | Si no responde |
| --- | --- | --- |
| Al apagar la alarma | "Hoy: 3 cosas y 2 huecos. La primera es X" | Se repite una vez a los 20 min |
| 5 min antes de un hueco | "Tienes 40 min libres hasta X. ¿Partimos con Y (25 min)?" | Segundo aviso al empezar el hueco con otra frase. Tercero a los 10 min: "Solo 5 minutos" |
| Al terminar un foco | "Listo. Puedes parar, o seguir 15 min" | Nada |
| Hábito anclado | "Después de almorzar: 10 min de orden" | Un recordatorio más |
| Noche | "Cierre de 2 minutos: ¿qué queda para mañana?" | Nada |

Reglas: máximo 3 avisos por hueco, frases que rotan, silencio durante clases y después de la hora de dormir. Número en el ícono (Badging API, requiere permiso de notificaciones).

### Atajos de iOS

Los Atajos hablan directo con el servidor (endpoints `/api/shortcut/*` con `APP_SECRET`), sin abrir la app.

| Atajo | Cómo se activa | Qué hace |
| --- | --- | --- |
| Anotar en Turbo | "Oye Siri, anota en Turbo" o botón de Acción | Dictar y la IA lo convierte en tarea |
| ¿Qué hago ahora? | Siri o widget de Atajos | Siri lee la tarea sugerida para el hueco |
| Partir 5 min | Control en pantalla bloqueada o Centro de Control (iOS 18+) | Arranca el foco y avisa al terminar |
| Hábito hecho | Widget de Atajos | Marca un hábito sin abrir nada |

| Automatización | Qué hace | ¿Corre sin confirmación? |
| --- | --- | --- |
| Apagar la alarma | Manda el plan del día | Sí |
| Abrir Instagram o TikTok | Notificación: "¿Esto o X (10 min)?" | Sí |
| Tocar un sticker NFC en el escritorio | Parte 5 min de foco | Sí |
| Hora del día | Rutina de noche | Puede pedir un toque |

Pregunta abierta para la fase 3: probar si un Atajo puede abrir Turbo instalado o si lo abre en Safari.

## Integraciones gratis

### Google Calendar: puente con Apps Script

- Dirección secreta iCal (lo actual): solo lectura. Queda como respaldo.
- API de Google con OAuth: en modo prueba el permiso vence cada 7 días y publicarla exige verificación. Descartada.
- **Apps Script como puente (elegida)**: corre en la cuenta de Joaquín, lee y crea eventos al instante, protegido con la misma clave secreta. Cuotas Gmail: 5.000 eventos creados y 20.000 llamadas web al día.

Las sesiones de estudio que Turbo planifica se crean como eventos en Google Calendar. El feed `.ics` actual se mantiene.

### IA: Gemini gratis, solo para tres cosas

Convertir lo dictado en tareas, desglosar una tarea en su primer paso físico y armar el plan de la mañana en los huecos. Si falla, se usa el respaldo sin IA (`localParse`, `fallbackSteps`). El nivel gratis no pide tarjeta (cerca de 10 pedidos por minuto y 1.500 al día reportados para Flash 3.x); meta: menos de 50 al día. No mandar nada sensible.

### Servidor: Cloudflare

- Workers gratis: 100.000 peticiones al día.
- D1 gratis: 5 millones de filas leídas y 100.000 escritas al día, 5 GB. Desde el 1 de septiembre de 2026, al pasar el límite las consultas fallan hasta las 00:00 UTC (21:00 en Chile).
- El cron corre cada minuto (1.440 veces al día): las consultas del cron necesitan índices. Hoy no hay ninguno.

## Plan de construcción con Claude Code

6 fases cortas, una sesión cada una, con 7 días de uso real entre fases (desde la fase 1). El copiloto `/turbo` dice en cada sesión qué modelo, esfuerzo y pasos tocan.

| Sesión | Listo cuando |
| --- | --- |
| Fase 0 · Red de seguridad | `npm test` pasa y deja capturas de cada pantalla |
| Fase 1 · Recortar a 4 pestañas | Abre en Ahora y los datos siguen ahí |
| Diseño 1 (impeccable) | Pruebas y `tester-tdah` sin problemas graves |
| Fase 2 · Calendario real y huecos | Día muestra los huecos igual que Google Calendar |
| Fase 3 · Insistencia | Llega el aviso con el iPhone bloqueado y Siri anota |
| Fase 4 · Hábitos y juego | Saltarse un día no rompe la racha |
| Diseño 2 (impeccable) | Igual que Diseño 1 |
| Fase 5 · Estudios desde el calendario | Una prueba nueva genera sesiones en los huecos |
| Después | Dos semanas sin funciones nuevas |

### Fase 0: red de seguridad

Pruebas con Playwright usando WebKit (motor de Safari) en tamaño iPhone, pruebas del servidor y un respaldo JSON de los datos actuales.

```text
Lee @CLAUDE.md y @docs/PLAN.md. Estamos en la Fase 0. En modo plan: revisa el repo y propón cómo agregar pruebas con Playwright (WebKit, viewport de iPhone 15) para las pantallas principales y pruebas del worker con wrangler/miniflare. Agrega un script para exportar mis datos a JSON antes de cualquier migración. Al implementar, corre las pruebas y muéstrame la salida y las capturas.
```

### Fase 1: recortar

Cuatro pestañas, módulos congelados fuera de la navegación, datos intactos e índices en D1.

```text
Fase 1 de @docs/PLAN.md. En modo plan: deja solo 4 pestañas (Ahora, Día, Capturar, Foco) y saca de la navegación Plata, Pareja, Escudo, Metas, Desafíos y el chat de Secretaria, sin borrar sus datos. Revisa las consultas del cron en src/worker.js y agrega índices para no pasar el límite gratis de D1. Implementa, corre las pruebas y muéstrame capturas.
```

### Fase 2: calendario real y huecos

```text
Fase 2 de @docs/PLAN.md. Entrevístame primero con preguntas cortas (hora de despertar y dormir, tamaño mínimo de hueco, palabras que marcan pruebas). Luego escribe el Apps Script (archivo aparte, con instrucciones paso a paso para pegarlo en script.google.com) y el detector de huecos con pruebas unitarias que cubran días con clases seguidas, eventos de todo el día y huecos de menos de 15 min.
```

### Fase 3: insistencia

```text
Fase 3 de @docs/PLAN.md. Mueve el cálculo de avisos (computeReminders en planner.js) al worker para que no dependa de abrir la app. Migra las notificaciones a Declarative Web Push (iOS 18.4+) manteniendo el respaldo actual, implementa la escalera de avisos (máximo 3 por hueco, frases que rotan, silencio en clases y de noche) y el badge del ícono. Crea endpoints /api/shortcut/* protegidos con APP_SECRET y escribe una guía en español para armar cada Atajo en iOS.
```

### Fase 4: hábitos y juego

Rachas semanales, "saltar hoy" y reparar racha, XP por partir, bonus sorpresa y la primera temporada de 4 semanas.

### Fase 5: estudios desde el calendario

Las pruebas se detectan en el calendario, la IA reparte sesiones hacia atrás y se crean como eventos en Google Calendar. Probar primero con datos de prueba.

## Reglas anti-abandono

En un estudio con una app para adultos con TDAH, el 36% abandonó antes de la segunda semana y casi nadie se fue después de la cuarta (Inflow, PLOS Digital Health). Las primeras dos semanas de cada fase son las que hay que proteger.

Para Joaquín:

- Regla de los 7 días: no se construye la fase siguiente sin haber usado la actual 7 días.
- Una sesión de Claude Code por semana para Turbo, de máximo 2 horas.
- Las ideas van a `IDEAS.md`, no al código. En la revisión del domingo se elige máximo una.
- Volver sin culpa: tras 3 días sin abrirla, la app ofrece un "día mínimo" de 2 minutos.
- Revisión del domingo de 5 minutos: qué se usó, qué se ignoró y qué sobra.

Para Claude Code: están en `CLAUDE.md`.

## Fuentes

- Proyectos: [GitHub tema adhd](https://github.com/topics/adhd), [awesome-adhd](https://github.com/XargsUK/awesome-adhd), [Habo](https://gittrend.io/repo/xpavle00/Habo), [habitica-ios](https://gittrend.io/repo/HabitRPG/habitica-ios), [Super Productivity en AlternativeTo](https://www.alternativeto.net/software/super-productivity/about/)
- Evidencia: [Silverman y Barasch 2023](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb), [Lally et al. 2009](https://www.spring.org.uk/2023/01/form-a-habit.php), [Gawrilow y Gollwitzer 2008](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-facilitate-response-inhibition-adhd-children), [Inflow](https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0000083)
- iPhone: [Declarative Web Push](https://webkit.org/?p=16535), [Badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/), [iOS 26 web apps](https://heise.de/-10749652), [SideStore](https://docs.sidestore.io/docs/faq), [Cuenta Apple gratis](https://flaviocopes.com/apple-developer-free-vs-paid.md), [Centro de Control iOS 18](https://macrumors.com/guide/ios-18-control-center), [Automatizaciones](https://www.howtogeek.com/442760/how-to-create-automations-on-an-iphone-or-ipad/)
- Integraciones: [OAuth en modo prueba](https://newscrewdriver.com/2023/02/04/google-oauth-test-tokens-expire-weekly/), [Cuotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas?hl=en), [Gemini gratis](https://klymentiev.com/blog/gemini-api-free-tier), [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [D1 límites](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
