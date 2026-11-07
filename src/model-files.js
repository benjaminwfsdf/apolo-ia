export function validateRanges(shard){
  if(!Number.isSafeInteger(shard.size)||shard.size<1)throw new Error('Tamaño de fragmento inválido.');
  for(const r of shard.records||[]){
    if(!Number.isSafeInteger(r.byteOffset)||r.byteOffset<0||!Number.isSafeInteger(r.nbytes)||r.nbytes<0||!Number.isSafeInteger(r.byteOffset+r.nbytes)||r.byteOffset+r.nbytes>shard.size)throw new Error('Metadatos incompatibles: el rango del tensor excede su fragmento.');
  }
}
export async function verifyBytes(buffer,file,digest=globalThis.crypto.subtle){
  if(buffer.byteLength!==file.size)throw new Error(`Fragmento incompleto o incompatible: ${file.path}; esperados ${file.size} bytes, recibidos ${buffer.byteLength}.`);
  const hash=Array.from(new Uint8Array(await digest.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==file.sha256)throw new Error(`Integridad SHA-256 incorrecta: ${file.path}.`);
}
export async function prepareModelFiles(meta,{signal,report=()=>{},storage=globalThis.caches,fetcher=fetch}={}){
  if(!storage)throw new Error('No se puede verificar la caché de modelos en este navegador.');
  meta.shards.forEach(validateRanges);
  const cache=await storage.open('webllm/model'),files=[meta.manifest,...meta.shards];
  for(let i=0;i<files.length;i++){
    signal?.throwIfAborted();
    const file=files[i],url=new URL(file.path,meta.base).href;
    report({progress:i/files.length,text:`Verificando archivos ${i+1}/${files.length} · ${file.path}`});
    const cached=await cache.match(url);
    const response=cached||await fetcher(url,{signal,cache:'no-store'});
    try{
      if(!response.ok||response.status===206)throw new Error('Descarga incompleta: HTTP '+response.status);
      const buffer=await response.arrayBuffer();signal?.throwIfAborted();
      await verifyBytes(buffer,file);signal?.throwIfAborted();
      if(!cached)await cache.put(url,new Response(buffer,{headers:{'Content-Type':'application/octet-stream'}}));
    }catch(error){
      // Evict only this model artifact. Never erase conversations or automatically retry.
      await cache.delete(url);
      if(error.name==='AbortError')throw error;
      throw new Error(error.message+' No se reintentó. Puedes volver a cargar manualmente o borrar solo los modelos en Configuración.');
    }
  }
  report({progress:1,text:'Archivos verificados por tamaño y SHA-256. Preparando GPU.'});
}
export function modelError(error){
  const message=String(error?.message||error);
  if(/Tensor-cache record range|exceeds shard size/i.test(message))return new Error('Lectura de fragmentos inconsistente. No se ha confirmado la causa (descarga, caché, formato o navegador). Borra solo los modelos descargados y vuelve a cargar manualmente. Detalle: '+message);
  return error&&typeof error.message==='string'?error:new Error(message);
}
