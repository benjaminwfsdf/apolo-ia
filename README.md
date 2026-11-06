# Apolo IA 2.0

Chat local con WebLLM, interfaz negra y dorada, voz y PWA. Rama de trabajo: `feat/apolo-2-webllm`. Sin NotebookLM ni servicios de inferencia de pago.

## Ejecutar y verificar

Node 22+ y npm:

```sh
npm ci
npm test
npm run dev
# En otra terminal, opcional:
npm run build
npm run preview
```

Usar localhost o HTTPS, no `file://`. La primera pregunta descarga el modelo. Los pesos y el runtime se almacenan en las cachés de WebLLM. Se necesita WebGPU y suficiente memoria gráfica. No basta con que exista `navigator.gpu`.

Pruebas de navegador con Playwright y Chrome instalados: `node tests/browser.cjs` contra Vite en 5173; `node tests/pwa.cjs` contra la compilación en 4173. Variables opcionales: `PLAYWRIGHT_MODULE` (ruta al módulo), `CHROME_PATH` (ejecutable), `TEST_URL`, `PREVIEW_URL` y `SCREENSHOT_DIR`. Las pruebas UI simulan la inferencia y la voz; la prueba PWA usa el build real. `node tests/gpu.cjs` ejecuta tres consultas reales y descarga 1.5B: requiere GPU y conexión; imprime las respuestas para evaluar su calidad. No son benchmarks comparativos.

## Qué fallaba con la memoria

La versión anterior mostraba seis turnos, pero enviaba un subconjunto condicionado por un presupuesto de 2800 bytes. El orden de roles era correcto. Al encontrar una respuesta larga, el bucle hacía `break` y descartaba todos los turnos anteriores; el nombre podía seguir visible pero estar ausente del prompt. Después de seis turnos también se borraban del estado los anteriores. Ver un dato en pantalla no garantizaba que el modelo lo recibiera. Render solo recibe la pregunta actual.

No tenemos el intercambio exacto del fallo reportado: no se afirma que esta sea su única causa. Incluso con contexto correcto, 0.5B puede fallar siguiendo instrucciones. El prompt y la temperatura anteriores tampoco garantizaban recuperación fiable.

Ahora:

- Se conserva el historial completo de la sesión; se construyen pares user/assistant en orden cronológico y se añade la pregunta actual una sola vez.
- El contexto sigue limitado al modelo de 4096 tokens. Se usa un límite conservador de bytes (no una medida exacta de tokens), se acortan mensajes antiguos, se priorizan turnos recientes y se reservan tokens de salida. Configuración muestra cuántos turnos se enviaron y si hubo recortes. No se promete memoria ilimitada de todo el historial.
- Una declaración independiente como `Me llamo Ana` o `En realidad me llamo Lucía` conserva el nombre separadamente. No se extraen nombres de las respuestas del asistente. Se puede editar o borrar en Configuración → Memoria. Esta extracción es deliberadamente limitada; una presentación dentro de un párrafo complejo puede no detectarse.
- El nombre declarado se incluye en cada contexto aunque el turno original quede fuera. Limpiar borra conversación, nombre y estado del modelo. No se usa almacenamiento persistente de conversaciones ni resúmenes inventados.
- Instrucciones explícitas de no inventar recuerdos, fuentes ni acciones; pedir aclaración cuando falte información. Temperatura 0.2. Esto reduce riesgos, no garantiza verdad.

## Modelos evaluados

Los tres identificadores están comprobados mediante pruebas contra `prebuiltAppConfig` de `@mlc-ai/web-llm@0.2.87`. Todos son Qwen2.5 Instruct multilingües y usan `q4f32_1-MLC`, sin exigir `shader-f16`.

| Modelo | VRAM estimada del catálogo | Uso y calidad esperada |
|---|---:|---|
| 0.5B | 1060.20 MB | Menor consumo; menor capacidad para instrucciones y conversación. Alternativa ligera. |
| 1.5B | 1888.97 MB | Equilibrio elegido por defecto; más capacidad esperada. Se probó generación real y recuperación del nombre en esta tarea. |
| 3B | 2893.64 MB | Más capacidad potencial, mayor descarga y latencia; no se midió calidad comparativa en este equipo. Licencia Qwen Research, distinta de Apache 2.0 de 0.5B/1.5B. |

Son estimaciones de memoria, no tamaños de descarga ni garantías. Las variantes f16 del catálogo estiman respectivamente 944.62, 1629.75 y 2504.76 MB; se prefirió f32 para evitar exigir esa extensión de GPU. Un modelo mayor no garantiza respuestas correctas. `navigator.deviceMemory <= 4` sugiere 0.5B; esta señal es RAM aproximada, no VRAM. Si no está disponible, se propone 1.5B. El usuario puede cambiar el modelo antes de descargarlo. Al cambiar o liberar el modelo se termina el worker anterior para evitar mantener dos modelos en memoria.

Fuentes: [catálogo WebLLM](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts), [Qwen 1.5B](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct), [Qwen 3B](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct), [WebLLM](https://webllm.mlc.ai/docs/user/get_started.html).

## Interfaz y funciones conservadas

Conversación en burbujas, campo multilínea, envío y micrófono. Enter envía en escritorio; Shift+Enter crea una línea. En móviles Enter conserva la escritura multilínea y el botón envía. Historial y engranaje abren diálogos accesibles con Escape y foco del navegador. La animación respeta movimiento reducido. El progreso solo aparece durante carga/inicialización.

Cada respuesta permite copiar y escuchar. Se conserva lectura automática opcional; Detener aparece mientras hay voz/micrófono activos. La selección de motor/modelo, la voz, el retorno al campo y la liberación del modelo están en Configuración. Limpiar está en Historial. El retorno al campo no fuerza el teclado en pantallas táctiles. El saludo se sustituyó por una bienvenida estable, sin consultar Render al abrir. No se eliminaron controles útiles; se reubicaron para despejar el chat.

El reconocimiento de voz depende de los permisos y puede usar servicios del fabricante del navegador. Las fuentes externas pueden no cargarse offline, en cuyo caso se usan fuentes locales de respaldo. La conversación se borra al recargar/cerrar la pestaña.

## Render y costo cero

La IA local no envía preguntas a Render ni cobra por consulta. Render es manual y no tiene memoria conversacional. Antes de enviar cualquier pregunta, se consulta `/capabilities`; solo se permite el POST si devuelve `paid_ai_enabled: false`. Un backend antiguo, inaccesible o con pago habilitado queda bloqueado con un mensaje claro. Para usar la alternativa, desplegar posteriormente el backend actualizado en Render con `APOLO_ENABLE_PAID_AI=false`. **Esta tarea no modifica ese despliegue.** Las funciones previas de aprendizaje, respuestas temáticas y Wikipedia siguen en el backend.

No se incluyen claves. Nunca poner claves privadas en `VITE_*`. El objetivo $0 también requiere permanecer dentro de los límites del plan de alojamiento; no se contrataron servicios ni activaron opciones de pago.

## Vercel Preview y PWA

Proyecto elegido: `apolo-ia-2.0`. Vite, `npm ci`, salida `dist`. `vercel.json` desactiva el autodespliegue **solo para esta rama** porque hay varios proyectos Vercel conectados al mismo repositorio. Crear la Preview explícitamente en el proyecto elegido; no promover ni cambiar alias de producción. Además el guard de build rechaza producción cuando la referencia es esta rama. `main` no se modifica.

El service worker precarga los archivos compilados con una versión basada en contenido. Espera al cierre de pestañas antiguas para activar la actualización, borra solo cachés propias/legacy conocidas y conserva las de WebLLM. Se corrigió la coincidencia de recursos estáticos con cabecera `Vary: Origin` para que scripts y CSS funcionen offline. El backend y sus datos no forman parte de `dist`.

## Validación realizada

- 13 pruebas unitarias/integración: catálogo, recomendaciones, roles/orden, nombre, respuesta larga, más de seis turnos, corrección/borrado, límite multibyte, WebGPU, forwarding exacto a `chat.completions.create`, cambio de modelo, reintento/concurrencia, bloqueo de pago en Render y protección de despliegues de esta rama. Sintaxis Python y guard de IA de pago verificados separadamente.
- Chrome automatizado en escritorio 1440×1000 y emulación táctil 390×844: flujo de chat con inferencia simulada, contexto enviado, progreso, modelos, memoria, historial, limpieza, errores y voz simulada; sin desbordamiento horizontal ni errores JS.
- Build de producción y prueba PWA real: shell offline, configuración, manifiesto/iconos y conservación de cachés del modelo. Las fuentes de Google fallan offline de forma esperada y se sustituyen por fuentes locales.
- **Inferencia real en Chrome headless sobre GPU AMD RDNA-1:** Qwen 1.5B descargó aproximadamente 829 MB. `Me llamo Ana` → saludo con Ana; `¿Cómo me llamo?` → `Te llamas Ana.`; consulta sin nombre → petición de información, sin inventar un nombre. Carga y tres consultas: aproximadamente 102 s. No es un benchmark comparativo de calidad y la primera carga depende de red/hardware.
- Pendiente: generación en teléfonos físicos, micrófono/altavoces físicos, comparación empírica 0.5B/3B y casos de conversación extensos. La emulación móvil no verifica una GPU móvil ni Safari/iOS.
