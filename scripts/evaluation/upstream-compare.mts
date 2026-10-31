import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { supervise } from '../testing/test-process.mts'
import { errorMessage } from '../lib/lib.mts'
import { inputs, loadInput, commonHosts } from './upstream-compare/inputs.mts'
import {
  scenarios,
  outcomeCode,
  sha256,
  scenarioHash,
  comparisonMetrics,
  parseComparisonArgs,
  validCaseResult,
} from './upstream-compare/model.mts'
import type { CaseResult } from './upstream-compare/model.mts'

export async function compareUpstream(calibrationOnly = false) {
  for (const input of inputs) loadInput(input.version)
  const results: (CaseResult & { exitCode: number | null })[] = []
  for (const scenario of calibrationOnly ? (['healthy'] as const) : scenarios)
    for (const rate of [1, 2] as const)
      for (const input of inputs) {
        const child = await supervise(process.execPath, [
          'scripts/evaluation/upstream-compare/worker.mts',
          input.version,
          scenario,
          String(rate),
          calibrationOnly ? 'calibration' : 'compare',
        ])
        const line = child.stdout.split('\n').find((line) => line.startsWith('COMPARISON_RESULT '))
        let value: unknown = null
        try {
          value = line ? JSON.parse(line.slice('COMPARISON_RESULT '.length)) : null
        } catch {
          /* Invalid child output remains an invalid execution. */
        }
        const id = `${scenario}@${rate}x/${input.version}`
        const result: CaseResult = validCaseResult(value, id)
          ? value
          : {
              id,
              version: input.version,
              scenario,
              rate,
              scenarioHash: scenarioHash(scenario, rate),
              validity: 'invalid',
              verdict: 'undetermined',
              reasons: [
                `worker-result-unavailable:${child.reason ?? (child.error ? 'spawn-error' : 'protocol-or-case-error')}`,
              ],
              observations: [],
              assertions: [],
              calibration: [],
              cleanup: null,
              metrics: comparisonMetrics([], 0),
            }
        results.push({ ...result, exitCode: child.code })
      }
  return {
    schemaVersion: 1,
    productBaseline: 'f4ede7327c475c7013edda14cc0aacd7ff3ccee7',
    nodeVersion: process.versions.node,
    mode: calibrationOnly ? 'calibration' : 'comparison',
    model: {
      codec: 'avc',
      visibility: 'foreground-model',
      preludeMs: 60000,
      scenarioMs: 180000,
      mediaDurationSec: 3600,
      initialPositionSec: 120,
      fixtureBodyBytes: 65536,
      websiteRequestsPerMediaPerSecond: 1,
      websiteAutomaticRetries: false,
      randomSeed: 0x1badb002,
      candidatePolicy: 'version-defaults',
      progress: 'scheduled input, independent of SDK effects',
      dom: 'static player; settings anchor absent',
    },
    limits: { caseMs: 5000, cleanupMs: 5000, suiteMs: 60000, maxBytes: 32 * 1024 * 1024 },
    inputs,
    hosts: commonHosts(),
    toolHashes: Object.fromEntries(
      [
        'scripts/evaluation/upstream-compare.mts',
        ...['model', 'page', 'inputs', 'cases', 'worker'].map(
          (name) => `scripts/evaluation/upstream-compare/${name}.mts`,
        ),
        'tests-v2/support/clock.ts',
        'tests-v2/support/scope.ts',
      ].map((path) => [path, sha256(readFileSync(path))]),
    ),
    results,
    exitCode: outcomeCode(results) || (results.some((e) => e.exitCode !== 0) ? 1 : 0),
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/evaluation/upstream-compare.mts')
) {
  let options: ReturnType<typeof parseComparisonArgs> | undefined
  try {
    options = parseComparisonArgs(process.argv.slice(2))
  } catch {
    console.error('Usage: npm run compare:upstream -- [--json] [--calibrate]')
    process.exitCode = 2
  }
  if (options)
    try {
      const report = await compareUpstream(options.calibration)
      if (options.json) console.log(JSON.stringify(report))
      else {
        console.log(
          'case\tvalidity\tverdict\twire-switch-ms\treload-ms/count\tprobe/retry\tfailures',
        )
        for (const result of report.results)
          console.log(
            `${result.id}\t${result.validity}\t${result.verdict}\t${result.metrics.firstVideoHostChangeFromFaultMs ?? '-'}\t${result.metrics.firstReloadFromFaultMs ?? '-'}/${result.metrics.reloads}\t${result.metrics.probeDispatches}/${result.metrics.retryDispatches}\t${result.assertions
              .filter((e) => e.verdict === 'fail')
              .map((e) => e.id)
              .join(',')}${result.reasons.join(',')}`,
          )
        console.log(
          `Executions: ${report.results.length}; exit ${report.exitCode}; offline model only.`,
        )
      }
      process.exitCode = report.exitCode
    } catch (error) {
      console.error(errorMessage(error))
      process.exitCode = 1
    }
}
