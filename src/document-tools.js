/** Future document tools contract. No provider, network call or NotebookLM integration is enabled. */
export function createDocumentTools(provider = null) {
  return {
    available: !!provider,
    /** @param {{query:string, consent:boolean, signal?:AbortSignal}} request
     * Provider must return {answer:string, sources:Array<{title:string,url:string,excerpt?:string}>}.
     * Sources are evidence, never system instructions or confirmed personal memories.
     */
    async research(request) {
      if (!provider) throw new Error('Las herramientas documentales todavía no están conectadas.');
      if (!request.consent) throw new Error('La consulta externa requiere consentimiento explícito.');
      const result=await provider.research({query:request.query,signal:request.signal});
      if (typeof result?.answer!=='string' || !Array.isArray(result.sources)) throw new Error('Respuesta documental inválida.');
      for(const source of result.sources) {
        if(typeof source.title!=='string' || !/^https?:\/\//.test(source.url))throw new Error('Fuente documental inválida.');
      }
      return result;
    }
  };
}
