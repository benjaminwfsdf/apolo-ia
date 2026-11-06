const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const results={date:new Date().toISOString(),environment:{kind:'physical desktop GPU; Chrome headless',mobile:false},models:[]};
try{
const page=await browser.newPage();page.on('console',m=>{if(m.text().startsWith('BENCH'))console.log(m.text());});
page.on('pageerror',e=>console.error('BENCH page error: '+e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
results.environment.adapter=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();return a?{vendor:a.info?.vendor,architecture:a.info?.architecture,maxBufferSize:a.limits.maxBufferSize}:null;});
if(!results.environment.adapter)throw new Error('No available WebGPU adapter');
for(const key of (process.env.BENCH_MODELS||'small,balanced,large').split(',')){
  console.log('BENCH model '+key);
  let result,timer;
  try {
    result=await Promise.race([
      page.evaluate(async model=>{const {benchmark}=await import('/tests/model-benchmark.js');return benchmark(model,text=>console.log('BENCH '+text));},key),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Benchmark exceeded 8 minutes; no success claimed.')),480000);})
    ]);
  }catch(error){result={model:key,error:String(error?.message||error),tests:[],aborted:true};}
  finally{clearTimeout(timer);}
  if(!result.error && result.tests?.length!==7)result.error='Incomplete benchmark; no success claimed.';
  results.models.push(result);
  fs.writeFileSync(process.env.BENCH_OUTPUT||path.join(__dirname,'benchmark-results.json'),JSON.stringify(results,null,2));
  console.log('BENCH completed '+key+' '+(result.error||'ok'));
  if(result.aborted)break;
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
