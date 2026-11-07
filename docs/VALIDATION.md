Actualización más reciente: [integridad de modelos, nube y documentos](VALIDATION-CLOUD.md). Configuración: [CLOUD-SETUP.md](CLOUD-SETUP.md). El contenido siguiente conserva la evaluación anterior a esta actualización.

# Validación de la actualización integral

Fecha: 2026-11-06. Base: a8f40098b2b026731ed07ba525eaa52ea59227fa. Rama: feat/apolo-2-webllm. Proyecto Vercel: apolo-ia-2.0. No se cambia main, producción ni dominios.

## Pruebas que pasaron

- `npm test`: 24 pruebas, 0 fallos. Incluye intercambio exacto Benjamín, declaraciones naturales, terceros/citas, corrección/eliminación, contexto cronológico, más de seis turnos, respuestas largas, presupuesto multibyte, pregunta no duplicada, WebGPU, forwarding al SDK, concurrencia, cambio de modelo, liberación de workers, cancelación en carga/generación/antes de GPU, error de red/plazo/texto, bloqueo de Render de pago, guard Preview e interfaz documental desconectada.
- `npm run build`: correcto. Vite advierte sobre el tamaño de WebLLM (~6 MB por bundle de motor/worker, sin pesos). Se importa el motor bajo demanda; la advertencia no es un error de compilación.
- Chrome + Playwright: escritorio 1440×1000 y emulación táctil 390×844 con UA iPhone. Inferencia/voz simuladas para probar de forma determinista el flujo de UI: regresión exacta, datos enviados, confirmación previa a carga, consentimiento de persistencia, restauración, borrado, cancelación, solicitud duplicada, errores, Render bloqueado sin consentimiento o backend seguro, limpieza acotada de cachés, aviso WebGPU y ausencia de arranque automático. Licencia 3B: continuar deshabilitado hasta confirmar, cancelación sin iniciar carga.
- IndexedDB REAL en Chrome: escritura atómica, revisión obsoleta rechazada, error de cuota inyectado conserva copia anterior, datos corruptos rechazados, consentimiento denegado sin creación de DB, borrado, revocación en una pestaña limpia la otra y evita escrituras posteriores.
- PWA con compilación REAL: shell y configuración offline, manifiesto/iconos, eliminación de cachés antiguas propias y preservación de caché WebLLM. Las fuentes de Google fallan offline de forma esperada; hay respaldo local. No se afirma inferencia offline solo por esta prueba.
- Inspección visual de captura móvil: apariencia negra/dorada conservada y sin desbordamiento. Controles secundarios mantienen el chat despejado.

## Inferencia real: resultados y límites

Chrome headless con GPU física AMD RDNA-1 (no GPU de iPhone). Casos sintéticos, temperatura 0.2, una muestra por consulta: no son un estudio estadístico. El benchmark envía el contexto real de `buildContext` directamente a WebLLM para medir al modelo, omitiendo deliberadamente la recuperación determinista del nombre de la aplicación.

Resultados iniciales completos: [1.5B con instrucciones iniciales](benchmark-initial-1.5b.json) y [0.5B con instrucciones abreviadas](benchmark-short-prompt-0.5b.json). Los JSON incluyen preguntas, respuestas literales, tiempos y estadísticas del runtime. No contienen conversaciones privadas.

| Caso | 0.5B, instrucciones abreviadas | 1.5B, instrucciones iniciales |
|---|---|---|
| Nombre en contexto | Falló; respondió con identidad Apolo | Mencionó Benjamín, pero con frase impropia |
| 3 manzanas - 1 + 2 | Resultado 4 correcto | Resultado 4, explicación confusa |
| Responder exactamente azul | Azul con mayúscula: incumple exactitud | azul correcto |
| Estrella frente a planeta | Incorrecto | Simplificación incorrecta/incompleta |
| Ciudad y estación previas | Inventó Santiago | Recordó Valdivia, perdió invierno |
| Desayuno no informado | No reconoció claramente la falta de información | Reconoció que no tenía el dato |
| Corregir 7+5=13 | Corrigió a 12 | Corrigió a 12 |

0.5B: descarga reportada ~266 MB, inicialización fría ~33.4 s y recarga desde caché ~1.2 s. 1.5B: ~829 MB, inicialización fría ~91.8 s y caché ~2.0 s. Tiempos de esta red/equipo; no promesas para otras máquinas. No se midió el pico de RAM/VRAM: las cifras del catálogo son estimaciones, no mediciones. Velocidades por respuesta están en los JSON.

Los primeros intentos secuenciales de 3B no completaron ningún caso; no se consideran exitosos. Se corrigió además un problema del propio registro de pruebas que perdía errores enviados como texto por el SDK. La aplicación también normaliza esos errores. No hay evidencia para afirmar que 3B sea mejor o compatible con este equipo en esa ejecución.

La recuperación estructurada del nombre sí está verificada y no depende de la calidad del modelo. Las instrucciones más claras no garantizan mejoras generales: estas pruebas detectaron errores reales y no permiten anunciar razonamiento avanzado ni memoria infalible del LLM.

## Qué no está validado

- Safari en iPhone físico, presión de memoria real, comparación 0.5B/1.5B en iOS, caché tras recargar y ausencia de cierres en sesiones prolongadas. La emulación de Chrome prueba disposición y flujo, no Safari ni una GPU móvil.
- Micrófono, altavoces y permisos en dispositivos físicos; las rutas de voz se prueban con dobles. Reconocimiento puede usar servicios del navegador.
- Calidad robusta en cientos de conversaciones largas, hechos científicos, fuentes y razonamiento complejo. Las pruebas unitarias de contexto no equivalen a evaluación semántica del modelo.
- Inferencia totalmente offline, eliminación de recursos por el sistema operativo, consumo energético/temperatura y pico de RAM/VRAM.
- Conexión NotebookLM: deliberadamente no implementada. Render no se desplegó ni se habilitó automáticamente.

## Reproducción manual recomendada

1. Abrir la nueva Preview en Chrome compatible. No debe empezar a descargar al abrir. Escribir «Hola Apolo, me llamo Benjamín.» y aceptar la carga si se desea. Preguntar «¿Cómo me llamo?»; debe devolver Benjamín desde memoria confirmada.
2. Corregir «En realidad me llamo Luis». Consultar otra vez. Eliminar con «Olvida mi nombre» o desde Configuración; no debe recuperar el nombre antiguo en una consulta directa.
3. Activar persistencia, aceptar, recargar y revisar historial/nombre/notas. Desactivar y recargar: no debe restaurar la copia. Borrar todos los datos también elimina cachés del modelo en ese origen.
4. Cancelar durante carga y durante generación. Cambiar de modelo solo cuando la operación haya terminado/cancelado. No debe haber reintentos automáticos.
5. En iPhone físico anotar modelo de dispositivo, versión exacta iOS/Safari, fase y porcentaje. Probar primero 0.5B con acción explícita; comparar carga fría/caliente. Probar 1.5B solo si los recursos lo permiten. Si se cierra Safari, no repetir en bucle: registrar el resultado y recopilar Web Inspector si está disponible.

Siguiente fase: validar móviles físicos y ampliar evaluaciones antes de añadir un proveedor documental oficial con consentimiento, fuentes y límites claros. Revisar licencia 3B antes de cualquier uso comercial.

## Repetición con las instrucciones finales

1.5B completó los siete casos con las instrucciones abreviadas: reconoció Benjamín de forma indirecta, falló la operación de manzanas (respondió 2), escribió Azul con mayúscula, dio una explicación científica defectuosa, recordó Valdivia pero no invierno, reconoció desconocer el desayuno y corrigió 7+5 a 12. No se demuestra una mejora general por cambiar el prompt. Se conserva la evidencia literal para evitar seleccionar únicamente resultados favorables.

Inicialización fría: ~115.4 s; recarga desde caché: ~1.94 s. **Cancelación real durante generación: AbortError; siguiente consulta tras volver a cargar: Listo.** Esto comprueba recuperación después de cancelación controlada en este escritorio, no después de un cierre completo de Safari.

Un intento adicional de 0.5B quedó esperando descarga y se interrumpió sin completar; no se cuenta como éxito ni se atribuye a falta de GPU sin evidencia. El harness ahora incluye plazos acotados y registra también errores enviados como texto.

Resultados finales literales: [benchmark-final.json](benchmark-final.json). 3B terminó con `QuotaExceededError: Quota exceeded.` antes de generar respuestas. No se midió su calidad. Este fallo llevó a añadir **Borrar modelos descargados** en Configuración, que conserva historial, recuerdos y shell PWA; comprobado con Cache API real y la UI automatizada. Queda pendiente repetir 3B con cuota/caché limpia; el fallo observado no demuestra incompatibilidad de GPU.
