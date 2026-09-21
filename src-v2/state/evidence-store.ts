import { addEvidenceSample, emptyEvidence, EVIDENCE_TTL_MS, MAX_EVIDENCE_SAMPLES, pruneSamples } from '../domain/evidence.ts'
import type { EvidenceSample, MediaKind, RouteEvidence } from '../domain/model.ts'
import type { StoragePort } from '../platform/storage.ts'

export const EVIDENCE_KEY = 'bilicdn.v2.routeEvidence'
const MAX_VIDEO_HOSTS = 64
const MAX_AUDIO_HOSTS = 32

interface EvidencePayload { readonly schema: 2; readonly records: Readonly<Record<string, RouteEvidence>>; readonly updatedAt: number }
const recordKey = (host: string, kind: MediaKind): string => `${kind}:${host}`

const safeHost = (value: unknown): string | null => {
  const host = String(value ?? '').trim().toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : null
}

const parsePayload = (value: unknown, now: number): EvidencePayload => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const source = raw.records && typeof raw.records === 'object' ? raw.records as Record<string, unknown> : {}
  const records: Record<string, RouteEvidence> = {}
  for (const item of Object.values(source).slice(0, MAX_VIDEO_HOSTS + MAX_AUDIO_HOSTS)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>, host = safeHost(row.host), kind = row.kind
    if (!host || (kind !== 'video' && kind !== 'audio')) continue
    const samples: EvidenceSample[] = []
    for (const rawSample of (Array.isArray(row.samples) ? row.samples : []).slice(-MAX_EVIDENCE_SAMPLES)) {
      if (!rawSample || typeof rawSample !== 'object') continue
      const sample = rawSample as Record<string, unknown>, at = Number(sample.at)
      if (!Number.isFinite(at) || at > now + 5 * 60_000 || now - at > EVIDENCE_TTL_MS) continue
      const outcome = sample.outcome === 'failure' ? 'failure' : sample.outcome === 'success' ? 'success' : null
      if (!outcome) continue
      samples.push(Object.freeze({ requestId: String(sample.requestId ?? '').slice(0, 64), at,
        source: sample.source === 'challenge' ? 'challenge' : 'transport', outcome,
        throughputMbps: Number.isFinite(sample.throughputMbps) ? Math.min(100_000, Math.max(0, Number(sample.throughputMbps))) : null,
        ttfbMs: Number.isFinite(sample.ttfbMs) ? Math.min(120_000, Math.max(0, Number(sample.ttfbMs))) : null,
        failureKind: ['network','body','timeout','http-5xx','native-invalid'].includes(String(sample.failureKind))
          ? sample.failureKind as EvidenceSample['failureKind'] : null }))
    }
    const updatedAt = Math.min(now + 5 * 60_000, Math.max(0, Number(row.updatedAt) || 0))
    const expiredHistory = !samples.length && now - updatedAt > EVIDENCE_TTL_MS
    const evidence: RouteEvidence = Object.freeze({ host, kind, samples: Object.freeze(samples),
      circuitLevel: expiredHistory ? 0 : Math.max(0, Math.min(4, Number(row.circuitLevel) || 0)),
      circuitUntil: expiredHistory ? 0 : Math.min(now + 7 * 24 * 60 * 60_000, Math.max(0, Number(row.circuitUntil) || 0)),
      updatedAt })
    records[recordKey(host, kind)] = evidence
  }
  return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Number(raw.updatedAt) || now })
}

const mergeEvidence = (a: RouteEvidence | undefined, b: RouteEvidence | undefined, now: number): RouteEvidence | null => {
  if (!a && !b) return null
  const base = a ?? b
  if (!base) return null
  const samples = new Map<string, EvidenceSample>()
  for (const sample of [...(a?.samples ?? []), ...(b?.samples ?? [])]) {
    const key = sample.requestId || `${sample.at}:${sample.source}:${sample.outcome}`
    const old = samples.get(key)
    if (!old || sample.at >= old.at) samples.set(key, sample)
  }
  const newer = !a ? b : !b ? a : b.updatedAt >= a.updatedAt ? b : a
  return Object.freeze({ host: base.host, kind: base.kind,
    samples: pruneSamples([...samples.values()].sort((x, y) => x.at - y.at), now),
    circuitLevel: newer?.circuitLevel ?? 0, circuitUntil: newer?.circuitUntil ?? 0,
    updatedAt: Math.max(a?.updatedAt ?? 0, b?.updatedAt ?? 0) })
}

const mergePayload = (a: EvidencePayload, b: EvidencePayload, now: number): EvidencePayload => {
  const records: Record<string, RouteEvidence> = {}
  for (const key of new Set([...Object.keys(a.records), ...Object.keys(b.records)])) {
    const merged = mergeEvidence(a.records[key], b.records[key], now)
    if (merged) records[key] = merged
  }
  for (const kind of ['video', 'audio'] as const) {
    const max = kind === 'video' ? MAX_VIDEO_HOSTS : MAX_AUDIO_HOSTS
    const rows = Object.entries(records).filter(([, row]) => row.kind === kind).sort((x, y) => y[1].updatedAt - x[1].updatedAt)
    for (const [key] of rows.slice(max)) delete records[key]
  }
  return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Math.max(a.updatedAt, b.updatedAt, now) })
}

export class EvidenceStore {
  #payload: EvidencePayload
  #stopRemote: () => void
  constructor(private readonly storage: StoragePort, private readonly now: () => number) {
    this.#payload = parsePayload(storage.get<unknown>(EVIDENCE_KEY, null), now())
    this.#stopRemote = storage.listen<unknown>(EVIDENCE_KEY, (value, remote) => {
      if (!remote) return
      const incoming = parsePayload(value, this.now())
      if (incoming.updatedAt >= this.#payload.updatedAt) this.#payload = incoming
    })
  }

  get(host: string, kind: MediaKind): RouteEvidence | null { return this.#payload.records[recordKey(host, kind)] ?? null }
  list(kind?: MediaKind): readonly RouteEvidence[] {
    return Object.freeze(Object.values(this.#payload.records).filter(row => !kind || row.kind === kind))
  }

  async record(host: string, kind: MediaKind, sample: EvidenceSample): Promise<RouteEvidence> {
    return await this.storage.withLock('routeEvidence', () => {
      const now = this.now(), latest = parsePayload(this.storage.get<unknown>(EVIDENCE_KEY, null), now)
      const key = recordKey(host, kind), prior = latest.records[key] ?? emptyEvidence(host, kind)
      const updated = addEvidenceSample(prior, sample, now)
      const incoming: EvidencePayload = { schema: 2, records: { [key]: updated }, updatedAt: now }
      this.#payload = mergePayload(latest, incoming, now)
      this.storage.set(EVIDENCE_KEY, this.#payload)
      return this.#payload.records[key] ?? updated
    })
  }

  async clear(): Promise<void> {
    await this.storage.withLock('routeEvidence', () => this.storage.delete(EVIDENCE_KEY))
    this.#payload = Object.freeze({ schema: 2, records: Object.freeze({}), updatedAt: this.now() })
  }
  dispose(): void { this.#stopRemote() }
}
