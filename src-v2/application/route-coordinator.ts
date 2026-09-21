import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG } from '../domain/catalog.ts'
import { chooseRoute } from '../domain/routing.ts'
import { mediaIdentity, parseMediaUrl, replaceUrlHost } from '../domain/url-policy.ts'
import {
  decisionId, recoveryActionId, type CatalogCandidate, type Clock, type DecisionId, type DomainEvent, type FailureKind,
  type MediaKind, type PlaybackDemand, type RepresentationId, type RouteDecision, type RouteIdentity,
  type RouteType, type TransportObservation, type RequestContext, type AttributionStatus, type AttributionSource,
} from '../domain/model.ts'
import type { EvidenceStore } from '../state/evidence-store.ts'
import type { RestrictionStore } from '../state/restriction-store.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'

export interface AppliedRouteDecision {
  readonly decision: RouteDecision
  readonly url: string | null
  readonly context: RouteIdentity | null
  readonly streamKey: string | null
  readonly sourceHost: string | null
  readonly attributionStatus?: AttributionStatus
  readonly attributionSource?: AttributionSource
  readonly playurlHostChanged?: boolean
}

interface DecisionRecord { readonly decision: RouteDecision; readonly context: RouteIdentity | null; readonly kind: MediaKind; readonly representation: RepresentationId | null }

export class RouteCoordinator {
  #serial = 0
  #recoverySerial = 0
  #decisions = new Map<DecisionId, DecisionRecord>()
  #plans = new Map<RepresentationId, RouteDecision>()
  #unlockedNative = new Map<RepresentationId, Set<string>>()
  #listeners = new Set<(event: DomainEvent) => void>()
  #hostLockedStreams = new Set<string>()
  #tentativeRepresentation: RepresentationId | null = null
  #tentativeTransfers = 0
  #streamPlans = new Map<string, RouteDecision>()
  #latest = new Map<string, Readonly<Record<string, unknown>>>()
  #lastSuccess = new Map<string, Readonly<Record<string, unknown>>>()
  #requested = new Map<string, RequestContext>()
  #effectiveRate = 2

  constructor(
    private readonly clock: Clock,
    private readonly session: SessionStore,
    private readonly settings: SettingsStore,
    private readonly restrictions: RestrictionStore,
    private readonly evidence: EvidenceStore,
    private readonly vault: SignedRouteVault,
  ) {}

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  resetEpoch(): void {
    this.#plans.clear(); this.#unlockedNative.clear(); this.#decisions.clear(); this.#hostLockedStreams.clear()
    this.#tentativeRepresentation = null; this.#tentativeTransfers = 0
    this.#streamPlans.clear(); this.#latest.clear(); this.#lastSuccess.clear(); this.#requested.clear()
    this.#effectiveRate = 2
  }
  invalidateForUserSetting(): void { this.#plans.clear(); this.#streamPlans.clear(); this.session.setAffinity(null) }

  requestStarted(request: RequestContext): void {
    const key = request.kind ?? 'unknown'
    this.#requested.set(key, request)
    this.#emit({ type: 'request-started', at: request.startedAt, request })
    this.#emit({ type: 'attribution-changed', at: request.startedAt, requestId: request.requestId, status: request.attributionStatus, kind: request.kind })
  }

  observePlaybackRate(rate: number): void { this.#effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 2 }
  playbackRate(): number { return this.#effectiveRate }

  latestVideoHost(): string | null {
    const row = this.#lastSuccess.get('video')
    return row?.outcome === 'success' && row.attributionStatus === 'matched' && this.clock.now() - Number(row.observedAt) <= 60_000 && typeof row.responseHost === 'string' ? row.responseHost : null
  }

  unlockNative(representation: RepresentationId, host: string): void {
    const hosts = this.#unlockedNative.get(representation) ?? new Set<string>()
    hosts.add(host)
    this.#unlockedNative.set(representation, hosts)
  }

  plan(representation: RepresentationId, demand: PlaybackDemand,
    boundary: 'startup' | 'new-epoch' | 'representation' | 'verified-failure' | 'watchdog' | 'user-setting',
    failedHost: string | null = null): RouteDecision {
    const context = this.vault.identity(representation)
    if (!context) return this.#pass('missing-representation', null, demand.kind)
    const previous = this.#plans.get(representation)
    if (previous && !['verified-failure', 'watchdog', 'user-setting'].includes(boundary) && this.#decisionAllowed(previous, context, demand.kind)) return previous
    const decision = this.#choose(context, demand, boundary, failedHost)
    this.#plans.set(representation, decision)
    return decision
  }

  recover(representation: RepresentationId, demand: PlaybackDemand, boundary: 'verified-failure' | 'watchdog', failedHost: string | null): RouteDecision {
    const decision = this.plan(representation, demand, boundary, failedHost)
    this.#emit({ type: 'recovery', at: this.clock.now(), action: {
      action: 'route-fallback', id: recoveryActionId(`recovery-${++this.#recoverySerial}`), kind: demand.kind, decision,
    } })
    return decision
  }

  apply(url: string, kindHint: MediaKind | null = null, demand?: PlaybackDemand): AppliedRouteDecision {
    const parsed = parseMediaUrl(url)
    if (!parsed) return { decision: this.#pass('invalid-url', null, kindHint ?? 'video'), url, context: null, streamKey: null, sourceHost: null }
    const streamKey = mediaIdentity(url)
    if (parsed.kind === 'live' || parsed.kind === 'resource' || parsed.kind === 'pcdn' || parsed.kind === 'suspected-pcdn') {
      return { decision: this.#pass(parsed.kind, parsed.host, kindHint ?? 'video'), url, context: null, streamKey, sourceHost: parsed.host }
    }
    const match = this.vault.match(url)
    const context = match.status === 'matched' ? match.context : null
    const kind = context?.kind ?? kindHint ?? 'video'
    if (streamKey && this.#hostLockedStreams.has(streamKey)) {
      const original = context ? this.vault.rootUrl(context.representation) ?? url : url
      const originalHost = parseMediaUrl(original)?.host ?? parsed.host
      const hard = this.#hardRestriction(originalHost, kind)
      const decision = hard ? this.#block(hard, originalHost) : this.#pass('host-locked', originalHost, kind)
      this.#remember(decision, context, kind)
      return { decision, url: hard ? null : original, context, streamKey, sourceHost: originalHost }
    }
    const playbackDemand = demand ?? { kind, requiredMbps: kind === 'audio' ? 0.5 : 8, highDemand: false }
    let decision = context ? this.#plans.get(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null
    const outputRole = context ? this.vault.outputRole(context.representation, url) : null
    if (context && outputRole?.role === 'backup' && decision?.host !== parsed.host && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
      const catalogIndex = TRUSTED_CATALOG.indexOf(parsed.host as typeof TRUSTED_CATALOG[number])
      const native = this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? new Set()).native
        .find(candidate => candidate.host === parsed.host && this.vault.resolve(candidate.handle, context) === parsed.url.href)
      const candidate = catalogIndex >= 0 ? { type: 'catalog-generated' as const, host: parsed.host, kind, catalogIndex } : native
      if (candidate) {
        decision = { action: 'rewrite', id: this.#nextId(), reason: 'player-fallback', routeType: candidate.type, host: parsed.host, candidate, ranking: [] }
        this.session.noteDecision(decision.id)
        this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
      }
    }
    if (!decision || decision.action === 'block' || !this.#decisionAllowed(decision, context, kind)) decision = context
      ? this.#choose(context, playbackDemand, 'request', null)
      : this.#catalogOnly(playbackDemand, parsed.host)
    let applied = this.#materialize(url, decision, context)
    if (decision.action === 'rewrite' && decision.candidate.type === 'catalog-generated' && applied === null) {
      const restriction = this.#hardRestriction(parsed.host, kind)
      decision = restriction ? this.#block(restriction, parsed.host) : this.#pass('catalog-host-not-replaceable', parsed.host, kind)
      applied = restriction ? null : url
    }
    const finalHost = applied ? parseMediaUrl(applied)?.host : null
    const finalRestriction = finalHost ? this.#hardRestriction(finalHost, kind) : null
    if (finalHost && finalRestriction) { decision = this.#block(finalRestriction, finalHost); applied = null }
    this.#remember(decision, context, kind)
    if (context) this.#plans.set(context.representation, decision)
    else if (streamKey) {
      this.#streamPlans.set(streamKey, decision)
      while (this.#streamPlans.size > 192) this.#streamPlans.delete(this.#streamPlans.keys().next().value as string)
    }
    const sourceHost = context ? parseMediaUrl(this.vault.rootUrl(context.representation) ?? url)?.host ?? parsed.host : parsed.host
    if (applied && context) this.vault.registerAlias(context.representation, applied)
    return { decision, url: applied, context, streamKey, sourceHost, attributionStatus: match.status, attributionSource: match.source, playurlHostChanged: outputRole?.hostChanged ?? false }
  }

  decisionRecord(id: DecisionId | null): DecisionRecord | null { return id ? this.#decisions.get(id) ?? null : null }

  playerOutput(representation: RepresentationId, original: string, decision: RouteDecision, originals: readonly string[]): { primary: string; backups: readonly string[] } {
    const context = this.vault.identity(representation)
    if (!context) return { primary: '', backups: [] }
    const allowed = (url: string): boolean => {
      const parsed = parseMediaUrl(url)
      return !!parsed && parsed.kind === 'normal' && !this.#hardRestriction(parsed.host, context.kind) && !this.vault.isInvalid(representation, parsed.host)
    }
    const stream = mediaIdentity(original)
    const lockedOriginal = stream && this.#hostLockedStreams.has(stream) ? this.vault.rootUrl(representation) : null
    const primary = lockedOriginal ?? this.#materialize(original, decision, context)
    if (!primary || !allowed(primary)) return { primary: '', backups: [] }
    const locked = mediaIdentity(original)
    const generated = locked && this.#hostLockedStreams.has(locked) ? [] : decision.ranking
      .filter(row => row.eligible && row.candidate.type === 'catalog-generated')
      .flatMap(row => { const url = replaceUrlHost(original, row.candidate.host); return url && allowed(url) ? [url] : [] }).slice(0, 2)
    const backups = lockedOriginal ? [] : [...new Set([...generated, ...originals.filter(allowed)])].filter(url => url !== primary).slice(0, 5)
    this.vault.registerAlias(representation, primary)
    for (const url of generated) this.vault.registerAlias(representation, url)
    this.vault.registerOutput(representation, original, primary, backups)
    return { primary, backups }
  }

  challenge(representation: RepresentationId, demand: PlaybackDemand, preferNative: boolean): AppliedRouteDecision | null {
    const context = this.vault.identity(representation), root = this.vault.rootUrl(representation)
    const rootKey = root ? mediaIdentity(root) : null
    if (!context || !root || this.settings.get().fixedHost || (rootKey !== null && this.#hostLockedStreams.has(rootKey))) return null
    const settings = this.settings.get(), restriction = this.restrictions.snapshot(context.kind)
    const catalog: CatalogCandidate[] = TRUSTED_CATALOG.map((host, index) => ({ type: 'catalog-generated', host, kind: context.kind, catalogIndex: index }))
    const native = this.vault.candidates(representation, this.#unlockedNative.get(representation) ?? new Set()).native
      .filter(candidate => candidate.activelyExplorable)
    const candidates = preferNative ? [...native, ...catalog] : [...catalog, ...native]
    const now = this.clock.now(), currentHost = this.session.get().affinity?.host
    const selected = candidates.find(candidate => {
      if (candidate.host === currentHost) return false
      if (this.#hardRestriction(candidate.host, candidate.kind)) return false
      const evidence = this.evidence.get(candidate.host, candidate.kind)
      return !evidence || !evidence.updatedAt || now - evidence.updatedAt >= 6 * 60 * 60 * 1000
    })
    if (!selected) return null
    const id = this.#nextId()
    const decision: RouteDecision = { action: 'rewrite', id, reason: 'safe-challenger', routeType: selected.type,
      host: selected.host, candidate: selected, ranking: Object.freeze([]) }
    const url = selected.type === 'catalog-generated' ? replaceUrlHost(root, selected.host) : this.vault.resolve(selected.handle, context)
    if (!url) return null
    this.#remember(decision, context, context.kind)
    this.#emit({ type: 'route-planned', at: now, decision })
    return { decision, url, context, streamKey: rootKey, sourceHost: parseMediaUrl(root)?.host ?? null }
  }

  async recordChallenge(applied: AppliedRouteDecision, bytes: number, elapsedMs: number, ttfbMs: number | null,
    outcome: 'success' | 'failure', failureKind: FailureKind | null): Promise<void> {
    const context = applied.context
    if (!context || applied.decision.action !== 'rewrite') return
    const valid = (): boolean => context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled
    if (!valid()) return
    if (failureKind === 'native-invalid' && applied.decision.routeType === 'native-signed') {
      this.vault.invalidate(context.representation, applied.decision.host)
      return
    }
    if (outcome === 'failure' && failureKind === null) return
    await this.evidence.record(applied.decision.host, context.kind, {
      requestId: `challenge:${applied.decision.id}`,
      at: this.clock.now(), source: 'challenge', outcome,
      throughputMbps: outcome === 'success' && bytes >= 64 * 1024 && elapsedMs > 0 ? (bytes * 8) / elapsedMs / 1000 : null,
      ttfbMs, failureKind,
    }, valid)
  }

  async observe(observation: TransportObservation): Promise<void> {
    const valid = (): boolean => observation.generation === this.session.get().generation && observation.epoch === this.session.get().epoch && !this.session.get().disabled
    this.#emit({ type: 'transport-completed', at: this.clock.now(), observation, detached: !valid() })
    if (!valid()) return
    const key = observation.kind ?? 'unknown', request = observation.request
    this.#latest.set(key, Object.freeze({ ...(request ?? {}), kind: observation.kind, routeType: observation.routeType,
      originalHost: observation.originalHost, targetHost: observation.targetHost, responseHost: observation.finalHost,
      outcome: observation.outcome, status: observation.status, observedAt: observation.completedAt,
      attributionStatus: request?.attributionStatus ?? (observation.representation ? 'matched' : 'waiting-data') }))
    if (observation.outcome === 'success' && observation.finalHost) this.#lastSuccess.set(key, this.#latest.get(key)!)
    if (observation.outcome === 'abort') return
    const evidenceHost = observation.finalHost ?? observation.targetHost
    if (!evidenceHost) return
    if (observation.status === 403 && observation.streamKey && observation.routeType === 'catalog-generated'
      && (observation.request?.sourceHost ?? observation.originalHost) !== observation.targetHost) {
      this.#hostLockedStreams.add(observation.streamKey)
      return
    }
    if (!observation.kind || (request && request.attributionStatus !== 'matched')) return
    const representation = observation.representation
    const requestId = request?.requestId ?? `${Number(observation.generation)}:${Number(observation.epoch)}:${observation.completedAt}:${observation.targetHost}`
    if (observation.outcome === 'success') {
      if (!observation.finalHost) return
      const throughputMbps = observation.bytes >= 64 * 1024 && observation.elapsedMs > 0
        ? (observation.bytes * 8) / observation.elapsedMs / 1000 : null
      await this.evidence.record(observation.finalHost, observation.kind, {
        requestId, at: observation.completedAt, source: 'transport', outcome: 'success', throughputMbps,
        ttfbMs: observation.ttfbMs, failureKind: null,
      }, valid)
      if (!valid()) return
      if (representation && this.vault.hosts(representation).includes(observation.finalHost)) {
        this.unlockNative(representation, observation.finalHost)
      }
      if (observation.kind === 'video') {
        const active = this.session.get().representation
        if (representation && representation !== active) {
          if (this.#tentativeRepresentation === representation) this.#tentativeTransfers++
          else { this.#tentativeRepresentation = representation; this.#tentativeTransfers = 1 }
          if (this.#tentativeTransfers >= 2) {
            this.session.setRepresentation(representation)
            this.#tentativeRepresentation = null; this.#tentativeTransfers = 0
          }
        } else { this.#tentativeRepresentation = null; this.#tentativeTransfers = 0 }
        if (representation && this.session.get().representation === representation && observation.decisionId) {
          this.session.setAffinity({ type: observation.routeType, host: observation.finalHost, confirmedAt: observation.completedAt,
            decisionId: observation.decisionId, representation })
        }
      }
      this.#emit({ type: 'route-confirmed', at: observation.completedAt, observation })
      return
    }
    const failureKind = observation.failureKind
    if (failureKind === 'native-invalid' && representation) {
      this.vault.invalidate(representation, evidenceHost)
      const demand: PlaybackDemand = { kind: observation.kind, requiredMbps: observation.kind === 'audio' ? 0.5 : 8, highDemand: false }
      this.recover(representation, demand, 'verified-failure', evidenceHost)
      return
    }
    if (!failureKind || !['network','body','timeout','http-5xx'].includes(failureKind)) return
    await this.evidence.record(evidenceHost, observation.kind, {
      requestId, at: observation.completedAt, source: 'transport', outcome: 'failure', throughputMbps: null,
      ttfbMs: observation.ttfbMs, failureKind,
    }, valid)
    if (!valid()) return
    if (representation) {
      const demand: PlaybackDemand = { kind: observation.kind, requiredMbps: observation.kind === 'audio' ? 0.5 : 8, highDemand: false }
      this.recover(representation, demand, 'verified-failure', evidenceHost)
    }
  }

  snapshot(): Readonly<Record<string, unknown>> {
    const session = this.session.get(), active = session.representation ? this.#plans.get(session.representation) : null
    const recent = [...this.#plans.entries()].filter(([representation]) => representation !== session.representation).slice(-4)
    const summarize = (decision: RouteDecision): Readonly<Record<string, unknown>> => Object.freeze({
      id: decision.id, action: decision.action, reason: decision.reason, routeType: decision.routeType, host: decision.host,
    })
    return Object.freeze({ planCount: this.#plans.size, activePlan: active ? Object.freeze({ ...summarize(active),
      ranking: Object.freeze(active.ranking.slice(0, 12).map(row => Object.freeze({ host: row.candidate.host, type: row.candidate.type,
        state: row.state, eligible: row.eligible, reasons: row.reasons, safeMbps: row.safeThroughputMbps,
        ratio: row.demandRatio, ttfbMs: row.medianTtfbMs }))),
    }) : null, recentPlans: Object.freeze(recent.map(([representation, decision]) => Object.freeze({ representation, ...summarize(decision) }))),
      affinity: session.affinity, latest: Object.freeze(Object.fromEntries(this.#latest)), lastSuccess: Object.freeze(Object.fromEntries(this.#lastSuccess)), requested: Object.freeze(Object.fromEntries(this.#requested)),
      attribution: session.representation ? 'confirmed' : this.#tentativeRepresentation ? 'awaiting-second-video-transfer' : 'awaiting-matched-video',
      representation: session.representation ? this.vault.groupSummary(session.representation) : null })
  }

  #choose(context: RouteIdentity, demand: PlaybackDemand,
    boundary: 'startup' | 'new-epoch' | 'representation' | 'request' | 'verified-failure' | 'watchdog' | 'user-setting',
    failedHost: string | null): RouteDecision {
    const settings = this.settings.get()
    const disabledCatalogHosts = new Set(TRUSTED_CATALOG.filter(host => settings.catalogOverrides[host] === false))
    const defaultUnavailableHosts = new Set(TRUSTED_CATALOG.filter(host => DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true))
    const restriction = this.restrictions.snapshot(context.kind)
    const unlocked = this.#unlockedNative.get(context.representation) ?? new Set<string>()
    const routes = this.vault.candidates(context.representation, unlocked)
    const catalog: CatalogCandidate[] = TRUSTED_CATALOG.map((host, index) => Object.freeze({ type: 'catalog-generated', host,
      kind: context.kind, catalogIndex: index }))
    const candidates = [...catalog, ...routes.native, ...(routes.root ? [routes.root] : [])]
    const id = this.#nextId()
    const current = this.#plans.get(context.representation), affinity = this.session.get().affinity
    const currentRoute = current && current.action !== 'block' && current.host ? { type: current.routeType, host: current.host }
      : context.kind === 'video' && affinity ? { type: affinity.type, host: affinity.host } : null
    const decision = chooseRoute({ candidates, evidenceFor: (host, kind) => this.evidence.get(host, kind),
      restrictions: { disabledCatalogHosts, defaultUnavailableHosts, blackHosts: restriction.blackHosts, deadHosts: restriction.deadHosts, hostLocked: new Set() },
      demand, fixedHost: settings.fixedHost, current: currentRoute, boundary, failedHost }, this.clock, id)
    this.session.noteDecision(id)
    this.#remember(decision, context, context.kind)
    this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
    return decision
  }

  #catalogOnly(demand: PlaybackDemand, originalHost: string): RouteDecision {
    const settings = this.settings.get(), restriction = this.restrictions.snapshot(demand.kind)
    const candidates: CatalogCandidate[] = TRUSTED_CATALOG.map((host, index) => ({ type: 'catalog-generated', host, kind: demand.kind, catalogIndex: index }))
    const id = this.#nextId()
    const decision = chooseRoute({ candidates, evidenceFor: (host, kind) => this.evidence.get(host, kind),
      restrictions: { disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter(host => settings.catalogOverrides[host] === false)),
        defaultUnavailableHosts: new Set(TRUSTED_CATALOG.filter(host => DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true)),
        blackHosts: restriction.blackHosts, deadHosts: restriction.deadHosts, hostLocked: new Set() }, demand,
      fixedHost: settings.fixedHost, current: this.session.get().affinity, boundary: 'request', failedHost: null }, this.clock, id)
    if (decision.action === 'block') {
      const forbidden = this.#hardRestriction(originalHost, demand.kind)
      return forbidden ? this.#block(forbidden, originalHost) : this.#pass('catalog-unavailable', originalHost, demand.kind)
    }
    return decision
  }

  #materialize(original: string, decision: RouteDecision, context: RouteIdentity | null): string | null {
    if (decision.action === 'block') return null
    if (decision.action === 'pass') return original
    if (decision.candidate.type === 'catalog-generated') return replaceUrlHost(original, decision.host)
    return context ? this.vault.resolve(decision.candidate.handle, context) : null
  }

  #pass(reason: string, host: string | null, kind: MediaKind): RouteDecision {
    return { action: 'pass', id: this.#nextId(), reason: reason.slice(0, 64), routeType: 'root-original', host, ranking: Object.freeze([]) }
  }

  #block(reason: 'catalog-disabled' | 'default-unavailable' | 'black' | 'dead' | 'circuit-open', host: string): RouteDecision {
    return { action: 'block', id: this.#nextId(), reason, routeType: 'root-original', host, ranking: Object.freeze([]) }
  }

  #hardRestriction(host: string, kind: MediaKind): 'catalog-disabled' | 'default-unavailable' | 'black' | 'dead' | 'circuit-open' | null {
    const settings = this.settings.get(), restriction = this.restrictions.snapshot(kind), evidence = this.evidence.get(host, kind)
    if (restriction.blackHosts.has(host)) return 'black'
    if (restriction.deadHosts.has(host)) return 'dead'
    if (settings.catalogOverrides[host] === false) return 'catalog-disabled'
    if (DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true) return 'default-unavailable'
    if (evidence && evidence.circuitUntil > this.clock.now()) return 'circuit-open'
    return null
  }

  #decisionAllowed(decision: RouteDecision, context: RouteIdentity | null, kind: MediaKind): boolean {
    if (decision.action === 'block' || !decision.host || this.#hardRestriction(decision.host, kind)) return false
    if (decision.action === 'pass') return true
    const candidate = decision.candidate
    if (candidate.type === 'catalog-generated') return true
    if (!context) return false
    return this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? new Set())
      .native.some(route => route.handle === candidate.handle && route.host === decision.host)
  }

  #nextId(): DecisionId { return decisionId(`decision-${++this.#serial}`) }
  #remember(decision: RouteDecision, context: RouteIdentity | null, kind: MediaKind): void {
    this.#decisions.set(decision.id, { decision, context, kind, representation: context?.representation ?? null })
    while (this.#decisions.size > 256) this.#decisions.delete(this.#decisions.keys().next().value as DecisionId)
  }
  #emit(event: DomainEvent): void { for (const listener of this.#listeners) listener(event) }
}
