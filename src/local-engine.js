import { CreateWebWorkerMLCEngine, prebuiltAppConfig, deleteModelAllInfoInCache } from '@mlc-ai/web-llm';
import { MODELS, checkWebGPU } from './conversation.js';
import integrity from './model-integrity.json' with {type:'json'};
import {prepareModelFiles,modelError} from './model-files.js';
export function createLocalClient({createEngine=CreateWebWorkerMLCEngine,createWorker=()=>new Worker(new URL('./llm-worker.js',import.meta.url),{type:'module'}),checkGPU=checkWebGPU,prepareModel=prepareModelFiles,loadTimeout=600000,generateTimeout=180000}={}) {
  let engine,worker,loadedModel,busy=false,cancelActive;
  function release(){worker?.terminate();worker=undefined;engine=undefined;loadedModel=undefined;}
  function cancel(){cancelActive?.();}
  function dispose(){cancel();release();}
  async function deadline(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Se agotó el tiempo. Reintenta manualmente con el modelo ligero o comprueba tu conexión.')),ms);})]);}finally{clearTimeout(timer);}}
  return {dispose,cancel,
    async answer(messages,modelKey,onProgress=()=>{},onReady=()=>{},signal) {
      if(busy)throw new Error('Apolo ya está respondiendo.');
      const model=MODELS[modelKey];
      if(!model || !prebuiltAppConfig.model_list.some(m=>m.model_id===model.id))throw new Error('Modelo no disponible.');
      if(signal?.aborted)throw new DOMException('Respuesta cancelada.','AbortError');
      busy=true;
      let rejectOperation,stopped=false,ownedWorker;
      const preparation=new AbortController();
      const interrupted=new Promise((_,reject)=>rejectOperation=reject);
      cancelActive=()=>{stopped=true;preparation.abort();try{engine?.interruptGenerate?.();}catch{}release();rejectOperation(new DOMException('Respuesta cancelada.','AbortError'));};
      const abort=()=>cancelActive?.();signal?.addEventListener('abort',abort,{once:true});
      const workerError=()=>rejectOperation(new Error('El motor local dejó de responder. Reintenta manualmente con el modelo ligero.'));
      try {
        if(loadedModel!==model.id){
          release();
          await Promise.race([checkGPU(),interrupted]);
          await deadline(Promise.race([prepareModel(integrity[modelKey],{signal:preparation.signal,report:onProgress}),interrupted]),loadTimeout);
          if(stopped)throw new DOMException('Carga cancelada.','AbortError');
          worker=createWorker();ownedWorker=worker;
          worker.addEventListener?.('error',workerError);worker.addEventListener?.('messageerror',workerError);
          engine=await deadline(Promise.race([createEngine(worker,model.id,{initProgressCallback:report=>{if(!stopped)onProgress(report);},appConfig:{...prebuiltAppConfig,cacheBackend:'cache',model_list:prebuiltAppConfig.model_list.map(m=>m.model_id===model.id?{...m,model:integrity[modelKey].base}:m)}}),interrupted]),loadTimeout);
          loadedModel=model.id;
        }else{
          ownedWorker=worker;worker.addEventListener?.('error',workerError);worker.addEventListener?.('messageerror',workerError);
        }
        if(stopped)throw new DOMException('Respuesta cancelada.','AbortError');
        onReady();
        const result=await deadline(Promise.race([engine.chat.completions.create({messages,temperature:0.2,max_tokens:modelKey==='small'?256:512}),interrupted]),generateTimeout);
        const answer=result.choices[0]?.message?.content?.trim();
        if(!answer)throw new Error('El modelo no produjo una respuesta. Reintenta.');
        return answer;
      }catch(error){preparation.abort();release();throw modelError(error);}
      finally{signal?.removeEventListener('abort',abort);ownedWorker?.removeEventListener?.('error',workerError);ownedWorker?.removeEventListener?.('messageerror',workerError);cancelActive=undefined;busy=false;}
    }
  };
}
const client=createLocalClient();
export const localAnswer=(...args)=>client.answer(...args);
export const disposeLocal=()=>client.dispose();
export const cancelLocal=()=>client.cancel();
export async function clearModelCache(){client.dispose();for(const model of Object.values(MODELS))await deleteModelAllInfoInCache(model.id,prebuiltAppConfig);}
