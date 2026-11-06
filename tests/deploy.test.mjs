import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('feature branch cannot build for production, but preview is allowed',()=>{
  const run=environment=>spawnSync(process.execPath,['scripts/guard-preview.mjs'],{env:{...process.env,VERCEL_ENV:environment,VERCEL_GIT_COMMIT_REF:'feat/apolo-2-webllm'},encoding:'utf8'});
  assert.equal(run('production').status,1);assert.equal(run('preview').status,0);
});
test('only this feature branch has automatic Vercel deployments disabled',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.deepEqual(config.git.deploymentEnabled,{'feat/apolo-2-webllm':false});
});
