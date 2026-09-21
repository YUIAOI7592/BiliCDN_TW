import type { MediaKind } from '../domain/model.ts'
import type { StoragePort } from '../platform/storage.ts'

export const RESTRICTIONS_KEY = 'bilicdn.v2.restrictions'
export type RestrictionType = 'black' | 'dead'

export interface RestrictionRecord {
  readonly host: string
  readonly type: RestrictionType
  readonly kind: MediaKind | 'all'
  readonly reason: string
  readonly createdAt: number
  readonly expireAt: number
  readonly updatedAt: number
}

interface RestrictionPayload { readonly schema: 2; readonly records: readonly RestrictionRecord[]; readonly updatedAt: number }

const safeHost = (value: unknown): string | null => {
  const host = String(value ?? '').trim().toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : null
}

const parsePayload = (value: unknown, now: number): RestrictionPayload => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rows = Array.isArray(raw.records) ? raw.records : []
  const records: RestrictionRecord[] = []
  for (const item of rows.slice(0, 128)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const host = safeHost(row.host)
    const type = row.type === 'black' || row.type === 'dead' ? row.type : null
    const storedKind = row.kind === 'video' || row.kind === 'audio' || row.kind === 'all' ? row.kind : 'all'
    const reason = String(row.reason ?? '').slice(0, 64)
    // The previous control-center button saved a video-only row despite presenting it as a host blacklist.
    const kind = type === 'black' && storedKind === 'video' && reason === 'user' ? 'all' : storedKind
    const expireAt = Number(row.expireAt)
    if (!host || !type || !Number.isFinite(expireAt) || expireAt <= now || expireAt > now + 30 * 24 * 60 * 60_000) continue
    records.push(Object.freeze({ host, type, kind, reason,
      createdAt: Math.min(now, Math.max(0, Number(row.createdAt) || now)), expireAt,
      updatedAt: Math.min(now + 5 * 60_000, Math.max(0, Number(row.updatedAt) || now)) }))
  }
  return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Number(raw.updatedAt) || now })
}

const mergePayload = (a: RestrictionPayload, b: RestrictionPayload, now: number): RestrictionPayload => {
  const merged = new Map<string, RestrictionRecord>()
  for (const row of [...a.records, ...b.records]) {
    if (row.expireAt <= now) continue
    const key = `${row.type}:${row.kind}:${row.host}`
    const old = merged.get(key)
    if (!old || row.updatedAt >= old.updatedAt) merged.set(key, row)
  }
  return Object.freeze({ schema: 2, records: Object.freeze([...merged.values()].slice(-128)), updatedAt: Math.max(a.updatedAt, b.updatedAt, now) })
}

export class RestrictionStore {
  #payload: RestrictionPayload
  #stopRemote: () => void
  constructor(private readonly storage: StoragePort, private readonly now: () => number) {
    this.#payload = parsePayload(storage.get<unknown>(RESTRICTIONS_KEY, null), now())
    this.#stopRemote = storage.listen<unknown>(RESTRICTIONS_KEY, (value, remote) => {
      if (!remote) return
      const incoming = parsePayload(value, this.now())
      if (incoming.updatedAt >= this.#payload.updatedAt) this.#payload = incoming
    })
  }

  has(host: string, kind: MediaKind, type?: RestrictionType): boolean {
    const now = this.now()
    return this.#payload.records.some(row => row.host === host && row.expireAt > now
      && (row.kind === 'all' || row.kind === kind) && (!type || row.type === type))
  }

  snapshot(kind: MediaKind): { readonly blackHosts: ReadonlySet<string>; readonly deadHosts: ReadonlySet<string> } {
    const now = this.now(), black = new Set<string>(), dead = new Set<string>()
    for (const row of this.#payload.records) {
      if (row.expireAt <= now || (row.kind !== 'all' && row.kind !== kind)) continue
      ;(row.type === 'black' ? black : dead).add(row.host)
    }
    return Object.freeze({ blackHosts: black, deadHosts: dead })
  }

  list(): readonly RestrictionRecord[] { return Object.freeze(this.#payload.records.filter(row => row.expireAt > this.now())) }

  async add(record: Omit<RestrictionRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.storage.withLock('restrictions', () => {
      const now = this.now()
      const current = parsePayload(this.storage.get<unknown>(RESTRICTIONS_KEY, null), now)
      const incoming = parsePayload({ schema: 2, updatedAt: now, records: [{ ...record, createdAt: now, updatedAt: now }] }, now)
      this.#payload = mergePayload(current, incoming, now)
      this.storage.set(RESTRICTIONS_KEY, this.#payload)
    })
  }

  async remove(host: string, type?: RestrictionType): Promise<void> {
    await this.storage.withLock('restrictions', () => {
      const now = this.now()
      const current = parsePayload(this.storage.get<unknown>(RESTRICTIONS_KEY, null), now)
      this.#payload = Object.freeze({ schema: 2, updatedAt: now,
        records: Object.freeze(current.records.filter(row => row.host !== host || (!!type && row.type !== type))) })
      this.storage.set(RESTRICTIONS_KEY, this.#payload)
    })
  }

  async clear(): Promise<void> {
    await this.storage.withLock('restrictions', () => this.storage.delete(RESTRICTIONS_KEY))
    this.#payload = Object.freeze({ schema: 2, records: Object.freeze([]), updatedAt: this.now() })
  }

  dispose(): void { this.#stopRemote() }
}
