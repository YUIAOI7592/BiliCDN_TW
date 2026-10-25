import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { filesUnder } from './lib.mts'
import { performance } from 'node:perf_hooks'
import { build as bundle } from 'esbuild'
import { build } from './build.mts'
import { supervise } from './test-process.mts'
import {
  baseline,
  jobs,
  parseArgs,
  proof,
  hash,
  validResult,
  summarize,
} from './diagnostics-cost/model.mts'
import type { Measurement } from './diagnostics-cost/model.mts'

export async function evaluateDiagnostics(profile = false) {
  const toolHashes = Object.fromEntries(
    [
      'scripts/diagnostics-cost.mts',
      ...filesUnder('scripts/diagnostics-cost'),
      ...filesUnder('scripts/upstream-compare'),
      'scripts/test-process.mts',
      'scripts/build.mts',
      'tests-v2/support/diagnostics-cost.ts',
      'tests-v2/support/clock.ts',
    ]
      .sort()
      .map((path) => [path, hash(readFileSync(path))]),
  )
  const inputHash = hash(readFileSync('tests-v2/support/diagnostics-cost.ts'))
  const sourceHash = hash(readFileSync('src-v2/diagnostics/recorder.ts'))
  const dir = mkdtempSync(join(tmpdir(), 'bilicdn-diagnostics-'))
  try {
    const archive = execFileSync('git', ['archive', '--format=tar', baseline.commit, 'src-v2'], {
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    const root = join(dir, 'baseline')
    mkdirSync(root)
    execFileSync('tar', ['-xf', '-', '-C', root], { input: archive, windowsHide: true })
    let releasePath = `Release/v${baseline.version}/BiliCDN_TW.user.js`
    let released: Buffer
    try {
      released = readFileSync(releasePath)
    } catch {
      releasePath = `archive/retired/releases/Release/v${baseline.version}/BiliCDN_TW.user.js`
      released = readFileSync(releasePath)
    }
    proof(released, baseline.bytes, baseline.sha256)
    const product = await build({ write: false })
    const candidate = Buffer.from(product.output)
    const inputs = {
      baseline: { data: released, root },
      candidate: { data: candidate, root: process.cwd() },
    }
    for (const [side, input] of Object.entries(inputs)) {
      writeFileSync(join(dir, side + '.user.js'), input.data)
      await bundle({
        stdin: {
          contents: `import {DiagnosticRecorder} from ${JSON.stringify(join(input.root, 'src-v2/diagnostics/recorder.ts'))};
        import {exercise} from ${JSON.stringify(resolve('tests-v2/support/diagnostics-cost.ts'))};
        export function create(rate, workload) { let now = 2000000000000; const recorder = new DiagnosticRecorder(() => now, () => true);
          return i => { now += 1000; return exercise(recorder, workload, now, i, rate); }; }`,
          resolveDir: process.cwd(),
        },
        outfile: join(dir, side + '.mjs'),
        bundle: true,
        platform: 'node',
        format: 'esm',
        keepNames: true,
        logLevel: 'silent',
      })
    }
    const results: Measurement[] = []
    let suite = '',
      suiteStarted = 0
    for (const job of jobs(profile)) {
      const nextSuite = job.rate + '/' + job.workload
      if (suite !== nextSuite) {
        suite = nextSuite
        suiteStarted = performance.now()
      }
      const remaining = 60000 - (performance.now() - suiteStarted)
      const data = inputs[job.side as keyof typeof inputs].data
      const config = {
        ...job,
        profile,
        script: join(dir, job.side + '.user.js'),
        recorder: join(dir, job.side + '.mjs'),
        bytes: data.length,
        sha256: hash(data),
        recorderBytes: readFileSync(join(dir, job.side + '.mjs')).length,
        recorderSha256: hash(readFileSync(join(dir, job.side + '.mjs'))),
      }
      const configPath = join(dir, 'worker.json')
      writeFileSync(configPath, JSON.stringify(config))
      if (remaining <= 0) {
        results.push({ ...job, validity: 'invalid', reason: 'suite-timeout' })
        continue
      }
      const child = await supervise(
        process.execPath,
        ['scripts/diagnostics-cost/worker.mts', configPath],
        { timeoutMs: Math.min(10000, remaining) },
      )
      let result: unknown
      try {
        result = JSON.parse(
          child.stdout
            .split('\n')
            .find((l) => l.startsWith('DIAGNOSTICS_RESULT '))
            ?.slice('DIAGNOSTICS_RESULT '.length) ?? 'null',
        )
      } catch {
        result = null
      }
      if (
        child.code !== 0 ||
        child.reason ||
        child.error ||
        !validResult(result) ||
        result.rate !== job.rate ||
        result.workload !== job.workload ||
        result.side !== job.side
      ) {
        results.push({
          ...job,
          validity: 'invalid',
          reason: child.reason ?? child.error ?? 'worker-protocol',
        })
        process.stderr.write(child.stderr + child.stdout.slice(-3000))
      } else results.push({ ...result, ...job })
    }
    for (const [path, expected] of Object.entries(toolHashes))
      if (hash(readFileSync(path)) !== expected)
        throw Error('Tool source changed during measurement')
    return {
      schemaVersion: 2,
      mode: profile ? 'profile' : 'cost',
      baseline,
      candidate: { bytes: candidate.length, sha256: hash(candidate) },
      sourceHashes: product.manifest.sources,
      baselineSource: { bytes: archive.length, sha256: hash(archive) },
      toolHashes,
      tools: product.manifest.tools,
      node: process.version,
      inputHash,
      sourceHash,
      results,
      summary: summarize(results, profile),
    }
  } finally {
    const target = resolve(dir),
      parent = resolve(tmpdir())
    if (
      !target.startsWith(parent + sep) ||
      !target.split(sep).at(-1)?.startsWith('bilicdn-diagnostics-')
    )
      throw Error('Unsafe diagnostics cleanup')
    rmSync(target, { recursive: true })
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/diagnostics-cost.mts')) {
  const options = parseArgs(process.argv.slice(2))
  const result = await evaluateDiagnostics(options.profile)
  console.log(options.json ? JSON.stringify(result) : JSON.stringify(result.summary, null, 2))
  if (result.results.some((r) => r.validity !== 'valid') || !result.summary.semanticEquality)
    process.exitCode = 1
}
