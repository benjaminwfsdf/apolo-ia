import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBytes,validateRanges,prepareModelFiles,modelError} from '../src/model-files.js';
import integrity from '../src/model-integrity.json' with {type:'json'};
const buffer=new TextEncoder().encode('verified data').buffer;
const file={path:'shard.bin',size:buffer.byteLength,sha256:createHash('sha256').update(Buffer.from(buffer)).digest('hex'),records:[{byteOffset:0,nbytes:buffer.byteLength}]};
function cacheSetup(){const map=new Map();return {map,storage:{open:async()=>({match:async key=>map.get(key)?.clone(),put:async(key,response)=>map.set(key,response),delete:async key=>map.delete(key)})}};}
const meta={base:'https://example.org/model/resolve/pinned/',manifest:{...file,path:'tensor-cache.json'},shards:[file]};
test('pinned published manifests have valid record ranges and SHA256 for every shard',()=>{
  for(const model of Object.values(integrity)){assert.match(model.revision,/^[a-f0-9]{40}$/);for(const shard of model.shards){validateRanges(shard);assert.match(shard.sha256,/^[a-f0-9]{64}$/);}}
  assert.equal(integrity.small.shards[0].size,68067328);
});
test('exact reported shard discrepancy rejects size without claiming its cause',async()=>{
  await assert.rejects(verifyBytes(new ArrayBuffer(10222924),{...file,size:68067328}),/68067328.*10222924/);
  assert.match(modelError(new Error('Tensor-cache record range [0, 68067328) exceeds shard size 10222924')).message,/No se ha confirmado la causa/);
  assert.throws(()=>validateRanges({...file,records:[{byteOffset:10,nbytes:99}]}),/rango/);
});
test('same-size tampering fails SHA256',async()=>{
  await assert.rejects(verifyBytes(new ArrayBuffer(file.size),file),/SHA-256/);await verifyBytes(buffer,file);
});
test('sequential verified download; warm cache never fetches again',async()=>{
  const {storage,map}=cacheSetup();let calls=0,active=0,peak=0;
  const fetcher=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return new Response(buffer);};
  await prepareModelFiles(meta,{storage,fetcher});assert.equal(peak,1);assert.equal(calls,2);assert.equal(map.size,2);
  await prepareModelFiles(meta,{storage,fetcher});assert.equal(calls,2);
});
test('corrupt cached artifact evicted without auto-retry; explicit retry repairs it',async()=>{
  const {storage,map}=cacheSetup();const url=meta.base+meta.manifest.path;map.set(url,new Response('bad'));let calls=0;
  const fetcher=async()=>{calls++;return new Response(buffer);};
  await assert.rejects(prepareModelFiles(meta,{storage,fetcher}),/No se reintentó/);assert.equal(calls,0);assert.ok(!map.has(url));
  await prepareModelFiles(meta,{storage,fetcher});assert.equal(map.size,2);
});
test('interrupted/partial downloads never committed; future manual request succeeds',async()=>{
  const {storage,map}=cacheSetup();let calls=0;
  await assert.rejects(prepareModelFiles(meta,{storage,fetcher:async()=>{calls++;return new Response('short');}}),/incompleto/);
  assert.equal(calls,1);assert.equal(map.size,0);
  const controller=new AbortController();controller.abort();
  await assert.rejects(prepareModelFiles(meta,{storage,signal:controller.signal,fetcher:async()=>{calls++;}}),{name:'AbortError'});assert.equal(calls,1);
  await prepareModelFiles(meta,{storage,fetcher:async()=>new Response(buffer)});assert.equal(map.size,2);
});
