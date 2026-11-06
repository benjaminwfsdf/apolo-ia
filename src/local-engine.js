import { CreateWebWorkerMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { MODELS, checkWebGPU } from './conversation.js';
export function createLocalClient({createEngine = CreateWebWorkerMLCEngine, createWorker = () => new Worker(new URL('./llm-worker.js', import.meta.url), {type:'module'}), checkGPU = checkWebGPU} = {}) {
  let engine, worker, loadedModel, busy = false;
  function dispose() { worker?.terminate(); worker=undefined; engine=undefined; loadedModel=undefined; }
  async function deadline(operation, ms) {
    let timer;
    try { return await Promise.race([operation,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Se agotó el tiempo. Reintenta con el modelo ligero o comprueba tu conexión.')),ms); })]); }
    finally { clearTimeout(timer); }
  }
  return {
    dispose,
    async answer(messages, modelKey, onProgress = () => {}, onReady = () => {}) {
      if (busy) throw new Error('Apolo ya está respondiendo.');
      const model = MODELS[modelKey];
      if (!model || !prebuiltAppConfig.model_list.some(m=>m.model_id === model.id)) throw new Error('Modelo no disponible.');
      busy=true;
      try {
        if (loadedModel !== model.id) {
          dispose();
          await checkGPU();
          worker=createWorker();
          const failure = new Promise((_,reject)=>worker.addEventListener?.('error',()=>reject(new Error('No se pudo iniciar la IA local. Prueba el modelo ligero.')),{once:true}));
          engine=await deadline(Promise.race([createEngine(worker,model.id,{initProgressCallback:onProgress}),failure]),600000);
          loadedModel=model.id;
        }
        onReady();
        const result=await deadline(engine.chat.completions.create({messages,temperature:0.2,max_tokens:512}),180000);
        const answer=result.choices[0]?.message?.content?.trim();
        if (!answer) throw new Error('El modelo no produjo una respuesta. Reintenta.');
        return answer;
      } catch(error) { dispose(); throw error; }
      finally { busy=false; }
    }
  };
}
const client=createLocalClient();
export const localAnswer=(...args)=>client.answer(...args);
export const disposeLocal=()=>client.dispose();
