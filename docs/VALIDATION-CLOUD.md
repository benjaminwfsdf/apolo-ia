# Validación de integridad, nube y documentos (2026-11-06)

Base de esta actualización: d1b5362. Rama exclusiva feat/apolo-2-webllm, proyecto existente apolo-ia-2.0. El informe anterior se conserva en VALIDATION.md para trazabilidad.

## Clasificación de los problemas

| Hallazgo | Tipo y evidencia | Acción / límite |
|---|---|---|
| Nombre no recuperado | Fallo reproducible de extracción/contexto + limitación del LLM | Se conserva la corrección determinista y las pruebas exactas; no se sustituye por inferencia remota |
| Tensor-cache [0,68067328) frente a 10222924 | Inconsistencia reportada en iPhone; no reproducida físicamente aquí | Metadatos del publicador confirman 68067328 bytes para shard 0. Se verifican tamaño y SHA-256 contra revisión fija antes de GPU. Causa de la lectura del iPhone pendiente |
| Safari se cierra al 52% | Compatibilidad/recursos: causa no demostrada | Descarga secuencial, 0.5B inicial, acción explícita, cancelación, sin reintentos. No puede capturarse todo cierre del proceso |
| 3B QuotaExceeded | Fallo de almacenamiento observado previamente | Borrado exclusivo de modelos conservado; repetir 3B con cuota libre pendiente |
| Aritmética y pérdida de contexto | Limitación empírica de Qwen; no basta cambiar instrucciones | Motor Gemini preparado, contexto remoto más amplio con consentimiento. Calidad real de Gemini pendiente de credenciales |
| NotebookLM | Dependencia externa sin vía gratuita oficial adecuada verificada | Desconectado; alternativa de texto documental con citas validables implementada y desactivada sin clave |

## Implementación local y verificación

WebLLM permanece en 0.2.87, última versión publicada encontrada en la [página de releases](https://github.com/mlc-ai/web-llm/releases). No se cambió de versión sin evidencia de una corrección del error. El runtime instalado produce la comprobación de rango en getTensorCacheRecordBytes; la ruta Cache API reutilizaba respuestas sin comparar su contenido con un hash esperado.

El nuevo preflight fija revisiones de Hugging Face en src/model-integrity.json, valida metadatos/rangos, tamaños y SHA-256 del manifiesto y cada shard. Los hashes de los pesos provienen de metadatos LFS del publicador; el hash del manifiesto se calcula de su respuesta HTTPS fijada por commit. `scripts/update-model-integrity.mjs` es mantenimiento explícito, nunca se ejecuta automáticamente en build/startup.

Descarga y verificación secuenciales antes de crear el worker/GPU; un fragmento a la vez, sin conservar todos los buffers. Una entrada corrupta se elimina individualmente y la operación falla; no se reintenta en ese flujo. Una descarga interrumpida no se confirma como válida. Una nueva acción manual puede recuperar lo faltante. Se vuelve a verificar la caché en cada carga. Esto añade lecturas/hash y memoria temporal: no elimina los límites del dispositivo. No se hace una promesa de verificación criptográfica de todos los archivos auxiliares ni del runtime WASM.

Las claves de caché incluyen la revisión. Las cachés antiguas no se reinterpretan como nuevas; el botón de borrar modelos elimina ambas. La memoria personal continúa en su DB separada. La PWA no intercepta pesos externos ni /api/, y nunca guarda respuestas de nube.

## Pruebas

- 38 pruebas Node: contexto/memoria, catálogo y ciclo de vida existentes, discrepancia exacta 68067328/10222924, modificación de igual tamaño que falla SHA-256, rangos inválidos, descarga secuencial/caché caliente, interrupción, eliminación acotada y recuperación manual.
- Servidor real con fetch simulado: apagado por defecto/producción, consentimiento, origen, código de acceso, tamaño del cuerpo, roles, contexto de nube hasta 15 turnos, clave solo en cabecera server→Google, sin herramientas de pago, duplicados, concurrencia, límites por instancia/minuto/día, 429 sin reintentos, citas literales y rechazo de fuentes inventadas.
- Playwright: escritorio y emulación móvil 390px. Se mantiene la suite anterior (inferencia/voz simuladas); nueva suite usa el handler de servidor real con Gemini simulado. Comprueba selección de motores, consentimiento, contexto opcional, referencias, 429, cancelación, ausencia de credenciales en almacenamiento y reinicio de permisos/texto al recargar.
- IndexedDB real: consentimiento, restauración, conflictos entre pestañas, cuota/corrupción y borrado. Cache API y PWA se verifican en Chrome real sobre build de producción; no es un dispositivo móvil físico.

## Inferencia REAL de esta actualización

[Resultado completo](benchmark-integrity.json): Chrome headless con GPU AMD RDNA-1, Qwen 0.5B, archivos comprobados por tamaño y SHA-256. Inicialización fría ~35.5 s; caché ~1.38 s; cancelación AbortError y siguiente respuesta Listo. Siete consultas completadas. No se observó el error de rango en este equipo.

Resultados: recuperó Benjamín en el benchmark directo; cálculo de manzanas 4; incumplió la minúscula exacta azul; explicación estrella/planeta incorrecta; recomendó Río de Janeiro pese a Valdivia/invierno; respuesta evasiva sobre desayuno; corrigió 7+5 a 12. Son muestras, no un benchmark estadístico. La aplicación sigue resolviendo preguntas directas del nombre mediante datos confirmados.

No se midió pico de RAM/VRAM ni se probó un iPhone físico. No se hicieron llamadas reales a Gemini ni a NotebookLM y no se afirma que su calidad esté comprobada. No se dispone de credenciales y no se activaron pagos. Véase CLOUD-SETUP.md para configuración y límites reales.

## Pendientes concretos

1. iPhone físico con Safari: primera carga y caché caliente de 0.5B, cancelación y recargas; comparar 1.5B solo si cabe. Registrar dispositivo/iOS, fase, error y Web Inspector si se puede. No diagnosticar caché o memoria únicamente por el porcentaje.
2. Activar Gemini únicamente con proyecto Free Tier sin billing, clave privada y acceso restringido; ejecutar los mismos casos de calidad con inferencia real y contrastar antes de recomendarlo como mejora demostrada.
3. Repetir 3B tras limpieza y cuota suficiente, respetando su licencia de evaluación/no comercial.
4. Voz/micrófono físicos, inferencia offline completa y sesiones móviles prolongadas.
5. NotebookLM real necesita una vía oficial viable y permisos/licencia; no se implementó un puente de cookies inseguro. Para acceso público futuro, autenticación individual y límites distribuidos; los contadores actuales por instancia no sustituyen esas medidas.
