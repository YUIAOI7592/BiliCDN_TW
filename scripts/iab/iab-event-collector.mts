// Host-side helper for the documented IAB CDP capability. No browser connection,
// network work, or timers are created by importing this module.
export type RequestKind = 'video' | 'audio' | 'owned' | 'other' | 'unknown'
export interface CollectorEventParams extends Record<string, unknown> {
  requestId?: string
  networkId?: string
  request?: { url?: string }
  response?: { status?: number }
  canceled?: boolean
}
export interface CollectorEvent {
  sequence: number
  method: string
  params?: CollectorEventParams
}
export interface EventBatch {
  cursor: number
  events: CollectorEvent[]
  hasMore: boolean
  truncated: boolean
}
export interface ReadOptions extends Record<string, unknown> {
  methods: readonly string[]
  afterSequence?: number | null
  limit?: number
  timeoutMs?: number
}
export interface CdpCapability {
  send(method: string, params: Record<string, unknown>): Promise<unknown>
  readEvents(options: ReadOptions): Promise<EventBatch>
}
export interface CollectorOptions {
  clock?: () => number
  limit?: number
  ownsPaused?: (params: CollectorEventParams) => boolean
}
export interface CollectorRow {
  resourceType?: string
  owned?: boolean
  sequence: number
  event: string
  at: number
  id: string | undefined
  kind: RequestKind
  status?: number | undefined
  canceled?: boolean
}
export interface CollectorError {
  stage: string
  at: number
}
export interface CollectorSnapshot {
  unownedPaused: number
  cursor: number | null
  rows: CollectorRow[]
  held: number
  patterns: number
  truncated: boolean
  dropped: boolean
  errors: CollectorError[]
  maxReadGapMs: number
  active: boolean
  holding: boolean
}
export interface FetchPattern extends Record<string, unknown> {
  urlPattern?: string
  resourceType?: string
  requestStage?: string
}
interface HeldRequest {
  kind: RequestKind
  networkId: string | null
}
export class IabEventCollector {
  ownsPaused: (params: CollectorEventParams) => boolean
  unownedPaused: number
  cdp: CdpCapability
  classify: (url: string) => string | undefined
  clock: () => number
  limit: number
  methods: string[]
  cursor: number | null
  seen: number
  rows: CollectorRow[]
  held: Map<string, HeldRequest>
  kinds: Map<string | undefined, RequestKind>
  errors: CollectorError[]
  truncated: boolean
  dropped: boolean
  holding: boolean
  busy: boolean
  active: boolean
  patterns: number
  lastReadAt: number | null
  maxReadGapMs: number
  constructor(
    cdp: CdpCapability,
    classify: (url: string) => string | undefined,
    { clock = Date.now, limit = 12000, ownsPaused = () => true }: CollectorOptions = {},
  ) {
    this.cdp = cdp
    this.classify = classify
    this.clock = clock
    this.limit = limit
    this.ownsPaused = ownsPaused
    this.unownedPaused = 0
    this.methods = [
      'Fetch.requestPaused',
      'Network.requestWillBeSent',
      'Network.responseReceived',
      'Network.loadingFinished',
      'Network.loadingFailed',
    ]
    this.cursor = null
    this.seen = -1
    this.rows = []
    this.held = new Map()
    this.kinds = new Map()
    this.errors = []
    this.truncated = false
    this.dropped = false
    this.holding = false
    this.busy = false
    this.active = false
    this.patterns = 0
    this.lastReadAt = null
    this.maxReadGapMs = 0
  }
  record(row: CollectorRow) {
    if (this.rows.length < this.limit) this.rows.push(row)
    else {
      this.dropped = true
      this.holding = false
    }
  }
  fail(stage: string) {
    if (this.errors.length < 32) this.errors.push({ stage, at: this.clock() })
    this.holding = false
  }
  async start(patterns: FetchPattern[] = []) {
    if (this.active || this.cursor !== null)
      throw new Error('Collector already started; use a fresh instance')
    await this.cdp.send('Network.enable', {})
    const initial = await this.cdp.readEvents({ methods: this.methods })
    this.cursor = initial.cursor
    this.seen = initial.cursor
    this.active = true
    if (patterns.length) await this.cdp.send('Fetch.enable', { patterns })
    this.patterns = patterns.length
  }
  setHolding(value: boolean) {
    if (value && (!this.active || this.errors.length || this.truncated || this.dropped))
      throw new Error('Cannot hold with an invalid collector')
    this.holding = value
  }
  async release(id: string | undefined) {
    if (id === undefined) return
    const held = this.held.get(id)
    if (!held) return
    const networkId = held.networkId
    if (
      networkId &&
      this.rows.some(
        (row) =>
          row.id === networkId &&
          ['Network.loadingFailed', 'Network.loadingFinished'].includes(row.event),
      )
    ) {
      this.held.delete(id)
      return // Native terminal evidence already ended this exact request.
    }
    try {
      await this.cdp.send('Fetch.continueRequest', { requestId: id })
      this.held.delete(id)
    } catch {
      this.fail('continue') /* Retain ownership until explicitly resolved or tab unload. */
    }
  }
  async fulfill(id: string, response: Record<string, unknown>) {
    if (!this.held.has(id)) throw new Error('Unknown held request')
    await this.cdp.send('Fetch.fulfillRequest', { ...response, requestId: id })
    this.held.delete(id)
  }
  async pump(timeoutMs = 100) {
    if (!this.active) throw new Error('Collector is not active')
    if (this.busy) throw new Error('Concurrent collector pump')
    this.busy = true
    try {
      let more
      do {
        const now = this.clock()
        if (this.lastReadAt !== null)
          this.maxReadGapMs = Math.max(this.maxReadGapMs, now - this.lastReadAt)
        this.lastReadAt = now
        const batch = await this.cdp.readEvents({
          afterSequence: this.cursor,
          methods: this.methods,
          limit: 1000,
          timeoutMs,
        })
        if (batch.truncated) {
          this.truncated = true
          this.holding = false
        }
        const events = batch.events
          .filter((e) => e.sequence > this.seen)
          .sort((a, b) => a.sequence - b.sequence)
        // Capture every paused ID before any classifier or CDP continuation can fail.
        for (const e of events)
          if (e.method === 'Fetch.requestPaused' && typeof e.params?.requestId === 'string') {
            if (!this.ownsPaused(e.params)) {
              this.unownedPaused++
              continue
            }
            this.held.set(e.params.requestId, {
              kind: 'unknown',
              networkId: e.params.networkId ?? null,
            })
          }
        this.cursor = Math.max(this.cursor ?? 0, batch.cursor)
        this.seen = Math.max(this.seen, batch.cursor, ...events.map((e) => e.sequence))
        for (const e of events) {
          const p = e.params ?? {},
            id = p.requestId
          let kind = this.kinds.get(id) ?? 'other'
          if (e.method === 'Network.requestWillBeSent' || e.method === 'Fetch.requestPaused') {
            try {
              const value = this.classify(p.request?.url ?? '') ?? 'other'
              if (
                value === 'video' ||
                value === 'audio' ||
                value === 'owned' ||
                value === 'other' ||
                value === 'unknown'
              )
                kind = value
              else {
                this.fail('classification-value')
                kind = 'unknown'
              }
            } catch {
              this.fail('classify')
              kind = 'unknown'
            }
            if (e.method === 'Network.requestWillBeSent') this.kinds.set(id, kind)
          }
          this.record({
            ...(typeof p.resourceType === 'string'
              ? { resourceType: p.resourceType }
              : typeof p.type === 'string'
                ? { resourceType: p.type }
                : {}),
            ...(e.method === 'Fetch.requestPaused'
              ? { owned: id !== undefined && this.held.has(id) }
              : {}),
            sequence: e.sequence,
            event: e.method,
            at: this.clock(),
            id,
            kind,
            ...(e.method === 'Network.responseReceived' ? { status: p.response?.status } : {}),
            ...(e.method === 'Network.loadingFailed' ? { canceled: p.canceled === true } : {}),
          })
          if (e.method === 'Fetch.requestPaused') {
            const owned = id === undefined ? undefined : this.held.get(id)
            if (owned) owned.kind = kind
            if (!(this.holding && (kind === 'video' || kind === 'owned'))) await this.release(id)
          }
          if (e.method === 'Network.loadingFinished' || e.method === 'Network.loadingFailed')
            this.kinds.delete(id)
        }
        if (!this.holding) for (const id of [...this.held.keys()]) await this.release(id)
        more = batch.hasMore
        timeoutMs = 0
      } while (more)
    } catch (error) {
      this.fail('read')
      throw error
    } finally {
      this.busy = false
    }
    return this.snapshot()
  }
  async releaseHolding() {
    if (this.busy) throw new Error('Wait for current pump before cleanup')
    this.holding = false
    await this.cdp.send('Fetch.enable', { patterns: [] })
    this.patterns = 0
    if (this.active) await this.pump(0)
    for (const id of [...this.held.keys()]) await this.release(id)
    if (this.active) await this.pump(0)
    return { ...this.snapshot(), complete: this.held.size === 0 }
  }
  async cleanup() {
    await this.releaseHolding()
    this.active = false
    return { ...this.snapshot(), complete: this.held.size === 0 }
  }
  snapshot(): CollectorSnapshot {
    return {
      unownedPaused: this.unownedPaused,
      cursor: this.cursor,
      rows: this.rows.map((r) => ({ ...r })),
      held: this.held.size,
      patterns: this.patterns,
      truncated: this.truncated,
      dropped: this.dropped,
      errors: this.errors.map((r) => ({ ...r })),
      maxReadGapMs: this.maxReadGapMs,
      active: this.active,
      holding: this.holding,
    }
  }
}
