# Actualización: motores local, nube y documentos

WebLLM incorpora verificación de shards por tamaño/SHA-256 y revisiones fijas. Gemini y consultas de texto con citas están implementados en una función de Vercel, **desactivados sin credenciales/configuración**. NotebookLM sigue desconectado tras evaluar sus vías oficiales y no oficiales. No se activaron pagos.

Consulta [configuración segura de Preview](docs/CLOUD-SETUP.md) y [validación más reciente](docs/VALIDATION-CLOUD.md). La nube solo envía contexto/recuerdos con permiso adicional; usa hasta 15 turnos y 12000 bytes frente al contexto local más reducido. Prueba adicional: `node tests/cloud-browser.cjs` (proveedor simulado).

# Apolo IA 2.0

Aplicación existente: interfaz negra y dorada, voz, WebLLM local y PWA. Desarrollo exclusivamente en `feat/apolo-2-webllm`; Preview en el proyecto existente `apolo-ia-2.0`. Sin integración activa con NotebookLM ni nuevas APIs de pago.

## Desarrollo y pruebas

Node 22+: `npm ci`, `npm test`, `npm run dev`. Compilar: `npm run build`; servir compilación: `npm run preview`.

Con Playwright y Chrome instalados:

- `node tests/browser.cjs`: escritorio y emulación táctil; inferencia y voz simuladas.
- `node tests/storage-browser.cjs`: IndexedDB real, consentimiento, conflictos, cuota, corrupción y varias pestañas.
- `node tests/pwa.cjs`: compilación real en puerto 4173, shell offline y conservación de cachés WebLLM.
- `node tests/benchmark.cjs`: inferencia REAL de 0.5B/1.5B/3B con GPU; descarga varios GB y usa recursos. 3B se prueba solo con fines de evaluación no comercial. No son respuestas simuladas.

Variables opcionales: `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `TEST_URL` (Vite en 5173), `PREVIEW_URL` (4173), `SCREENSHOT_DIR`, `BENCH_MODELS` (`small,balanced,large`), `BENCH_OUTPUT`. El benchmark es una herramienta de desarrollo, no entra en la aplicación publicada. Ver [validación](docs/VALIDATION.md).

## Memoria y privacidad

El fallo exacto se debía, entre otros factores, a una extracción demasiado estricta: «Hola Apolo, me llamo Benjamín» no reconocía el nombre. El historial se enviaba en orden, pero ver un dato en pantalla no garantizaba su inclusión en el contexto limitado ni su recuperación por 0.5B.

Ahora se reconocen declaraciones directas con saludos, puntuación y correcciones. Las últimas correcciones explícitas prevalecen. Se rechazan citas, ejemplos y narraciones de terceros reconocibles; no es un extractor universal de lenguaje natural. Las frases ambiguas pueden requerir introducir el nombre en Configuración. Nunca se extraen hechos de respuestas de Apolo.

Hay tres conceptos diferentes:

1. **Historial visible:** preguntas, respuestas y errores de la sesión; los errores/cancelaciones no se envían como turnos exitosos al modelo.
2. **Memoria local opcional:** con consentimiento explícito se guardan historial y recuerdos en IndexedDB. Nombre y notas son exclusivamente declaraciones o ediciones del usuario. Se pueden consultar, corregir, eliminar y exportar. Desactivar elimina la copia guardada; mantiene la sesión actual en RAM. Borrar todos los datos elimina también cachés propias y del modelo, sin borrar otras aplicaciones ni archivos exportados.
3. **Contexto del modelo:** pares cronológicos recientes, pregunta actual una sola vez y datos confirmados en el mensaje del sistema. Presupuesto conservador de 3000 bytes más reserva de salida/plantilla para modelos de 4096 tokens; no es un contador exacto de tokens. Se muestra cuándo hubo recortes. No hay memoria ilimitada.

Las preguntas directas sobre el nombre se resuelven desde el dato confirmado, sin depender de inferencia. Esto es recuperación estructurada, no razonamiento simulado. Borrar el nombre impide su recuperación directa; los mensajes históricos que lo mencionan permanecen hasta limpiar el historial. Las notas se guardan solo al escribirlas explícitamente en Configuración.

Sin consentimiento no se persisten conversaciones. La caché técnica del modelo es independiente; existe un indicador de operación interrumpida en sessionStorage que no contiene texto personal. Las escrituras son transaccionales, con validación y revisión para evitar sobrescribir cambios de otra pestaña. Ante cuota, corrupción o conflictos se conserva la copia previa y se informa del fallo; exporta la sesión actual antes de recargar. Límite de persistencia: 1000 turnos / 2 MB. El navegador puede eliminar datos por políticas de almacenamiento; no es una copia de seguridad.

La memoria es local a cada navegador **y origen**: una nueva URL de Preview puede tener otra memoria/caché. No se sincroniza entre dispositivos. WebLLM descarga pesos/runtime, pero no envía conversaciones al servidor de inferencia. La voz puede usar servicios del fabricante del navegador según sus permisos; no se cambia esa funcionalidad. Render requiere consentimiento independiente para enviar preguntas y confirma antes que la IA de pago esté deshabilitada.

## Modelos y recursos

Identificadores comprobados en `prebuiltAppConfig` de WebLLM 0.2.87, variantes `q4f32_1-MLC` que no requieren shader-f16:

| Modelo | Memoria gráfica estimada del catálogo | Selección y licencia |
|---|---:|---|
| Qwen2.5 0.5B Instruct | 1060.20 MB | Móviles, capacidad desconocida o RAM indicada de hasta 4 GB. Apache 2.0. Menor consumo, errores frecuentes en evaluación. |
| Qwen2.5 1.5B Instruct | 1888.97 MB | Predeterminado en escritorio con capacidad conocida superior. Apache 2.0. Tampoco garantiza respuestas correctas. |
| Qwen2.5 3B Instruct | 2893.64 MB | Experimental y selección manual. Qwen Research: investigación/evaluación no comercial; uso comercial requiere licencia del titular. Confirmación específica antes de cargar. |

Estas cifras no son memoria medida, ni tamaño de descarga, ni garantía de compatibilidad. `deviceMemory` indica RAM aproximada, no VRAM libre. Un modelo mayor no garantiza mejor calidad. Los tres siguen disponibles, pero el primer arranque es conservador. Fuentes: [catálogo](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts), [0.5B](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), [1.5B](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct), [licencia 3B](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE).

La primera inferencia requiere aceptar explícitamente la descarga/inicialización. Al recargar no se inicia ningún modelo. Cancelar interrumpe la generación y termina el worker; cambiar/liberar modelo también termina el worker anterior. La caché permanece para reutilización. Se bloquean operaciones simultáneas en la pestaña y no hay reintentos automáticos. Los plazos controlables son 10 minutos para carga y 3 para generación. Otra aplicación/pestaña todavía puede competir por los recursos del dispositivo.

## Safari / iPhone

Safari incorporó WebGPU en [Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Tener WebGPU no demuestra que un modelo pueda cargar con los recursos disponibles. Se comprueba HTTPS y un adaptador real antes de crear el worker.

El cierre observado al 52% no tiene diagnóstico confirmado. El porcentaje puede pertenecer a descarga o inicialización y reiniciarse entre fases. Descarga, caché, compilación, GPU y presión de memoria son hipótesis, no causas demostradas. WebKit documenta [problemas de comandos GPU en iOS](https://bugs.webkit.org/show_bug.cgi?id=311598), pero eso no identifica el fallo de este iPhone. No hay un límite universal de RAM que podamos prometer.

iPhone/iPad comienzan con 0.5B, muestran advertencias y requieren acción explícita. Ni siquiera 0.5B está garantizado. Un cierre completo del navegador puede impedir que JavaScript capture el error. Al regresar, un marcador técnico puede avisar de una operación interrumpida, pero nunca fuerza recarga/reintento ni promete recuperación. No se dispone de iPhone físico: quedan pendientes Safari real, comparar 0.5B/1.5B, primera carga y caché caliente, varias recargas, voz y ausencia de cierres bajo presión de memoria.

## Arquitectura, costo y despliegue

`conversation.js`: contexto y política de motor. `memory.js`: declaraciones y consulta estructurada. `storage.js`: persistencia transaccional. `local-engine.js`: worker, ciclo de vida/cancelación. `document-tools.js`: interfaz documental desconectada con consentimiento, respuesta y referencias validadas; sin proveedor, credenciales ni llamadas a NotebookLM.

Render permanece alternativo y manual. Sin consentimiento no se consulta. Incluso con consentimiento, no se envía una pregunta si `/capabilities` no devuelve `paid_ai_enabled: false`. Backend antiguo/inaccesible queda bloqueado. No se modifica el despliegue Render. No incluir claves privadas en el frontend ni en variables `VITE_*`.

El objetivo es $0 sin cobro por consulta usando el hardware del usuario, independientemente del computador de desarrollo. Eso no garantiza capacidad ilimitada del alojamiento, red, almacenamiento o servicios de voz. No se contratan servicios ni se habilitan APIs comerciales.

Vercel: Vite, `npm ci`, salida `dist`. Se conserva el bloqueo de despliegue automático de esta rama para evitar publicar en otros proyectos conectados. Crear Preview explícita por SHA en `apolo-ia-2.0`, sin promover, tocar main ni modificar dominios. El guard de build rechaza producción para esta rama.

La PWA versiona el shell compilado por contenido, espera al cierre de pestañas viejas para activar y solo limpia cachés propias/legacy conocidas. No intercepta ni precarga pesos del modelo. El borrado completo voluntario sí elimina cachés WebLLM. El shell offline no equivale a inferencia offline garantizada: también deben estar disponibles todos los pesos y el runtime. Fuentes externas usan respaldo local cuando no hay conexión.

Si WebLLM informa falta de cuota, Configuración → Borrar modelos descargados elimina solo cachés WebLLM, conservando conversaciones y recuerdos. Es independiente de liberar RAM y de borrar todos los datos. El navegador decide la cuota disponible; dejar espacio en disco no garantiza que conceda más cuota al origen.
