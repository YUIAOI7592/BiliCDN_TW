import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'
import { isDeepStrictEqual } from 'node:util'
import { build as buildProduct } from './build.mts'
import { supervise } from './test-process.mts'
import { filesUnder, isRecord, errorMessage } from './lib.mts'
import { sha256 } from './upstream-compare/model.mts'
import {
  parseEvaluationArgs,
  scenarioNames,
  scoreWindow,
  readingVersion,
  candidateContinuity,
} from './buffer-shadow/model.mts'
import type { EvidenceRow } from './buffer-shadow/model.mts'
import { costInputs, v3CostInputs, loadCostInput } from './buffer-shadow/inputs.mts'
import type { CostInput } from './buffer-shadow/inputs.mts'

export function validEvaluationResult(
  value: unknown,
  cost: boolean,
): value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    value.validity !== 'valid' ||
    !['pass', 'fail'].includes(String(value.verdict)) ||
    !isRecord(value.cleanup)
  )
    return false
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  const ticks = value.tickMs
  if (cost)
    return (
      isRecord(ticks) &&
      Array.isArray(ticks.samples) &&
      ticks.samples.length === 600 &&
      ticks.samples.every((n) => finite(n) && n >= 0) &&
      ['min', 'median', 'p95', 'max'].every((k) => finite(ticks[k])) &&
      isRecord(value.heapBytes) &&
      isRecord(value.cpuMicroseconds) &&
      Object.values(value.heapBytes).every(finite) &&
      Object.values(value.cpuMicroseconds).every(finite) &&
      finite(value.startupMs) &&
      value.measurementMs === 600000 &&
      isRecord(value.cleanup.after) &&
      Object.values(value.cleanup.after).every((n) => n === 0) &&
      value.cleanup.unclassified === 0 &&
      value.cleanup.callbacksAfterClose === 0
    )
  if (
    !Array.isArray(value.rows) ||
    !Array.isArray(value.inputs) ||
    value.rows.length !== value.inputs.length ||
    !value.rows.length ||
    !Array.isArray(value.assertions) ||
    !value.assertions.length ||
    !isRecord(value.score) ||
    !Array.isArray(value.prelude) ||
    value.prelude.length !== 61 ||
    value.warmupMs !== 60000
  )
    return false
  try {
    const rows = value.rows as EvidenceRow[]
    if (!value.rows.every(isRecord)) return false
    const version = readingVersion(value.rows[0]?.trend)
    if (
      !version ||
      !value.rows.every((r) => readingVersion(r.trend) === version) ||
      !value.prelude.every((r) => isRecord(r) && readingVersion(r.trend) === version)
    )
      return false
    if (value.algorithm !== undefined && value.algorithm !== `buffer-window-v${version}`)
      return false
    if (
      !value.rows.every(
        (row) =>
          isRecord(row.trend) &&
          row.candidate === row.trend.candidate &&
          row.state === row.trend.state &&
          row.reason === row.trend.reason &&
          readingVersion(row.trend) === version,
      )
    )
      return false
    const computed = scoreWindow(rows, {
      scoreUntil: rows.at(-1)!.at,
      stallAt: value.stallAt as number | null,
    })
    if (JSON.stringify(computed) !== JSON.stringify(value.score)) return false
  } catch {
    return false
  }
  if (
    !value.assertions.every(
      (a) =>
        isRecord(a) &&
        'expected' in a &&
        'actual' in a &&
        a.verdict === (isDeepStrictEqual(a.expected, a.actual) ? 'pass' : 'fail'),
    )
  )
    return false
  const verdict = value.assertions.every((a) => isRecord(a) && a.verdict === 'pass')
    ? 'pass'
    : 'fail'
  return (
    value.verdict === verdict && value.cleanup.timers === 0 && value.cleanup.subscriptions === 0
  )
}
export async function evaluateBufferShadow(
  cost = false,
  comparison: 'legacy' | 'v3' | 'source' = 'legacy',
) {
  let suiteStarted = performance.now(),
    activeSuite = ''
  const results: Record<string, unknown>[] = []
  for (const input of costInputs) loadCostInput(input.version)
  const dir = mkdtempSync(join(tmpdir(), 'bilicdn-shadow-'))
  try {
    let inputs: readonly CostInput[] = comparison === 'legacy' ? costInputs : v3CostInputs
    if (comparison === 'source') {
      const source = Buffer.from((await buildProduct({ write: false })).output)
      const input = {
        version: 'working-source',
        path: join(dir, 'working.user.js'),
        bytes: source.length,
        sha256: sha256(source),
      }
      writeFileSync(input.path, source)
      inputs = [v3CostInputs[1]!, input]
    }
    for (const input of inputs.filter((i) => i.version !== 'working-source'))
      loadCostInput(input.version)
    const worker = cost ? 'scripts/buffer-shadow/cost-worker.mts' : join(dir, 'worker.mjs')
    if (!cost)
      await build({
        entryPoints: ['tests-v2/support/buffer-shadow-worker.ts'],
        outfile: worker,
        bundle: true,
        platform: 'node',
        format: 'esm',
        sourcemap: 'inline',
        logLevel: 'silent',
      })
    const jobs: { args: string[]; warmup: boolean; id: string; pair: number | null }[] = []
    if (cost)
      for (const rate of [1, 2])
        for (let pair = -2; pair < 10; pair++)
          for (const input of pair % 2 === 0 ? inputs : inputs.slice().reverse())
            jobs.push({
              args: [
                input.version,
                String(rate),
                ...(input.version === 'working-source'
                  ? [input.path, String(input.bytes), input.sha256]
                  : []),
              ],
              warmup: pair < 0,
              id: `${input.version}@${rate}x/pair-${pair}`,
              pair,
            })
    else
      for (const name of scenarioNames)
        for (const rate of [1, 2])
          jobs.push({
            args: [name, String(rate)],
            warmup: false,
            id: `${name}@${rate}x`,
            pair: null,
          })
    for (const job of jobs) {
      // Rate-specific cost suites each contain the predeclared 2 warmup + 10 measured pairs.
      // Each suite retains the same 60s bound; no individual measurement gets more time.
      const suite = cost ? `cost-${job.args[1]}x` : 'functional'
      if (suite !== activeSuite) {
        activeSuite = suite
        suiteStarted = performance.now()
      }
      const remaining = 60000 - (performance.now() - suiteStarted)
      if (remaining <= 0) {
        results.push({
          id: job.id,
          suite,
          warmup: job.warmup,
          pair: job.pair,
          validity: 'invalid',
          verdict: 'undetermined',
          reason: 'suite-timeout',
          exitCode: null,
        })
        continue
      }
      const child = await supervise(process.execPath, [worker, ...job.args], {
        timeoutMs: Math.max(1, Math.min(10000, remaining)),
      })
      const line = child.stdout.split('\n').find((l) => l.startsWith('SHADOW_RESULT '))
      let value: unknown = null
      try {
        value = line ? JSON.parse(line.slice('SHADOW_RESULT '.length)) : null
      } catch {
        /* Preserves invalid protocol. */
      }
      if (!validEvaluationResult(value, cost) || child.reason || child.error)
        results.push({
          id: job.id,
          suite,
          pair: job.pair,
          warmup: job.warmup,
          validity: 'invalid',
          verdict: 'undetermined',
          reason: child.reason ?? child.error ?? 'worker-protocol',
          exitCode: child.code,
        })
      else
        results.push({
          ...value,
          ...(!cost && Array.isArray(value.rows)
            ? {
                continuity: candidateContinuity(value.rows as EvidenceRow[], {
                  scoreUntil: (value.rows as EvidenceRow[]).at(-1)!.at,
                  stallAt: value.stallAt as number | null,
                }),
              }
            : {}),
          id: job.id,
          suite,
          pair: job.pair,
          warmup: job.warmup,
          exitCode: child.code,
        })
    }
    const sourceHashes = Object.fromEntries(
      ['src-v2', 'scripts/buffer-shadow', 'scripts/upstream-compare']
        .flatMap((d) => filesUnder(d))
        .concat([
          'scripts/buffer-shadow-evaluation.mts',
          'tests-v2/support/buffer-shadow-scenarios.ts',
          'tests-v2/support/buffer-shadow-worker.ts',
          'tests-v2/support/buffer-monitor.ts',
          'tests-v2/support/clock.ts',
        ])
        .sort()
        .map((p) => [p, sha256(readFileSync(p))]),
    )
    return {
      schemaVersion: 1,
      baseline:
        cost && comparison !== 'legacy'
          ? '67b45c4eaca15a0fcca230c6011943a98e99072c'
          : cost
            ? '39c21b5f272eda2f8090f079770ad129e1545dd0'
            : 'cfc15924c40f688518e78be417909b69558ce4d5',
      mode: cost ? (comparison === 'legacy' ? 'cost' : `cost-${comparison}`) : 'functional',
      node: process.version,
      limits: { caseMs: 5000, cleanupMs: 5000, suiteMs: 60000, maxBytes: 33554432 },
      assumptions: [
        'offline synthetic progress',
        'foreground model',
        '60s healthy prelude',
        cost
          ? 'published-version defaults'
          : 'buffer-window-v3: fixed 8s/2s/10s base; cumulative 2s new-low intervals',
        cost
          ? comparison === 'source'
            ? 'published v2.1.29 versus hashed working source'
            : 'unmodified release scripts'
          : 'current v3 source; no rescue changes',
      ],
      inputs,
      sourceHashes,
      results,
      exitCode: results.every(
        (r) => r.validity === 'valid' && r.verdict === 'pass' && r.exitCode === 0,
      )
        ? 0
        : 1,
    }
  } finally {
    const target = resolve(dir),
      parent = resolve(tmpdir())
    if (
      !target.startsWith(parent + sep) ||
      !target.split(sep).at(-1)?.startsWith('bilicdn-shadow-')
    )
      throw Error('Unsafe evaluation temporary directory')
    rmSync(target, { recursive: true })
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/buffer-shadow-evaluation.mts')
) {
  let options: ReturnType<typeof parseEvaluationArgs> | undefined
  try {
    options = parseEvaluationArgs(process.argv.slice(2))
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 2
  }
  if (options)
    try {
      const report = await evaluateBufferShadow(options.cost, options.comparison)
      if (options.json) console.log(JSON.stringify(report))
      else {
        for (const row of report.results)
          console.log(
            `${row.id}\t${row.validity}\t${row.verdict}\t${JSON.stringify(row.score ?? row.tickMs ?? row.reason)}`,
          )
        console.log(
          `Executions ${report.results.length}; exit ${report.exitCode}; model results only.`,
        )
      }
      process.exitCode = report.exitCode
    } catch (error) {
      console.error(errorMessage(error))
      process.exitCode = 1
    }
}
