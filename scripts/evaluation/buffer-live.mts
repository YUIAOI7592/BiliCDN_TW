import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { evaluateLiveWindows } from './buffer-shadow/live-report.mts'
import type { LiveWindow } from './buffer-shadow/live-report.mts'
import { riskCoverageReport } from './buffer-shadow/risk-report.mts'
import { evaluateSupply } from './buffer-risk-evaluation.mts'
import { evaluateDecision } from './buffer-adoption-decision.mts'

export function parseLiveArgs(args: readonly string[]) {
  let input: string | undefined,
    serve = false,
    json = false,
    risk = false,
    supply = false,
    decision = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--input' && input === undefined && args[i + 1] && !args[i + 1]!.startsWith('--'))
      input = args[++i]
    else if (a === '--serve' && !serve) serve = true
    else if (a === '--json' && !json) json = true
    else if (a === '--risk' && !risk) risk = true
    else if (a === '--supply' && !supply) supply = true
    else if (a === '--decision' && !decision) decision = true
    else
      throw Error(
        'Usage: npm run evaluate:buffer-live -- (--input <evidence.json> [--risk] [--json] | --supply [--json] | --decision [--json] | --serve)',
      )
  }
  if (
    (serve ? 1 : 0) + (input !== undefined ? 1 : 0) + (supply ? 1 : 0) + (decision ? 1 : 0) !== 1 ||
    (serve && json) ||
    (risk && (serve || supply || decision || input === undefined))
  )
    throw Error('Choose input or serve')
  return {
    input,
    serve,
    json,
    ...(risk ? { risk: true } : {}),
    ...(supply ? { supply: true } : {}),
    ...(decision ? { decision: true } : {}),
  }
}
export function analyzeLiveRisk(value: unknown) {
  const original = replayLiveEvidence(value)
  return {
    schemaVersion: 1,
    mode: 'risk',
    original,
    coverage: riskCoverageReport((value as { windows: LiveWindow[] }).windows),
    productActionAuthorized: false,
    exitCode: original.exitCode,
  }
}
export function replayLiveEvidence(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid live evidence envelope')
  const v = value as Record<string, unknown>
  const source = v.source as Record<string, unknown> | undefined
  if (
    v.schemaVersion !== 1 ||
    v.baseline !== 'd0c2c8c3dcc61e6db76531d560dfbc2a12d7fd98' ||
    !Array.isArray(v.windows) ||
    !source ||
    source.version !== '2.1.35' ||
    source.bytes !== 422022 ||
    source.sha256 !== '7458f27610a0b2a9f13e07c1e087502198809dacb2a411f5112acf9aaf3b9cc3'
  )
    throw Error('Invalid live evidence provenance')
  return evaluateLiveWindows(v.windows as LiveWindow[])
}
export async function calibrationAssets() {
  const built = await build({
    stdin: {
      contents:
        "export {startBrowserObservation} from './scripts/evaluation/buffer-shadow/live-browser.mts'",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'BufferLiveTools',
    write: false,
    target: 'es2022',
  })
  const script = built.outputFiles[0]!.text
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Buffer observation calibration</title>
<h1>Read-only observation collector calibration</h1><p id="status">Ready. No GM storage, network transport or product controller.</p>
<script src="/tool.js"></script><script>
const started=performance.now();let listeners=[],routeListeners=[],producer=null,exit=null,current=null,serial=0;
const runtime={monitor:{subscribe(fn){listeners.push(fn);return()=>{listeners=listeners.filter(x=>x!==fn)}}},
routes:{subscribe(fn){routeListeners.push(fn);return()=>{routeListeners=routeListeners.filter(x=>x!==fn)}},latestRequested(){return null},isOriginalComparison(){return false}},
player:{controls(){return {mediaId:1,coreId:1,userRevision:0,seekRevision:0,reloadRevision:0,coreReloadRevision:0}}},
session:{get(){return {generation:1,epoch:1}}},settings:{get(){return {disabled:false,fixedHost:null}}},recovery:{isRecovering(){return false}},visibility:{isActuallyVisible(){return true}}};
const env={now:()=>performance.now(),wall:()=>Date.now(),timeout(fn,ms){const id=setTimeout(fn,ms);return()=>clearTimeout(id)},onExit(fn){addEventListener('pagehide',fn);return()=>removeEventListener('pagehide',fn)}};
window.calibration={start(){if(current)throw Error('fresh calibration required');current=BufferLiveTools.startBrowserObservation(runtime,env,1,60000);producer=setInterval(()=>{
const at=Date.now(),n=++serial,v={available:true,paused:false,seeking:false,ended:false,mediaError:false,bufferedToEnd:false,currentTime:100+n,frames:n*30,playbackRate:1};
listeners.slice().forEach(fn=>fn({video:v,bufferTrend:{schemaVersion:6,algorithm:'buffer-window-v6',at,reason:'stable',candidate:false,endBufferSec:12}}));
if(n%5===0)routeListeners.slice().forEach(fn=>fn({type:'request-started',at,request:{requestId:'owned-'+n,kind:'video'}}));
},1000);return current.status()},drain(after=0,limit=1000){return current.drain(after,limit)},stop(){current?.stop();clearInterval(producer);producer=null;return this.status()},status(){return {session:current?.status()??null,fixture:{producer:producer===null?0:1,monitorListeners:listeners.length,routeListeners:routeListeners.length,elapsedMs:performance.now()-started}}}};
</script></html>`
  return { script, html }
}
export async function serveCalibration() {
  const assets = await calibrationAssets()
  const server = createServer((request, response) => {
    const asset =
      request.url === '/'
        ? ['text/html; charset=utf-8', assets.html]
        : request.url === '/tool.js'
          ? ['text/javascript; charset=utf-8', assets.script]
          : null
    response.writeHead(asset ? 200 : 404, {
      'Content-Type': asset?.[0] ?? 'text/plain',
      'Cache-Control': 'no-store',
    })
    response.end(asset?.[1] ?? 'Not found')
  })
  await new Promise<void>((ok, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', ok)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('Calibration address unavailable')
  console.log(
    JSON.stringify({
      origin: `http://127.0.0.1:${address.port}`,
      gm: false,
      assets: Object.fromEntries(
        Object.entries(assets).map(([key, value]) => [
          key,
          {
            bytes: Buffer.byteLength(value),
            sha256: createHash('sha256').update(value).digest('hex'),
          },
        ]),
      ),
    }),
  )
  const stop = () => server.close()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  return server
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/evaluation/buffer-live.mts')) {
  let options: ReturnType<typeof parseLiveArgs> | undefined
  try {
    options = parseLiveArgs(process.argv.slice(2))
  } catch {
    console.error('Invalid buffer live arguments')
    process.exitCode = 2
  }
  if (options)
    try {
      if (options.serve) await serveCalibration()
      else if (options.decision) {
        const report = await evaluateDecision()
        console.log(
          options.json
            ? JSON.stringify(report)
            : `${report.decision.recommendation}; paired rates ${report.results.length}; exit ${report.exitCode}; product action unauthorized.`,
        )
        process.exitCode = report.exitCode
      } else if (options.supply) {
        const report = await evaluateSupply()
        console.log(
          options.json
            ? JSON.stringify(report)
            : `Supply executions ${report.results.length}; exit ${report.exitCode}; synthetic only.`,
        )
        process.exitCode = report.exitCode
      } else {
        if (statSync(options.input!).size > 64 * 1024 * 1024)
          throw Error('Live evidence exceeds 64 MiB')
        const value: unknown = JSON.parse(readFileSync(options.input!, 'utf8'))
        const result = replayLiveEvidence(value)
        const risk = options.risk ? analyzeLiveRisk(value) : null
        console.log(
          options.json
            ? JSON.stringify(risk ?? result)
            : `${result.adoption.decision}; valid windows ${result.adoption.facts.windows}/12; exit ${result.exitCode}${risk ? '; risk ' + risk.coverage.utilityCoverage : ''}`,
        )
        process.exitCode = result.exitCode
      }
    } catch {
      console.error('Live evidence or calibration failed')
      process.exitCode = 1
    }
}
