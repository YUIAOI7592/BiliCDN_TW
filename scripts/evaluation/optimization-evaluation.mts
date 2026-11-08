import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { NODE_BUILD_TARGET } from '../lib/toolchain.mts'

const baselineRevision = '060b79ffba2c257a73e8d3a5257291d028a7097a'
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
type EarlyRetryFacts = ReturnType<typeof baseFacts>
interface EarlyRetryAssessment {
  readonly eligible: boolean
  readonly reason: string
  readonly remainingSec: number | null
  readonly alternativeSec: number | null
}
type Predicate = (input: EarlyRetryFacts) => EarlyRetryAssessment

function baseFacts() {
  return {
    now: 10000,
    startedAt: 8000,
    currentHost: 'current.test',
    loadedBytes: 100000,
    totalBytes: 1000000,
    recentBytesPerSec: 50000,
    playableBufferSec: 4,
    requiredMbps: 4,
    alternative: {
      host: 'alternative.test',
      safeMbps: 40,
      safePayloadMbps: 40,
      ttfbMs: 100,
      successCount: 2,
      oldestAt: 5000,
    },
  }
}

function retryInputs(): EarlyRetryFacts[] {
  const rows: EarlyRetryFacts[] = [],
    base = baseFacts()
  for (const playableBufferSec of [0.5, 1, 2, 2.5, 3, 4, 5, 5.9])
    for (const totalBytes of [65536, 262144, 1000000, 4000000, 16000000])
      for (const capacity of [10, 20, 40, 80])
        for (const ttfbMs of [0, 100, 500])
          for (const fraction of [0, 0.1, 0.5, 0.79])
            for (const recentBytesPerSec of [0, 50000, 250000, 600000])
              rows.push({
                ...base,
                playableBufferSec,
                totalBytes,
                loadedBytes: Math.floor(totalBytes * fraction),
                recentBytesPerSec,
                alternative: {
                  ...base.alternative,
                  safeMbps: capacity,
                  safePayloadMbps: capacity,
                  ttfbMs,
                },
              })
  return rows
}

interface Future {
  readonly id: string
  readonly continueSec: number
  readonly handoffSec: number | null
  readonly replacementDeliverySec: number | null
  readonly handoff: 'accepted' | 'unconfirmed'
}
const futures: readonly Future[] = [
  {
    id: 'sustained-slow',
    continueSec: 18,
    handoffSec: 2,
    replacementDeliverySec: 0.3,
    handoff: 'accepted',
  },
  {
    id: 'immediate-recovery',
    continueSec: 0.2,
    handoffSec: 2,
    replacementDeliverySec: 0.3,
    handoff: 'accepted',
  },
  {
    id: 'alternative-collapses',
    continueSec: 18,
    handoffSec: 2,
    replacementDeliverySec: 23,
    handoff: 'accepted',
  },
  {
    id: 'unknown-alternative',
    continueSec: 18,
    handoffSec: 2,
    replacementDeliverySec: null,
    handoff: 'accepted',
  },
  {
    id: 'handoff-unconfirmed',
    continueSec: 18,
    handoffSec: null,
    replacementDeliverySec: null,
    handoff: 'unconfirmed',
  },
]

function counterfactuals(predicate: Predicate) {
  // Evaluate once, before revealing each held-out future. Future facts cannot affect the action.
  const facts = baseFacts(),
    decision = predicate(facts)
  return futures.map((future) => {
    const known =
      future.handoff === 'accepted' &&
      future.handoffSec !== null &&
      future.replacementDeliverySec !== null
    const replacementTotalSec = known ? future.handoffSec! + future.replacementDeliverySec! : null
    const baselineStallSec = Math.max(0, future.continueSec - facts.playableBufferSec)
    const candidateCompletionSec = !decision.eligible ? future.continueSec : replacementTotalSec
    const candidateStallSec =
      candidateCompletionSec === null
        ? null
        : Math.max(0, candidateCompletionSec - facts.playableBufferSec)
    return {
      ...future,
      facts,
      decision,
      policyHandoffBudgetSec: 2,
      replacementTotalSec,
      baselineStallSec,
      candidateStallSec,
      candidateCompletionSec,
      savedStallSec: candidateStallSec === null ? null : baselineStallSec - candidateStallSec,
      savedCompletionSec:
        candidateCompletionSec === null ? null : future.continueSec - candidateCompletionSec,
      predictedDeadlineMiss:
        decision.alternativeSec === null ? null : decision.alternativeSec > facts.playableBufferSec,
      actualDeadlineMiss:
        candidateCompletionSec === null ? null : candidateCompletionSec > facts.playableBufferSec,
      deadlineMisjudged:
        candidateCompletionSec === null || decision.alternativeSec === null
          ? null
          : decision.alternativeSec > facts.playableBufferSec !==
            candidateCompletionSec > facts.playableBufferSec,
      // Full replacement bytes are known only when delivery completed; pending work is not free.
      extraDownloadedBytes:
        candidateCompletionSec === null ? null : decision.eligible ? facts.loadedBytes : 0,
      baselineRemainingBytes: facts.totalBytes - facts.loadedBytes,
      candidateRemainingBytes:
        candidateCompletionSec === null
          ? null
          : decision.eligible
            ? facts.totalBytes
            : facts.totalBytes - facts.loadedBytes,
      hostSwitches: !decision.eligible ? 0 : future.handoff === 'accepted' ? 1 : null,
      probeCount: null,
      reloadCount: null,
    }
  })
}

interface SegmentInput {
  readonly id: string
  readonly rate: number
  readonly kind: 'video'
  readonly bandwidth: number
  readonly fps: number
  readonly initialBufferMediaSec: number
  readonly capacityBps: number
  readonly waitSec: number
  readonly segments: readonly { bytes: number; durationMediaSec: number }[]
}
function segmentInputs(): SegmentInput[] {
  return [1, 2].flatMap((rate) =>
    [
      { id: `uniform-${rate}x`, sizes: [3, 3, 3, 3] },
      { id: `vbr-${rate}x`, sizes: [8, 1, 1, 2] },
    ].map(({ id, sizes }) => ({
      id,
      rate,
      kind: 'video' as const,
      bandwidth: 6000000,
      fps: 60,
      initialBufferMediaSec: 4,
      capacityBps: 8000000,
      waitSec: 0.1,
      segments: sizes.map((size) => ({ bytes: size * 1000000, durationMediaSec: 4 })),
    })),
  )
}
function segmentTrace(input: SegmentInput) {
  let buffer = input.initialBufferMediaSec,
    wall = 0,
    stalls = 0
  const rows = input.segments.map((segment, index) => {
    const before = buffer,
      startedAtSec = wall
    const deliverySec = input.waitSec + (segment.bytes * 8) / input.capacityBps
    const deadlineSec = before / input.rate,
      stallSec = Math.max(0, deliverySec - deadlineSec)
    buffer = Math.max(0, before - input.rate * deliverySec) + segment.durationMediaSec
    wall += deliverySec
    stalls += stallSec
    return {
      index,
      ...segment,
      startedAtSec,
      completedAtSec: wall,
      bufferBeforeMediaSec: before,
      bufferAfterMediaSec: buffer,
      deliverySec,
      deadlineSec,
      stallSec,
      representation: {
        kind: input.kind,
        bandwidth: input.bandwidth,
        fps: input.fps,
        rate: input.rate,
      },
    }
  })
  return {
    input,
    rows,
    stallSec: stalls,
    completionSec: wall,
    downloadedBytes: input.segments.reduce((n, s) => n + s.bytes, 0),
    hostSwitches: 0,
    probeCount: null,
    reloadCount: null,
  }
}

export async function evaluateOptimization() {
  const compiled = await build({
    entryPoints: ['src-v2/domain/early-retry.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: NODE_BUILD_TARGET,
    metafile: true,
    logLevel: 'silent',
  })
  const { evaluateEarlyRetry } = (await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.contents).toString('base64')}`
  )) as { evaluateEarlyRetry: Predicate }
  const inputs = retryInputs(),
    segments = segmentInputs()
  const rows = inputs.map((facts) => ({ facts, decision: evaluateEarlyRetry(facts) }))
  const reasons: Record<string, number> = {}
  for (const row of rows) reasons[row.decision.reason] = (reasons[row.decision.reason] ?? 0) + 1
  const sources = [
    ...Object.keys(compiled.metafile!.inputs),
    'scripts/evaluation/optimization-evaluation.mts',
    'scripts/lib/toolchain.mts',
  ].sort()
  return {
    schemaVersion: 1,
    model: 'todo-optimization-v2212',
    baselineRevision,
    evidence: 'offline-synthetic-with-held-out-future',
    fieldEfficacy: 'not-validated',
    adoption: 'no-policy-change',
    limitations: [
      'Grid proportions are not field eligibility rates; adapter and controller gates remain separate.',
      'Serial whole-segment append, fixed representation, no real ABR, decode, progressive append or audio simulation.',
      'Probe and reload effects are not modeled; null is not zero.',
      'Synthetic handoff is distinct from the two-second policy budget; unknown outcomes remain null.',
    ],
    sourceSha256: Object.fromEntries(sources.map((path) => [path, sha256(readFileSync(path))])),
    inputSha256: sha256(JSON.stringify({ inputs, futures, segments })),
    retry: { rows, reasons, counterfactuals: counterfactuals(evaluateEarlyRetry) },
    segments: segments.map(segmentTrace),
  }
}
