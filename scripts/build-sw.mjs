import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = (await readdir('dist', {recursive:true, withFileTypes:true})).filter(e => e.isFile()).map(e => `${e.parentPath}/${e.name}`.replaceAll('\\','/')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const assets = files.map(f => './' + f.replace(/^dist\//,''));
const source = (await readFile('service-worker.js','utf8')).replace('__VERSION__',hash.digest('hex').slice(0,12)).replace('__ASSETS__',JSON.stringify(assets));
await writeFile('dist/service-worker.js',source);
