const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
const page=await browser.newPage();page.on('console',m=>{if(m.text().startsWith('GPU_TEST'))console.log(m.text())});
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
const result=await page.evaluate(async()=>{
  const {localAnswer,disposeLocal}=await import('/src/local-engine.js');
  const {buildContext}=await import('/src/conversation.js');
  let last=-1;
  const progress=r=>{const n=Math.floor(r.progress*10);if(n!==last){last=n;console.log('GPU_TEST load '+Math.round(r.progress*100)+'% '+r.text)}};
  const start=Date.now();
  try{
    const first=await localAnswer(buildContext([],'Me llamo Ana','Ana').messages,'balanced',progress);
    console.log('GPU_TEST first: '+first);
    const second=await localAnswer(buildContext([{q:'Me llamo Ana',a:first}],'¿Cómo me llamo?','Ana').messages,'balanced',progress);
    console.log('GPU_TEST second: '+second);
    const unknown=await localAnswer(buildContext([],'¿Cómo me llamo?').messages,'balanced',progress);
    return {first,second,unknown,elapsedMs:Date.now()-start};
  }finally{disposeLocal();}
});
console.log(JSON.stringify(result));
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

