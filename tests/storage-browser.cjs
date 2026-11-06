const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
const context=await browser.newContext(),page=await context.newPage();await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
const results=await page.evaluate(async()=>{
  const {createMemoryStore,DB_NAME,CONSENT_KEY}=await import('/src/storage.js');
  const state=name=>({schema:1,memory:{name,notes:'',source:'user'},history:[]});
  const a=createMemoryStore();await a.enable(state('Ana'));
  const b=createMemoryStore();await b.load();await a.save(state('Luis'));
  let conflict=false;try{await b.save(state('Old'));}catch{conflict=true;}
  const afterConflict=await createMemoryStore().load();
  const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(){throw new DOMException('Quota full','QuotaExceededError');};
  let quota=false;try{await a.save(state('Discarded'));}catch(e){quota=e.name==='QuotaExceededError';}finally{IDBObjectStore.prototype.put=original;}
  const afterQuota=await createMemoryStore().load();
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('conversation','readwrite');tx.objectStore('conversation').put({...afterQuota,memory:{name:'Invented',notes:'',source:'assistant'}},'state');tx.oncomplete=resolve;tx.onabort=reject;});db.close();
  let corrupt=false;try{await createMemoryStore().load();}catch{corrupt=true;}
  await a.disable();
  const blockedConsent={getItem:()=>null,setItem(){throw new DOMException('Storage blocked','SecurityError');},removeItem(){}};
  let denied=false;try{await createMemoryStore({consent:blockedConsent}).enable(state('Secret'));}catch{denied=true;}
  const databases=await indexedDB.databases();
  return {conflict,nameAfterConflict:afterConflict.memory.name,quota,nameAfterQuota:afterQuota.memory.name,corrupt,denied,noConsent:localStorage.getItem(CONSENT_KEY)===null,noDatabase:!databases.some(d=>d.name===DB_NAME)};
});
assert.deepEqual(results,{conflict:true,nameAfterConflict:'Luis',quota:true,nameAfterQuota:'Luis',corrupt:true,denied:true,noConsent:true,noDatabase:true});
// A second tab must not resurrect data after revocation in the first.
await page.evaluate(async()=>{const {createMemoryStore}=await import('/src/storage.js');await createMemoryStore().enable({schema:1,memory:{name:'Ana',notes:'',source:'user'},history:[]});});
await page.reload();await page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);
const second=await context.newPage();await second.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await second.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);
await page.evaluate(async()=>{const {createMemoryStore}=await import('/src/storage.js');await createMemoryStore().disable();});
await second.waitForFunction(()=>document.querySelector('#storageStatus').textContent.includes('otra pestaña'));
assert.equal(await second.locator('#rememberedName').inputValue(),'');assert.equal(await second.locator('#persistMemory').isChecked(),false);
console.log('PASS real IndexedDB: atomic writes, stale revision conflict, quota preservation, corruption detection, denied consent, deletion and cross-tab revocation');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
