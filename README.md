# 🏎️ Turbo

Tu copiloto para arrancar, terminar y ordenar el día. Hecha a medida, gratis y pensada para el iPhone.

**Fase 1:** Ahora (una sola tarea), Vaciar cabeza, Modo Foco con compañía, Día, Hábitos, Garage (niveles, autos, premios) y Escudo.

**Fase 2:** Rutinas paso a paso, Plata (gastos, hormiga, "¿Lo necesito?" con espera de 24 h, presupuesto), Ánimo y energía (check-in y patrones; la tarea sugerida se ajusta a tu energía), Estudios (ramos, pruebas y plan de sesiones hacia atrás con IA) y Pareja (link de solo lectura en `/pareja.html` + mensajes de ánimo como notificación).

**Fase 3:** Secretaria (chat con IA que anota tareas, eventos, gastos, hábitos, pruebas y metas), entrevista de la mañana, Metas (pasos semanales con IA), Revisión semanal (domingo, 3 prioridades), Desafíos mensuales con trofeo y Calendario en ambas direcciones (feed `.ics` para iPhone/Google + importación de la dirección secreta iCal de Google Calendar).

---

## Instalación (una sola vez, ~20 min)

Nadie más que tú hace estos pasos: son tus cuentas y tus claves. **Nunca pegues claves en el chat**, solo en Cloudflare y en la app.

### 1. GitHub: crear el repositorio
1. Entra a <https://github.com/new>.
2. Nombre: `turbo`. Marca **Private**. No agregues README.
3. Crear. Copia la URL (algo como `https://github.com/TU_USUARIO/turbo`) y pásasela a Claude para subir el código.

### 2. Cloudflare: crear la cuenta
1. <https://dash.cloudflare.com/sign-up> (plan gratis, no pide tarjeta).

### 3. Crear la base de datos
1. En el panel: **Storage & Databases → D1 SQL Database → Create**.
2. Nombre: `turbo` → Create.
3. Copia el **Database ID** y pásaselo a Claude (no es secreto).

### 4. Publicar la app desde GitHub
1. **Workers & Pages → Create → Import a repository**.
2. Conecta tu GitHub y elige el repo `turbo`.
3. Deja todo por defecto (comando de deploy: `npx wrangler deploy`) → **Deploy**.
4. Al terminar verás tu dirección: `https://turbo.TU-SUBDOMINIO.workers.dev`.

Desde ahora, cada cambio que se suba a GitHub se publica solo.

### 5. Las dos claves (en Cloudflare)
En el Worker `turbo` → **Settings → Variables and Secrets → Add**, tipo **Secret**:

| Nombre | Valor |
|---|---|
| `APP_SECRET` | Una contraseña larga que inventes (ej. 4 palabras al azar). La vas a escribir una vez en la app. |
| `GEMINI_API_KEY` | Tu clave gratis de <https://aistudio.google.com/apikey> → *Create API key*. |

Opcional: `GEMINI_MODEL` (por defecto `gemini-flash-lite-latest`).

### 6. Instalar en el iPhone
1. Abre tu dirección `https://turbo…workers.dev` en **Safari**.
2. Toca **Compartir** (cuadrado con flecha) → **Agregar a pantalla de inicio**.
3. Abre Turbo **desde el ícono** (no desde Safari).
4. ⚙️ Ajustes → pega tu `APP_SECRET` → **Guardar y probar**.
5. **Activar notificaciones** → Permitir → **Probar**.

### 7. Escudo
En la app: 🛡️ → "Configura tus bloqueos". Son 6 pasos en los ajustes del iPhone y del PC. El código de Tiempo en pantalla que lo ponga otra persona.

---

## Cómo funciona por dentro

```
public/            la app (HTML + CSS + JavaScript, sin instalar nada)
  js/store.js      datos (viven en el teléfono, se respaldan en el servidor)
  js/game.js       XP, niveles, autos, rachas con comodín
  js/planner.js    horario, "¿qué hago ahora?", recordatorios
  js/views/        cada pantalla
  sw.js            funciona sin internet + notificaciones
src/worker.js      servidor: IA (Gemini), respaldo, notificaciones (cron cada minuto)
wrangler.toml      configuración de Cloudflare
tools/             íconos y pruebas del servidor
```

- **Probar en el PC:** `python -m http.server 8787 --directory public` y abrir <http://localhost:8787> (sin IA ni notificaciones).
- **Probar el servidor:** `python -m http.server 8788` desde esta carpeta y abrir <http://localhost:8788/tools/worker-test.html>.
- **Costo:** $0. Cloudflare gratis (100.000 peticiones/día) y Gemini gratis. En el nivel gratis, Google puede usar lo que le mandes a la IA para mejorar sus modelos. Los datos del Escudo nunca se mandan a la IA.
