
import { checkWebGPU, askRender } from './conversation.js';
    // === Config ===
    const API_BASE = "https://apolo-ia.onrender.com"; // cambia si usas FastAPI local
    let recognition = null;
    let history = [];

    // Permiso de voz en móviles tras interacción
    let userInteracted = false;
    window.addEventListener('click', () => { userInteracted = true; }, { once:true });

    const $ = s => document.querySelector(s);
    const show = el => el.hidden = false;
    const hide = el => el.hidden = true;

    let busy = false;
    const status = text => $('#engineStatus').textContent = text;
    const hour = new Date().getHours();
    $('#saludo span:last-child').textContent = hour >= 6 && hour < 12 ? '¡Buenos días! Soy Apolo.' : hour < 19 && hour >= 12 ? '¡Buenas tardes! Soy Apolo.' : '¡Buenas noches! Soy Apolo.';
    checkWebGPU().then(() => status('IA local disponible. El modelo se descargará en la primera pregunta (cientos de MB).'))
      .catch(e => { if ($('#motor').value === 'local') status(e.message); });
    $('#motor').addEventListener('change', () => {
      status($('#motor').value === 'render'
        ? 'Render envía tu pregunta al servidor anterior; puede usar servicios de pago hasta actualizar su configuración.'
        : 'IA local: la primera pregunta carga el modelo. No se envían preguntas a Render.');
      $('#modelProgress').hidden = true;
    });
    async function preguntar(texto){
      texto = texto.trim();
      if(!texto || busy) return;
      busy = true;
      ['#btnPreguntar', '#btnHablar', '#motor', '#limpiar'].forEach(s => $(s).disabled = true);
      try {
        let resp;
        if ($('#motor').value === 'render') {
          status('Consultando Render… puede tardar al despertar.');
          resp = await askRender(texto);
          status('Respuesta de Render.');
        } else {
          status('Preparando IA local…');
          const { localAnswer } = await import('./local-engine.js');
          resp = await localAnswer(history, texto, report => {
            const progress = $('#modelProgress');
            progress.hidden = false;
            progress.value = Math.max(0, Math.min(1, report.progress || 0));
            status(`Descarga / inicialización: ${Math.round(progress.value * 100)}% — ${report.text}`);
          });
          status('IA local lista. Respuesta generada en este dispositivo.');
        }
        $('#respuesta').textContent = resp;
        show($('#panelRespuesta'));
        addToHistory(texto, resp);
        speak(resp);
      } catch(e) {
        status($('#motor').value === 'local' ? 'No se pudo completar la IA local. Reintenta o selecciona Render manualmente.' : 'No se pudo consultar Render.');
        $('#respuesta').textContent = '❌ ' + e.message;
        show($('#panelRespuesta'));
      } finally {
        busy = false;
        ['#btnPreguntar', '#btnHablar', '#motor', '#limpiar'].forEach(s => $(s).disabled = false);
        if($('#autoFocus').checked) $('#texto').select();
      }
    }

    function addToHistory(q, a){
      history.unshift({q,a});
      history = history.slice(0, 6);
      const frag = document.createDocumentFragment();
      history.slice(0,6).forEach(item=>{
        const qEl = document.createElement('div'); qEl.className='q'; qEl.textContent="• "+item.q;
        const aEl = document.createElement('div'); aEl.className='a'; aEl.textContent="↳ "+item.a;
        frag.appendChild(qEl); frag.appendChild(aEl);
      });
      $("#hist").innerHTML = ""; $("#hist").appendChild(frag);
      show($("#historial"));
    }

    // TTS
    function speak(text){
      if(!$("#ttsOn").checked) return;
      if(!('speechSynthesis' in window)) return;
      if(!userInteracted) return; // iOS y móviles: requiere gesto
      if(!text) return;

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-ES";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }

    // STT
    function startSTT(){
      if (busy) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SR){ alert("Tu navegador no soporta reconocimiento de voz."); return; }

      if(recognition){ recognition.abort(); recognition = null; }
      recognition = new SR();
      recognition.lang = "es-ES";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      $("#saludo").innerHTML = `<span class="dot live"></span><span>🎤 Escuchando…</span>`;
      recognition.start();

      recognition.onresult = e=>{
        const texto = e.results[0][0].transcript;
        $("#texto").value = texto;
        preguntar(texto);
      };
      recognition.onerror = _=>{
        $("#saludo").innerHTML = `<span class="dot"></span><span>No te escuché. Intenta de nuevo.</span>`;
      };
      recognition.onend = ()=>{
        $("#saludo").innerHTML = `<span class="dot live"></span><span>Listo</span>`;
      };
    }
    function stopSTT(){ if(recognition){ recognition.abort(); recognition=null; } }

    // UI events
    $("#btnPreguntar").addEventListener('click', ()=> preguntar($("#texto").value.trim()));
    $("#texto").addEventListener('keydown', e=>{
      if(e.key==="Enter") preguntar($("#texto").value.trim());
    });
    $("#btnHablar").addEventListener('click', startSTT);
    $("#btnDetener").addEventListener('click', () => { stopSTT(); window.speechSynthesis?.cancel(); });

    $("#copiar").addEventListener('click', async ()=>{
      try{
        await navigator.clipboard.writeText($("#respuesta").textContent);
        $("#copiar").textContent="✅ Copiado";
        setTimeout(()=>$("#copiar").textContent="📋 Copiar",1200);
      }catch{}
    });
    $("#limpiar").addEventListener('click', ()=>{
      $("#texto").value=""; hide($("#panelRespuesta")); hide($("#historial"));
      history = [];
    });

    // Registrar Service Worker (PWA) — raíz
    if(import.meta.env.PROD && 'serviceWorker' in navigator){
      window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'}).catch(() => status('No se pudo activar el modo sin conexión.')));
    }
