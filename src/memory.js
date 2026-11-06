// Only user text/settings may enter this module. Model output is never a fact source.
const reserved = /\b(profesor|profesora|estudiante|doctor|doctora|ingeniero|ingeniera|chileno|chilena|feliz|triste|un|una|el|la|en|de|ejemplo|personaje|asistente|robot|apolo)\b/iu;
export const emptyMemory = () => ({name:'', notes:'', source:'user'});
export function declaredName(text) {
  let found = null;
  // Quotes, hypothetical introductions and third-person narration must not
  // turn into facts. Recognize direct declarations only, not arbitrary prose.
  if (/["“”«»`]/u.test(text) || /\b(?:ejemplo|imagina|supongamos|personaje|historia|si me llamo|dijo|decía|escribió)\b/iu.test(text)) return null;
  for (const sentence of text.trim().split(/[.!\n]+/u)) {
    const clean = sentence.trim().replace(/^¡/u,'').replace(/^(?:hola|buenos días|buenas tardes|buenas noches)(?:\s+Apolo)?[!,;:\s]+/iu,'');
    const match = clean.match(/^(?:(?:en realidad|perdón|corrijo)[,;:]?\s+)?(me llamo|mi nombre es|soy)\s+([\p{L}][\p{L}'’\-]*(?:\s+[\p{L}][\p{L}'’\-]*){0,3})(?:\s*[,;].*)?$/iu);
    if (!match || match[2].length>60 || reserved.test(match[2])) continue;
    if (match[1].toLowerCase()==='soy' && !/^\p{Lu}/u.test(match[2])) continue;
    found=match[2];
  }
  return found;
}
export function updateMemory(memory, userText) {
  if (/^(?:por favor[, ]+)?(?:olvida|borra|elimina) (?:mi nombre|el nombre guardado)[.!]?$/iu.test(userText.trim())) return {...memory,name:'',source:'user'};
  const name=declaredName(userText);
  return name ? {...memory,name,source:'user'} : memory;
}
export function recallConfirmed(question, memory) {
  const text=question.trim().toLocaleLowerCase('es').replace(/[¿?¡!.,]/gu,'').trim();
  if (/^(?:apolo[, ]+)?(?:cómo me llamo|cuál es mi nombre|recuerdas mi nombre|sabes cómo me llamo)$/.test(text)) {
    return memory.name ? `Te llamas ${memory.name}.` : 'No tengo un nombre confirmado. Puedes decírmelo o guardarlo en Configuración.';
  }
  return null; // All reasoning/open conversation continues through WebLLM.
}
