export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
const system = 'Eres Apolo, un sabio oráculo griego. Responde en español con claridad y brevedad. Usa el contexto de la conversación. Si no sabes algo, dilo; no inventes fuentes.';
export function messagesFor(history, question) {
  // Bound UTF-8 bytes conservatively below the 4096-token context, reserving output.
  const size = s => new TextEncoder().encode(s).length;
  if (size(question) > 2000) throw new Error('La pregunta es demasiado larga. Acórtala a unos 500 caracteres.');
  let budget = 2800 - size(system) - size(question);
  const turns = [];
  for (const {q, a} of history.slice(0, 6)) {
    const cost = size(q) + size(a) + 32;
    if (cost > budget) break;
    budget -= cost;
    turns.unshift({role:'user', content:q}, {role:'assistant', content:a});
  }
  return [{role:'system', content:system}, ...turns, {role:'user', content:question}];
}
export async function checkWebGPU(nav = navigator, secure = isSecureContext) {
  if (!secure) throw new Error('La IA local necesita HTTPS o localhost.');
  if (!nav.gpu) throw new Error('Este navegador no ofrece WebGPU. Prueba un navegador actualizado y activa la aceleración gráfica, o selecciona Render.');
  const adapter = await nav.gpu.requestAdapter();
  if (!adapter) throw new Error('No se encontró una GPU compatible. Puedes seleccionar Render.');
  return adapter;
}
export async function askRender(texto, fetcher = fetch) {
  const response = await fetcher('https://apolo-ia.onrender.com/preguntar', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({texto}), signal:AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`Render no está disponible (HTTP ${response.status}).`);
  const data = await response.json();
  if (typeof data.respuesta !== 'string' || !data.respuesta.trim()) throw new Error('Render devolvió una respuesta vacía.');
  return data.respuesta;
}
