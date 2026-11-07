# Nube y documentos: configuración segura de Preview

Estado: integración implementada pero desactivada sin configuración. No se han introducido credenciales ni efectuado inferencias reales con Gemini. WebLLM sigue disponible de forma independiente.

## Activar exclusivamente en el proyecto existente apolo-ia-2.0

En Vercel → apolo-ia-2.0 → Settings → Environment Variables, seleccionar **Preview** (preferiblemente también la rama feat/apolo-2-webllm). Nunca Production ni variables con prefijo VITE_. Añadir:

| Variable privada del servidor | Valor |
|---|---|
| GEMINI_API_KEY | Clave de la API oficial obtenida en Google AI Studio para un proyecto sin facturación vinculada y con Free Tier confirmado |
| APOLO_CLOUD_ACCESS_CODE | Código aleatorio de al menos 24 caracteres; compartir solo con quienes probarán esta Preview |
| GEMINI_FREE_TIER_CONFIRMED | true, únicamente tras verificar personalmente que ese proyecto/key no tiene facturación y permite el modelo elegido |
| APOLO_CLOUD_ENABLED | true para habilitar la integración después de lo anterior |

No pegar claves en el chat, GitHub, HTML ni campos de Apolo. El campo «Código de acceso» recibe solo el código privado de la Preview, **nunca la clave Google**. Este código no se guarda en localStorage/IndexedDB ni en el historial. La protección Vercel existente permanece activa. Para revocar acceso, cambiar el código y crear otra Preview. El servidor rechaza siempre VERCEL_ENV=production.

Después de configurar, crear una nueva Preview del mismo commit/proyecto para que reciba las variables. No hace falta cambiar producción. En Apolo elegir Nube, introducir el código y autorizar el envío. Incluir contexto/recuerdos requiere un permiso adicional desactivado por defecto. Los permisos desaparecen al recargar.

## Gratuidad y límites

Modelo fijo: gemini-2.5-flash, API oficial generateContent, sin Search, embeddings, File Search, herramientas de pago, reintentos ni fallback automático. La [tabla oficial de precios](https://ai.google.dev/gemini-api/docs/pricing) ofrece un nivel gratuito para ese modelo a la fecha de revisión (2026-11-06). La disponibilidad efectiva depende de la cuenta, región, modelo y cuota. Confirmarla antes de habilitar.

**La aplicación no puede deducir el estado de facturación a partir de una API key.** GEMINI_FREE_TIER_CONFIRMED es una declaración del administrador, no una comprobación de billing. No habilitar con claves de proyectos de pago ni vincular facturación después. Si cambia la política del proveedor, desactivar. No se promete coste cero bajo una configuración incorrecta.

Límites de Apolo: cuerpo 80 KB, contexto hasta 32 mensajes / 16000 caracteres, texto documental 16000 caracteres, salida 1024 tokens, plazo 45 segundos, una llamada simultánea, 3 solicitudes/minuto y 30/día **por instancia caliente**. Rechazo de requestId repetido durante 24 horas en esa instancia. Son defensas complementarias; el escalado/reinicio de Vercel puede reiniciarlas. No constituyen un límite global distribuido ni un sistema público multiusuario. Esta versión requiere acceso restringido y proyecto Google sin billing. Antes de abrir acceso público, implementar autenticación individual y límites distribuidos durables; no se contrató una base de datos para aparentar que ya existen.

Las cuotas definitivas son las del proyecto Google, consultables en [AI Studio / rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), y pueden variar. Un 429 se muestra sin reintentar ni activar pago. Cancelar detiene la espera en el cliente y transmite cancelación cuando el transporte la propaga; Google puede haber consumido cuota o continuar una solicitud ya recibida. No se promete devolución de cuota.

## Privacidad y documentos

Los [términos de servicios gratuitos](https://ai.google.dev/gemini-api/terms) permiten usar entradas/salidas para mejorar servicios y revisión humana, con diferencias regionales. No enviar información personal, confidencial o sensible. Consentir el envío no convierte al nivel gratuito en almacenamiento confidencial.

Modo Documentos: pegar texto público en Configuración, preguntar desde el chat. El texto completo permanece solo en RAM de la pestaña; se envía a Google tras consentimiento. No se almacenan archivos en Vercel ni se usan cookies Google. No hay selector de archivos/PDF, repositorio documental ni sincronización simulados. Las respuestas/citas pueden permanecer en el historial local si el usuario activó su persistencia; se advierte en la interfaz.

El servidor exige citas textuales presentes en el documento y devuelve sus posiciones UTF-16. Rechaza citas inventadas, ausencia de evidencia sin declaración de insuficiencia y respuestas incompletas. La coincidencia literal es comprobable; **no demuestra que la interpretación o cada afirmación de la respuesta esté sustentada**. No se inventan URLs como fuentes. Se usa textContent en pantalla.

## NotebookLM: evaluación y decisión

La [API oficial de notebooks](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks) revisada documenta gestión de cuadernos y requiere cuenta autenticada, rol IAM y licencia activa de Notebook Enterprise. No se ha identificado en esta revisión una vía oficial gratuita apta para conectar el chat de cuadernos personales a esta Preview. No se afirma que nunca vaya a existir tal API; se debe reevaluar con documentación y acceso adecuados.

[notebooklm-py](https://github.com/teng-lin/notebooklm-py) es una biblioteca no oficial, MIT, que utiliza endpoints no documentados. Su README describe autenticación con cookies, inicio de sesión por navegador y alternativas con tokens duraderos. Eso exige proteger credenciales de cuenta Google y renovar/autenticar sesiones; no equivale a una API key de alcance limitado ni a autorización oficial de Google. Puede cambiar, ser limitada o romperse. Su licencia de software no sustituye las condiciones del servicio. No se evaluó como apropiado exponer una cuenta personal mediante un backend público gratuito.

No se instaló ni ejecutó esa biblioteca, no se importaron cookies/tokens y no se automatizó ningún acceso a Google. NotebookLM permanece explícitamente desconectado; `document-tools.js` conserva la interfaz futura y `/api/chat` informa notebooklm:false. El modo Documentos implementado es la alternativa con Gemini y texto aportado, no una conexión a NotebookLM. La conexión real necesita una vía oficial viable, permisos y condiciones revisadas antes de activarla.

## Desarrollo local

`npm run dev` sirve la UI Vite y el motor local. `/api/chat` es una función de Vercel; Vite por sí solo no la ejecuta. Usar Vercel Preview para probar el endpoint desplegado. Las pruebas de nube ejecutan el handler real con un proveedor simulado; no necesitan una clave ni realizan llamadas a Google. No confundir sus respuestas de prueba con inferencia real.
