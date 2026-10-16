# Puente con Google Calendar

Con el puente, Turbo y tu Google Calendar quedan como uno solo:

- Lo que anotas en Turbo con día y hora (por ejemplo "dentista jueves 15:00") aparece en un calendario nuevo de Google llamado **Turbo**. Llega en segundos.
- Turbo ve **todos** tus calendarios visibles (menos los de feriados). Los revisa cada 5 minutos, aunque no abras la app.
- Si en Google mueves o borras algo que anotaste en Turbo, Turbo lo sigue. Si lo borras en Turbo, también se borra en Google.
- Nada se ve dos veces: lo de Turbo no vuelve a Turbo como evento de Google.

Se arma una sola vez y toma unos 5 minutos. Hazlo en el **computador**: script.google.com no funciona bien en el celular.

## Paso a paso

1. En el computador, abre Turbo → ⚙️ Ajustes → **Calendario** → **Paso a paso** → **Copiar código**.
   - Si no copia, abre `https://<tu-turbo>/puente-google.txt`, selecciona todo (Ctrl+A) y cópialo (Ctrl+C).
2. Abre **script.google.com** (con tu cuenta de Google de siempre) → **Nuevo proyecto**.
3. Borra lo que aparece en el editor y pega el código (Ctrl+V).
4. Arriba, cambia el nombre "Proyecto sin título" por **Turbo** y guarda (💾 o Ctrl+S).
5. En la barra de arriba, elige la función **probar** y toca **▶ Ejecutar**. Google pide permisos:
   - **Revisar permisos** → elige tu cuenta.
   - Sale "Google no verificó esta app". Es normal, porque la app la hiciste tú: **Configuración avanzada** → **Ir a Turbo (no seguro)** → **Permitir**.
   - Abajo debería decir "Listo". En Google Calendar ya aparece el calendario **Turbo**.
6. Arriba a la derecha: **Implementar** → **Nueva implementación**.
   - En "Seleccionar tipo" (⚙️), elige **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**. Si no, Turbo no puede entrar. Igual queda protegido: el link es secreto y solo responde a la clave de tu Turbo.
   - **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`).
7. Vuelve a Turbo → Ajustes → Calendario, pega la URL y toca **Conectar**. Debería decir 🟢 Conectado.

Puedes conectarlo desde el computador o desde el iPhone: queda guardado en el servidor y vale para los dos.

## Después de conectar: saca el link viejo

Si antes agregaste el link `.ics` de Turbo a Google Calendar, quítalo para no ver todo doble:
calendar.google.com → a la izquierda, en "Otros calendarios", **Turbo 🏎️** → ⋮ → **Anular suscripción**.

## Si algo falla

- **"Clave incorrecta"**: ese Apps Script ya quedó amarrado a otro Turbo. Crea un proyecto nuevo (paso 2) y conéctalo con su nueva URL.
- **"No respondió bien"**: revisa que "Quién tiene acceso" diga **Cualquier persona** (paso 6).
- **Cambiaste el código**: Implementar → **Gestionar implementaciones** → ✏️ → Versión: **Nueva versión** → Implementar. La URL no cambia.
- Para desconectar: Ajustes → Calendario → **Desconectar**. Lo que ya está en Google se queda allá.

## Cómo funciona (para Claude)

- El código del Apps Script está en `public/puente-google.txt`. La lógica vive en `src/puente.js` (funciones puras con pruebas en `tests/worker/puente.test.mjs`) y en `sincronizar()` de `src/worker.js`.
- La primera llamada de Turbo deja guardada su clave (`puenteToken` en kv) en las propiedades del script. Desde ahí, cualquier otra clave se rechaza.
- El servidor no escribe en el estado de la app. Guarda su mapa `idTurbo → idGoogle` en kv `puente`. Los cambios hechos en Google van en `importCache.cambios`: el cron los aplica para los avisos y la app los aplica al leer el calendario (`seguirGoogle` en `public/js/calendar.js`).
- Lo borrado en Turbo queda en `state.calBorrados` (últimos 100) para que el puente lo borre en Google.
