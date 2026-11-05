const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try {
const context=await browser.newContext();
await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
const page=await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let renderCalls=0;
await page.route('https://apolo-ia.onrender.com/**',async route=>{renderCalls++;await new Promise(r=>setTimeout(r,300));await route.fulfill({json:{respuesta:'Hola, soy Apolo.'}})});
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(()=>document.querySelector('#engineStatus').textContent.includes('WebGPU'));
assert.equal(renderCalls,0);
await page.locator('#motor').selectOption('render');
await page.locator('#texto').fill('Hola');
await page.locator('#btnPreguntar').click();
await page.locator('#texto').press('Enter');
await page.waitForFunction(()=>document.querySelector('#respuesta').textContent==='Hola, soy Apolo.');
assert.equal(renderCalls,1);
assert.equal(await page.locator('#hist .q').count(),1);
await page.locator('#limpiar').click();
assert.equal(await page.locator('#historial').isVisible(),false);
const manifestURL=await page.locator('link[rel=manifest]').getAttribute('href');
const manifest=await (await page.request.get(new URL(manifestURL,page.url()).href)).json();
const iconURL=new URL(manifest.icons[0].src,new URL(manifestURL,page.url()));
assert.equal((await page.request.get(iconURL.href)).status(),200);
await page.evaluate(()=>navigator.serviceWorker.ready);
await page.reload();
await context.setOffline(true);
await page.reload();
assert.equal(await page.title(),'Apolo — Oráculo del Conocimiento');
assert.deepEqual(errors,[]);
console.log('PASS: unsupported WebGPU, no implicit Render, Render UI, duplicate submit guard, history, clear, manifest icons, offline shell, no JS errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

