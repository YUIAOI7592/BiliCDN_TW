import test from 'node:test';
import assert from 'node:assert/strict';
import { createRate } from '../../src/playback/rate.mjs';
import { createMediaUrlPolicy } from '../../src/policy/url-policy.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import vm from 'node:vm';
import { buildOptions } from '../../scripts/build.mjs';

test('v160 independent playback instances cannot carry confirmation into another instance', () => {
  const a=createRate({currentStreamBitsPerSec:0}), b=createRate({currentStreamBitsPerSec:0});
  a.syncPlaybackRateFromVideo({playbackRate:1},'ratechange');
  assert.equal(a.playbackRateState.effectiveRate,1);
  assert.equal(b.playbackRateState.effectiveRate,2);
  assert.equal(b.playbackRateState.confirmed,false);
  a.syncPlaybackRateFromVideo({playbackRate:8});
  assert.equal(a.playbackRateState.observedRate,8);
  assert.equal(a.playbackRateState.effectiveRate,4);
});
test('v160 shared pure policy keeps PCDN, source-port, live and signed-resource boundaries', () => {
  const p=createMediaUrlPolicy();
  assert.equal(p.classify('//n.mountaintoys.cn/upgcxcode/v.m4s').kind,'pcdn');
  assert.equal(p.classify('https://upos-sz-mirroraliov.bilivideo.com:8443/upgcxcode/v.m4s').kind,'suspected-pcdn');
  assert.equal(p.decide('https://n.mountaintoys.cn/v1/resource/v.m4s').action,'pass');
  assert.equal(p.decide('https://n.bilivideo.com/live-bvc/v.m4s').action,'pass');
  assert.equal(p.parse('https://n.bilivideo.com/'+ 'x'.repeat(16384)),null);
});
test('v160 fixed historical fixtures remain byte-identical including v155 final timeout guards', () => {
  const manifest=JSON.parse(readFileSync('tests/fixtures/SHA256.json','utf8'));
  for(const [name,expected]of Object.entries(manifest))assert.equal(createHash('sha256').update(readFileSync('tests/fixtures/'+name)).digest('hex'),expected,name);
  assert.equal(manifest['BiliCDN_TW_1.5.5.user.js'],'fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f');
});
test('v160 importing all main modules does not read GM, Worker, DOM or install network/timers', async () => {
  const result=await esbuild.build({...buildOptions,stdin:{contents:"import './src/main.mjs'",resolveDir:process.cwd()},plugins:[{
    name:'unused-worker',setup(b){b.onResolve({filter:/^bilicdn:worker$/},()=>({path:'worker',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const WORKER_SOURCE="";'}));}
  }]});
  assert.doesNotThrow(()=>vm.runInNewContext(result.outputFiles[0].text,{}));
});
test('v160 only test builds contain the module-state bridge; UI has no raw GM access',()=>{
  const code=readFileSync('dist/BiliCDN_TW.user.js','utf8');
  assert.doesNotMatch(code,/TEST_BRIDGE|TEST_EXPORTS|Object\.defineProperty\(globalThis, key/);
  assert.doesNotMatch(code,/\.toString\(\)\}\)|sourceMappingURL=|\b(?:require\(|process\.|node:)/);
  assert.doesNotMatch(code,/static\s*\{/);
  for(const file of ['src/ui/trusted.mjs','src/ui/control-center.mjs'])assert.doesNotMatch(readFileSync(file,'utf8'),/\bGM_(?:get|set|delete)Value\b|TRUSTED_XHR_TIMEOUT_EVIDENCE/);
});
