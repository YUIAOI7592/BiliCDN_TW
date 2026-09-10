import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const buildOptions = Object.freeze({
  bundle: true, platform: 'browser', format: 'iife', splitting: false,
  target: 'esnext', minify: false, treeShaking: false, keepNames: true,
  charset: 'utf8', legalComments: 'inline', write: false,
  // keepNames must not introduce a new static-block browser requirement.
  supported: { 'class-static-blocks': false },
});
const hash = value => createHash('sha256').update(value).digest('hex');

export async function build({ testing = false, sourceTransform, write = true } = {}) {
  const release = JSON.parse(readFileSync('release.json', 'utf8'));
  if (esbuild.version !== release.esbuildVersion) throw Error('Unexpected esbuild version');
  const worker = await esbuild.build({ ...buildOptions, entryPoints: ['src/worker/entry.mjs'], metafile: true });
  const workerSource = worker.outputFiles[0].text;
  const testExports = testing ? JSON.parse(readFileSync('tests/harness/module-exports.json', 'utf8')) : null;
  const plugins = [{ name: 'private-worker-source', setup(build) {
    build.onResolve({ filter: /^bilicdn:worker$/ }, () => ({ path: 'worker', namespace: 'embedded' }));
    build.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({ contents: `export const WORKER_SOURCE = ${JSON.stringify(workerSource)};`, loader: 'js' }));
    build.onLoad({ filter: /\.mjs$/ }, args => {
      let contents = readFileSync(args.path, 'utf8');
      if (!testing) return { contents: contents.replace(/\/\* TEST_(?:EXPORTS:\w+|BRIDGE) \*\//g, ''), loader: 'js' };
      if (sourceTransform) contents = sourceTransform(contents);
      contents = contents.replace(/\/\* TEST_EXPORTS:(\w+) \*\//g, (marker, group, offset) => {
        const existing = contents.slice(offset + marker.length);
        return testExports[group].filter(({name}) => !existing.includes(`get ${name}()`)).map(({name,mutable}) =>
          `get ${name}(){return ${name}},${mutable?`set ${name}(v){${name}=v},`:''}`).join('\n');
      });
      contents = contents.replace('/* TEST_BRIDGE */',
        `for (const instance of [${Object.keys(testExports).join(',')}]) { for(const key of Object.keys(instance)) Object.defineProperty(globalThis, key, {...Object.getOwnPropertyDescriptor(instance,key), configurable:true}); }`);
      return { contents, loader: 'js' };
    });
  }}];
  const result = await esbuild.build({ ...buildOptions, metafile: true,
    stdin: { contents: "import { start } from './src/main.mjs'; start(__BiliCDNSettings);", resolveDir: process.cwd(), sourcefile: 'entry.mjs' }, plugins,
    sourcemap: 'external', outfile: 'dist/BiliCDN_TW.user.js',
  });
  let settings = readFileSync('src/settings.txt', 'utf8');
  if (sourceTransform) settings = sourceTransform(settings);
  const metadata = readFileSync('src/metadata.txt','utf8').replace(/(@version\s+)\S+/, `$1${release.version}`);
  const code = result.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const output = `${metadata}\n(function () {\n${settings}\nconst __BiliCDNSettings = { CustomCDN, ExcludeHostKeywords, BlockHttpDNS, PreferredVideoCodec, BlockWebRTC, EnableWorkerIntercept };\n${code}\n})();\n`;
  const inputs = [...new Set([...Object.keys(worker.metafile.inputs), ...Object.keys(result.metafile.inputs)].filter(p=>p.startsWith('src/')))].sort();
  for (const p of ['src/metadata.txt','src/settings.txt','scripts/build.mjs','package.json','package-lock.json','release.json']) if(!inputs.includes(p))inputs.push(p);
  inputs.sort();
  const manifest = { version: release.version, tools: { node: process.versions.node, npm: release.npmVersion, esbuild: esbuild.version }, options: buildOptions,
    sources: Object.fromEntries(inputs.map(p=>[p,hash(readFileSync(p))])), workerSha256: hash(workerSource), userscriptSha256: hash(output) };
  if (write) {
    mkdirSync('dist', {recursive:true});
    writeFileSync(`dist/BiliCDN_TW${testing?'.test':''}.user.js`, output);
    if(!testing) {
      writeFileSync('dist/build-manifest.json', JSON.stringify(manifest,null,2)+'\n');
      writeFileSync('dist/BiliCDN_TW.user.js.map', result.outputFiles.find(f=>f.path.endsWith('.map')).contents);
    }
  }
  return { output, manifest };
}

if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/build.mjs')) {
  await build();
  await build({testing:true});
  console.log('Built one private userscript and a separate, non-release test entry.');
}
