import test from 'node:test';
import assert from 'node:assert/strict';
import {declaredName,emptyMemory,updateMemory,recallConfirmed} from '../src/memory.js';
import {buildContext,recommendedModel} from '../src/conversation.js';
import {validateSnapshot} from '../src/storage.js';
import {createDocumentTools} from '../src/document-tools.js';
test('exact Benjamín regression: greeting, context and deterministic recall',()=>{
  const memory=updateMemory(emptyMemory(),'Hola Apolo, me llamo Benjamín.');
  const history=[{q:'Hola Apolo, me llamo Benjamín.',a:'Hola Benjamín, es un placer conocerte.',status:'complete'}];
  const context=buildContext(history,'¿Cómo me llamo?',memory);
  assert.match(context.messages[0].content,/Benjamín/);
  assert.equal(context.messages.at(-1).content,'¿Cómo me llamo?');
  assert.equal(recallConfirmed('¿Cómo me llamo?',memory),'Te llamas Benjamín.');
});
test('natural declarations, punctuation and latest explicit correction',()=>{
  for(const text of ['Soy Benjamín','Mi nombre es Benjamín','¡Hola Apolo! Me llamo Benjamín.','Hola, me llamo Benjamín, encantado.'])assert.equal(declaredName(text),'Benjamín');
  assert.equal(declaredName('Me llamo Ana. En realidad me llamo Luis.'),'Luis');
  const corrected=updateMemory({name:'Benjamín',notes:'Prefiero ejemplos',source:'user'},'En realidad me llamo Luis');
  assert.equal(corrected.name,'Luis');assert.equal(corrected.notes,'Prefiero ejemplos');
  const cleared=updateMemory(corrected,'Olvida mi nombre.');assert.equal(cleared.name,'');assert.match(recallConfirmed('¿Cómo me llamo?',cleared),/No tengo/);
});
test('third-party, quoted, hypothetical and professional statements are not names',()=>{
  assert.equal(declaredName('Me llamo Juan, dijo Pedro.'),null);
  for(const text of ['Mi amigo se llama Luis','Mi nombre es un ejemplo','Soy profesor','Soy Profesor','Ella dijo: me llamo Ana','Por ejemplo, soy Benjamín','Escribe una historia. Me llamo Ana.','"Soy Benjamín"','¿Soy Benjamín?','No soy Benjamín'])assert.equal(declaredName(text),null,text);
});
test('generated text is history, not a confirmed memory; non-complete turns excluded',()=>{
  const history=[{q:'Hola',a:'Te llamas Juan',status:'complete'},{q:'ERROR',a:'failed',status:'error'},{q:'CANCEL',a:'partial',status:'cancelled'}];
  const context=buildContext(history,'¿Qué sabemos?',emptyMemory());
  assert.match(context.messages[0].content,/No hay un nombre confirmado/);
  assert.ok(!context.messages.some(m=>m.content==='ERROR'||m.content==='CANCEL'));
  assert.equal(recallConfirmed('Resuelve este problema',emptyMemory()),null);
});
test('unknown capacity and iPhone/iPad are conservative; known capable desktop stays 1.5B',()=>{
  assert.equal(recommendedModel({}),'small');assert.equal(recommendedModel({userAgent:'iPhone',deviceMemory:8}),'small');
  assert.equal(recommendedModel({platform:'MacIntel',maxTouchPoints:5,deviceMemory:8}),'small');
  assert.equal(recommendedModel({userAgent:'Windows',deviceMemory:8}),'balanced');
});
test('snapshot schema rejects corruption and untrusted memory sources',()=>{
  assert.equal(validateSnapshot({schema:1,history:[],memory:emptyMemory()}).schema,1);
  assert.throws(()=>validateSnapshot({schema:1,history:[],memory:{name:'Ana',notes:'',source:'assistant'}}),/válido/);
  assert.throws(()=>validateSnapshot({schema:1,history:[{q:42}],memory:emptyMemory()}),/inválido/);
});
test('document adapter is disconnected and never fabricates sources; external consent required',async()=>{
  await assert.rejects(createDocumentTools().research({query:'x',consent:true}),/no están conectadas/);
  let calls=0;const tools=createDocumentTools({research:async()=>{calls++;return {answer:'evidence',sources:[{title:'Source',url:'https://example.org'}]};}});
  await assert.rejects(tools.research({query:'x',consent:false}),/consentimiento/);assert.equal(calls,0);
  assert.equal((await tools.research({query:'x',consent:true})).sources.length,1);
});
