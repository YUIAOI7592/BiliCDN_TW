import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { supervise } from './test-process.mts'
import { riskNames, riskScenario } from './buffer-shadow/risk-inputs.mts'
import { projectLiveSample, projectLiveEvent } from './buffer-shadow/live-model.mts'
import { filesUnder, isRecord } from './lib.mts'

export function validSupplyResult(
  value: unknown,
  name: string,
  rate: number,
): value is Record<string, unknown> {
  const serialized = JSON.stringify(value)
  if (!serialized || /https?:\/\/|C:\\\\Users|"(?:url|token|core|cookie)"/i.test(serialized))
    return false
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.scenario !== name ||
    value.rate !== rate ||
    value.level !== 'synthetic-integration' ||
    value.sourceAlgorithm !== 'buffer-window-v6' ||
    !['valid', 'invalid'].includes(String(value.validity)) ||
    !['pass', 'fail'].includes(String(value.verdict)) ||
    value.productActionAuthorized !== false ||
    !Array.isArray(value.rows) ||
    value.rows.length !== 180 ||
    !value.rows.every(projectLiveSample) ||
    !Array.isArray(value.events) ||
    !value.events.every(projectLiveEvent) ||
    !Array.isArray(value.assertions) ||
    !value.assertions.every(
      (a) => isRecord(a) && typeof a.pass === 'boolean' && typeof a.id === 'string',
    ) ||
    !isRecord(value.cleanup) ||
    value.cleanup.timers !== 0 ||
    value.cleanup.storageListeners !== 0 ||
    value.cleanup.exitListeners !== 0
  )
    return false
  return (
    value.verdict === (value.assertions.every((a) => a.pass) ? 'pass' : 'fail') &&
    value.scenarioHash ===
      createHash('sha256')
        .update(JSON.stringify(riskScenario(name as (typeof riskNames)[number], rate as 1 | 2)))
        .digest('hex')
  )
}

export async function evaluateSupply() {
  const dir = mkdtempSync(join(tmpdir(), 'bilicdn-risk-')),
    started = performance.now()
  try {
    const worker = join(dir, 'worker.mjs')
    await build({
      entryPoints: ['tests-v2/support/buffer-risk-worker.ts'],
      outfile: worker,
      bundle: true,
      platform: 'node',
      format: 'esm',
      sourcemap: 'inline',
      logLevel: 'silent',
    })
    const results: Record<string, unknown>[] = []
    for (const name of riskNames)
      for (const rate of [1, 2] as const) {
        const remaining = 60000 - (performance.now() - started)
        if (remaining <= 0) {
          results.push({
            scenario: name,
            rate,
            validity: 'invalid',
            reason: 'suite-timeout',
            exitCode: null,
          })
          continue
        }
        const child = await supervise(process.execPath, [worker, name, String(rate)], {
          timeoutMs: Math.min(10000, remaining),
          maxBytes: 32 * 1024 * 1024,
        })
        let value: unknown = null
        try {
          const line = child.stdout.split('\n').find((s) => s.startsWith('RISK_RESULT '))
          value = line ? JSON.parse(line.slice(12)) : null
        } catch {
          /* invalid worker output remains invalid */
        }
        if (
          child.reason ||
          child.error ||
          !validSupplyResult(value, name, rate) ||
          child.code !== (value.verdict === 'pass' ? 0 : 1)
        )
          results.push({
            scenario: name,
            rate,
            validity: 'invalid',
            reason: child.reason ?? 'worker-protocol',
            exitCode: child.code,
          })
        else results.push({ ...value, exitCode: child.code })
      }
    const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')
    const sourceHashes = Object.fromEntries(
      [
        ...filesUnder('src-v2').filter((p) => p.endsWith('.ts')),
        ...filesUnder('scripts/buffer-shadow').filter((p) => p.endsWith('.mts')),
        'scripts/buffer-risk-evaluation.mts',
        'tests-v2/support/buffer-risk-scenario.ts',
        'tests-v2/support/buffer-risk-worker.ts',
        'tests-v2/support/runtime-fixture.ts',
      ]
        .sort()
        .map((p) => [p, hash(p)]),
    )
    return {
      schemaVersion: 1,
      baseline: '19304621e9c2dd22714891a2f774c571636f3264',
      mode: 'supply',
      sourceHashes,
      frozenInputs: riskNames.flatMap((n) => [riskScenario(n, 1), riskScenario(n, 2)]),
      results,
      productActionAuthorized: false,
      adoptionDecision: 'not-evaluated-synthetic-only',
      exitCode: results.every(
        (r) => r.validity === 'valid' && r.verdict === 'pass' && r.exitCode === 0,
      )
        ? 0
        : 1,
      limits: { caseMs: 5000, cleanupMs: 5000, suiteMs: 60000, maxBytes: 33554432 },
      limitations: [
        'Synthetic supply does not measure website warning accuracy.',
        'Depletion and a two-second progress interruption are different outcomes.',
        'Missing alternative qualification stays unknown.',
        'No predictive route policy or automatic SDK success is modeled.',
      ],
    }
  } finally {
    const target = resolve(dir),
      parent = resolve(tmpdir())
    if (!target.startsWith(parent + sep) || !target.split(sep).at(-1)?.startsWith('bilicdn-risk-'))
      throw Error('Unsafe risk scratch cleanup')
    rmSync(target, { recursive: true })
  }
}
