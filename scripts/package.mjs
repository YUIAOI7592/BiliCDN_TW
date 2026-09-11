import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from './build.mjs';
import { sha256, readJson, filesUnder } from './lib.mjs';

export async function packageRelease(){
 const config=readJson('release.json'),version=config.version;
 if(version===config.previousVersion)throw Error('Do not package until modular extraction is accepted and version is bumped');
 const dir=`Release/v${version}`;
 const previous=config.previousPath||`tests/fixtures/BiliCDN_TW_${config.previousVersion}.user.js`;
 const upstream=`baseline/BiliCDN_TW_${config.upstreamVersion}.original.user.js`;
 if(sha256(readFileSync(previous))!==config.previousSha256||sha256(readFileSync(upstream))!==config.upstreamSha256)throw Error('Immutable input hash mismatch');
 const result=await build();await build({testing:true});mkdirSync(dir,{recursive:true});
 const script=`${dir}/${config.artifactName||`BiliCDN_TW_${version}.user.js`}`;
 writeFileSync(script,result.output);
 copyFileSync('dist/build-manifest.json',`${dir}/BUILD_MANIFEST_v${version}.json`);
 for(const [label,from]of [[config.previousVersion,previous],[config.upstreamVersion,upstream]]){
  const diff=spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--binary','--',from,script],{encoding:'utf8',maxBuffer:32*1024*1024});
  if(diff.error||diff.status!==1||!diff.stdout.startsWith('diff --git '))throw diff.error||Error('No-index diff failed: '+diff.stderr);
  writeFileSync(`${dir}/v${label}_to_v${version}.patch.diff`,diff.stdout);
 }
 writeSums(dir,version);
 return {dir,script};
}
export function writeSums(dir,version){
 const manifest=`${dir}/SHA256SUMS_v${version}.txt`;
 const rows=filesUnder(dir).filter(f=>f!==manifest).map(file=>`${sha256(readFileSync(file))}  ${file}`);
 writeFileSync(manifest,rows.join('\n')+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/package.mjs')){
 const result=await packageRelease();console.log(`Packaged ${result.script}; this does not publish or install it.`);
}
