import { MODELS, recommendedModel, checkWebGPU, askRender, buildContext } from './conversation.js';
import { emptyMemory, updateMemory, recallConfirmed } from './memory.js';
import { createMemoryStore, CONSENT_KEY, clearModelCaches } from './storage.js';
const $ = selector => document.querySelector(selector);
let history = [], memory=emptyMemory(), busy = false, recognition = null, localModule;
let persistent=false, store, activeAbort, approvedModel=null, restoring=true;
const RUN_KEY='apolo-active-model-operation';
function markRun(value){try{value?sessionStorage.setItem(RUN_KEY,value):sessionStorage.removeItem(RUN_KEY);}catch{}}
function snapshot(){return {schema:1,history,memory};}
function syncMemoryFields(){$('#rememberedName').value=memory.name;$('#memoryNotes').value=memory.notes;}
async function persist(){
  if(!persistent)return;
  try{await store.save(snapshot());$('#storageStatus').textContent='Guardado localmente. No se sincroniza con otros dispositivos.';}
  catch(e){persistent=false;$('#persistMemory').checked=false;$('#storageStatus').textContent='No se pudo guardar: '+e.message+' La copia anterior no se sobrescribió. Exporta la sesión actual antes de recargar.';}
}
const modelSelect = $('#model');
modelSelect.value = recommendedModel();
$('#mobileWarning').hidden=modelSelect.value!=='small';
function notice(text='') { $('#notice').textContent=text; $('#notice').hidden=!text; }
function scrollToLatest() { $('#thinking').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
function describeModel() {
  const m=MODELS[modelSelect.value];
  $('#modelInfo').textContent=`${m.memory}. ${m.description} La descarga inicial puede ocupar cientos de MB o más de 1 GB. La memoria es una estimación, no una garantía de compatibilidad.`;
  $('#modelBadge').lastChild.textContent=$('#motor').value==='local'?`Apolo · ${m.label}`:'Apolo · Render';
}
describeModel();
modelSelect.addEventListener('change',()=>{localModule?.disposeLocal();approvedModel=null;describeModel();});
$('#motor').addEventListener('change',()=>{localModule?.disposeLocal();approvedModel=null;describeModel();});
checkWebGPU().then(()=>$('#gpuStatus').textContent='WebGPU disponible. La capacidad real depende de la memoria libre de tu GPU.').catch(e=>{ $('#gpuStatus').textContent=e.message; notice(e.message); });
function setBusy(value) {
  busy=value;
  for(const selector of ['#btnPreguntar','#btnHablar','#motor','#model','#limpiar','#rememberedName','#memoryNotes','#forgetName','#releaseModel','#clearModels','#persistMemory','#eraseAll','#renderConsent']) $(selector).disabled=value;
  $('#thinking').hidden=!value;
  $('#cancelResponse').hidden=!value;
  $('#composer').setAttribute('aria-busy',String(value));
}
function stopVoice() {
  if(recognition) { const current=recognition; recognition=null; current.abort(); }
  window.speechSynthesis?.cancel();
  $('#btnDetener').hidden=true;
  $('#btnHablar').setAttribute('aria-pressed','false');
}
function speak(text, manual=false) {
  if ((!manual && !$('#ttsOn').checked) || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text); utterance.lang='es-ES';
  utterance.onend=utterance.onerror=()=>{if(!recognition)$('#btnDetener').hidden=true;};
  $('#btnDetener').hidden=false;
  window.speechSynthesis.speak(utterance);
}
function addMessage(role, text, {error=false,id}={}) {
  $('#welcome').hidden=true;
  const article=document.createElement('article'); article.className=`message ${role}${error?' error':''}`;
  if(id)article.id=id;
  if(role==='assistant') { const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent='Λ';avatar.setAttribute('aria-hidden','true');article.append(avatar); }
  const body=document.createElement('div');body.className='message-body';
  const label=document.createElement('p');label.className='message-label';label.textContent=role==='user'?'Tú':error?'No se pudo responder':'Apolo';
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;
  body.append(label,bubble);
  if(role==='assistant'&&!error) {
    const toolbar=document.createElement('div');toolbar.className='message-tools';
    const copy=document.createElement('button');copy.textContent='Copiar';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);copy.textContent='Copiado';setTimeout(()=>copy.textContent='Copiar',1500);}catch{notice('No se pudo copiar. Puedes seleccionar el texto.');}});
    const read=document.createElement('button');read.textContent='Escuchar';read.addEventListener('click',()=>speak(text,true));
    toolbar.append(copy,read);body.append(toolbar);
  }
  article.append(body);$('#messages').append(article);return article;
}
function renderHistory() {
  $('#historyList').replaceChildren();
  if(!history.length) { $('#historyList').textContent='Tu próxima conversación comienza aquí.';return; }
  history.forEach((turn,index)=>{
    const button=document.createElement('button'),number=document.createElement('small');number.textContent=`MENSAJE ${index+1}`;button.append(number,document.createTextNode(turn.q));
    button.addEventListener('click',()=>{$('#historyDialog').close();document.getElementById(turn.id)?.scrollIntoView({block:'center'});});
    $('#historyList').append(button);
  });
}
async function preguntar(texto) {
  texto=texto.trim();if(!texto||busy||restoring)return;
  if($('#motor').value==='render'&&!$('#renderConsent').checked){notice('Antes de enviar una pregunta a Render, autoriza el envío en Configuración.');return;}
  let context;
  const nextMemory=updateMemory(memory,texto);
  const recalled=$('#motor').value==='local'?recallConfirmed(texto,nextMemory):null;
  try { context=buildContext(history,texto,nextMemory); }catch(e){notice(e.message);return;}
  stopVoice();notice();setBusy(true);
  activeAbort=new AbortController();
  if($('#motor').value==='local' && recalled===null && approvedModel!==modelSelect.value){
    const allowed=await requestModelLoad(activeAbort.signal);
    if(!allowed || activeAbort.signal.aborted){setBusy(false);activeAbort=null;return;}
    approvedModel=modelSelect.value;
  }
  const id=`turn-${history.length}-${Date.now()}`;
  addMessage('user',texto,{id});$('#texto').value='';$('#texto').style.height='auto';
  memory=nextMemory;syncMemoryFields();
  const turn={q:texto,a:'',id,status:'pending',source:recalled!==null?'memory':$('#motor').value};
  history.push(turn);persist();
  $('#contextInfo').textContent=`Última consulta: ${context.includedTurns} turnos incluidos, ${context.omittedTurns} fuera de contexto.${context.shortened?' Algunos mensajes se acortaron.':''} ${memory.name?'Nombre declarado conservado.':''}`;
  scrollToLatest();
  try {
    let answer;
    if(recalled!==null){answer=recalled;$('#contextInfo').textContent='Consulta directa resuelta desde tus datos confirmados, sin inferencia ni envío externo.';}
    else if($('#motor').value==='render') {
      $('#thinkingText').textContent='Consultando Render';
      answer=await askRender(texto,fetch,activeAbort.signal);
      $('#contextInfo').textContent='Render recibe solo la pregunta actual. No tiene memoria conversacional.';
    } else {
      $('#thinkingText').textContent='Preparando Apolo';
      markRun('loading:'+modelSelect.value);
      localModule ||= await import('./local-engine.js');
      if(activeAbort.signal.aborted)throw new DOMException('Respuesta cancelada.','AbortError');
      answer=await localModule.localAnswer(context.messages,modelSelect.value,report=>{
        $('#download').hidden=false;
        const fraction=Math.max(0,Math.min(1,Number(report.progress)||0));
        $('#modelProgress').value=fraction;
        $('#downloadPercent').textContent=`${Math.round(fraction*100)}%`;
        const phase=/Loading model from cache|Loading GPU|compil|Finish loading/i.test(report.text||'')?'Inicializando':/fetch|download/i.test(report.text||'')?'Descargando / verificando caché':'Preparando';
        markRun(phase+':'+modelSelect.value);
        $('#downloadText').textContent=phase+' · '+MODELS[modelSelect.value].label;
        $('#downloadText').title=report.text||'';
      },()=>{markRun('generating:'+modelSelect.value);$('#download').hidden=true;$('#thinkingText').textContent='Apolo está pensando';},activeAbort.signal);
    }
    addMessage('assistant',answer);
    turn.a=answer;turn.status='complete';await persist();
    renderHistory();speak(answer);
    if(context.omittedTurns>0 || context.shortened)notice('La conversación completa está en el historial. El modelo utiliza un contexto reciente limitado y tu nombre declarado.');
  }catch(e){
    approvedModel=null;
    if(/quota/i.test(e.message||''))e=new Error('No hay cuota suficiente para guardar el modelo. En Configuración puedes borrar solo los modelos descargados, conservando conversaciones y recuerdos.');
    turn.status=e.name==='AbortError'?'cancelled':'error';turn.a=e.name==='AbortError'?'Operación cancelada.':e.message;
    addMessage('assistant',turn.a,{error:true});await persist();renderHistory();
    notice(e.name==='AbortError'?'Cancelado. No se reintentará automáticamente.':$('#motor').value==='local'?'Puedes reintentar manualmente o elegir el modelo ligero en Configuración.':'No se pudo consultar Render. La IA local sigue disponible.');
    $('#texto').value=texto;
  }finally{
    markRun(null);activeAbort=null;$('#download').hidden=true;setBusy(false);
    $('#messages').lastElementChild?.scrollIntoView({block:'nearest'});
    if($('#autoFocus').checked && !matchMedia('(pointer: coarse)').matches)$('#texto').focus({preventScroll:true});
  }
}
$('#composer').addEventListener('submit',e=>{e.preventDefault();preguntar($('#texto').value);});
$('#texto').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();preguntar($('#texto').value);}});
$('#texto').addEventListener('input',()=>{$('#texto').style.height='auto';$('#texto').style.height=Math.min($('#texto').scrollHeight,160)+'px';});
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('#texto').value=button.dataset.prompt;$('#texto').focus();}));
$('#openSettings').addEventListener('click',()=>$('#settings').showModal());
$('#openHistory').addEventListener('click',()=>{renderHistory();$('#historyDialog').showModal();});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
$('#rememberedName').addEventListener('input',()=>{memory={...memory,name:$('#rememberedName').value.trim(),source:'user'};persist();});
$('#memoryNotes').addEventListener('input',()=>{memory={...memory,notes:$('#memoryNotes').value.trim(),source:'user'};persist();});
$('#forgetName').addEventListener('click',()=>{memory={...memory,name:''};syncMemoryFields();persist();});
$('#releaseModel').addEventListener('click',()=>{localModule?.disposeLocal();approvedModel=null;markRun(null);$('#gpuStatus').textContent='Modelo liberado de la memoria. Se cargará al volver a preguntar; su caché se conserva.';});
$('#clearModels').addEventListener('click',async()=>{
  setBusy(true);$('#thinking').hidden=true;$('#cancelResponse').hidden=true;localModule?.disposeLocal();approvedModel=null;markRun(null);
  try{await clearModelCaches();$('#gpuStatus').textContent='Modelos descargados borrados. Tus conversaciones y recuerdos se conservan.';}
  catch(e){$('#gpuStatus').textContent='No se completó el borrado de modelos: '+e.message;}
  finally{setBusy(false);}
});
$('#limpiar').addEventListener('click',()=>{
  if(busy)return;
  history=[];memory=emptyMemory();syncMemoryFields();localModule?.disposeLocal();approvedModel=null;stopVoice();persist();
  $('#messages').replaceChildren();$('#welcome').hidden=false;$('#texto').value='';notice();renderHistory();
  $('#contextInfo').textContent='Conversación y memoria borradas.';$('#historyDialog').close();
});
$('#ttsOn').addEventListener('change',()=>{if(!$('#ttsOn').checked)stopVoice();});
$('#btnDetener').addEventListener('click',stopVoice);
$('#btnHablar').addEventListener('click',()=>{
  if(busy)return;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){notice('Tu navegador no admite reconocimiento de voz. Puedes escribir tu mensaje.');return;}
  stopVoice();const current=new SR();recognition=current;current.lang='es-ES';current.interimResults=false;current.maxAlternatives=1;
  current.onresult=e=>{const text=e.results[0][0].transcript;$('#texto').value=text;preguntar(text);};
  current.onerror=e=>notice(e.error==='not-allowed'?'Permite el acceso al micrófono desde tu navegador.':'No pude escucharte. Inténtalo otra vez.');
  current.onend=()=>{if(recognition===current){recognition=null;$('#btnHablar').setAttribute('aria-pressed','false');if(!window.speechSynthesis?.speaking)$('#btnDetener').hidden=true;}};
  try {current.start();$('#btnDetener').hidden=false;$('#btnHablar').setAttribute('aria-pressed','true');notice('Escuchando…');}catch{recognition=null;notice('No se pudo iniciar el micrófono.');}
});
function requestModelLoad(signal){
  $('#loadConsentText').textContent=`${MODELS[modelSelect.value].label}: ${MODELS[modelSelect.value].memory} estimada, además de memoria temporal de descarga y compilación. Se descargarán los archivos que falten en la caché, sin enviar tu conversación. En móviles puede cerrarse la página por falta de recursos; ni 0.5B está garantizado. No habrá reintentos automáticos.`;
  $('#researchLicenseRow').hidden=modelSelect.value!=='large';$('#researchLicense').checked=false;$('#acceptLoad').disabled=modelSelect.value==='large';
  return new Promise(resolve=>{
    const dialog=$('#loadConsent');dialog.returnValue='';
    const abort=()=>dialog.close('cancel');
    dialog.addEventListener('close',()=>{signal.removeEventListener('abort',abort);resolve(dialog.returnValue==='accept');},{once:true});
    signal.addEventListener('abort',abort,{once:true});
    dialog.showModal();
  });
}
$('#acceptLoad').addEventListener('click',()=>$('#loadConsent').close('accept'));
$('#researchLicense').addEventListener('change',()=>$('#acceptLoad').disabled=!$('#researchLicense').checked);
$('#declineLoad').addEventListener('click',()=>$('#loadConsent').close('cancel'));
$('#cancelResponse').addEventListener('click',()=>{activeAbort?.abort();localModule?.cancelLocal();});
$('#persistMemory').addEventListener('change',async()=>{
  if($('#persistMemory').checked){$('#persistMemory').checked=false;$('#storageConsent').showModal();return;}
  persistent=false;
  try{await store.disable();$('#storageStatus').textContent='Persistencia desactivada y copia guardada borrada. La conversación actual sigue solo en esta pestaña.';}
  catch(e){$('#storageStatus').textContent='No se completó el borrado: '+e.message;}
});
$('#declineStorage').addEventListener('click',()=>$('#storageConsent').close());
$('#acceptStorage').addEventListener('click',async()=>{
  $('#acceptStorage').disabled=true;setBusy(true);$('#thinking').hidden=true;$('#cancelResponse').hidden=true;
  try{
    if(!store)store=createMemoryStore();
    await store.enable(snapshot());persistent=true;$('#persistMemory').checked=true;
    $('#storageStatus').textContent='Guardado localmente con tu consentimiento. Solo en este navegador.';$('#storageConsent').close();
  }catch(e){$('#storageStatus').textContent='No se pudo activar la persistencia: '+e.message;$('#storageConsent').close();}
  finally{$('#acceptStorage').disabled=false;setBusy(false);}
});
$('#exportHistory').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='apolo-conversacion.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#eraseAll').addEventListener('click',()=>$('#eraseConsent').showModal());
$('#confirmErase').addEventListener('click',async()=>{
  $('#confirmErase').disabled=true;setBusy(true);$('#thinking').hidden=true;$('#cancelResponse').hidden=true;
  persistent=false;$('#persistMemory').checked=false;activeAbort?.abort();localModule?.disposeLocal();approvedModel=null;stopVoice();
  try{
    if(!store)store=createMemoryStore();await store.disable();
    if('serviceWorker' in navigator){for(const registration of await navigator.serviceWorker.getRegistrations())if(registration.scope===new URL('./',location.href).href)await registration.unregister();}
    if('caches' in window){for(const key of await caches.keys())if(key.startsWith('apolo-shell-')||key==='static-v1.2.6'||key.startsWith('webllm/'))await caches.delete(key);}
    for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(key.startsWith('apolo-'))storage.removeItem(key);
    history=[];memory=emptyMemory();syncMemoryFields();$('#messages').replaceChildren();$('#welcome').hidden=false;$('#texto').value='';$('#renderConsent').checked=false;renderHistory();
    $('#contextInfo').textContent='Historial y recuerdos borrados.';$('#storageStatus').textContent='Datos locales y cachés borrados. La PWA podrá recrear su caché al volver a abrirla.';
    notice('Datos locales borrados. No se han borrado tus archivos exportados ni otros dispositivos.');
  }catch(e){$('#storageStatus').textContent='Borrado incompleto: '+e.message+' Cierra otras pestañas y vuelve a intentar; no se afirma que los datos se hayan eliminado.';}
  finally{$('#confirmErase').disabled=false;$('#eraseConsent').close();setBusy(false);}
});
window.addEventListener('storage',event=>{
  if(event.key===CONSENT_KEY){persistent=false;$('#persistMemory').checked=false;$('#storageStatus').textContent='La memoria cambió en otra pestaña. Recarga antes de guardar.';
    if(!event.newValue){activeAbort?.abort();localModule?.disposeLocal();history=[];memory=emptyMemory();syncMemoryFields();$('#messages').replaceChildren();$('#welcome').hidden=false;renderHistory();}
  }
});
window.addEventListener('pagehide',()=>{activeAbort?.abort();localModule?.disposeLocal();});
async function restore(){
  setBusy(true);$('#thinking').hidden=true;$('#cancelResponse').hidden=true;
  try{
    try{if(sessionStorage.getItem(RUN_KEY)){modelSelect.value='small';describeModel();notice('La operación anterior no terminó. No se reiniciará automáticamente. Prueba 0.5B solo cuando quieras volver a cargarlo.');}}catch{}
    store=createMemoryStore();const saved=await store.load();
    if(saved){
      history=saved.history.map(turn=>turn.status==='pending'?{...turn,status:'cancelled',a:'Operación interrumpida al salir. No se reintentó automáticamente.'}:turn);memory=saved.memory;persistent=true;$('#persistMemory').checked=true;syncMemoryFields();
      for(const turn of history){addMessage('user',turn.q,{id:turn.id});addMessage('assistant',turn.a,{error:turn.status!=='complete'});}
      renderHistory();$('#storageStatus').textContent='Conversación restaurada desde este navegador. No se cargó ningún modelo.';
    }
  }catch(e){$('#storageStatus').textContent='No se pudo restaurar la memoria local: '+e.message+' Los datos existentes no se sobrescribirán.';}
  finally{restoring=false;setBusy(false);}
}
restore();
if(import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).catch(()=>notice('No se pudo activar el modo sin conexión.')));
