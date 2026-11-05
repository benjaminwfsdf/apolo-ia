import { CreateWebWorkerMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { MODEL_ID, checkWebGPU, messagesFor } from './conversation.js';
let enginePromise;
let worker;
async function withDeadline(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Se agotó el tiempo de espera. Comprueba la conexión y la memoria disponible; puedes reintentar.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function localAnswer(history, question, onProgress) {
  const messages = messagesFor(history, question);
  try {
    if (!enginePromise) {
      enginePromise = (async () => {
        await checkWebGPU();
        if (!prebuiltAppConfig.model_list.some(m => m.model_id === MODEL_ID)) throw new Error('Modelo no disponible.');
        worker = new Worker(new URL('./llm-worker.js', import.meta.url), {type:'module'});
        return CreateWebWorkerMLCEngine(worker, MODEL_ID, {initProgressCallback:onProgress});
      })();
    }
    const engine = await withDeadline(enginePromise, 600000);
    onProgress({progress:1, text:'Modelo listo. Pensando…'});
    const result = await withDeadline(engine.chat.completions.create({messages, temperature:0.7, max_tokens:384}), 180000);
    const answer = result.choices[0]?.message?.content?.trim();
    if (!answer) throw new Error('El modelo no produjo una respuesta.');
    return answer;
  } catch (error) {
    worker?.terminate(); worker = undefined; enginePromise = undefined;
    throw error;
  }
}
