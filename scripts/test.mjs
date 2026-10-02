import * as esbuild from 'esbuild'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { command, filesUnder } from './lib.mjs'
import { testArchitectureRules } from './architecture-tests.mjs'
import { suites } from '../tests-v2/run.ts'

export async function runTests(filter = '') {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-v2-tests-'))
  try {
    if (!filter || filter === 'architecture') testArchitectureRules()
    if (!filter || filter === 'imports') {
      const modules = filesUnder('src-v2').filter(path => path.endsWith('.ts') && !path.endsWith('entry.ts') && !path.endsWith('.d.ts'))
      const imports = modules.map(path => `import './${path.replaceAll('\\', '/')}'`).join('\n')
      const moduleFile = join(scratch, 'modules.mjs')
      await esbuild.build({ stdin: { contents: imports, resolveDir: process.cwd() }, outfile: moduleFile,
        bundle: true, platform: 'node', format: 'esm', target: 'node26', treeShaking: false, ignoreAnnotations: true, logLevel: 'warning' })
      const harness = join(scratch, 'imports.mjs')
      writeFileSync(harness, `const names = ['window','document','unsafeWindow','location','history','navigator','performance','fetch','XMLHttpRequest','Worker','setTimeout','setInterval','clearTimeout','clearInterval','queueMicrotask','GM_getValue','GM_setValue','GM_deleteValue','GM_addValueChangeListener','GM_removeValueChangeListener','GM_registerMenuCommand'];
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
        }
        console.log('Import purity: ${modules.length} modules passed');`)
      process.stdout.write(command(process.execPath, [harness]))
    }
    const selected = suites.filter(name => !filter || name === filter || name === `suites/${filter}`)
    if (!selected.length && !['architecture', 'imports'].includes(filter)) throw Error(`Unknown test suite: ${filter}`)
    for (const name of selected) {
      const outfile = join(scratch, name.replaceAll('/', '-') + '.mjs')
      await esbuild.build({ stdin: { contents: `import './tests-v2/${name}.ts'`, resolveDir: process.cwd(), sourcefile: 'v2-tests.ts' },
        outfile, bundle: true, platform: 'node', format: 'esm', target: 'node26', logLevel: 'warning' })
      const output = command(process.execPath, [outfile])
      process.stdout.write(output)
    }
  } finally {
    const absolute = resolve(scratch), parent = resolve(tmpdir())
    if (!absolute.startsWith(`${parent}${sep}`) || !absolute.split(sep).at(-1)?.startsWith('bilicdn-v2-tests-')) throw Error('Refusing unsafe cleanup')
    rmSync(absolute, { recursive: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/test.mjs')) await runTests(process.argv[2] ?? '')
