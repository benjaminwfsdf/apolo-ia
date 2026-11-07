// Explicit maintenance command; never runs at build/startup. No weights committed.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MODELS} from '../src/conversation.js';
const result={};
for(const [key,model] of Object.entries(MODELS)){
  const repo='mlc-ai/'+model.id;
  const response=await fetch(`https://huggingface.co/api/models/${repo}?blobs=true`);
  if(!response.ok)throw new Error('Metadata HTTP '+response.status);
  const info=await response.json(),base=`https://huggingface.co/${repo}/resolve/${info.sha}/`;
  const metaResponse=await fetch(base+'tensor-cache.json');if(!metaResponse.ok)throw new Error('Missing tensor cache');
  const raw=Buffer.from(await metaResponse.arrayBuffer()),manifest=JSON.parse(raw);
  const shards=manifest.records.map(shard=>{
    const file=info.siblings.find(f=>f.rfilename===shard.dataPath);
    if(!file?.lfs?.sha256||file.size!==shard.nbytes)throw new Error('Inconsistent shard metadata');
    return {path:shard.dataPath,size:file.size,sha256:file.lfs.sha256,records:shard.records.map(r=>({byteOffset:r.byteOffset,nbytes:r.nbytes}))};
  });
  result[key]={id:model.id,revision:info.sha,base,manifest:{path:'tensor-cache.json',size:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},shards};
  console.log(key,info.sha,shards.length+' shards');
}
await writeFile('src/model-integrity.json',JSON.stringify(result,null,2)+'\n');
