import type {
  EarlyRetryActionState,
  EarlyRetryPermit,
  InFlightVideoSample,
  EarlyRetryObservation,
} from '../application/early-retry-contracts.ts'
import type { InFlightVideoPort } from '../application/early-retry-contracts.ts'
import type { EarlyRetryRoutingPort } from '../application/early-retry-contracts.ts'
import type { AppliedRouteDecision } from '../application/route-contracts.ts'
import { parseProbeRange } from '../domain/probe-range.ts'
import type { XhrMeta } from './xhr-request.ts'
import type { TransportContext } from './transport-context.ts'
import { sameUrl } from './transport-context.ts'
interface Flight {
  readonly xhr: XMLHttpRequest
  readonly meta: XhrMeta
  readonly range: string
  readonly start: number
  readonly end: number
  loaded: number
  total: number | null
  samples: { at: number; bytes: number }[]
  lease: { before: number; applied: number; revision: number; permit: EarlyRetryPermit } | null
}
interface Action {
  readonly observations: EarlyRetryObservation[]
  readonly permit: EarlyRetryPermit
  readonly flight: Flight
  state: EarlyRetryActionState
  replacement: XhrMeta | null
}

/** Owns only adapter references to existing request metadata, never an authorizing URL index. */
export class XhrEarlyRetry implements InFlightVideoPort {
  #active = new Map<string, Flight>()
  #actions = new Map<string, Action>()
  #selection = new WeakMap<XhrMeta, Action>()
  #writes = new WeakMap<XMLHttpRequest, number>()
  #descriptor: PropertyDescriptor | undefined
  #get: PropertyDescriptor['get']
  #set: PropertyDescriptor['set']
  #capable = false
  readonly #status: PropertyDescriptor | undefined
  readonly #responseUrl: PropertyDescriptor | undefined
  readonly #ready: PropertyDescriptor | undefined
  readonly #header: XMLHttpRequest['getResponseHeader'] | undefined

  constructor(
    private readonly proto: typeof XMLHttpRequest.prototype,
    private readonly context: TransportContext,
    private readonly metadata: (xhr: XMLHttpRequest) => XhrMeta | undefined,
    private readonly routes: EarlyRetryRoutingPort | undefined,
  ) {
    this.#descriptor = Object.getOwnPropertyDescriptor(proto, 'timeout')
    this.#status = Object.getOwnPropertyDescriptor(proto, 'status')
    this.#responseUrl = Object.getOwnPropertyDescriptor(proto, 'responseURL')
    this.#ready = Object.getOwnPropertyDescriptor(proto, 'readyState')
    try {
      this.#header = proto.getResponseHeader
    } catch {
      return
    }
    const descriptor = this.#descriptor
    if (
      !routes ||
      !descriptor?.get ||
      !descriptor.set ||
      !descriptor.configurable ||
      !this.#status?.get ||
      !this.#responseUrl?.get ||
      !this.#ready?.get ||
      typeof this.#header !== 'function'
    )
      return
    const owner = this
    this.#get = function (this: XMLHttpRequest): unknown {
      return descriptor.get!.call(this)
    }
    this.#set = function (this: XMLHttpRequest, value: unknown): void {
      // Native owns brand checking and conversion. Reentrant conversion has not
      // committed a website write yet, so open() may still restore our old lease.
      descriptor.set!.call(this, value)
      owner.#writes.set(this, (owner.#writes.get(this) ?? 0) + 1)
      for (const flight of owner.#active.values())
        if (flight.xhr === this) {
          const permit = flight.lease?.permit
          flight.lease = null
          if (permit) owner.cancel(permit)
        }
    }
    try {
      Object.defineProperty(proto, 'timeout', { ...descriptor, get: this.#get, set: this.#set })
      this.#capable = Object.getOwnPropertyDescriptor(proto, 'timeout')?.set === this.#set
    } catch {
      /* The ordinary transport remains installed when this capability is unavailable. */
    }
  }

  #enabled(): boolean {
    return (
      this.#capable &&
      this.#ownsDescriptor() &&
      !!this.routes &&
      this.context.settings.get().earlyRetryEnabled === true &&
      !this.context.settings.get().disabled
    )
  }
  #ownsDescriptor(): boolean {
    const current = Object.getOwnPropertyDescriptor(this.proto, 'timeout')
    return (
      !!this.#descriptor &&
      current?.get === this.#get &&
      current?.set === this.#set &&
      current?.enumerable === this.#descriptor.enumerable &&
      current?.configurable === this.#descriptor.configurable
    )
  }
  tracks(meta: XhrMeta): boolean {
    return !!meta.request && this.#active.get(meta.request.requestId)?.meta === meta
  }
  verifiedBytes(xhr: XMLHttpRequest, meta: XhrMeta): number | null {
    const flight = meta.request ? this.#active.get(meta.request.requestId) : null
    if (!flight || flight.xhr !== xhr || flight.total === null || flight.loaded !== flight.total)
      return null
    try {
      if (
        this.#ready?.get?.call(xhr) !== 4 ||
        this.#status?.get?.call(xhr) !== 206 ||
        !sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ''), meta.targetUrl)
      )
        return null
      return flight.loaded
    } catch {
      return null
    }
  }
  #owns(flight: Flight): boolean {
    return (
      this.metadata(flight.xhr) === flight.meta &&
      flight.meta.phase === 'sent' &&
      !flight.meta.settled
    )
  }
  #timeout(xhr: XMLHttpRequest): number {
    return Number(this.#descriptor?.get?.call(xhr))
  }
  #response(flight: Flight): boolean {
    const xhr = flight.xhr
    if (!this.#owns(flight) || !this.routes?.earlyRetryRequestCurrent(flight.meta.request!))
      return false
    try {
      if (
        this.#ready?.get?.call(xhr) < 2 ||
        this.#ready?.get?.call(xhr) >= 4 ||
        this.#status?.get?.call(xhr) !== 206 ||
        !sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ''), flight.meta.targetUrl)
      )
        return false
      const value = Reflect.apply(this.#header!, xhr, ['Content-Range'])
      const parsed =
        typeof value === 'string'
          ? parseProbeRange(value, flight.start, flight.end - flight.start + 1)
          : null
      if (!parsed || parsed.endByte !== flight.end) return false
      flight.total = parsed.endByte - parsed.startByte + 1
      return true
    } catch {
      return false
    }
  }

  register(xhr: XMLHttpRequest, meta: XhrMeta): void {
    if (
      !this.#enabled() ||
      this.metadata(xhr) !== meta ||
      meta.phase !== 'sent' ||
      meta.settled ||
      !meta.request ||
      !meta.async ||
      meta.method !== 'GET' ||
      meta.playurl ||
      meta.request.kind !== 'video' ||
      meta.request.routeType !== 'catalog-generated' ||
      this.#active.size >= 16
    )
      return
    try {
      if (this.#timeout(xhr) !== 0 || !/\.m4s$/i.test(new URL(meta.targetUrl).pathname)) return
      const headers = meta.headers.filter(([name]) => name.toLowerCase() === 'range')
      if (headers.length !== 1) return
      const range = /^bytes=(\d+)-(\d+)$/.exec(headers[0]![1].trim())
      if (!range) return
      const start = Number(range[1]),
        end = Number(range[2])
      if (![start, end].every(Number.isSafeInteger) || start < 0 || end < start) return
      this.#active.set(meta.request.requestId, {
        xhr,
        meta,
        range: `bytes=${start}-${end}`,
        start,
        end,
        loaded: 0,
        total: null,
        samples: [],
        lease: null,
      })
    } catch {
      /* Unknown native properties never grant control. */
    }
  }

  progress(xhr: XMLHttpRequest, meta: XhrMeta, event: ProgressEvent): void {
    const flight = meta.request ? this.#active.get(meta.request.requestId) : null
    if (!flight || flight.xhr !== xhr || !event.isTrusted || !this.#response(flight)) return
    const loaded = Number(event.loaded)
    if (!Number.isSafeInteger(loaded) || loaded < flight.loaded || loaded > flight.total!) {
      const permit = flight.lease?.permit
      if (permit) {
        const action = this.#actions.get(permit.id)
        if (action) action.state = 'failed'
        this.routes?.revokeEarlyRetry(permit)
      }
      this.#restore(flight)
      this.#active.delete(meta.request!.requestId)
      return
    }
    flight.loaded = loaded
    this.#sample(flight, this.context.now())
  }

  #sample(flight: Flight, now: number): void {
    const last = flight.samples.at(-1)
    if (last && last.at === now) {
      last.bytes = flight.loaded
      return
    }
    if (last && now - last.at < 250) return
    flight.samples.push({ at: now, bytes: flight.loaded })
    flight.samples = flight.samples
      .filter((sample) => now >= sample.at && now - sample.at <= 2000)
      .slice(-8)
  }

  samples(now: number): readonly InFlightVideoSample[] {
    if (!this.#enabled()) return []
    const results: InFlightVideoSample[] = []
    for (const flight of this.#active.values()) {
      if (
        !flight.meta.request ||
        flight.lease ||
        this.#timeout(flight.xhr) !== 0 ||
        !this.#response(flight)
      )
        continue
      this.#sample(flight, now)
      const first = flight.samples.find((sample) => now - sample.at >= 1000)
      results.push(
        Object.freeze({
          request: flight.meta.request,
          loadedBytes: flight.loaded,
          totalBytes: flight.total!,
          recentBytesPerSec: first
            ? ((flight.loaded - first.bytes) * 1000) / (now - first.at)
            : null,
        }),
      )
    }
    return Object.freeze(results)
  }

  arm(requestId: string, permit: EarlyRetryPermit): boolean {
    const flight = this.#active.get(requestId),
      now = this.context.now()
    if (
      !this.#enabled() ||
      !flight ||
      flight.lease ||
      permit.expiresAt <= now ||
      permit.expiresAt > now + 2000 ||
      !this.#response(flight) ||
      flight.total === null ||
      flight.loaded >= flight.total * 0.8 ||
      now - flight.meta.startedAt < 1500 ||
      this.#timeout(flight.xhr) !== 0
    )
      return false
    const applied = Math.max(1, Math.floor(now - flight.meta.startedAt))
    flight.lease = { before: 0, applied, revision: this.#writes.get(flight.xhr) ?? 0, permit }
    const action: Action = { permit, flight, state: 'pending', replacement: null, observations: [] }
    this.#actions.set(permit.id, action)
    while (this.#actions.size > 16) this.#actions.delete(this.#actions.keys().next().value!)
    try {
      this.#descriptor!.set!.call(flight.xhr, applied)
      if (!this.#owns(flight) && action.state === 'pending') {
        action.state = 'failed'
        return false
      }
      return true
    } catch {
      action.state = 'failed'
      this.#restore(flight)
      return false
    }
  }

  beforeOpen(xhr: XMLHttpRequest): void {
    for (const flight of this.#active.values()) if (flight.xhr === xhr) this.#restore(flight)
  }
  #restore(flight: Flight): void {
    const lease = flight.lease
    flight.lease = null
    if (
      !lease ||
      this.metadata(flight.xhr) !== flight.meta ||
      (this.#writes.get(flight.xhr) ?? 0) !== lease.revision
    )
      return
    try {
      if (this.#timeout(flight.xhr) === lease.applied)
        this.#descriptor!.set!.call(flight.xhr, lease.before)
    } catch {
      this.#capable = false
    }
  }

  select(xhr: XMLHttpRequest, meta: XhrMeta): AppliedRouteDecision | null {
    if (!this.#enabled() || !meta.async || meta.method !== 'GET') return null
    const headers = meta.headers.filter(([name]) => name.toLowerCase() === 'range')
    if (headers.length !== 1) return null
    const range = /^bytes=(\d+)-(\d+)$/.exec(headers[0]![1].trim())
    if (!range) return null
    const normalized = `bytes=${Number(range[1])}-${Number(range[2])}`
    for (const action of this.#actions.values()) {
      if (
        action.state !== 'timedout' ||
        this.context.now() >= action.permit.expiresAt ||
        action.flight.range !== normalized ||
        (action.flight.xhr === xhr && action.flight.meta === meta)
      )
        continue
      if (action.replacement && action.replacement !== meta) continue
      if (!this.routes!.earlyRetryRequestCurrent(action.flight.meta.request!)) continue
      const applied = this.routes!.applyEarlyRetry(meta.originalUrl, action.permit)
      if (applied) {
        if (!action.replacement)
          action.observations.push(Object.freeze({ at: this.context.now(), state: 'claimed' }))
        action.replacement = meta
        this.#selection.set(meta, action)
        return applied
      }
    }
    return null
  }

  accepted(xhr: XMLHttpRequest, meta: XhrMeta): void {
    const action = this.#selection.get(meta)
    if (!action) return
    this.#selection.delete(meta)
    if (
      this.metadata(xhr) !== meta ||
      meta.phase !== 'sent' ||
      !meta.request ||
      !this.#enabled() ||
      !this.routes!.acceptEarlyRetry(action.permit, meta.request)
    ) {
      action.state = 'failed'
      this.routes?.revokeEarlyRetry(action.permit)
      return
    }
    action.state = 'dispatched'
    action.replacement = meta
  }

  terminal(
    xhr: XMLHttpRequest,
    meta: XhrMeta,
    kind: 'success' | 'abort' | 'failure' | 'timeout',
  ): boolean {
    const flight = meta.request ? this.#active.get(meta.request.requestId) : null
    let ownTimeout = false
    if (flight && flight.xhr === xhr && flight.meta === meta) {
      const lease = flight.lease,
        action = lease ? this.#actions.get(lease.permit.id) : null
      if (kind === 'timeout' && action?.state === 'pending') {
        action.state = 'timedout'
        action.observations.push(Object.freeze({ at: this.context.now(), state: 'timedout' }))
        ownTimeout = true
      } else if (action?.state === 'pending') {
        action.state = 'failed'
        this.routes?.revokeEarlyRetry(action.permit)
      }
      this.#restore(flight)
      this.#active.delete(meta.request!.requestId)
    }
    for (const action of this.#actions.values())
      if (action.replacement === meta && action.state === 'dispatched') {
        const direct = (() => {
          try {
            return (
              this.#status?.get?.call(xhr) === 206 &&
              sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ''), meta.targetUrl)
            )
          } catch {
            return false
          }
        })()
        action.state =
          kind === 'success' &&
          direct &&
          flight?.total !== null &&
          flight?.loaded === action.flight.end - action.flight.start + 1
            ? 'succeeded'
            : 'failed'
      }
    return ownTimeout
  }

  cleanup(xhr: XMLHttpRequest, meta: XhrMeta): void {
    const selected = this.#selection.get(meta)
    if (selected) {
      this.#selection.delete(meta)
      selected.state = 'failed'
      this.routes?.revokeEarlyRetry(selected.permit)
    }
    const flight = meta.request ? this.#active.get(meta.request.requestId) : null
    if (flight && flight.xhr === xhr) {
      this.#restore(flight)
      this.#active.delete(meta.request!.requestId)
      if (!meta.settled && meta.phase === 'terminal' && meta.request && meta.applied) {
        for (const action of this.#actions.values())
          if (action.flight === flight && action.state === 'pending') {
            action.state = 'failed'
            this.routes?.revokeEarlyRetry(action.permit)
          }
        void this.context.routes.observe(
          this.context.observation(
            meta.request,
            meta.applied,
            meta.originalUrl,
            meta.targetUrl,
            '',
            0,
            meta.bytes,
            meta.startedAt,
            meta.responseAt,
            'abort',
            undefined,
            false,
          ),
        )
      }
    }
  }
  observations(permit: EarlyRetryPermit): readonly EarlyRetryObservation[] {
    const action = this.#actions.get(permit.id)
    return Object.freeze(action?.permit === permit ? action.observations.slice(0, 2) : [])
  }
  state(permit: EarlyRetryPermit): EarlyRetryActionState | null {
    const action = this.#actions.get(permit.id)
    if (!action || action.permit !== permit) return null
    if (['pending', 'timedout'].includes(action.state) && this.context.now() >= permit.expiresAt) {
      this.cancel(permit)
      action.state = 'expired'
    }
    return action.state
  }
  cancel(permit?: EarlyRetryPermit): void {
    for (const action of this.#actions.values())
      if (!permit || action.permit === permit) {
        this.#restore(action.flight)
        this.routes?.revokeEarlyRetry(action.permit)
        if (!['succeeded', 'failed', 'expired'].includes(action.state)) action.state = 'expired'
      }
  }
  restore(): void {
    this.cancel()
    this.#active.clear()
    this.#actions.clear()
    if (this.#descriptor && this.#ownsDescriptor())
      Object.defineProperty(this.proto, 'timeout', this.#descriptor)
    this.#capable = false
  }
}
