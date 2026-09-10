import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
export function command(command,args,options={}){
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:32*1024*1024,...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}
export function filesUnder(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesUnder(`${dir}/${e.name}`):[`${dir}/${e.name}`]).sort();}
