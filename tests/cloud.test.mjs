import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudHandler,validateDocumentAnswer} from '../server/cloud.js';
import {remoteAnswer} from '../src/remote-engine.js';
import {buildContext} from '../src/conversation.js';
const code='synthetic-test-code-at-least-24-chars';
const env={VERCEL_ENV:'preview',APOLO_CLOUD_ENABLED:'true',GEMINI_FREE_TIER_CONFIRMED:'true',GEMINI_API_KEY:'synthetic-server-only-key',APOLO_CLOUD_ACCESS_CODE:code};
const payload=(extra={})=>({mode:'cloud',consent:true,requestId:crypto.randomUUID(),messages:[{role:'system',content:'Habla español'},{role:'user',content:'¿Cuánto es 3-1+2?'}],...extra});
function req(body=payload(),headers={}){return new Request('https://apolo.test/api/chat',{method:'POST',headers:{Origin:'https://apolo.test','Content-Type':'application/json',Authorization:'Bearer '+code,...headers},body:JSON.stringify(body)});}
const success=text=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});
test('remote context keeps more recent pairs, bounded to fifteen turns and one current question',()=>{
  const history=Array.from({length:50},(_,i)=>({q:'Pregunta '+i+' x'.repeat(100),a:'Respuesta '+i+' x'.repeat(100)}));
  const local=buildContext(history,'Actual'),remote=buildContext(history,'Actual','Ana','cloud');
  assert.ok(remote.includedTurns>local.includedTurns);assert.ok(remote.messages.length<=32);
  assert.equal(remote.messages.filter(m=>m.content==='Actual').length,1);assert.match(remote.messages.at(-3).content,/49/);
});
test('default disabled, billing confirmation required, production always disabled',async()=>{
  for(const e of [{},{...env,GEMINI_FREE_TIER_CONFIRMED:'false'},{...env,VERCEL_ENV:'production'}]){
    const handler=createCloudHandler({env:e,fetcher:()=>{throw new Error('must not call');}});
    assert.equal((await handler(req())).status,503);
    const status=await (await handler(new Request('https://apolo.test/api/chat'))).json();assert.equal(status.enabled,false);assert.equal(status.notebooklm,false);
  }
});
test('consent, access, origin, roles, body size validated before external requests',async()=>{
  let calls=0;const handler=createCloudHandler({env,fetcher:()=>{calls++;}});
  for(const [request,status] of [[req(payload({consent:false})),403],[req(payload(),{Authorization:'Bearer wrong'}),401],[req(payload(),{Origin:'https://attacker.test'}),403],[req(payload({messages:[{role:'assistant',content:'x'}]})),400],[req(payload({document:'x'.repeat(90000)})),413]])assert.equal((await handler(request)).status,status);
  assert.equal(calls,0);
});
test('server protects key, forwards ordered context, caps output and never enables paid tools',async()=>{
  let captured;const handler=createCloudHandler({env,fetcher:async(url,options)=>{captured={url,options};return success('4');}});
  const result=await handler(req());assert.equal(result.status,200);const text=await result.text();assert.ok(!text.includes(env.GEMINI_API_KEY));
  assert.equal(captured.options.headers['x-goog-api-key'],env.GEMINI_API_KEY);assert.ok(!captured.url.includes(env.GEMINI_API_KEY));
  const sent=JSON.parse(captured.options.body);assert.equal(sent.generationConfig.maxOutputTokens,1024);assert.equal(sent.contents[0].role,'user');assert.equal(sent.tools,undefined);
});
test('duplicate, concurrency and per-instance rate limits reject without retry',async()=>{
  let calls=0;const handler=createCloudHandler({env,fetcher:async()=>{calls++;return success('4');}});
  const body=payload();assert.equal((await handler(req(body))).status,200);assert.equal((await handler(req(body))).status,409);
  await handler(req());await handler(req());assert.equal((await handler(req())).status,429);assert.equal(calls,3);
  let resolve;const concurrent=createCloudHandler({env,fetcher:()=>new Promise(r=>resolve=r)});const pending=concurrent(req());while(!resolve)await new Promise(r=>setTimeout(r,1));assert.equal((await concurrent(req())).status,429);resolve(success('ok'));await pending;
});
test('daily cap persists within warm instance and upstream 429 never retried',async()=>{
  let time=1000000,calls=0;const handler=createCloudHandler({env,now:()=>time,fetcher:async()=>{calls++;return success('ok');}});
  for(let i=0;i<30;i++){time+=60001;assert.equal((await handler(req())).status,200);}time+=60001;assert.equal((await handler(req())).status,429);assert.equal(calls,30);
  const quota=createCloudHandler({env,fetcher:async()=>new Response('private upstream diagnostic',{status:429})});const response=await quota(req());assert.equal(response.status,429);assert.ok(!(await response.text()).includes('private upstream'));
});
test('document quotes must exist in submitted text; invented sources rejected',async()=>{
  const doc='La biblioteca abre los lunes a las nueve de la mañana.';
  assert.throws(()=>validateDocumentAnswer({answer:'x',citations:[{quote:'Esta frase fue inventada.'}]},doc),/no coincide/);
  assert.throws(()=>validateDocumentAnswer({answer:'x',citations:[]},doc),/evidencia/);
  const handler=createCloudHandler({env,fetcher:async()=>success(JSON.stringify({answer:'Abre los lunes.',citations:[{quote:'abre los lunes a las nueve'}]}))});
  const result=await (await handler(req(payload({mode:'documents',document:doc})))).json();assert.equal(result.sources[0].start,14);assert.equal(result.sources[0].excerpt,'abre los lunes a las nueve');
});
test('client no-consent makes no request, cancellation signal is forwarded',async()=>{
  let calls=0;await assert.rejects(remoteAnswer({consent:false},()=>{calls++;}),/Autoriza/);assert.equal(calls,0);
  const signal=new AbortController().signal;await remoteAnswer({messages:[],mode:'cloud',consent:true,accessCode:code,signal},async(url,options)=>{assert.equal(options.signal,signal);return Response.json({answer:'ok'});});
});
