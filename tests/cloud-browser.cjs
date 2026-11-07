const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
const {createCloudHandler}=await import('../server/cloud.js');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();let calls=0,lastBody,fail=false,slow=false;
 const env={VERCEL_ENV:'preview',APOLO_CLOUD_ENABLED:'true',GEMINI_FREE_TIER_CONFIRMED:'true',GEMINI_API_KEY:'server-secret-never-public',APOLO_CLOUD_ACCESS_CODE:'synthetic-access-code-24-characters'};
 let time=1000000;
 const handler=createCloudHandler({env,now:()=>time+=60001,fetcher:async(url,options)=>{
   calls++;lastBody=JSON.parse(options.body);if(slow)await new Promise(r=>setTimeout(r,2000));
   if(fail)return new Response('upstream private',{status:429});
   const answer=lastBody.generationConfig.responseMimeType?JSON.stringify({answer:'Abre los lunes.',citations:[{quote:'abre los lunes a las nueve'}]}):'4';
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:answer}]}}]});
 }});
 await page.route('**/api/chat',async route=>{
   const r=route.request();const response=await handler(new Request(r.url(),{method:r.method(),headers:r.headers(),...(r.method()==='POST'?{body:r.postData()}: {})}));
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 });
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#btnPreguntar').disabled);await ready();
 await page.evaluate(()=>document.querySelector('#ttsOn').checked=false);
 await page.locator('#openSettings').click();await page.locator('summary').click();await page.locator('#rememberedName').fill('Benjamín');await page.locator('summary').click();
 await page.locator('#motor').selectOption('cloud');await page.waitForFunction(()=>document.querySelector('#cloudStatus').textContent.includes('configurado'));
 await page.locator('[data-close=settings]').click();
 const send=async text=>{await page.locator('#texto').fill(text);await page.locator('#btnPreguntar').click();await ready();};
 await send('¿Cuánto es 3-1+2?');assert.equal(calls,0);assert.match(await page.locator('#notice').textContent(),/Autoriza/);
 await page.locator('#openSettings').click();await page.locator('#cloudConsent').check();await page.locator('#cloudAccess').fill(env.APOLO_CLOUD_ACCESS_CODE);await page.locator('[data-close=settings]').click();
 await send('¿Cuánto es 3-1+2?');assert.equal(calls,1);assert.equal(await page.locator('.assistant .bubble').last().textContent(),'4');assert.ok(!JSON.stringify(lastBody).includes('Benjamín'));
 await page.locator('#openSettings').click();await page.locator('#cloudContext').check();await page.locator('[data-close=settings]').click();await send('Continúa');assert.ok(JSON.stringify(lastBody).includes('Benjamín'));assert.equal(lastBody.contents.length,3);
 await page.locator('#openSettings').click();await page.locator('#motor').selectOption('documents');await page.locator('#documentText').fill('La biblioteca abre los lunes a las nueve de la mañana.');await page.locator('[data-close=settings]').click();
 await send('¿Cuándo abre?');assert.match(await page.locator('.assistant .bubble').last().textContent(),/Fuentes.*Texto aportado/s);assert.match(await page.locator('.assistant .bubble').last().textContent(),/abre los lunes a las nueve/);
 fail=true;await send('Prueba de cuota');assert.match(await page.locator('.assistant .bubble').last().textContent(),/Cuota/);assert.equal(await page.locator('#motor').inputValue(),'documents');fail=false;
 slow=true;await page.locator('#texto').fill('Consulta lenta');await page.locator('#btnPreguntar').click();await page.locator('#cancelResponse').click();await ready();assert.match(await page.locator('.assistant .bubble').last().textContent(),/cancelada/);
 await page.locator('#openSettings').click();await page.locator('#clearDocument').click();assert.equal(await page.locator('#documentText').inputValue(),'');
 assert.ok(!await page.evaluate(()=>document.documentElement.outerHTML.includes('server-secret-never-public')));
 assert.ok(!await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('synthetic-access-code')));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();await ready();assert.equal(await page.locator('#cloudConsent').isChecked(),false);assert.equal(await page.locator('#cloudAccess').inputValue(),'');assert.equal(await page.locator('#documentText').inputValue(),'');
 console.log('PASS '+(mobile?'mobile emulation':'desktop')+': real server handler with mocked Gemini, consent/context opt-in, sources, quota, cancellation, credentials never persisted');
 await context.close();
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
