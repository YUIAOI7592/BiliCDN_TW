import { readFileSync, mkdirSync, mkdtempSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from './build.mjs';
import { runTests } from './test.mjs';
import { command, sha256, readJson, filesUnder } from './lib.mjs';

export function verifyPatches(config,dir,script){
 const workspace=process.cwd(),scratch=mkdtempSync(join(tmpdir(),'bilicdn-verify-'));
 try{
  for(const [label,from]of [[config.previousVersion,config.previousPath||`tests/fixtures/BiliCDN_TW_${config.previousVersion}.user.js`],[config.upstreamVersion,`baseline/BiliCDN_TW_${config.upstreamVersion}.original.user.js`]]){
   const cwd=join(scratch,label);mkdirSync(dirname(join(cwd,from)),{recursive:true});copyFileSync(from,join(cwd,from));
   const patch=resolve(dir,`v${label}_to_v${config.version}.patch.diff`);
   command('git',['-c','core.autocrlf=false','apply','--check',patch],{cwd});
   command('git',['-c','core.autocrlf=false','apply',patch],{cwd});
   if(sha256(readFileSync(join(cwd,script)))!==sha256(readFileSync(join(workspace,script))))throw Error('Applied patch mismatch');
  }
 }finally{
  const absolute=resolve(scratch),parent=resolve(tmpdir());
  if(!absolute.startsWith(parent+sep)||!absolute.split(sep).at(-1).startsWith('bilicdn-verify-'))throw Error('Refusing unsafe cleanup');
  rmSync(absolute,{recursive:true});
 }
}
export async function verify(){
 const config=readJson('release.json'),dir=`Release/v${config.version}`,script=`${dir}/${config.artifactName||`BiliCDN_TW_${config.version}.user.js`}`;
 if(process.versions.node!==config.nodeVersion)throw Error(`Validated Node version is ${config.nodeVersion}; found ${process.versions.node}`);
 for(const [file,digest]of Object.entries(readJson('tests/fixtures/SHA256.json')))if(sha256(readFileSync('tests/fixtures/'+file))!==digest)throw Error('Fixture changed: '+file);
 const first=await build({write:false}),second=await build();await build({testing:true});
 if(first.output!==second.output||JSON.stringify(first.manifest)!==JSON.stringify(second.manifest))throw Error('Build not reproducible');
 command(process.execPath,['--check','dist/BiliCDN_TW.user.js']);
 for(const source of filesUnder('src').filter(p=>p.endsWith('.mjs')))command(process.execPath,['--check',source]);
 if(!existsSync(script)||readFileSync(script,'utf8')!==second.output)throw Error('Release differs from build; run npm run package');
 process.env.BILICDN_TEST_TARGET=resolve(script);
 runTests({functional:true});
 verifyPatches(config,dir,script);
 const manifest=readFileSync(`${dir}/SHA256SUMS_v${config.version}.txt`,'utf8');
 for(const row of manifest.trim().split('\n')){
  const match=/^([a-f0-9]{64})  (.+)$/.exec(row);if(!match)throw Error('Invalid checksum entry');
  const file=match[2];if(!file.startsWith(dir+'/')||file.includes('..')||sha256(readFileSync(file))!==match[1])throw Error('SHA mismatch: '+file);
 }
 const tracked=command('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'ls-files']).trim().split('\n');
 if(tracked.some(p=>/^(archive|development|review|security|\.work|node_modules|dist)\/|\.github\/workflows\//.test(p)))throw Error('Private/build/CI files are tracked');
 console.log('Verified syntax, immutable fixtures, deterministic build, functional regressions, both applied patches, checksums and tracked exclusions. No security scan or security subset executed.');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/verify.mjs'))await verify();
