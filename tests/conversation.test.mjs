import test from 'node:test';
import assert from 'node:assert/strict';
import {MODELS,buildContext,declaredName,checkWebGPU,askRender,recommendedModel} from '../src/conversation.js';
import {createLocalClient} from '../src/local-engine.js';
import {prebuiltAppConfig} from '@mlc-ai/web-llm';
test('all offered models really exist, use 4096 context and f32',()=>{
  for(const model of Object.values(MODELS)){
    const record=prebuiltAppConfig.model_list.find(m=>m.model_id===model.id);
    assert.ok(record);assert.equal(record.overrides.context_window_size,4096);assert.match(record.model_id,/q4f32/);
  }
});
test('low resource recommendation is conservative',()=>{assert.equal(recommendedModel({deviceMemory:4}),'small');assert.equal(recommendedModel({deviceMemory:8}),'balanced');});
test('context is chronological, roles alternate and current question occurs once',()=>{
  const result=buildContext([{q:'Me llamo Ana',a:'Hola Ana'},{q:'Vivo en Chile',a:'Entendido'}],'¿Dónde vivo?','Ana');
  assert.deepEqual(result.messages.slice(1).map(m=>m.content),['Me llamo Ana','Hola Ana','Vivo en Chile','Entendido','¿Dónde vivo?']);
  assert.deepEqual(result.messages.map(m=>m.role),['system','user','assistant','user','assistant','user']);
});
test('regression: long assistant reply does not erase name or all earlier turns',()=>{
  const history=[{q:'Me llamo Ana',a:'Encantado'},{q:'Explica filosofía',a:'Respuesta extensa '.repeat(300)}];
  const result=buildContext(history,'¿Cómo me llamo?','Ana');
  assert.match(result.messages[0].content,/Ana/);
  assert.ok(result.messages.some(m=>m.content==='Me llamo Ana'));
  assert.equal(result.shortened,true);assert.equal(history[1].a,'Respuesta extensa '.repeat(300));
});
test('name survives beyond six turns, corrections and clearing are honored',()=>{
  const history=Array.from({length:20},(_,i)=>({q:`Pregunta ${i}`,a:'Respuesta '.repeat(80)}));
  const result=buildContext(history,'¿Cómo me llamo?',declaredName('En realidad me llamo Lucía.'));
  assert.match(result.messages[0].content,/Lucía/);assert.ok(result.omittedTurns>0);
  assert.match(buildContext([],'¿Cómo me llamo?').messages[0].content,/No hay un nombre confirmado/);
});
test('extract only explicit standalone declarations, never third-person or quoted stories',()=>{
  assert.equal(declaredName('Me llamo José María.'),'José María');
  for(const text of ['Mi hermana se llama Ana','Escribe una historia: me llamo Ana','"Me llamo Ana"','¿Me llamo Ana?','Soy un profesor','No me llamo Ana'])assert.equal(declaredName(text),null);
});
test('byte budget holds for multibyte input and rejects overlong questions',()=>{
  const result=buildContext(Array.from({length:30},()=>({q:'é'.repeat(500),a:'😀'.repeat(2000)})),'é'.repeat(900),'Ana');
  assert.ok(result.messages.reduce((n,m)=>n+new TextEncoder().encode(m.content).length,0)<=3000);
  assert.throws(()=>buildContext([],'é'.repeat(1001)),/larga/);
});
test('WebGPU checks distinguish insecure, unavailable, and absent adapter',async()=>{
  await assert.rejects(checkWebGPU({},false),/HTTPS/);await assert.rejects(checkWebGPU({},true),/WebGPU/);
  await assert.rejects(checkWebGPU({gpu:{requestAdapter:async()=>null}},true),/GPU compatible/);
});
test('the actual engine client forwards context unchanged, reloads models and frees workers',async()=>{
  const requests=[],models=[],workers=[];
  const client=createLocalClient({prepareModel:async()=>{},checkGPU:async()=>{},createWorker:()=>{const w={terminated:false,terminate(){this.terminated=true;}};workers.push(w);return w;},createEngine:async(w,id)=>{models.push(id);return {chat:{completions:{create:async options=>{requests.push(options);return {choices:[{message:{content:'Te llamas Ana.'}}]};}}}};}});
  const messages=buildContext([{q:'Me llamo Ana',a:'Hola Ana'}],'¿Cómo me llamo?','Ana').messages;
  assert.equal(await client.answer(messages,'balanced'),'Te llamas Ana.');
  assert.deepEqual(requests[0].messages,messages);assert.equal(requests[0].temperature,0.2);
  await client.answer(messages,'balanced');assert.equal(models.length,1);
  await client.answer(messages,'small');assert.equal(models.length,2);assert.ok(workers[0].terminated);
  client.dispose();assert.ok(workers[1].terminated);
});
test('initialization failure is retryable; simultaneous generation is rejected',async()=>{
  let fail=true,release;
  const client=createLocalClient({prepareModel:async()=>{},checkGPU:async()=>{},createWorker:()=>({terminate(){}}),createEngine:async()=>{if(fail){fail=false;throw new Error('GPU memory');}return {chat:{completions:{create:()=>new Promise(resolve=>release=()=>resolve({choices:[{message:{content:'ok'}}]}))}}};}});
  await assert.rejects(client.answer([],'small'),/GPU memory/);
  const pending=client.answer([],'small');
  await new Promise(r=>setTimeout(r,0));
  await assert.rejects(client.answer([],'small'),/respondiendo/);release();assert.equal(await pending,'ok');client.dispose();
});
test('Render cannot send a question unless backend explicitly disables paid AI',async()=>{
  let calls=0;
  await assert.rejects(askRender('x',async()=>{calls++;return {ok:true,json:async()=>({paid_ai_enabled:true})};}),/No se envió/);
  assert.equal(calls,1);
  assert.equal(await askRender('Hola',async(url,options)=>url.endsWith('/capabilities')?{ok:true,json:async()=>({paid_ai_enabled:false})}:{ok:true,json:async()=>{assert.equal(JSON.parse(options.body).texto,'Hola');return {respuesta:'Saludos'};}}),'Saludos');
  await assert.rejects(askRender('x',async(url)=>url.endsWith('/capabilities')?{ok:true,json:async()=>({paid_ai_enabled:false})}:{ok:false,status:503}),/503/);
});
