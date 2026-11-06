// Development-only harness. Never imported by the production app.
import {CreateWebWorkerMLCEngine,prebuiltAppConfig} from '@mlc-ai/web-llm';
import {createLocalClient} from '../src/local-engine.js';
import {buildContext,MODELS} from '../src/conversation.js';
const cases=[
  {id:'name',question:'¿Cómo me llamo?',memory:{name:'Benjamín',notes:''},history:[{q:'Hola Apolo, me llamo Benjamín.',a:'Hola Benjamín, es un placer conocerte.'}]},
  {id:'logic',question:'Tenía 3 manzanas, regalé 1 y compré 2. ¿Cuántas tengo ahora? Responde con el número y una explicación breve.'},
  {id:'instruction',question:'Responde únicamente con la palabra azul, sin comillas ni puntuación.'},
  {id:'spanish',question:'Explica en dos frases la diferencia entre una estrella y un planeta.'},
  {id:'related',history:[{q:'Quiero visitar Valdivia en invierno.',a:'Podemos planificar ese viaje.'}],question:'¿Qué ciudad quiero visitar y en qué estación?'},
  {id:'uncertainty',question:'¿Qué desayuné hoy? No te lo he contado.'},
  {id:'contradiction',history:[{q:'¿Cuánto es 7 más 5?',a:'Es 13.'}],question:'Eso es incorrecto: 7 más 5 es 12. Corrige tu respuesta.'}
];
export async function benchmark(modelKey,report=()=>{}){
  let usage=null;const client=createLocalClient({loadTimeout:180000,createEngine:async(...args)=>{
    const engine=await CreateWebWorkerMLCEngine(...args);
    return {interruptGenerate:()=>engine.interruptGenerate(),chat:{completions:{create:async request=>{const result=await engine.chat.completions.create(request);usage=result.usage;return result;}}}};
  }});
  const result={model:MODELS[modelKey].id,catalogVramMB:prebuiltAppConfig.model_list.find(m=>m.model_id===MODELS[modelKey].id).vram_required_MB,tests:[]};
  let loadingStart=performance.now(),last=-1;
  const progress=r=>{const part=Math.floor(r.progress*4);if(part!==last){last=part;report(r.text);}};
  try{
    for(const item of cases){
      const start=performance.now();let ready=start;
      const answer=await client.answer(buildContext(item.history||[],item.question,item.memory||'').messages,modelKey,progress,()=>{ready=performance.now();if(!result.initializationMs)result.initializationMs=ready-loadingStart;});
      result.tests.push({id:item.id,question:item.question,answer,elapsedMs:Math.round(performance.now()-start),generationMs:Math.round(performance.now()-ready),usage});
      report(item.id+': '+answer);
    }
    client.dispose();loadingStart=performance.now();
    await client.answer(buildContext([],'Responde solamente: listo.').messages,modelKey,()=>{},()=>result.cachedInitializationMs=Math.round(performance.now()-loadingStart));
    const controller=new AbortController();let timer;
    try {
      await client.answer(buildContext([],'Escribe una explicación larga de la historia de la astronomía.').messages,modelKey,()=>{},()=>{timer=setTimeout(()=>controller.abort(),100);},controller.signal);
      result.cancellation='finished before cancellation';
    }catch(error){result.cancellation=error.name;}finally{clearTimeout(timer);}
    result.afterCancellation=await client.answer(buildContext([],'Responde únicamente: listo.').messages,modelKey);
    return result;
  }catch(error){result.error=String(error?.message||error);return result;}finally{client.dispose();}
}
