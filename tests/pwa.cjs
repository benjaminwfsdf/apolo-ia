const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
const context=await browser.newContext(),page=await context.newPage();const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
await page.route('**/qa-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<title>Setup</title>'}));
await page.goto(base+'/qa-bootstrap');
await page.evaluate(async()=>{await caches.open('webllm-test-model');await caches.open('static-v1.2.6');await caches.open('apolo-shell-obsolete');});
await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);
const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('webllm-test-model'));assert.ok(!keys.includes('static-v1.2.6'));assert.ok(!keys.includes('apolo-shell-obsolete'));
const manifestURL=new URL(await page.locator('link[rel=manifest]').getAttribute('href'),page.url());
const manifest=await (await page.request.get(manifestURL.href)).json();for(const icon of manifest.icons)assert.equal((await page.request.get(new URL(icon.src,manifestURL).href)).status(),200);
await page.reload();await context.setOffline(true);await page.reload();assert.equal(await page.title(),'Apolo — Tu espacio para pensar');await page.waitForFunction(()=>document.querySelector('#modelInfo').textContent.length>0);await page.locator('#openSettings').click();await page.locator('#settings').waitFor({state:'visible'});
console.log('PASS production PWA: offline shell, settings, manifest icons, legacy cleanup, WebLLM cache preservation');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
