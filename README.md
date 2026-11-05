# Apolo IA 2.0

Interfaz original de Apolo con conversación local mediante WebLLM. Sin NotebookLM.

## Arquitectura y cambios

- Antes: `index.html` enviaba cada pregunta a FastAPI en Render. `apolo_core.py` consulta aprendizaje JSON, respuestas temáticas, Wikipedia y finalmente OpenAI. El historial mostraba seis turnos, sin enviarlos al modelo.
- Ahora: HTML y estilo originales, lógica en `src/app.js`; WebLLM se carga bajo demanda en un Web Worker. Se conservan reconocimiento y síntesis de voz, copiar, limpiar, autoselección e historial de sesión. Detener ahora también detiene la voz sintetizada.
- El modelo recibe los turnos recientes en orden, dentro de un presupuesto conservador de contexto. Limpiar elimina ese contexto. No se persiste el historial al cerrar la pestaña, igual que antes.
- Modelo: `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`, disponible en el catálogo de la dependencia fijada. Multilingüe, incluido español; pequeño y sin exigir shader-f16. La estimación del catálogo es aproximadamente 1060 MB de VRAM; no es el tamaño de descarga. Calidad y velocidad limitadas frente a modelos grandes.
- Progreso visible de descarga/inicialización, comprobación HTTPS/WebGPU/adaptador y errores recuperables. La primera pregunta descarga cientos de MB. La caché del navegador puede ser eliminada por el sistema.
- Render sigue seleccionable manualmente; nunca hay envío automático de preguntas al servidor cuando falla la IA local. Conserva el contrato POST `/preguntar`, `{texto}` → `{respuesta}`.
- PWA: caché versionada del shell compilado, incluidos módulos y worker. No borra las cachés de WebLLM. Las actualizaciones esperan a cerrar las pestañas antiguas. Los archivos Python, aprendizaje y secretos no entran en `dist`.

## Desarrollo y pruebas

Requiere Node 22 o superior y npm.

```sh
npm ci
npm test
npm run dev
npm run build
npm run preview
```

Abrir la dirección localhost que muestra Vite (no abrir index.html con file://).

Prueba de navegador reproducible: con Playwright instalado y `npm run preview` activo en el puerto 4173, ejecutar `node tests/browser.cjs`. Puede configurarse `CHROME_PATH` con la ruta de Chrome y `PLAYWRIGHT_MODULE` con un módulo Playwright externo. Simula Render y ausencia de WebGPU; no descarga el modelo ni contacta el backend real.

Verificación realizada: 5 pruebas unitarias, compilación de producción, auditoría npm sin vulnerabilidades detectadas, sintaxis Python y bloqueo de OpenAI por defecto. Chrome headless: ausencia de WebGPU, selección explícita de Render, respuesta/historial/limpieza, bloqueo de envíos simultáneos, iconos del manifiesto y shell PWA offline. No se validó una generación real en GPU ni micrófono/altavoces físicos. El build advierte de chunks grandes correspondientes al runtime WebLLM.

1. Con WebGPU: escribir «Me llamo Ana» y luego «¿Cómo me llamo?». Comprobar progreso, respuesta en español y contexto. La descarga inicial puede tardar varios minutos; límite de 10 minutos para cargar y 3 para responder.
2. Probar Hablar, Voz, Detener, Copiar, Enter, Autoseleccionar y Limpiar. Los permisos de micrófono y soporte de reconocimiento dependen del navegador. El reconocimiento puede usar servicios del fabricante del navegador.
3. Sin WebGPU/aceleración gráfica: comprobar mensaje claro; no debe haber solicitudes a Render hasta seleccionarlo expresamente. Probar errores de red y reintentar.
4. Seleccionar Render y preguntar. Puede tardar hasta 90 segundos al despertar. El servicio desplegado no se actualiza al modificar esta rama.
5. En `npm run preview`, instalar PWA, cerrar y abrir; comprobar que conserva la interfaz. Tras cargar completamente el modelo, probar modo avión. Voz, imágenes y fuentes externas pueden requerir red; no se promete funcionamiento completamente offline.
6. Publicar una nueva preview, cerrar todas las pestañas/PWA antiguas y abrir de nuevo para activar el nuevo service worker. Verificar que la caché del modelo permanece.

## Vercel y GitHub

Conectar este repositorio a Vercel, framework Vite, raíz del repositorio. `vercel.json` configura `npm ci`, `npm run build` y salida `dist`. Usar una **Preview de la rama `feat/apolo-2-webllm`**; mantener producción en `main` hasta revisar. No requiere claves ni variables del frontend. GitHub conserva el código; Vercel sirve archivos estáticos por HTTPS. El resultado `dist` también puede alojarse bajo una subruta estática (base relativa).

## Costo objetivo $0 y backend temporal

WebLLM no cobra por consulta: ejecuta inferencia en el dispositivo. El alojamiento debe permanecer dentro de los límites/condiciones del plan gratuito disponible. No se han contratado servicios ni activado pagos.

**El Render actualmente desplegado podría seguir llamando a OpenAI.** Para mantener también esa alternativa sin cargos, desplegar allí el backend de esta rama con `APOLO_ENABLE_PAID_AI=false` (valor predeterminado) antes de usarla. La función anterior se conserva como opción explícita `true`, pero activarla rompe el objetivo de costo cero. Las claves, si existieran, sólo deben estar en las variables privadas de Render, nunca en GitHub, `VITE_*` ni Vercel frontend. No se cambió el despliegue existente de Render.

## Fuentes

- https://webllm.mlc.ai/docs/user/get_started.html
- https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
- https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct
