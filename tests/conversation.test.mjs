import test from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor, checkWebGPU, askRender, MODEL_ID } from '../src/conversation.js';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
test('selected model exists in installed WebLLM', () => assert.ok(prebuiltAppConfig.model_list.some(m => m.model_id === MODEL_ID)));
test('conversation is chronological and preserves roles', () => {
  const messages = messagesFor([{q:'segunda',a:'dos'},{q:'primera',a:'uno'}], 'tercera');
  assert.deepEqual(messages.slice(1).map(m => m.content), ['primera','uno','segunda','dos','tercera']);
  assert.deepEqual(messages.map(m => m.role), ['system','user','assistant','user','assistant','user']);
});
test('large history drops complete turns; oversized question fails', () => {
  assert.equal(messagesFor([{q:'q',a:'a'.repeat(9000)}],'hola').length,2);
  assert.throws(() => messagesFor([], 'á'.repeat(1001)), /larga/);
});
test('WebGPU capability and secure context failures are explicit', async () => {
  await assert.rejects(checkWebGPU({},false),/HTTPS/);
  await assert.rejects(checkWebGPU({},true),/WebGPU/);
  await assert.rejects(checkWebGPU({gpu:{requestAdapter:async()=>null}},true),/GPU compatible/);
  assert.ok(await checkWebGPU({gpu:{requestAdapter:async()=>({})}},true));
});
test('Render keeps API contract and rejects HTTP and malformed responses', async () => {
  assert.equal(await askRender('Hola',async(url,options)=> {
    assert.equal(JSON.parse(options.body).texto,'Hola');
    assert.ok(url.endsWith('/preguntar'));
    return {ok:true,json:async()=>({respuesta:'Saludos'})};
  }),'Saludos');
  await assert.rejects(askRender('x',async()=>({ok:false,status:503})),/503/);
  await assert.rejects(askRender('x',async()=>({ok:true,json:async()=>({})})),/vacía/);
});
