import { MODELS, recommendedModel, checkWebGPU, askRender, buildContext, declaredName } from './conversation.js';
const $ = selector => document.querySelector(selector);
let history = [], rememberedName = '', busy = false, recognition = null, localModule;
const modelSelect = $('#model');
modelSelect.value = recommendedModel();
function notice(text='') { $('#notice').textContent=text; $('#notice').hidden=!text; }
function scrollToLatest() { $('#thinking').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
function describeModel() {
  const m=MODELS[modelSelect.value];
  $('#modelInfo').textContent=`${m.memory}. ${m.description} La descarga inicial puede ocupar cientos de MB o más de 1 GB. La memoria es una estimación, no una garantía de compatibilidad.`;
  $('#modelBadge').lastChild.textContent=$('#motor').value==='local'?`Apolo · ${m.label}`:'Apolo · Render';
}
describeModel();
modelSelect.addEventListener('change',()=>{localModule?.disposeLocal();describeModel();});
$('#motor').addEventListener('change',()=>{localModule?.disposeLocal();describeModel();});
checkWebGPU().then(()=>$('#gpuStatus').textContent='WebGPU disponible. La capacidad real depende de la memoria libre de tu GPU.').catch(e=>{ $('#gpuStatus').textContent=e.message; notice(e.message); });
function setBusy(value) {
  busy=value;
  for(const selector of ['#btnPreguntar','#btnHablar','#motor','#model','#limpiar','#rememberedName','#releaseModel']) $(selector).disabled=value;
  $('#thinking').hidden=!value;
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
  texto=texto.trim();if(!texto||busy)return;
  let context;
  const nextName=declaredName(texto) || rememberedName;
  try { context=buildContext(history,texto,nextName); }catch(e){notice(e.message);return;}
  stopVoice();notice();setBusy(true);
  const id=`turn-${history.length}-${Date.now()}`;
  addMessage('user',texto,{id});$('#texto').value='';$('#texto').style.height='auto';
  rememberedName=nextName;$('#rememberedName').value=rememberedName;
  $('#contextInfo').textContent=`Última consulta: ${context.includedTurns} turnos enviados, ${context.omittedTurns} fuera de contexto.${context.shortened?' Algunos mensajes se acortaron.':''} ${rememberedName?'Nombre declarado conservado.':''}`;
  scrollToLatest();
  try {
    let answer;
    if($('#motor').value==='render') {
      $('#thinkingText').textContent='Consultando Render';
      answer=await askRender(texto);
      $('#contextInfo').textContent='Render recibe solo la pregunta actual. No tiene memoria conversacional.';
    } else {
      $('#thinkingText').textContent='Preparando Apolo';
      localModule ||= await import('./local-engine.js');
      answer=await localModule.localAnswer(context.messages,modelSelect.value,report=>{
        $('#download').hidden=false;
        const fraction=Math.max(0,Math.min(1,Number(report.progress)||0));
        $('#modelProgress').value=fraction;
        $('#downloadPercent').textContent=`${Math.round(fraction*100)}%`;
        $('#downloadText').textContent='Descargando e iniciando '+MODELS[modelSelect.value].label;
        $('#downloadText').title=report.text||'';
      },()=>{$('#download').hidden=true;$('#thinkingText').textContent='Apolo está pensando';});
    }
    addMessage('assistant',answer);
    history.push({q:texto,a:answer,id});
    renderHistory();speak(answer);
    if(context.omittedTurns>0 || context.shortened)notice('La conversación completa está en el historial. El modelo utiliza un contexto reciente limitado y tu nombre declarado.');
  }catch(e){
    addMessage('assistant',e.message,{error:true});
    notice($('#motor').value==='local'?'Puedes reintentar o elegir el modelo ligero en Configuración.':'No se pudo consultar Render. La IA local sigue disponible.');
    $('#texto').value=texto;
  }finally{
    $('#download').hidden=true;setBusy(false);
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
$('#rememberedName').addEventListener('input',()=>rememberedName=$('#rememberedName').value.trim());
$('#releaseModel').addEventListener('click',()=>{localModule?.disposeLocal();$('#gpuStatus').textContent='Modelo liberado de la memoria. Se cargará al volver a preguntar; su caché se conserva.';});
$('#limpiar').addEventListener('click',()=>{
  if(busy)return;
  history=[];rememberedName='';$('#rememberedName').value='';localModule?.disposeLocal();stopVoice();
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
if(import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).catch(()=>notice('No se pudo activar el modo sin conexión.')));
