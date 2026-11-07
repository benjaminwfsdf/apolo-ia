import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalClient} from '../src/local-engine.js';
function setup(overrides={}){
  const workers=[];let interrupts=0;
  const client=createLocalClient({prepareModel:async()=>{},checkGPU:async()=>{},createWorker:()=>{const w={terminated:false,terminate(){this.terminated=true;}};workers.push(w);return w;},createEngine:async()=>({interruptGenerate(){interrupts++;},chat:{completions:{create:()=>new Promise(()=>{})}}}),...overrides});
  return {client,workers,get interrupts(){return interrupts;}};
}
test('cancel during generation settles immediately, terminates worker, and permits retry',async()=>{
  const s=setup();const ac=new AbortController();const pending=s.client.answer([],'small',undefined,undefined,ac.signal);
  await new Promise(r=>setTimeout(r,0));ac.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(s.interrupts,1);assert.ok(s.workers[0].terminated);
  const next=s.client.answer([],'small');await new Promise(r=>setTimeout(r,0));s.client.cancel();await assert.rejects(next,{name:'AbortError'});assert.equal(s.workers.length,2);
});
test('cancel during initialization does not retry or leave busy/worker behind',async()=>{
  const s=setup({createEngine:()=>new Promise(()=>{})});const pending=s.client.answer([],'small');await new Promise(r=>setTimeout(r,0));s.client.cancel();await assert.rejects(pending,{name:'AbortError'});assert.ok(s.workers[0].terminated);
});
test('cancel before GPU check resolves never creates a worker',async()=>{
  let resolveGPU;const s=setup({checkGPU:()=>new Promise(r=>resolveGPU=r)});const p=s.client.answer([],'small');s.client.cancel();resolveGPU();await assert.rejects(p,{name:'AbortError'});assert.equal(s.workers.length,0);
});
test('download failure and initialization deadline are recoverable, not automatic retries',async()=>{
  let loads=0;const s=setup({createEngine:async()=>{loads++;throw new Error('Network failed');}});
  await assert.rejects(s.client.answer([],'small'),/Network failed/);assert.equal(loads,1);assert.ok(s.workers[0].terminated);
  const stringError=setup({createEngine:async()=>{throw 'Network failed as text';}});await assert.rejects(stringError.client.answer([],'small'),/Network failed as text/);
  const timeout=setup({createEngine:()=>new Promise(()=>{}),loadTimeout:10});await assert.rejects(timeout.client.answer([],'small'),/agotó/);assert.ok(timeout.workers[0].terminated);
});
