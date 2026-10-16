# Atajo "Anotar en Turbo"

Dices "Oye Siri, anota en Turbo", dictas, y queda anotado sin abrir la app:

- Si dice día y hora ("dentista el jueves a las 15"), es un evento. Sale en tu Google Calendar (si el puente está conectado) y te llega el aviso 15 min antes.
- Si no, es una tarea. Aparece en Turbo la próxima vez que la abras.
- Siri te responde qué anotó: "Anotado: Ir al dentista, jue 22 a las 15:00 ✅".

Se arma una vez en la app **Atajos** del iPhone y toma unos 3 minutos. Necesitas dos cosas:

- Tu dirección de Turbo, por ejemplo `https://turbo.TU-SUBDOMINIO.workers.dev`. Es la misma que abres en Safari.
- Tu clave secreta, la misma que pusiste en Turbo → ⚙️ Ajustes. No la compartas: solo va dentro del Atajo.

## Paso a paso

1. Abre **Atajos** → pestaña **Atajos** → **+** (arriba a la derecha).
2. Arriba, toca el nombre y ponle **Anotar en Turbo**. Así lo vas a llamar con Siri.
3. **Agregar acción** → busca **Dictar texto** → agrégala. Toca la flecha ⌄ de la acción y elige Idioma: **Español (Chile)** y Dejar de escuchar: **Después de una pausa**.
4. Agrega **Obtener contenido de URL**:
   - URL: `https://TU-TURBO/api/shortcut/anotar` (cambia `TU-TURBO` por tu dirección).
   - Toca la flecha ⌄ para ver más opciones:
     - Método: **POST**.
     - Encabezados → **Agregar nuevo encabezado**: clave `Authorization`, valor `Bearer TU-CLAVE`. Va la palabra Bearer, un espacio y tu clave.
     - Cuerpo de la solicitud: **JSON** → **Agregar nuevo campo** → **Texto**: clave `texto`, valor: toca y elige la variable **Texto dictado**.
5. Agrega **Obtener valor del diccionario**: Obtener **Valor** de la clave `mensaje` en **Contenido de URL**.
6. Agrega **Mostrar resultado** (o **Leer texto**, si quieres que Siri lo diga en voz alta) con **Valor del diccionario**.
7. Toca **Listo**.

## Usarlo

- **Siri**: "Oye Siri, anota en Turbo". Dicta, haz una pausa y listo.
- **Botón de Acción** (iPhone 15 Pro o posterior): Configuración → Botón de Acción → **Atajo** → Anotar en Turbo.
- **Pantalla bloqueada o Centro de Control**: mantén presionado → Personalizar → agregar control → Atajos → Anotar en Turbo.

## Si algo falla

- **"Clave secreta incorrecta"**: revisa el encabezado. Debe decir `Bearer`, un espacio y tu clave, sin espacios de más.
- **"Lo ordeno cuando abras Turbo"**: la IA no está disponible (falta `GEMINI_API_KEY` en Cloudflare o Gemini no respondió). Igual quedó guardado: al abrir Turbo se ordena solo. En ese caso los eventos salen en Google recién cuando abras la app.
- **Siri no lo encuentra**: el nombre del atajo tiene que ser exactamente "Anotar en Turbo".

## Cómo funciona (para Claude)

- `POST /api/shortcut/anotar` con `Authorization: Bearer <APP_SECRET>` y `{ "texto": "…" }` → `{ "mensaje": "…" }`.
- Con Gemini usa el mismo `aiCapture` de Capturar y guarda los ítems con ids estables (`at…`) en kv `bandeja`. Sin IA guarda solo el texto.
- Mientras la app no lo recoge, `conBandeja()` (`src/bandeja.js`) lo suma al estado para los avisos del cron y para el puente con Google.
- La app lo recoge al abrirse (`public/js/bandeja.js`): agrega los ítems con los mismos ids (o usa `localParse` si llegó solo texto) y avisa con `POST /api/bandeja/listo`.
