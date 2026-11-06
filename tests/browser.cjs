const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'}:{})});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({})}});
    Object.defineProperty(navigator,'deviceMemory',{value:8});
    window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__spoken.push(u.text),cancel(){},speaking:false}});
    window.SpeechRecognition=class{start(){window.__recognition=this}abort(){this.onend?.()}};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let renderCalls=0,moduleLoads=0;
  await page.route('https://apolo-ia.onrender.com/**',route=>{renderCalls++;return route.fulfill({status:404,body:'old backend'});});
  await page.route('**/src/local-engine.js*',route=>{moduleLoads++;return route.fulfill({contentType:'text/javascript',body:`
    export function disposeLocal(){window.__disposed=true;} export function cancelLocal(){}
    export async function localAnswer(messages,model,onProgress,onReady,signal){
      window.__requests||=[];window.__requests.push({messages,model});
      onProgress({progress:.52,text:'Loading test model'});
      await new Promise((resolve,reject)=>{const t=setTimeout(resolve,window.__slow?5000:100);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Cancelled','AbortError'))},{once:true});});
      onReady();if(window.__fail)throw new Error('GPU sin memoria');return 'Hola Benjamín, es un placer conocerte.';
    }`});});
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);
  await page.goto(base);await ready();
  assert.equal(moduleLoads,0);assert.equal(await page.locator('#model').inputValue(),mobile?'small':'balanced');
  assert.equal(await page.evaluate(()=>localStorage.getItem('apolo-memory-consent-v1')),null);
  assert.equal((await page.evaluate(()=>indexedDB.databases())).some(d=>d.name==='apolo-memory-v1'),false);
  const send=async(text,approve=true)=>{
    await page.locator('#texto').fill(text);await page.locator('#btnPreguntar').click();
    await page.waitForFunction(()=>document.querySelector('#loadConsent').open||!document.querySelector('#btnPreguntar').disabled);
    if(await page.locator('#loadConsent').isVisible())await page.locator(approve?'#acceptLoad':'#declineLoad').click();await ready();
  };
  await send('Hola Apolo, me llamo Benjamín.',false);assert.equal(moduleLoads,0);assert.equal(await page.locator('.message').count(),0);
  await send('Hola Apolo, me llamo Benjamín.');
  assert.equal(await page.evaluate(()=>window.__requests.length),1);
  await send('¿Cómo me llamo?');assert.equal(await page.locator('.assistant .bubble').last().textContent(),'Te llamas Benjamín.');
  assert.equal(await page.evaluate(()=>window.__requests.length),1,'recall must not depend on model');
  await page.evaluate(async()=>{await caches.open('webllm/model');await caches.open('apolo-shell-keep');});
  await page.locator('#openSettings').click();await page.locator('summary').click();await page.locator('#clearModels').click();await ready();
  assert.equal(await page.locator('#rememberedName').inputValue(),'Benjamín');assert.equal(await page.locator('.message').count(),4);
  const remaining=await page.evaluate(()=>caches.keys());assert.ok(!remaining.includes('webllm/model'));assert.ok(remaining.includes('apolo-shell-keep'));
  await page.locator('summary').click();await page.locator('[data-close=settings]').click();
  await send('En realidad me llamo Luis');await send('¿Cómo me llamo?');assert.equal(await page.locator('.assistant .bubble').last().textContent(),'Te llamas Luis.');
  await send('Continuemos la conversación');assert.match(await page.evaluate(()=>window.__requests.at(-1).messages[0].content),/Luis/);
  assert.equal(await page.locator('#download').isVisible(),false);
  await page.locator('#btnDetener').click();await page.locator('#btnHablar').click();await page.evaluate(()=>window.__recognition.onresult({results:[[{transcript:'Mensaje dictado'}]]}));await ready();
  assert.equal(await page.locator('.user .bubble').last().textContent(),'Mensaje dictado');assert.ok(await page.evaluate(()=>window.__spoken.length>0));
  await page.locator('#openSettings').click();await page.locator('summary').click();await page.locator('#memoryNotes').fill('Prefiero ejemplos breves.');
  await page.locator('#persistMemory').click();assert.equal(await page.locator('#storageConsent').isVisible(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('apolo-memory-consent-v1')),null);
  await page.locator('#declineStorage').click();assert.equal(await page.locator('#persistMemory').isChecked(),false);
  await page.locator('#persistMemory').click();await page.locator('#acceptStorage').click();await page.waitForFunction(()=>document.querySelector('#storageStatus').textContent.includes('consentimiento'));
  const count=await page.locator('.user').count(),loadsBefore=moduleLoads;
  await page.reload();await ready();assert.equal(await page.locator('.user').count(),count);assert.equal(moduleLoads,loadsBefore,'restore must not initialize model');
  await send('¿Cómo me llamo?');assert.equal(await page.locator('.assistant .bubble').last().textContent(),'Te llamas Luis.');
  await page.locator('#openSettings').click();await page.locator('summary').click();assert.equal(await page.locator('#memoryNotes').inputValue(),'Prefiero ejemplos breves.');
  await page.locator('#forgetName').click();await page.waitForFunction(()=>document.querySelector('#storageStatus').textContent.includes('Guardado localmente'));
  await page.locator('[data-close=settings]').click();await send('¿Cómo me llamo?');assert.match(await page.locator('.assistant .bubble').last().textContent(),/No tengo un nombre confirmado/);
  await page.reload();await ready();await page.locator('#openSettings').click();await page.locator('summary').click();assert.equal(await page.locator('#rememberedName').inputValue(),'');
  await page.locator('#persistMemory').uncheck();await page.waitForFunction(()=>document.querySelector('#storageStatus').textContent.includes('desactivada'));
  await page.reload();await ready();assert.equal(await page.locator('.message').count(),0);
  await page.evaluate(()=>window.__slow=true);await page.locator('#texto').fill('Respuesta lenta');await page.locator('#btnPreguntar').click();await page.locator('#acceptLoad').click();await page.locator('#download').waitFor({state:'visible'});await page.locator('#texto').press('Enter');await page.locator('#cancelResponse').click();await ready();assert.match(await page.locator('.assistant .bubble').last().textContent(),/cancelada/);assert.equal(await page.evaluate(()=>window.__requests.length),1);
  await page.evaluate(()=>{window.__slow=false;window.__fail=true;});await send('Fallo de carga');assert.match(await page.locator('.assistant .bubble').last().textContent(),/GPU sin memoria/);
  await page.locator('#openSettings').click();await page.locator('#motor').selectOption('render');await page.locator('[data-close=settings]').click();await send('No enviar');assert.equal(renderCalls,0);
  await page.locator('#openSettings').click();await page.locator('#renderConsent').check();await page.locator('[data-close=settings]').click();await send('Backend antiguo');assert.equal(renderCalls,1,'only capability probe; no paid POST');
  await page.evaluate(async()=>{await caches.open('webllm/model');await caches.open('apolo-shell-old');await caches.open('unrelated-cache');});
  await page.locator('#openSettings').click();await page.locator('summary').click();await page.locator('#eraseAll').click();await page.locator('#confirmErase').click();await page.waitForFunction(()=>document.querySelector('#storageStatus').textContent.startsWith('Datos locales y cachés borrados'));
  assert.equal(await page.locator('.message').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('apolo-memory-consent-v1')),null);
  const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('unrelated-cache'));assert.ok(!keys.includes('webllm/model'));assert.ok(!keys.includes('apolo-shell-old'));
  await page.locator('[data-close=settings]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#openSettings').click();await page.locator('#motor').selectOption('local');await page.locator('#model').selectOption('large');await page.locator('[data-close=settings]').click();
  await page.locator('#texto').fill('Evaluación del modelo');await page.locator('#btnPreguntar').click();await page.locator('#loadConsent').waitFor({state:'visible'});
  assert.equal(await page.locator('#acceptLoad').isDisabled(),true);await page.locator('#researchLicense').check();assert.equal(await page.locator('#acceptLoad').isDisabled(),false);
  await page.locator('#declineLoad').click();await ready();assert.equal(await page.locator('.message').count(),0);
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,mobile?'apolo-memory-mobile.png':'apolo-memory-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'iPhone emulation 390px':'desktop 1440px')+': exact regression, local recall, context, consent, restore/delete, cancellation, voice mocks, Render consent and free guard, scoped cache purge');await context.close();
}
const context=await browser.newContext();await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined});sessionStorage.setItem('apolo-active-model-operation','loading:balanced');});const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);assert.equal(await page.locator('#model').inputValue(),'small');assert.equal(await page.locator('#loadConsent').isVisible(),false);assert.match(await page.locator('#gpuStatus').textContent(),/WebGPU/);console.log('PASS unsupported GPU / interrupted load: no reload or auto-download loop');await context.close();
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
