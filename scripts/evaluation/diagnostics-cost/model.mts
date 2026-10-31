import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
export const baseline = {
  commit: '2f6b67e7c327429332bf425cc25a2d1bf9abf448',
  version: '2.1.36',
  bytes: 439664,
  sha256: '3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7',
} as const
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export const workloads = ['healthy', 'incident', 'capacity', 'export'] as const
export type Workload = (typeof workloads)[number]
export function parseArgs(args: readonly string[]) {
  if (new Set(args).size !== args.length || args.some((a) => !['--profile', '--json'].includes(a)))
    throw Error('Usage: npm run evaluate:diagnostics -- [--profile] [--json]')
  return { profile: args.includes('--profile'), json: args.includes('--json') }
}
export function jobs(profile: boolean) {
  return ([1, 2] as const).flatMap((rate) =>
    workloads.flatMap((workload) => {
      const pairs =
        workload === 'healthy' && !profile ? Array.from({ length: 12 }, (_, i) => i - 2) : [0]
      return pairs.flatMap((pair) =>
        (pair % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']).map((side) => ({
          rate,
          workload,
          pair,
          side,
          warmup: pair < 0,
        })),
      )
    }),
  )
}
export function proof(data: Uint8Array, bytes: number, sha256: string) {
  if (data.length !== bytes || hash(data) !== sha256) throw Error('Source proof mismatch')
}
export interface Measurement {
  rate: 1 | 2
  workload: Workload
  pair: number
  side: string
  warmup: boolean
  validity: 'valid' | 'invalid'
  startupMs?: number
  caseDurationMs?: number
  times?: number[]
  cpu?: { user: number; system: number }
  heap?: { start: number; end: number; peak: number }
  digest?: string
  counts?: Record<string, number>
  hotspots?: { name: string; hits: number }[]
  cleanup?: Record<string, number>
  reason?: string
}
export function validResult(value: unknown): value is Measurement {
  if (!value || typeof value !== 'object') return false
  const r = value as Measurement
  return (
    r.validity === 'valid' &&
    [1, 2].includes(r.rate) &&
    workloads.includes(r.workload) &&
    typeof r.digest === 'string' &&
    /^[a-f0-9]{64}$/.test(r.digest) &&
    Array.isArray(r.times) &&
    r.times.length === 600 &&
    r.times.every((n) => Number.isFinite(n) && n >= 0) &&
    typeof r.caseDurationMs === 'number' &&
    Number.isFinite(r.caseDurationMs) &&
    r.caseDurationMs >= r.times.reduce((a, b) => a + b, 0) &&
    r.caseDurationMs <= 5000 &&
    !!r.cpu &&
    [r.cpu.user, r.cpu.system, r.startupMs].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
    ) &&
    !!r.heap &&
    [r.heap.start, r.heap.end, r.heap.peak].every((n) => Number.isFinite(n) && n >= 0) &&
    !!r.cleanup &&
    ['timers', 'listeners', 'requests', 'subscriptions'].every((key) => r.cleanup![key] === 0) &&
    Object.values(r.cleanup).every((n) => n === 0)
  )
}
export function quantile(rows: readonly number[], q: number) {
  return rows.slice().sort((a, b) => a - b)[Math.floor((rows.length - 1) * q)]!
}
export function summarize(results: readonly Measurement[], profile: boolean) {
  const rates = ([1, 2] as const).map((rate) => {
    const rows = results.filter((r) => r.rate === rate && r.workload === 'healthy' && !r.warmup)
    const paired = Array.from({ length: profile ? 1 : 10 }, (_, pair) => {
      const a = rows.find((r) => r.pair === pair && r.side === 'baseline')
      const b = rows.find((r) => r.pair === pair && r.side === 'candidate')
      return { a, b }
    })
    const complete = paired.every(({ a, b }) => a && b && validResult(a) && validResult(b))
    const metrics = (side: 'a' | 'b') => ({
      median: quantile(
        paired.map((p) => quantile(p[side]!.times!, 0.5)),
        0.5,
      ),
      p95: quantile(
        paired.map((p) => quantile(p[side]!.times!, 0.95)),
        0.5,
      ),
      cpu: quantile(
        paired.map((p) => p[side]!.cpu!.user + p[side]!.cpu!.system),
        0.5,
      ),
    })
    const a = complete ? metrics('a') : null,
      b = complete ? metrics('b') : null
    const cpuWins = complete
      ? paired.filter(({ a, b }) => b!.cpu!.user + b!.cpu!.system < a!.cpu!.user + a!.cpu!.system)
          .length
      : 0
    return {
      rate,
      complete,
      baseline: a,
      candidate: b,
      cpuWins,
      timingAccepted:
        !profile && complete && cpuWins >= 8 && b!.median <= a!.median && b!.p95 <= a!.p95,
    }
  })
  const semanticEquality =
    results.length > 0 &&
    results.every(
      (r) =>
        r.validity === 'valid' &&
        isDeepStrictEqual(
          r.digest,
          results.find(
            (other) =>
              other.rate === r.rate &&
              other.workload === r.workload &&
              other.side !== r.side &&
              other.pair === r.pair,
          )?.digest,
        ),
    )
  return { rates, semanticEquality, timingAccepted: rates.every((r) => r.timingAccepted) }
}
