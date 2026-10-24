import { projectLiveSample, projectLiveEvent } from './live-model.mts'
import type { LiveSample, LiveEvent } from './live-model.mts'

export interface LiveSessionPorts {
  now(): number
  timeout(run: () => void, ms: number): () => void
  bind(sample: (v: unknown) => void, event: (v: unknown) => void, exit: () => void): () => void
  resources(): { readonly subscriptions: number; readonly listeners: number }
}
export interface LiveSessionOptions {
  readonly durationMs?: number
  readonly leaseMs?: number
  readonly maxSamples?: number
  readonly maxEvents?: number
  readonly maxBytes?: number
}
export interface LiveEntry {
  readonly sequence: number
  readonly kind: 'sample' | 'event'
  readonly value: LiveSample | LiveEvent
}
export function createLiveSession(port: LiveSessionPorts, options: LiveSessionOptions = {}) {
  const duration = options.durationMs ?? 365000,
    lease = options.leaseMs ?? 30000,
    maxSamples = options.maxSamples ?? 512,
    maxEvents = options.maxEvents ?? 4096,
    maxBytes = options.maxBytes ?? 4 * 1024 * 1024
  if (
    ![duration, lease, maxSamples, maxEvents, maxBytes].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    duration > 427000 ||
    lease > 30000 ||
    maxSamples > 512 ||
    maxEvents > 4096 ||
    maxBytes > 4 * 1024 * 1024
  )
    throw Error('Invalid live session options')
  const start = port.now(),
    entries: LiveEntry[] = []
  if (!Number.isFinite(start)) throw Error('Invalid observation clock')
  let active = true,
    reason = 'running',
    stoppedAt: number | null = null,
    samples = 0,
    events = 0,
    bytes = 0,
    lastNow = start,
    lastSample = -1,
    leaseUntil = start + lease,
    cancelTimer: (() => void) | null = null,
    unbind: (() => void) | null = null,
    cleanupFailed = false
  const stop = (why = 'cancelled') => {
    if (!active) return
    active = false
    reason = why
    const now = port.now()
    stoppedAt = Number.isFinite(now) && now >= start ? now - start : null
    const clear = cancelTimer
    cancelTimer = null
    const dispose = unbind
    unbind = null
    try {
      clear?.()
    } catch {
      cleanupFailed = true
    }
    try {
      dispose?.()
    } catch {
      cleanupFailed = true
    }
  }
  const check = () => {
    if (!active) return false
    const now = port.now()
    if (!Number.isFinite(now) || now < lastNow) {
      stop('clock-rollback')
      return false
    }
    lastNow = now
    if (now >= start + duration) {
      stop('complete')
      return false
    }
    if (now >= leaseUntil) {
      stop('lease-expired')
      return false
    }
    return true
  }
  const arm = () => {
    cancelTimer?.()
    cancelTimer = null
    if (active)
      cancelTimer = port.timeout(
        () => {
          cancelTimer = null
          check()
        },
        Math.max(0, Math.min(start + duration, leaseUntil) - port.now()),
      )
  }
  const append = (kind: LiveEntry['kind'], input: unknown) => {
    if (!check()) return
    try {
      const value = kind === 'sample' ? projectLiveSample(input) : projectLiveEvent(input)
      if (
        !value ||
        value.at > port.now() - start ||
        (kind === 'sample' && (value.at <= lastSample || port.now() - start - value.at > 1500))
      ) {
        stop(`invalid-${kind}`)
        return
      }
      const entry = { sequence: entries.length + 1, kind, value }
      const size = new TextEncoder().encode(JSON.stringify(entry)).byteLength
      if (
        (kind === 'sample' ? samples >= maxSamples : events >= maxEvents) ||
        bytes + size > maxBytes
      ) {
        stop('overflow')
        return
      }
      entries.push(entry)
      bytes += size
      if (kind === 'sample') {
        samples++
        lastSample = value.at
      } else events++
    } catch {
      stop('source-error')
    }
  }
  const status = () => ({
    schemaVersion: 1 as const,
    active,
    reason,
    stoppedAt,
    samples,
    events,
    bytes,
    cleanupFailed,
    resources: { timers: cancelTimer ? 1 : 0, ...port.resources() },
  })
  const drain = (after = 0, limit = 1000) => {
    if (
      !Number.isSafeInteger(after) ||
      after < 0 ||
      after > entries.length ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000
    )
      throw Error('Invalid live cursor')
    if (check()) {
      leaseUntil = port.now() + lease
      arm()
    }
    const selected = entries.slice(after, after + limit)
    const cursor = selected.at(-1)?.sequence ?? after
    return {
      ...status(),
      cursor,
      hasMore: cursor < entries.length,
      truncated: false,
      entries: JSON.parse(JSON.stringify(selected)) as LiveEntry[],
    }
  }
  try {
    const dispose = port.bind(
      (v) => append('sample', v),
      (v) => append('event', v),
      () => stop('page-exit'),
    )
    if (active) unbind = dispose
    else dispose()
    arm()
  } catch {
    stop('source-error')
  }
  return { drain, status, stop: () => stop(), fail: () => stop('source-error') }
}

/** The current capability is an explicit argument on every call, never a captured old tab. */
export async function drainRemoteSession(
  currentCdp: {
    send(
      method: string,
      params: Record<string, unknown>,
      options: { timeoutMs: number },
    ): Promise<unknown>
  },
  objectId: string,
  after: number,
) {
  if (!objectId || !Number.isSafeInteger(after) || after < 0)
    throw Error('Invalid remote session reference')
  const response = await currentCdp.send(
    'Runtime.callFunctionOn',
    {
      objectId,
      functionDeclaration: 'function(after){return this.drain(after,1000)}',
      arguments: [{ value: after }],
      returnByValue: true,
    },
    { timeoutMs: 10000 },
  )
  if (!response || typeof response !== 'object' || 'exceptionDetails' in response)
    throw Error('Remote observation rejected')
  const result = (response as { result?: { type?: string; value?: unknown } }).result
  if (!result || result.type === 'error' || !result.value || typeof result.value !== 'object')
    throw Error('Invalid remote observation')
  const batch = result.value as {
    cursor?: unknown
    hasMore?: unknown
    truncated?: unknown
    entries?: unknown
  }
  if (
    !Number.isSafeInteger(batch.cursor) ||
    Number(batch.cursor) < after ||
    typeof batch.hasMore !== 'boolean' ||
    batch.truncated !== false ||
    !Array.isArray(batch.entries) ||
    batch.entries.length > 1000
  )
    throw Error('Invalid remote observation batch')
  let expected = after + 1
  const entries: LiveEntry[] = []
  for (const entry of batch.entries) {
    const value =
      entry?.kind === 'sample'
        ? projectLiveSample(entry.value)
        : entry?.kind === 'event'
          ? projectLiveEvent(entry.value)
          : null
    if (!entry || typeof entry !== 'object' || entry.sequence !== expected++ || !value)
      throw Error('Invalid remote observation sequence')
    entries.push({ sequence: entry.sequence, kind: entry.kind, value })
  }
  if (batch.cursor !== expected - 1) throw Error('Invalid remote observation cursor')
  return {
    cursor: Number(batch.cursor),
    hasMore: batch.hasMore,
    truncated: false as const,
    entries,
  }
}
