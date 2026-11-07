export async function remoteAnswer({messages,mode,document='',consent,accessCode,signal},fetcher=fetch){
  if(consent!==true)throw new Error('Autoriza primero el envío externo en Configuración.');
  if(!accessCode)throw new Error('Introduce el código de acceso de esta Preview. No es una clave de Google.');
  const response=await fetcher('/api/chat',{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessCode},
    body:JSON.stringify({messages,mode,document,consent:true,requestId:crypto.randomUUID()})});
  let data;try{data=await response.json();}catch{throw new Error('El servidor de nube no respondió con JSON.');}
  if(!response.ok)throw new Error(data.error||'Error de conexión con la nube.');
  if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('Respuesta de nube inválida.');
  return data;
}
