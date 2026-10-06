import * as esbuild from 'esbuild'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { filesUnder } from './lib.mjs'
import { supervise } from './test-process.mjs'
export const purityTraps = ['window','document','unsafeWindow','location','history','navigator','performance','fetch',
  'XMLHttpRequest','Worker','setTimeout','setInterval','clearTimeout','clearInterval','queueMicrotask','GM_getValue',
  'GM_setValue','GM_deleteValue','GM_addValueChangeListener','GM_removeValueChangeListener','GM_registerMenuCommand']
export async function inspectImportPurity(sources = filesUnder('src-v2').filter(path => path.endsWith('.ts') && !path.endsWith('entry.ts') && !path.endsWith('.d.ts'))) {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-purity-'))
  try {
    await esbuild.build({ stdin: { contents: sources.map(path => `import ${JSON.stringify(resolve(path))}`).join('\n'), resolveDir: process.cwd() },
      outfile: join(scratch, 'modules.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node26',
      treeShaking: false, ignoreAnnotations: true, sourcemap: 'inline', logLevel: 'silent' })
    writeFileSync(join(scratch, 'probe.mjs'), `const names = ${JSON.stringify(purityTraps)};
      const descriptors = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis,name)]);
      const now = Date.now, random = Math.random;
      try {
        for(const name of names) Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('Import side effect: '+name)}});
        Date.now = () => { throw Error('Import side effect: Date.now') };
        Math.random = () => { throw Error('Import side effect: Math.random') };
        await import('./modules.mjs');
      } finally {
        Date.now = now; Math.random = random;
        for(const [name,descriptor] of descriptors) { if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name] }
      }`)
    const result = await supervise(process.execPath, ['--enable-source-maps', join(scratch, 'probe.mjs')], { timeoutMs: 3000 })
    if (result.code !== 0 || result.reason || result.error) throw Error(`Import purity failed: ${result.reason ?? result.error ?? result.stderr}`)
    return { modules: sources.length, result }
  } finally {
    const target = resolve(scratch)
    if (!target.startsWith(resolve(tmpdir()) + sep) || !target.split(sep).at(-1)?.startsWith('bilicdn-purity-')) throw Error('Unsafe purity cleanup')
    rmSync(target, { recursive: true })
  }
}
