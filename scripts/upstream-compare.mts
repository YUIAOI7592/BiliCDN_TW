import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { supervise } from './test-process.mts'
import { errorMessage } from './lib.mts'
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
          'scripts/upstream-compare/worker.mts',
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
    inputs,
    hosts: commonHosts(),
    toolHashes: Object.fromEntries(
      [
        'scripts/upstream-compare.mts',
        ...['model', 'page', 'inputs', 'cases', 'worker'].map(
          (name) => `scripts/upstream-compare/${name}.mts`,
        ),
        'tests-v2/support/clock.ts',
        'tests-v2/support/scope.ts',
      ].map((path) => [path, sha256(readFileSync(path))]),
    ),
    results,
    exitCode: outcomeCode(results) || (results.some((e) => e.exitCode !== 0) ? 1 : 0),
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/upstream-compare.mts')) {
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
        for (const result of report.results)
          console.log(
            `${result.id}\t${result.validity}\t${result.verdict}\t${result.assertions
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
