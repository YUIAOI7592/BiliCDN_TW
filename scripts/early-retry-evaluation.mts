import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

interface EarlyRetryFacts {
  readonly now: number
  readonly startedAt: number
  readonly currentHost: string
  readonly loadedBytes: number
  readonly totalBytes: number
  readonly recentBytesPerSec: number | null
  readonly playableBufferSec: number
  readonly requiredMbps: number
  readonly alternative: {
    readonly host: string
    readonly safeMbps: number
    readonly ttfbMs: number
    readonly successCount: number
    readonly oldestAt: number
  }
}

interface Assessment {
  readonly eligible: boolean
  readonly reason: string
  readonly remainingSec: number | null
  readonly alternativeSec: number | null
}

interface FrozenScenario {
  readonly id: string
  readonly kind: 'slow' | 'normal'
  readonly facts: EarlyRetryFacts
  readonly actualContinueMs: number
  readonly actualRetryMs: number
}

// The future delivery facts below are held out from the predicate. A recent slow window
// does not prove that the original connection will remain slow after the decision.
function frozenScenarios(): readonly FrozenScenario[] {
  const facts: EarlyRetryFacts = {
    now: 10_000,
    startedAt: 8_000,
    currentHost: 'upos-sz-mirrorali.bilivideo.com',
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 50_000,
    playableBufferSec: 4,
    requiredMbps: 4,
    alternative: {
      host: 'upos-sz-mirrorbos.bilivideo.com',
      safeMbps: 40,
      ttfbMs: 100,
      successCount: 2,
      oldestAt: 5000,
    },
  }
  return Object.freeze([
    { id: 'sustained-slow-1x', kind: 'slow', facts, actualContinueMs: 18_000, actualRetryMs: 300 },
    {
      id: 'sustained-slow-2x',
      kind: 'slow',
      facts: { ...facts, playableBufferSec: 2, requiredMbps: 8 },
      actualContinueMs: 18_000,
      actualRetryMs: 300,
    },
    {
      id: 'healthy-buffer',
      kind: 'normal',
      facts: { ...facts, playableBufferSec: 12 },
      actualContinueMs: 250,
      actualRetryMs: 300,
    },
    {
      id: 'nearly-complete',
      kind: 'normal',
      facts: { ...facts, loadedBytes: 800_000 },
      actualContinueMs: 150,
      actualRetryMs: 300,
    },
    { id: 'burst-recovery-1x', kind: 'normal', facts, actualContinueMs: 200, actualRetryMs: 300 },
    {
      id: 'burst-recovery-2x',
      kind: 'normal',
      facts: { ...facts, playableBufferSec: 2, requiredMbps: 8 },
      actualContinueMs: 200,
      actualRetryMs: 300,
    },
  ] satisfies FrozenScenario[])
}

export async function evaluateFrozenEarlyRetry() {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL('../src-v2/domain/early-retry.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    logLevel: 'silent',
  })
  const module: { evaluateEarlyRetry(input: EarlyRetryFacts): Assessment } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.contents).toString('base64')}`
  )
  const inputs = frozenScenarios()
  const results = inputs.map((scenario) => {
    const decision = module.evaluateEarlyRetry(scenario.facts)
    const baselineStallMs = Math.max(
      0,
      scenario.actualContinueMs - scenario.facts.playableBufferSec * 1000,
    )
    const candidateStallMs = decision.eligible
      ? Math.max(0, scenario.actualRetryMs - scenario.facts.playableBufferSec * 1000)
      : baselineStallMs
    return {
      id: scenario.id,
      kind: scenario.kind,
      decision,
      baselineStallMs,
      candidateStallMs,
      savedStallMs: baselineStallMs - candidateStallMs,
      unnecessaryIntervention:
        decision.eligible && scenario.actualContinueMs <= scenario.facts.playableBufferSec * 1000,
      extraDownloadedBytes: decision.eligible ? scenario.facts.loadedBytes : 0,
    }
  })
  const slow = results.filter((row) => row.kind === 'slow')
  const normal = results.filter((row) => row.kind === 'normal')
  const assertions = {
    slowCasesImproveAtLeast500Ms: slow.every((row) => row.savedStallMs >= 500),
    normalCasesHaveNoUnnecessaryIntervention: normal.every((row) => !row.unnecessaryIntervention),
    noStallRegression: results.every((row) => row.candidateStallMs <= row.baselineStallMs),
  }
  const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
  return {
    schemaVersion: 1,
    evidence: 'offline-model-with-held-out-future-delivery',
    policySourceSha256: sha256(
      readFileSync(new URL('../src-v2/domain/early-retry.ts', import.meta.url)),
    ),
    inputSha256: sha256(JSON.stringify(inputs)),
    inputs,
    results,
    assertions,
    valid: true,
    passed: Object.values(assertions).every(Boolean),
    adoption: 'requires-independent-native-and-installed-evidence',
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some((arg) => arg !== '--json')) {
    process.stderr.write('Usage: node scripts/early-retry-evaluation.mts [--json]\n')
    process.exitCode = 2
  } else {
    const result = await evaluateFrozenEarlyRetry()
    process.stdout.write(
      args[0] === '--json'
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Early retry frozen efficacy: ${result.passed ? 'PASS' : 'FAIL'}; valid=${result.valid}; unnecessary normal interventions=${result.results.filter((row) => row.kind === 'normal' && row.unnecessaryIntervention).length}.\n`,
    )
    process.exitCode = result.passed ? 0 : 1
  }
}
