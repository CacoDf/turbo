# Ideas para después

Las ideas que no son de la fase actual van aquí, no al código. En la revisión del domingo se elige máximo una.

- Pareja congelada: `public/pareja.html` y el worker (`/api/share/*`) aún mandan el push "💌 Te mandaron ánimo", cuyo toque abre `/` sin mostrar nada. Decidir si se apaga en el servidor o se quita del todo.
- Ahora sin tareas no ofrece "Ver todas" (Tareas). Revisar si hace falta cuando el flujo de Capturar quede más pulido (Diseño 1).
- Textos largos que Joaquín no lee: onboarding de Ahora, intro de Capturar, tarjeta "Agrega tus entrenamientos" de Día (Diseño 1).
- Archivos congelados sin importar (`views/more.js`, `money.js`, `partner.js`, `shield.js`, `assistant.js`, `challenges.js`): borrarlos en una limpieza futura si pasan semanas sin tocarlos.
- Hábitos: "saltar hoy" sin perder racha (ya está en la Fase 4 del plan).
- Joaquín quiere que las tareas de Google Calendar y las de Turbo se vean y se anoten como una sola lista. Hoy Turbo solo lee Google (no escribe) y no hay tareas de calendario. Se puede hacer en los dos sentidos con el puente Apps Script de la Fase 2 (Turbo → Google: lo que anotas sale como evento; Google → Turbo: los eventos aparecen en Ahora). En la entrevista de la Fase 2 definir cómo se ve para que no se duplique.
