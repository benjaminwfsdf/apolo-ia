export const CONSENT_KEY='apolo-memory-consent-v1';
export const DB_NAME='apolo-memory-v1';
const STORE='conversation';
// WebLLM is configured with cacheBackend:'cache'; do not touch conversation DB.
export async function clearModelCaches(storage=globalThis.caches){
  if(!storage)throw new Error('No se puede acceder a la caché en este navegador.');
  for(const key of await storage.keys())if(key.startsWith('webllm/'))await storage.delete(key);
}
export function validateSnapshot(value) {
  if (!value || value.schema!==1 || !Array.isArray(value.history) || value.history.length>1000 || value.memory?.source!=='user'
    || typeof value.memory.name!=='string' || value.memory.name.length>60 || typeof value.memory.notes!=='string' || value.memory.notes.length>500) throw new Error('Los datos locales no tienen un formato válido. Se conservaron sin sobrescribir.');
  for(const item of value.history) {
    if(typeof item.q!=='string'||typeof item.a!=='string'||typeof item.id!=='string'||item.q.length>4000||item.a.length>20000||!['complete','error','cancelled','pending'].includes(item.status))throw new Error('Historial local inválido. No se sobrescribió.');
  }
  if(new TextEncoder().encode(JSON.stringify(value)).length>2*1024*1024)throw new Error('El historial supera el límite local de 2 MB. Exporta una copia o limpia la conversación.');
  return value;
}
export function createMemoryStore({idb=globalThis.indexedDB, consent=globalThis.localStorage}={}) {
  let token=null,revision=0,queue=Promise.resolve();
  const serialize=operation=>{const result=queue.then(operation,operation);queue=result.catch(()=>{});return result;};
  function open() {
    return new Promise((resolve,reject)=>{
      if(!idb){reject(new Error('Este navegador no permite IndexedDB.'));return;}
      const request=idb.open(DB_NAME,1);let expired=false;
      const timer=setTimeout(()=>{expired=true;reject(new Error('El almacenamiento no responde. Cierra otras pestañas de Apolo y reintenta.'));},5000);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
      request.onsuccess=()=>{clearTimeout(timer);if(expired)request.result.close();else resolve(request.result);};
      request.onerror=()=>{clearTimeout(timer);reject(request.error);};
      request.onblocked=()=>{clearTimeout(timer);expired=true;reject(new Error('Otra pestaña bloquea el almacenamiento. Ciérrala antes de reintentar.'));};
    });
  }
  async function write(snapshot,initial=false) {
    validateSnapshot(snapshot);
    if(!token || consent.getItem(CONSENT_KEY)!==token)throw new Error('El consentimiento de almacenamiento cambió en otra pestaña.');
    const db=await open();
    try { await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let failure;
      const request=store.get('state');
      request.onsuccess=()=>{
        try {
        if(consent.getItem(CONSENT_KEY)!==token || (!initial && (request.result?.revision!==revision || request.result?.token!==token)) || (initial && request.result)) {
          failure=new Error('Hay cambios o datos anteriores en otra pestaña. Recarga antes de guardar; no se sobrescribieron.');tx.abort();return;
        }
        store.put({...snapshot,revision:revision+1,token},'state');
        }catch(error){failure=error;tx.abort();}
      };
      tx.oncomplete=()=>{revision++;resolve();};
      tx.onabort=()=>reject(failure||tx.error||new Error('No se guardó. La copia anterior permanece intacta.'));
      tx.onerror=()=>{};
    }); } finally {db.close();}
  }
  async function removeDatabase() {
    await new Promise((resolve,reject)=>{
      const request=idb.deleteDatabase(DB_NAME);
      request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('No se pudo completar el borrado. Cierra las otras pestañas y vuelve a borrar.'));
    });
  }
  return {
    async load() {
      token=consent.getItem(CONSENT_KEY);if(!token)return null;
      const db=await open();
      try {
        const record=await new Promise((resolve,reject)=>{const req=db.transaction(STORE).objectStore(STORE).get('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        if(!record || record.token!==token || !Number.isSafeInteger(record.revision) || record.revision<1)throw new Error('No se pudo restaurar la copia local. No se sobrescribirá automáticamente.');
        validateSnapshot(record);revision=record.revision;return record;
      }finally{db.close();}
    },
    enable(snapshot) {
      const copy=structuredClone(snapshot);
      return serialize(async()=>{
        if(consent.getItem(CONSENT_KEY))throw new Error('Ya hay una memoria guardada. Recarga o bórrala antes de activar una nueva.');
        token=crypto.randomUUID();revision=0;consent.setItem(CONSENT_KEY,token);
        try{await write(copy,true);}catch(error){consent.removeItem(CONSENT_KEY);token=null;throw error;}
      });
    },
    save(snapshot) {const copy=structuredClone(snapshot);return serialize(()=>write(copy));},
    disable() {
      // Revoke first: in-flight/other-tab writes check consent before committing.
      consent.removeItem(CONSENT_KEY);token=null;
      return serialize(removeDatabase);
    }
  };
}
