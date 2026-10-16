# Turbo 2.0: plan para una app TDAH que sí uses

16 de octubre de 2026 · Joaquín

Mockup de las pantallas: https://claude.ai/artifact/SXw5uprBWA8e4wN3FPMGKL (dirección para impeccable, no un plano exacto). Guía de uso de Claude Code: `docs/GUIA.md`. Estado actual: `docs/PROGRESO.md`.

## Resumen

No cambies de app ni partas de cero: reconstruye turbo como **Turbo 2.0**, más chica, sobre la misma infraestructura gratis que ya tienes en Cloudflare.

- Turbo falló por exceso (16 módulos en 8 días), porque sus avisos dejaban de llegar si no la abrías, y por falta de pulido.
- Turbo 2.0 tiene 4 pestañas y un ciclo central: detecta tus tiempos muertos en Google Calendar, te avisa y te ayuda a partir en 5 minutos.
- La insistencia llega por avisos escalonados, el número en el ícono y los Atajos de iOS (Siri, pantalla bloqueada y automatizaciones).
- Sin Mac, una app nativa no conviene: con cuenta gratis vence cada 7 días y no tiene notificaciones push.
- Fase 0 y Fase 1 están hechas. Siguen 7 sesiones cortas con Claude Code, en el orden que eligió Joaquín: primero lo que hace útil la app (avisos sin abrirla y una sola lista con Calendar) y el look al final. Cada sesión termina publicada y probada en el iPhone. Plan B sin programar: Super Productivity + Habitica desde la App Store (no cubre lo que Joaquín pide; ver más abajo).

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
| Faltaba pulido | 3 fases en 8 días, sin pruebas y sin una semana de uso real entre fases | Cada sesión se publica y se prueba en el celu el mismo día, con pruebas. El look va al final, con vistas previas |
| Tiempos muertos entre clases | La app usaba el tiempo libre para elegir tarea, pero no detectaba huecos ni avisaba de ellos | Detector de huecos que avisa y propone una tarea que cabe |

El patrón de construir todo en un hiperfoco de 8 días y después soltarlo puede ser parte del problema, pero Joaquín lo corrigió con su propia experiencia (16-10-2026): la Turbo vieja no se soltó por construir rápido. Nunca le gustó cómo quedó, no la sintió útil ni completa, y la encontraba tediosa.

Su patrón de éxito es `CacoDf/split4dias` (app de entrenamiento, un archivo, 26 commits entre agosto y octubre): la hizo completa y útil como la quería desde el inicio, la usó y recién después la fue puliendo a su gusto, incluido el rediseño, que antes vio en una página de vistas previas. Al principio también se veía genérica y la usaba igual, porque era útil.

De ahí salen las reglas de este plan: primero lo que la hace útil, el look al final, cada sesión publicada y probada en el celu el mismo día, y un freno de uso en vez de una espera fija (ver Reglas anti-abandono).

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

Revisado el 16-10-2026 (README de cada proyecto): ninguno mantiene tareas y calendario como una sola lista en los dos sentidos. Super Productivity importa por CalDAV, dayGLANCE solo lee el calendario, unstuck solo exporta un `.ics` y adhd-focus no tiene calendario. unstuck reconoce que, sin servidor de push, no puede avisar con la app cerrada; Turbo ya tiene servidor y cron. Por eso el Plan B no cubre lo que Joaquín pide y vale construirlo.

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

Pregunta abierta para la sesión 1: probar si un Atajo puede abrir Turbo instalado o si lo abre en Safari.

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

Fase 0 y Fase 1 están cerradas y publicadas. Siguen 7 sesiones, en el orden que eligió Joaquín el 16-10-2026: primero lo que hace útil la app (avisos sin abrirla y una sola lista con Calendar) y el look al final.

- El ritmo lo decide Joaquín. Cada sesión dura máximo 2 horas.
- Cada sesión termina publicada y probada en su iPhone el mismo día.
- Antes de cada sesión nueva, Claude pregunta si abrió Turbo estos días y qué le molestó (ver Reglas anti-abandono).
- Todo lo nuevo usa las variables CSS que ya existen, sin colores sueltos, para que el rediseño de la sesión 7 cueste poco.
- El copiloto `/turbo` dice en cada sesión qué modelo, esfuerzo y pasos tocan.

| Sesión | Listo cuando |
| --- | --- |
| Fase 0 · Red de seguridad (cerrada) | `npm test` pasa y deja capturas de cada pantalla |
| Fase 1 · Recortar a 4 pestañas (cerrada) | Abre en Ahora y los datos siguen ahí |
| Sesión 1 · Avisos sin abrir | Llega un aviso con el iPhone bloqueado, sin haber abierto la app en 2 días |
| Sesión 2 · Lista única dentro de Turbo | Anotas "dentista jueves 15:00" y lo ves en Día como cualquier evento, con aviso |
| Sesión 3 · Puente con Google y huecos | Lo que anotas sale en Google Calendar, los eventos de Google aparecen en Ahora y Día muestra los huecos igual que Google |
| Sesión 4 · Foco y Ahora de verdad | La usas en una sesión real de foco y Ahora propone la tarea que cabe |
| Sesión 5 · Hábitos y juego | Saltarse un día no rompe la racha |
| Sesión 6 · Estudios desde el calendario | Una prueba nueva genera sesiones en los huecos |
| Sesión 7 · Look con impeccable | Joaquín dice "ya no me molesta" y `tester-tdah` sin problemas graves |
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

### Sesión 1: avisos sin abrir

`opus` · `xhigh`, modo plan. El iPhone de Joaquín tiene iOS 26.6, así que el push declarativo es viable; falta probarlo en el aparato.

```text
Sesión 1 de @docs/PLAN.md. En modo plan. Mueve el cálculo de avisos (computeReminders en planner.js) al worker para que no dependa de abrir la app: el worker ya guarda el respaldo del estado y el link iCal, calcula desde ahí en el cron (con índices). Migra las notificaciones a Declarative Web Push manteniendo el service worker como respaldo, y agrega el número en el ícono. Reglas: máximo 3 avisos por hueco, frases que rotan, silencio en clases y después de la hora de dormir. Agrega el "día mínimo" de 2 minutos tras 3 días sin abrir. Escribe pruebas del worker para el cálculo y dime qué probar con el iPhone bloqueado.
```

### Sesión 2: lista única dentro de Turbo

`opusplan` · `high`, modo plan.

```text
Sesión 2 de @docs/PLAN.md. En modo plan. Haz que Capturar decida si lo que anoto es tarea o evento con hora (con respaldo sin IA en localParse), permite que una tarea tenga hora y muestra tareas y eventos de Google en la misma línea de tiempo de Día. Sin pestañas ni pantallas nuevas. Que avise igual que un evento. Prueba con "dentista jueves 15:00".
```

### Sesión 3: puente con Google y huecos

`opus` · `high`, modo plan.

```text
Sesión 3 de @docs/PLAN.md. Entrevístame primero con preguntas cortas (hora de despertar y dormir, tamaño mínimo de hueco, palabras que marcan pruebas, cómo mostrar lo que viene de Google para que no se duplique). Luego escribe el Apps Script (archivo aparte, con instrucciones paso a paso para pegarlo en script.google.com) para crear y leer eventos en los dos sentidos, y el detector de huecos de tiempo libre (incluye bloques largos) con pruebas unitarias que cubran días con clases seguidas, eventos de todo el día y huecos de menos de 15 min. Cierra con el aviso 5 minutos antes de un hueco y el Atajo de iOS "Anotar en Turbo" (endpoints /api/shortcut/* protegidos con APP_SECRET y guía en español para armarlo).
```

Lo que dejó lista la Sesión 2 para el puente (Joaquín quiere Turbo y Google Calendar como uno solo, en los dos sentidos):
- Todo lo que se anota con hora en Turbo queda en `state.schedule` con `date`, `id` estable y `src:'turbo'`. Esos son los eventos que el Apps Script crea en Google.
- Regla anti-duplicados: al crear el evento en Google, guardar el id de Turbo en su descripción (por ejemplo `turbo:<id>`). Al leer Google, un evento con ese id no se muestra dos veces en Día ni avisa dos veces.
- El feed `.ics` de Turbo (suscripción) ya muestra esos eventos en Google, pero solo para leer y con el retraso de Google. Si el puente funciona, evaluar apagarlo para no ver todo doble.

### Sesión 4: Foco y Ahora de verdad

`opusplan` · `high`, modo plan.

```text
Sesión 4 de @docs/PLAN.md. Entrevístame primero (¿solo 3 tareas por día?, ¿ritual de 30 segundos?). Agrega el ritual antes del foco, "puedes parar" al terminar, aprender cuánto subestimo el tiempo (estimado contra real) y que Ahora proponga UNA tarea que cabe en el hueco según mi energía y contexto. Suma el Atajo "Partir 5 min".
```

### Sesión 5: hábitos y juego

`opusplan` · `medium`, modo plan.

Rachas semanales, "saltar hoy" y reparar racha, XP por partir, bonus sorpresa y la primera temporada de 4 semanas.

### Sesión 6: estudios desde el calendario

`opusplan` · `high`, modo plan.

Las pruebas se detectan en el calendario, la IA reparte sesiones hacia atrás y se crean como eventos en Google Calendar. Probar primero con datos de prueba.

### Sesión 7: look con impeccable

`opus` · `medium`.

Una sola sesión de diseño, al final: `init`, `critique`, `audit`, `layout`/`typeset`/`colorize`, `adapt`, `harden` y `polish`; al final `delight` y `animate` con moderación. Contexto: app para TDAH, iPhone, una mano, 3 minutos libres, sin culpa. Joaquín quiere descubrir la identidad con vistas previas, como hizo con VANDAL en split4dias: primero una página aparte con 3 direcciones, él elige una y recién entonces se aplica a la app. Sus molestias con el look actual: se siente genérico ("AI slop") y recarga de cosas escondidas.

## Reglas anti-abandono

En un estudio con una app para adultos con TDAH, el 36% abandonó antes de la segunda semana y casi nadie se fue después de la cuarta (Inflow, PLOS Digital Health). Las primeras dos semanas son las que hay que proteger: por eso lo primero que se construye son los avisos que te buscan.

Para Joaquín:

- Freno de uso (reemplaza la regla de los 7 días): antes de cada sesión nueva, Claude te pregunta si abriste Turbo estos días y qué te molestó. Si no la abriste, esa sesión se usa para arreglar por qué, no para construir.
- Sesiones de máximo 2 horas. El ritmo lo decides tú.
- Cada sesión termina publicada y probada en tu iPhone el mismo día.
- Las ideas van a `IDEAS.md`, no al código. En la revisión del domingo se elige máximo una.
- Volver sin culpa: tras 3 días sin abrirla, la app ofrece un "día mínimo" de 2 minutos (sesión 1).
- Revisión del domingo de 5 minutos: qué se usó, qué se ignoró y qué sobra.

Para Claude Code: están en `CLAUDE.md`.

## Fuentes

- Proyectos: [GitHub tema adhd](https://github.com/topics/adhd), [awesome-adhd](https://github.com/XargsUK/awesome-adhd), [Habo](https://gittrend.io/repo/xpavle00/Habo), [habitica-ios](https://gittrend.io/repo/HabitRPG/habitica-ios), [Super Productivity en AlternativeTo](https://www.alternativeto.net/software/super-productivity/about/)
- Evidencia: [Silverman y Barasch 2023](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb), [Lally et al. 2009](https://www.spring.org.uk/2023/01/form-a-habit.php), [Gawrilow y Gollwitzer 2008](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-facilitate-response-inhibition-adhd-children), [Inflow](https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0000083)
- iPhone: [Declarative Web Push](https://webkit.org/?p=16535), [Badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/), [iOS 26 web apps](https://heise.de/-10749652), [SideStore](https://docs.sidestore.io/docs/faq), [Cuenta Apple gratis](https://flaviocopes.com/apple-developer-free-vs-paid.md), [Centro de Control iOS 18](https://macrumors.com/guide/ios-18-control-center), [Automatizaciones](https://www.howtogeek.com/442760/how-to-create-automations-on-an-iphone-or-ipad/)
- Integraciones: [OAuth en modo prueba](https://newscrewdriver.com/2023/02/04/google-oauth-test-tokens-expire-weekly/), [Cuotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas?hl=en), [Gemini gratis](https://klymentiev.com/blog/gemini-api-free-tier), [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [D1 límites](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
