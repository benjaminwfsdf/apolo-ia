const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({})}});
    window.__spoken=[];
    Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__spoken.push(u.text),cancel(){},speaking:false}});
    window.SpeechRecognition=class{start(){window.__recognition=this}abort(){this.onend?.()}};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let renderCalls=0;await page.route('https://apolo-ia.onrender.com/**',route=>{renderCalls++;return route.fulfill({status:404,body:'not updated'});});
  await page.route('**/src/local-engine.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function disposeLocal() { window.__disposed = true; }
    export async function localAnswer(messages,model,onProgress,onReady) {
      window.__requests ||= []; window.__requests.push({messages,model});
      onProgress({progress:.5,text:'Test download'});
      await new Promise(r=>setTimeout(r,300)); onReady();
      if(window.__fail) throw new Error('GPU sin memoria');
      return messages.at(-1).content.includes('llamo')?'Te llamas Ana.':'Una respuesta de prueba.';
    }`}));
  await page.goto(base);
  await page.locator('#modelBadge').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,mobile?'apolo-mobile.png':'apolo-desktop.png'),fullPage:true});
  const send=async text=>{await page.locator('#texto').fill(text);await page.locator('#btnPreguntar').click();await page.waitForFunction(()=>document.querySelector('#btnPreguntar').disabled===false);};
  await page.locator('#texto').fill('Me llamo Ana');await page.locator('#btnPreguntar').click();
  await page.locator('#download').waitFor({state:'visible'});
  assert.equal(await page.locator('#modelProgress').getAttribute('value'),'0.5');
  await page.locator('#texto').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);
  assert.equal(await page.evaluate(()=>window.__requests.length),1);
  assert.equal(await page.locator('#download').isVisible(),false);
  await send('¿Cómo me llamo?');
  const request=await page.evaluate(()=>window.__requests.at(-1));
  assert.match(request.messages[0].content,/Ana/);assert.equal(request.messages[1].content,'Me llamo Ana');assert.equal(request.messages.at(-1).content,'¿Cómo me llamo?');
  assert.deepEqual(request.messages.map(m=>m.role),['system','user','assistant','user']);
  assert.equal(await page.locator('.message.user').count(),2);
  assert.ok((await page.evaluate(()=>window.__spoken.length))>=2);
  await page.locator('#btnDetener').click();
  await page.locator('#btnHablar').click();
  await page.evaluate(()=>window.__recognition.onresult({results:[[{transcript:'Mensaje dictado'}]]}));
  await page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);
  assert.equal(await page.locator('.message.user').last().textContent(),'TúMensaje dictado');
  await page.locator('#openSettings').click();await page.locator('#model').selectOption('small');
  await page.locator('summary').click();await page.locator('#rememberedName').fill('Lucía');
  await page.locator('[data-close=settings]').click();await send('¿Cuál es mi nombre?');
  assert.match(await page.evaluate(()=>window.__requests.at(-1).messages[0].content),/Lucía/);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).model),'small');
  await page.locator('#openHistory').click();assert.equal(await page.locator('#historyList button').count(),4);
  await page.locator('#limpiar').click();assert.equal(await page.locator('.message').count(),0);
  await send('¿Cómo me llamo?');assert.match(await page.evaluate(()=>window.__requests.at(-1).messages[0].content),/No hay un nombre confirmado/);
  await page.evaluate(()=>window.__fail=true);await send('Reintenta');assert.equal(await page.locator('#texto').inputValue(),'Reintenta');assert.equal(await page.locator('.message.error').count(),1);
  await page.locator('#openSettings').click();await page.locator('#motor').selectOption('render');await page.locator('[data-close=settings]').click();await send('No enviar a pago');assert.equal(renderCalls,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'mobile 390px':'desktop 1440px')+': UI, ordered context, memory edit/clear, models, progress, voice mocks, history, retry and payment guard');
  await context.close();
}
const context=await browser.newContext();await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('WebGPU'));console.log('PASS unsupported WebGPU notice');await context.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
