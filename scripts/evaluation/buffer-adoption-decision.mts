import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { build } from 'esbuild'
import { supervise } from '../testing/test-process.mts'
import { filesUnder, isRecord } from '../lib/lib.mts'
import { adoptionPair } from './buffer-shadow/adoption-inputs.mts'
import { assessPrefixFeasibility } from './buffer-shadow/prefix-feasibility.mts'
import { assessReadiness } from './buffer-shadow/adoption-readiness.mts'
import { projectLiveEvent, projectLiveSample } from './buffer-shadow/live-model.mts'
import { evaluateLiveWindows } from './buffer-shadow/live-report.mts'
import type { LiveWindow } from './buffer-shadow/live-report.mts'
import { riskCoverageReport } from './buffer-shadow/risk-report.mts'
import { auditRouteObservability } from './buffer-shadow/actionability.mts'

const original = 'archive/retired/docs/evidence/BUFFER_LIVE_EVALUATION_R2_2026-10-25.json'
const digest = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex')

export function projectDecisionPair(value: unknown, rate: 1 | 2) {
  if (
    !isRecord(value) ||
    value.rate !== rate ||
    JSON.stringify(value.frozenInput) !== JSON.stringify(adoptionPair(rate))
  )
    return null
  const part = (v: unknown, input: unknown) => {
    if (
      !isRecord(v) ||
      !Array.isArray(v.rows) ||
      v.rows.length !== 180 ||
      !Array.isArray(v.events) ||
      !isRecord(v.cleanup) ||
      !isRecord(v.bounds) ||
      v.cleanup.timers !== 0 ||
      v.cleanup.storageListeners !== 0 ||
      v.cleanup.exitListeners !== 0 ||
      v.scenarioHash !== digest(JSON.stringify(input)) ||
      typeof v.effectsHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(v.effectsHash) ||
      typeof v.projectionMatches !== 'boolean' ||
      ![v.bounds.maxSamples, v.bounds.maxTrendRecords, v.bounds.maxTrendBytes].every(
        (n) => Number.isSafeInteger(n) && Number(n) >= 0,
      ) ||
      (v.firstDepletionMs !== null &&
        (typeof v.firstDepletionMs !== 'number' || !Number.isFinite(v.firstDepletionMs))) ||
      (v.firstLeadMs !== null &&
        (typeof v.firstLeadMs !== 'number' || !Number.isFinite(v.firstLeadMs)))
    )
      return null
    const rows = v.rows.map(projectLiveSample),
      events = v.events.map(projectLiveEvent)
    if (
      rows.some((r) => r === null || r.rate !== rate || r.quality !== 'valid') ||
      events.some((e) => e === null)
    )
      return null
    const firstCandidate = rows.find(
      (r) => r !== null && r.at >= 60000 && r.at < 180000 && r.candidate === true,
    )?.at
    const expectedDepletion = (input as { firstDepletionMs: number | null }).firstDepletionMs
    if (
      v.firstDepletionMs !== expectedDepletion ||
      v.firstLeadMs !==
        (expectedDepletion === null || firstCandidate === undefined
          ? null
          : expectedDepletion - (firstCandidate - 60000))
    )
      return null
    return {
      rows: rows.filter((r) => r !== null),
      events: events.filter((e) => e !== null),
      firstDepletionMs: v.firstDepletionMs as number | null,
      firstLeadMs: v.firstLeadMs as number | null,
      projectionMatches: v.projectionMatches,
      bounds: {
        maxSamples: Number(v.bounds.maxSamples),
        maxTrendRecords: Number(v.bounds.maxTrendRecords),
        maxTrendBytes: Number(v.bounds.maxTrendBytes),
      },
      effectsHash: v.effectsHash,
      cleanup: { timers: 0, storageListeners: 0, exitListeners: 0 },
      scenarioHash: v.scenarioHash as string,
    }
  }
  const input = adoptionPair(rate),
    exhaustion = part(value.exhaustion, input.exhaustion),
    normal = part(value.normal, input.normal)
  if (!exhaustion || !normal) return null
  const normalCount = normal.rows.filter((r) => r.at >= 60000 && r.candidate === true).length
  const assertions = [
    { id: 'normal-candidate-cost', expected: 0, actual: normalCount, pass: normalCount === 0 },
    {
      id: 'projection',
      expected: true,
      actual: exhaustion.projectionMatches && normal.projectionMatches,
      pass: exhaustion.projectionMatches && normal.projectionMatches,
    },
    {
      id: 'capacity',
      expected: true,
      actual: [exhaustion, normal].every(
        (r) =>
          r.bounds.maxSamples <= 32 &&
          r.bounds.maxTrendRecords <= 32 &&
          r.bounds.maxTrendBytes <= 8192,
      ),
      pass: [exhaustion, normal].every(
        (r) =>
          r.bounds.maxSamples <= 32 &&
          r.bounds.maxTrendRecords <= 32 &&
          r.bounds.maxTrendBytes <= 8192,
      ),
    },
    {
      id: 'minimum-warning',
      expected: 3000,
      actual: exhaustion.firstLeadMs,
      pass: exhaustion.firstLeadMs !== null && exhaustion.firstLeadMs >= 3000,
    },
  ]
  if (JSON.stringify(value.assertions) !== JSON.stringify(assertions)) return null
  return {
    rate,
    frozenInput: input,
    exhaustion,
    normal,
    assertions,
    validity: 'valid' as const,
    verdict: assertions.every((a) => a.pass) ? 'pass' : 'fail',
  }
}

export async function evaluateDecision() {
  const source = readFileSync(original)
  if (
    source.length !== 3488160 ||
    digest(source) !== '9e5c726c603c1b1eb8780622e702b13b243668c3bc96588145230732dc92d2f6'
  )
    throw Error('Original twelve-window evidence changed')
  const envelope: unknown = JSON.parse(source.toString('utf8'))
  if (!isRecord(envelope) || !Array.isArray(envelope.windows))
    throw Error('Invalid original evidence')
  const windows = envelope.windows as LiveWindow[],
    live = evaluateLiveWindows(windows)
  const dir = mkdtempSync(join(tmpdir(), 'bilicdn-adoption-')),
    started = performance.now()
  try {
    const worker = join(dir, 'worker.mjs')
    await build({
      entryPoints: ['tests-v2/support/buffer-adoption-worker.ts'],
      outfile: worker,
      bundle: true,
      platform: 'node',
      format: 'esm',
      sourcemap: 'inline',
      logLevel: 'silent',
    })
    const results = []
    for (const rate of [1, 2] as const) {
      const remaining = 60000 - (performance.now() - started)
      if (remaining <= 0) {
        results.push({ rate, validity: 'invalid', reason: 'suite-timeout' })
        continue
      }
      const child = await supervise(process.execPath, [worker, String(rate)], {
        timeoutMs: Math.min(10000, remaining),
        maxBytes: 33554432,
      })
      let value: unknown = null
      try {
        const line = child.stdout.split('\n').find((s) => s.startsWith('ADOPTION_PAIR '))
        value = line ? JSON.parse(line.slice(14)) : null
      } catch {
        /* invalid output remains invalid */
      }
      const pair = projectDecisionPair(value, rate)
      if (child.reason || child.error || !pair || child.code !== (pair.verdict === 'pass' ? 0 : 1))
        results.push({
          rate,
          validity: 'invalid',
          reason: child.reason ?? 'worker-protocol',
          exitCode: child.code,
        })
      else
        results.push({
          ...pair,
          exitCode: child.code,
          feasibility: assessPrefixFeasibility({
            exhaustion: pair.exhaustion.rows,
            normal: pair.normal.rows,
            from: 60000,
            depletionMs: pair.frozenInput.exhaustion.firstDepletionMs!,
            minimumLeadMs: 3000,
          }),
        })
    }
    const proofs = results.flatMap((r) => ('feasibility' in r ? [r.feasibility] : []))
    const warningFeasible =
      proofs.length !== 2 || proofs.some((p) => p.validity !== 'valid')
        ? null
        : proofs.every((p) => p.feasible === true)
    return {
      schemaVersion: 1,
      baseline: 'b5a08a3e53c405eb834d0d7a73091b307dd37762',
      mode: 'decision',
      originalEvidence: {
        path: original,
        bytes: source.length,
        sha256: digest(source),
        windowsRerun: 0,
      },
      live,
      coverage: riskCoverageReport(windows),
      alternativeObservability: auditRouteObservability(null),
      results,
      decision: assessReadiness({
        real: {
          ...live.adoption.facts,
          interruptionsByRate: [
            live.adoption.facts.interruptionsByRate[0]!,
            live.adoption.facts.interruptionsByRate[1]!,
          ],
        },
        warningFeasible,
        warningUtilityPassed:
          results.length !== 2 || results.some((r) => r.validity !== 'valid')
            ? null
            : results.every((r) => 'verdict' in r && r.verdict === 'pass'),
        alternative: 'unknown',
      }),
      sourceHashes: Object.fromEntries(
        [
          ...filesUnder('src-v2').filter((p) => p.endsWith('.ts')),
          ...filesUnder('scripts').filter((p) => p.endsWith('.mts')),
          ...filesUnder('tests-v2/support').filter((p) => p.endsWith('.ts')),
          'tests-v2/regressions/buffer-adoption-decision.ts',
        ]
          .sort()
          .map((p) => [p, digest(readFileSync(p))]),
      ),
      productActionAuthorized: false,
      exitCode:
        results.length === 2 &&
        results.every((r) => 'verdict' in r && r.verdict === 'pass') &&
        warningFeasible === true
          ? 0
          : 1,
      limits: { caseMs: 5000, cleanupMs: 5000, suiteMs: 60000, maxBytes: 33554432 },
      limitations: [
        'A shared-prefix constraint is limited to the fixed sample cadence and immediate refill revocation policy.',
        'Synthetic pairs do not supply missing website events or route qualification.',
        'Insufficient evidence means do not adopt now, not proof that all future predictive routing is ineffective.',
      ],
    }
  } finally {
    const target = resolve(dir),
      parent = resolve(tmpdir())
    if (
      !target.startsWith(parent + sep) ||
      !target.split(sep).at(-1)?.startsWith('bilicdn-adoption-')
    )
      throw Error('Unsafe adoption scratch cleanup')
    rmSync(target, { recursive: true })
  }
}
