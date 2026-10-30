import { catalogRestrictions, catalogCandidates } from '../domain/route-policy.ts'
import type { EarlyRetryAlternative, EarlyRetryPermit } from './early-retry-model.ts'
import { TRUSTED_CATALOG, isCatalogHost } from '../domain/catalog.ts'
import { chooseRoute } from '../domain/routing.ts'
import {
  isKnownPcdnHost,
  isOversizedBilibiliMedia,
  mediaIdentity,
  parseMediaUrl,
  replaceUrlHost,
} from '../domain/url-policy.ts'
import {
  decisionId,
  recoveryActionId,
  type CatalogCandidate,
  type Clock,
  type DecisionId,
  type DomainEvent,
  type FailureKind,
  type MediaKind,
  type NativeCandidate,
  type PlaybackDemand,
  type RepresentationId,
  type RouteDecision,
  type RouteIdentity,
  type TransportObservation,
  type RequestContext,
} from '../domain/model.ts'

import {
  startupCandidates,
  selectionCandidates,
  challengerCandidates,
} from './routing/candidate-planning.ts'
import { materializeRoute, catalogSource } from './routing/route-materialization.ts'
import {
  restrictionSnapshot,
  restrictedHost,
  canUseDecision,
} from './routing/route-restrictions.ts'
import {
  outputAllowed,
  opaquePlayerOutput,
  comparisonOutput,
  catalogPlayerOutput,
  normalPlayerOutput,
} from './routing/player-output.ts'
import type { RoutingPolicyReader } from './routing/routing-ports.ts'
import { classifyRequestSource, catalogRequestEligible } from './routing/request-routing.ts'
import {
  catalogObservationAllowed,
  classifyTransportResult,
  transportSnapshot,
} from './routing/transport-result.ts'
import type { HardRestriction } from '../domain/route-policy.ts'
import type { RuntimeIdPort } from '../platform/runtime-id-port.ts'

import type {
  AppliedRouteDecision,
  DecisionRecord,
  FallbackProgress,
  RoutePlanSummary,
  RouteSnapshot,
  RouteTransferSnapshot,
  StartupCandidate,
  StartupOptions,
} from './route-model.ts'
export type {
  AppliedRouteDecision,
  DecisionRecord,
  FallbackProgress,
  MediaRows,
  RoutePlanSummary,
  RouteRankingSummary,
  RouteSnapshot,
  RouteTransferSnapshot,
  StartupCandidate,
  StartupOptions,
} from './route-model.ts'

import type {
  RouteCoordinatorPort,
  RouteSessionPort,
  RouteSettingsPort,
  RouteRestrictionsPort,
  RouteEvidencePort,
  RouteVaultPort,
} from './route-ports.ts'
export type {
  RouteSessionPort,
  RouteSettingsPort,
  RouteRestrictionsPort,
  RouteEvidencePort,
  RouteVaultPort,
} from './route-ports.ts'

export class RouteCoordinator implements RouteCoordinatorPort {
  #policyRevision = 0
  #measurementIds = new WeakMap<object, string>()
  #serial = 0
  #recoverySerial = 0
  #decisions = new Map<DecisionId, DecisionRecord>()
  #plans = new Map<RepresentationId, RouteDecision>()
  #planIdentities = new Map<RepresentationId, RouteIdentity>()
  #requestedRepresentations = new Set<RepresentationId>()
  #unlockedNative = new Map<RepresentationId, Set<string>>()
  #listeners = new Set<(event: DomainEvent) => void>()
  #hostLockedStreams = new Set<string>()
  #startupIncompatible = new Map<string, Set<string>>()
  #tentativeRepresentation: RepresentationId | null = null
  #tentativeTransfers = 0
  #streamPlans = new Map<string, RouteDecision>()
  #latest = new Map<string, RouteTransferSnapshot>()
  #lastSuccess = new Map<string, RouteTransferSnapshot>()
  #requested = new Map<string, RequestContext>()
  #effectiveRate = 2
  #challengeAttempts = new Map<string, number>()
  #firstMediaAt = 0
  #pendingMedia = new Set<string>()
  #fallbacks = new Map<MediaKind, FallbackProgress>()
  #originalComparison = false
  #retrySuccesses: {
    request: RequestContext
    at: number
    bytes: number
    mbps: number
    ttfbMs: number
  }[] = []
  #retryPermit: {
    permit: EarlyRetryPermit
    request: RequestContext
    host: string
    demand: PlaybackDemand
    applied: AppliedRouteDecision | null
  } | null = null
  #retrySuppressed = new Map<string, number>()

  constructor(
    private readonly clock: Clock,
    private readonly session: RouteSessionPort,
    private readonly settings: RouteSettingsPort,
    private readonly restrictions: RouteRestrictionsPort,
    private readonly evidence: RouteEvidencePort,
    private readonly vault: RouteVaultPort,
    private readonly ids: RuntimeIdPort,
  ) {}

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  resetEpoch(): void {
    this.#retrySuccesses = []
    this.#retryPermit = null
    this.#policyRevision++
    this.#plans.clear()
    this.#planIdentities.clear()
    this.#unlockedNative.clear()
    this.#decisions.clear()
    this.#hostLockedStreams.clear()
    this.#startupIncompatible.clear()
    this.#requestedRepresentations.clear()
    this.#tentativeRepresentation = null
    this.#tentativeTransfers = 0
    this.#streamPlans.clear()
    this.#latest.clear()
    this.#lastSuccess.clear()
    this.#requested.clear()
    this.#effectiveRate = 2
    this.#challengeAttempts.clear()
    this.#firstMediaAt = 0
    this.#pendingMedia.clear()
    this.#fallbacks.clear()
  }
  invalidateForUserSetting(): void {
    this.#retryPermit = null
    this.#policyRevision++
    this.#plans.clear()
    this.#planIdentities.clear()
    this.#streamPlans.clear()
    this.#fallbacks.clear()
    this.session.setAffinity(null)
  }
  isOriginalComparison(): boolean {
    return this.#originalComparison
  }
  policyRevision(): number {
    return this.#policyRevision
  }
  isCatalogOnly(): boolean {
    return !this.#originalComparison && !this.settings.get().considerNativeSources
  }
  setOriginalComparison(enabled: boolean): void {
    if (this.#originalComparison === enabled) return
    this.#originalComparison = enabled
    this.#fallbacks.clear()
    this.invalidateForUserSetting()
  }

  requestStarted(request: RequestContext): void {
    if (request.kind && !this.#firstMediaAt) this.#firstMediaAt = request.startedAt
    if (request.kind) this.#pendingMedia.add(request.requestId)
    const key = request.kind ?? 'unknown'
    this.#requested.set(key, request)
    if (request.kind && request.representation) {
      const fallback = this.#fallbacks.get(request.kind)
      if (
        fallback?.representation === request.representation &&
        fallback.decisionId === request.decisionId &&
        fallback.plannedHost === request.targetHost &&
        fallback.stage === 'planned' &&
        request.generation === this.session.get().generation &&
        request.epoch === this.session.get().epoch
      ) {
        this.#fallbacks.set(request.kind, {
          ...fallback,
          stage: 'entered-hook',
          requestId: request.requestId,
        })
      }
    }
    this.#emit({ type: 'request-started', at: request.startedAt, request })
    this.#emit({
      type: 'attribution-changed',
      at: request.startedAt,
      requestId: request.requestId,
      status: request.attributionStatus,
      kind: request.kind,
    })
  }

  earlyRetryRequestCurrent(request: RequestContext): boolean {
    const settings = this.settings.get(),
      state = this.session.get()
    return (
      settings.earlyRetryEnabled &&
      !settings.disabled &&
      !state.disabled &&
      !settings.fixedHost &&
      this.isCatalogOnly() &&
      !this.#originalComparison &&
      request.kind === 'video' &&
      request.routeType === 'catalog-generated' &&
      request.attributionStatus === 'matched' &&
      request.generation === state.generation &&
      request.epoch === state.epoch &&
      request.routePolicyRevision === this.#policyRevision &&
      !!request.representation &&
      state.representation === request.representation &&
      request.authorityRevision === this.vault.identity(request.representation)?.authorityRevision
    )
  }

  earlyRetryAlternative(
    request: RequestContext,
    demand: PlaybackDemand,
  ): EarlyRetryAlternative | null {
    if (
      !this.earlyRetryRequestCurrent(request) ||
      demand.kind !== 'video' ||
      !Number.isFinite(demand.requiredMbps) ||
      demand.requiredMbps <= 0
    )
      return null
    const now = this.clock.now()
    this.#retrySuccesses = this.#retrySuccesses.filter(
      (row) => now - row.at <= 60_000 && now >= row.at,
    )
    const identity = this.vault.identity(request.representation!)
    if (!identity) return null
    const source = this.#catalogSource(identity)
    if (!source) return null
    const alternatives: EarlyRetryAlternative[] = []
    for (const host of TRUSTED_CATALOG) {
      if (
        host === request.targetHost ||
        this.#hardRestriction(host, 'video') ||
        this.#incompatible(source, host) ||
        this.vault.isInvalid(identity.representation, host)
      )
        continue
      const successes = this.#retrySuccesses.filter(
        (row) =>
          !this.#retrySuppressed.has(row.request.requestId) &&
          row.request.targetHost === host &&
          row.request.generation === request.generation &&
          row.request.epoch === request.epoch &&
          row.request.representation === request.representation &&
          row.request.authorityRevision === request.authorityRevision &&
          row.request.routePolicyRevision === request.routePolicyRevision,
      )
      const unique = [...new Map(successes.map((row) => [row.request.requestId, row])).values()]
      if (unique.length < 2) continue
      const safeMbps = Math.min(...unique.map((row) => row.mbps))
      if (safeMbps < demand.requiredMbps * 1.35) continue
      alternatives.push(
        Object.freeze({
          host,
          safeMbps,
          ttfbMs: Math.max(...unique.map((row) => row.ttfbMs)),
          successCount: unique.length,
          oldestAt: Math.min(...unique.map((row) => row.at)),
        }),
      )
    }
    return alternatives.sort((a, b) => b.safeMbps - a.safeMbps)[0] ?? null
  }

  prepareEarlyRetry(
    request: RequestContext,
    host: string,
    demand: PlaybackDemand,
  ): EarlyRetryPermit | null {
    if (this.#retryPermit && this.#retryPermit.permit.expiresAt > this.clock.now()) return null
    const alternative = this.earlyRetryAlternative(request, demand)
    if (!alternative || alternative.host !== host) return null
    const permit = Object.freeze({
      id: this.ids.next('request'),
      expiresAt: this.clock.now() + 2000,
    })
    this.#retryPermit = { permit, request, host, demand, applied: null }
    return permit
  }

  suppressEarlyRetryEvidence(requestIds: readonly string[]): () => void {
    const ids = [...new Set(requestIds)]
    if (
      ids.length > 32 ||
      ids.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 64) ||
      new Set([...this.#retrySuppressed.keys(), ...ids]).size > 32
    )
      throw new RangeError('Invalid early retry suppression scope')
    for (const id of ids) this.#retrySuppressed.set(id, (this.#retrySuppressed.get(id) ?? 0) + 1)
    this.#retrySuccesses = this.#retrySuccesses.filter(
      (row) => !this.#retrySuppressed.has(row.request.requestId),
    )
    let released = false
    return () => {
      if (released) return
      released = true
      for (const id of ids) {
        const count = this.#retrySuppressed.get(id) ?? 0
        if (count > 1) this.#retrySuppressed.set(id, count - 1)
        else this.#retrySuppressed.delete(id)
      }
    }
  }

  revokeEarlyRetry(permit: EarlyRetryPermit): void {
    if (this.#retryPermit?.permit === permit) this.#retryPermit = null
  }

  applyEarlyRetry(url: string, permit: EarlyRetryPermit): AppliedRouteDecision | null {
    const pending = this.#retryPermit
    if (
      !pending ||
      pending.permit !== permit ||
      this.clock.now() >= permit.expiresAt ||
      !this.earlyRetryRequestCurrent(pending.request)
    )
      return null
    const matched = this.vault.match(url)
    if (
      !matched.context ||
      !['exact', 'catalog-alias'].includes(matched.source) ||
      matched.context.representation !== pending.request.representation ||
      matched.context.authorityRevision !== pending.request.authorityRevision
    )
      return null
    const alternative = this.earlyRetryAlternative(pending.request, pending.demand)
    if (!alternative || alternative.host !== pending.host) return null
    const candidate: CatalogCandidate = {
      type: 'catalog-generated',
      host: pending.host,
      kind: 'video',
      catalogIndex: TRUSTED_CATALOG.indexOf(pending.host as (typeof TRUSTED_CATALOG)[number]),
    }
    const decision: RouteDecision = pending.applied?.decision ?? {
      action: 'rewrite',
      id: this.#nextId(),
      reason: 'early-retry',
      routeType: 'catalog-generated',
      host: pending.host,
      candidate,
      ranking: Object.freeze([]),
    }
    const output = this.#materialize(url, decision, matched.context)
    if (!output) return null
    this.#remember(decision, matched.context, 'video')
    pending.applied = {
      decision,
      url: output,
      context: matched.context,
      streamKey: mediaIdentity(url),
      sourceHost: parseMediaUrl(url)?.host ?? null,
    }
    return pending.applied
  }

  acceptEarlyRetry(permit: EarlyRetryPermit, request: RequestContext): boolean {
    const pending = this.#retryPermit
    if (
      !pending ||
      pending.permit !== permit ||
      !pending.applied ||
      this.clock.now() >= permit.expiresAt ||
      !this.earlyRetryRequestCurrent(pending.request) ||
      !this.earlyRetryRequestCurrent(request) ||
      request.targetHost !== pending.host ||
      request.decisionId !== pending.applied.decision.id ||
      this.latestRequested('video')?.requestId !== request.requestId
    )
      return false
    const decision = pending.applied.decision
    if (!this.#decisionAllowed(decision, pending.applied.context, 'video')) return false
    this.#retryPermit = null
    this.#savePlan(request.representation!, decision)
    this.session.setAffinity({
      type: 'catalog-generated',
      host: pending.host,
      confirmedAt: this.clock.now(),
      decisionId: decision.id,
      representation: request.representation,
    })
    this.#emit({ type: 'route-decision', at: this.clock.now(), decision })
    return true
  }

  observePlaybackRate(rate: number): void {
    this.#effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 2
  }
  playbackRate(): number {
    return this.#effectiveRate
  }
  firstMediaAt(): number {
    return this.#firstMediaAt
  }
  pendingMediaCount(): number {
    return this.#pendingMedia.size
  }
  latestRequested(kind: MediaKind): RequestContext | null {
    return this.#requested.get(kind) ?? null
  }

  recoveryEligible(
    request: Pick<
      RequestContext,
      'generation' | 'epoch' | 'representation' | 'authorityRevision' | 'routePolicyRevision'
    >,
  ): boolean {
    const state = this.session.get(),
      settings = this.settings.get()
    if (
      settings.disabled ||
      this.#originalComparison ||
      request.routePolicyRevision !== this.#policyRevision ||
      request.generation !== state.generation ||
      request.epoch !== state.epoch ||
      !request.representation
    )
      return false
    const identity = this.vault.identity(request.representation),
      decision = this.#plans.get(request.representation)
    return (
      !!identity &&
      identity.kind === 'video' &&
      identity.authorityRevision === request.authorityRevision &&
      this.vault.isCurrentIdentity(identity) &&
      !!decision &&
      this.#planIdentities.get(request.representation) === identity &&
      (!settings.fixedHost || decision.host === settings.fixedHost) &&
      this.#decisionAllowed(decision, identity, 'video')
    )
  }

  recognizesMedia(url: string): boolean {
    const parsed = parseMediaUrl(url)
    if (!parsed) return this.isCatalogOnly() && this.isBilibiliMedia(url)
    const match = this.vault.match(url)
    const media = parsed.kind !== 'unknown' || match.source === 'exact'
    return media && (!this.isCatalogOnly() || this.isBilibiliMedia(url))
  }

  isBilibiliMedia(url: string): boolean {
    const source = this.vault.match(url).source
    if (source === 'exact' || source === 'catalog-alias' || this.vault.wasPlayerOutput(url))
      return true
    const parsed = parseMediaUrl(url)
    if (!parsed) return isOversizedBilibiliMedia(url)
    if (parsed.kind === 'unknown') return false
    const host = parsed.host
    const bilivideo = /\.bilivideo\.(?:com|cn|net)$/.test(host)
    const akamai = host.startsWith('upos-') && host.endsWith('.akamaized.net')
    const knownPcdn =
      parsed.kind === 'pcdn' &&
      (isKnownPcdnHost(host) || parsed.url.pathname.includes('/upgcxcode/'))
    return bilivideo || akamai || knownPcdn
  }

  inspectOriginal(url: string): AppliedRouteDecision {
    const parsed = parseMediaUrl(url),
      match = this.vault.match(url)
    const context = match.context
    if (!parsed && this.isCatalogOnly() && this.isBilibiliMedia(url)) {
      return {
        decision: this.#block('catalog-only-non-get', null),
        url: null,
        context,
        streamKey: null,
        sourceHost: null,
      }
    }
    if (!parsed)
      return {
        decision: this.#pass('invalid-url', null, 'video'),
        url,
        context: null,
        streamKey: null,
        sourceHost: null,
      }
    if (this.isCatalogOnly() && this.isBilibiliMedia(url)) {
      return {
        decision: this.#block('catalog-only-non-get', parsed.host),
        url: null,
        context,
        streamKey: mediaIdentity(url),
        sourceHost: parsed.host,
      }
    }
    const restriction = this.#hardRestriction(parsed.host, context?.kind ?? null)
    const decision = restriction
      ? this.#block(restriction, parsed.host)
      : this.#pass('non-get-original', parsed.host, context?.kind ?? 'video')
    return {
      decision,
      url: restriction ? null : url,
      context,
      streamKey: mediaIdentity(url),
      sourceHost: parsed.host,
      attributionStatus: context ? 'weak' : match.status,
      attributionSource: match.source,
    }
  }

  startupOptions(url: string, catalogCursor = 0): StartupOptions | null {
    const parsed = parseMediaUrl(url),
      match = this.vault.match(url)
    const context = match.status === 'matched' || match.source === 'exact' ? match.context : null
    const source = context && this.isCatalogOnly() ? this.#catalogSource(context, url) : url
    const parsedSource = source ? parseMediaUrl(source) : null
    if (
      !parsed ||
      !source ||
      !parsedSource ||
      !parsedSource.replaceable ||
      (!this.isCatalogOnly() && parsedSource.kind !== 'normal') ||
      !context ||
      this.settings.get().fixedHost ||
      this.#originalComparison ||
      this.session.get().disabled
    )
      return null
    const bandwidth = this.vault.groupSummary(context.representation)?.bandwidth ?? 0
    const requiredMbps = Math.max(
      context.kind === 'audio' ? 0.5 : 2,
      ((bandwidth || (context.kind === 'audio' ? 192_000 : 4_000_000)) / 1_000_000) *
        this.#effectiveRate *
        1.25,
    )
    const candidates: StartupCandidate[] = []
    for (const candidate of startupCandidates({
      clock: this.clock,
      evidence: this.evidence,
      policy: this.#policyReader(),
      context,
      parsed,
      source,
      catalogCursor,
    })) {
      this.#measurementId(candidate, 'startup')
      candidates.push(candidate)
    }
    return {
      candidates,
      demand: { kind: context.kind, requiredMbps, highDemand: requiredMbps >= 12 },
      originalHost: parsedSource.host,
    }
  }

  noteStartupProbeResult(candidate: StartupCandidate, status: number | null): void {
    if (status !== 403 || candidate.type !== 'catalog-generated') return
    const context = candidate.context,
      current = this.session.get()
    if (
      context.generation !== current.generation ||
      context.epoch !== current.epoch ||
      !this.vault.isCurrentIdentity(context)
    )
      return
    this.#markIncompatible(candidate.url, candidate.host)
  }

  commitStartupChoice(
    url: string,
    selected: StartupCandidate | null,
    reason: string,
  ): RouteDecision | null {
    if (!selected || this.session.get().disabled || this.#originalComparison) return null
    if (this.isCatalogOnly() && selected.type !== 'catalog-generated') return null
    const fixedHost = this.settings.get().fixedHost
    if (fixedHost && (selected.type !== 'catalog-generated' || selected.host !== fixedHost))
      return null
    const match = this.vault.match(url)
    const context = match.status === 'matched' || match.source === 'exact' ? match.context : null
    if (
      !context ||
      context !== selected.context ||
      this.#hardRestriction(selected.host, context.kind) ||
      this.vault.isInvalid(context.representation, selected.host) ||
      this.#startupIncompatible.get(mediaIdentity(selected.url) ?? '')?.has(selected.host)
    )
      return null
    const source = this.isCatalogOnly() ? this.#catalogSource(context, url) : url
    if (!source) return null
    let decision: RouteDecision
    if (selected.original) {
      const candidates = this.vault.candidates(
        context.representation,
        this.#unlockedNative.get(context.representation) ?? new Set(),
      )
      const candidate = [candidates.root, ...candidates.native].find(
        (route) =>
          route?.handle &&
          route.host === selected.host &&
          this.vault.resolve(route.handle, context) === selected.url,
      )
      if (!candidate?.handle) return null
      decision = {
        action: 'pass',
        target: { type: 'selected-original', candidate: { ...candidate, type: 'root-original' } },
        id: this.#nextId(),
        reason,
        routeType: 'root-original',
        host: selected.host,
        ranking: [],
      }
    } else if (selected.type === 'catalog-generated') {
      const catalogIndex = TRUSTED_CATALOG.indexOf(
        selected.host as (typeof TRUSTED_CATALOG)[number],
      )
      if (
        catalogIndex < 0 ||
        replaceUrlHost(source, selected.host) !== selected.url ||
        parseMediaUrl(selected.url)?.kind !== 'normal'
      )
        return null
      const candidate: CatalogCandidate = {
        type: 'catalog-generated',
        host: selected.host,
        kind: context.kind,
        catalogIndex,
      }
      decision = {
        action: 'rewrite',
        id: this.#nextId(),
        reason,
        routeType: 'catalog-generated',
        host: selected.host,
        candidate,
        ranking: [],
      }
    } else {
      const native = this.vault
        .candidates(
          context.representation,
          this.#unlockedNative.get(context.representation) ?? new Set(),
        )
        .native.find(
          (candidate) =>
            candidate.host === selected.host &&
            this.vault.resolve(candidate.handle, context) === selected.url,
        )
      if (!native) return null
      decision = {
        action: 'rewrite',
        id: this.#nextId(),
        reason,
        routeType: 'native-signed',
        host: selected.host,
        candidate: native,
        ranking: [],
      }
    }
    this.#savePlan(context.representation, decision)
    this.session.noteDecision(decision.id)
    this.#remember(decision, context, context.kind)
    this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
    return decision
  }

  async recordStartupSuccess(
    candidate: StartupCandidate,
    bytes: number,
    elapsedMs: number,
    ttfbMs: number | null,
    workCurrent: () => boolean = () => true,
  ): Promise<void> {
    if (bytes < 64 * 1024 || elapsedMs <= 0) return
    if (this.isCatalogOnly() && candidate.type !== 'catalog-generated') return
    const context = candidate.context
    const valid = (): boolean =>
      workCurrent() &&
      context.generation === this.session.get().generation &&
      context.epoch === this.session.get().epoch &&
      !this.session.get().disabled &&
      this.vault.isCurrentIdentity(context) &&
      (!this.isCatalogOnly() || candidate.type === 'catalog-generated')
    if (!valid()) return
    await this.evidence.record(
      candidate.host,
      context.kind,
      {
        requestId: this.#measurementId(candidate, 'startup'),
        at: this.clock.now(),
        source: 'challenge',
        outcome: 'success',
        throughputMbps: (bytes * 8) / elapsedMs / 1000,
        ttfbMs,
        failureKind: null,
      },
      valid,
    )
  }

  latestVideoHost(): string | null {
    const row = this.#lastSuccess.get('video')
    return row?.outcome === 'success' &&
      row.attributionStatus === 'matched' &&
      this.clock.now() - Number(row.observedAt) <= 60_000 &&
      typeof row.responseHost === 'string'
      ? row.responseHost
      : null
  }

  unlockNative(representation: RepresentationId, host: string): void {
    const hosts = this.#unlockedNative.get(representation) ?? new Set<string>()
    hosts.add(host)
    this.#unlockedNative.set(representation, hosts)
  }

  plan(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary:
      'startup' | 'new-epoch' | 'representation' | 'verified-failure' | 'watchdog' | 'user-setting',
    failedHost: string | null = null,
  ): RouteDecision {
    const context = this.vault.identity(representation)
    if (!context) return this.#pass('missing-representation', null, demand.kind)
    if (this.#originalComparison) {
      const host = parseMediaUrl(this.vault.rootUrl(representation) ?? '')?.host ?? null
      const restriction = host ? this.#hardRestriction(host, context.kind) : null
      const original =
        restriction && host
          ? this.#block(restriction, host)
          : this.#pass('original-observe-only', host, context.kind)
      this.#savePlan(representation, original)
      this.#remember(original, context, context.kind)
      this.#emit({ type: 'route-planned', at: this.clock.now(), decision: original })
      return original
    }
    const previous = this.#currentPlan(representation)
    if (
      previous &&
      !['verified-failure', 'watchdog', 'user-setting'].includes(boundary) &&
      this.#decisionAllowed(previous, context, demand.kind)
    )
      return previous
    const decision = this.#choose(context, demand, boundary, failedHost)
    this.#savePlan(representation, decision)
    return decision
  }

  recover(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary: 'verified-failure' | 'watchdog',
    failedHost: string | null,
  ): RouteDecision {
    const decision = this.plan(representation, demand, boundary, failedHost)
    if (decision.action !== 'block' && decision.host && decision.host !== failedHost)
      this.#trackFallback(representation, demand.kind, decision)
    else {
      this.#fallbacks.delete(demand.kind)
      this.#emit({
        type: 'recovery',
        at: this.clock.now(),
        action: {
          action: 'none',
          id: recoveryActionId(`recovery-${++this.#recoverySerial}`),
          reason: 'no-legal-different-route',
        },
      })
    }
    return decision
  }

  recoverStartup(
    representation: RepresentationId,
    demand: PlaybackDemand,
    failedHost: string,
    preferredHosts: readonly string[],
  ): RouteDecision | null {
    if (this.#originalComparison) return null
    const context = this.vault.identity(representation)
    const root =
      context && this.isCatalogOnly()
        ? this.#catalogSource(context)
        : this.vault.rootUrl(representation)
    if (!root || !failedHost || demand.kind !== 'video') return null
    const options = this.startupOptions(root)
    if (!options) return null
    const alternatives = options.candidates.filter((candidate) => candidate.host !== failedHost)
    const locked = mediaIdentity(root) && this.#hostLockedStreams.has(mediaIdentity(root)!)
    const preferred = preferredHosts
      .map((host) => alternatives.find((candidate) => candidate.host === host))
      .find((candidate) => candidate !== undefined)
    const selected = locked
      ? (alternatives.find((candidate) => candidate.original) ?? preferred ?? alternatives[0])
      : (preferred ?? alternatives[0])
    if (!selected) return null
    const decision = this.commitStartupChoice(root, selected, 'startup-stall-fallback')
    if (decision && decision.host !== failedHost)
      this.#trackFallback(representation, 'video', decision)
    return decision && decision.host !== failedHost ? decision : null
  }

  apply(
    url: string,
    kindHint: MediaKind | null = null,
    demand?: PlaybackDemand,
    trustedPlayurl = false,
  ): AppliedRouteDecision {
    const parsed = parseMediaUrl(url)
    if (!parsed && this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
      return {
        decision: this.#block('catalog-unreplaceable', null),
        url: null,
        context: null,
        streamKey: null,
        sourceHost: null,
      }
    }
    if (!parsed)
      return {
        decision: this.#pass('invalid-url', null, kindHint ?? 'video'),
        url,
        context: null,
        streamKey: null,
        sourceHost: null,
      }
    if (this.#originalComparison) return this.#applyOriginalComparison(url, parsed, kindHint)
    if (this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
      return this.#applyCatalogOnly(url, parsed, kindHint, demand)
    }
    const streamKey = mediaIdentity(url)
    const source = classifyRequestSource({ kind: parsed.kind })
    if (source.type === 'opaque') return this.#applyOpaque(url, parsed, kindHint, streamKey)
    if (source.type === 'unreplaceable')
      return this.#applyUnreplaceable(url, parsed, kindHint, streamKey, source.reason)
    return this.#applyNormal(url, parsed, kindHint, streamKey, demand)
  }

  #applyOriginalComparison(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    kindHint: MediaKind | null,
  ): AppliedRouteDecision {
    const inspected = this.inspectOriginal(url)
    const decision =
      inspected.decision.action === 'pass'
        ? this.#pass(
            'original-observe-only',
            parsed.host,
            inspected.context?.kind ?? kindHint ?? 'video',
          )
        : inspected.decision
    const outputRole = inspected.context
      ? this.vault.outputRole(inspected.context.representation, url)
      : null
    this.#remember(decision, inspected.context, inspected.context?.kind ?? kindHint ?? 'video')
    return {
      ...inspected,
      decision,
      playurlHostChanged: outputRole?.hostChanged ?? false,
      ...(outputRole ? { playurlOutput: outputRole } : {}),
    }
  }

  #applyOpaque(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    kindHint: MediaKind | null,
    streamKey: string | null,
  ): AppliedRouteDecision {
    const match = this.vault.match(url),
      context = match.source === 'exact' ? match.context : null
    const restriction = this.#hardRestriction(parsed.host, context?.kind ?? kindHint)
    const decision = restriction
      ? this.#block(restriction, parsed.host)
      : this.#pass(
          'opaque-media-observation-only',
          parsed.host,
          context?.kind ?? kindHint ?? 'video',
        )
    const outputRole = context ? this.vault.outputRole(context.representation, url) : null
    return {
      decision,
      url: restriction ? null : url,
      context,
      streamKey,
      sourceHost: parsed.host,
      attributionStatus: match.status,
      attributionSource: match.source,
      playurlHostChanged: outputRole?.hostChanged ?? false,
      ...(outputRole ? { playurlOutput: outputRole } : {}),
    }
  }

  #applyUnreplaceable(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    kindHint: MediaKind | null,
    streamKey: string | null,
    reason: 'live' | 'resource' | 'pcdn' | 'suspected-pcdn',
  ): AppliedRouteDecision {
    // These URLs cannot be safely rewritten, but that never grants an exception to a host restriction.
    const restriction = this.#hardRestriction(parsed.host, kindHint)
    if (restriction)
      return {
        decision: this.#block(restriction, parsed.host),
        url: null,
        context: null,
        streamKey,
        sourceHost: parsed.host,
      }
    return {
      decision: this.#pass(reason, parsed.host, kindHint ?? 'video'),
      url,
      context: null,
      streamKey,
      sourceHost: parsed.host,
    }
  }

  #applyNormal(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    kindHint: MediaKind | null,
    streamKey: string | null,
    demand?: PlaybackDemand,
  ): AppliedRouteDecision {
    const match = this.vault.match(url)
    const context = match.status === 'matched' ? match.context : null
    const kind = context?.kind ?? kindHint ?? null
    if (streamKey && this.#hostLockedStreams.has(streamKey))
      return this.#applyHostLocked(url, parsed, context, streamKey, kind, demand)
    const playbackDemand = demand ?? {
      kind: kind ?? 'video',
      requiredMbps: kind === 'audio' ? 0.5 : 8,
      highDemand: false,
    }
    let decision = context
      ? this.#currentPlan(context.representation)
      : streamKey
        ? this.#streamPlans.get(streamKey)
        : null
    const outputRole = context ? this.vault.outputRole(context.representation, url) : null
    // Playurl preplans every quality before any route has proved successful.
    // On first use, prefer the now-observed video affinity, not that cold plan.
    // Explicit player backups and already-requested group recovery stay local.
    if (
      context?.kind === 'video' &&
      !this.#requestedRepresentations.has(context.representation) &&
      this.session.get().affinity &&
      outputRole?.role !== 'backup' &&
      !this.settings.get().fixedHost
    ) {
      decision = this.#choose(context, playbackDemand, 'representation', null)
    }
    if (
      context &&
      outputRole?.role === 'backup' &&
      decision?.host !== parsed.host &&
      !this.settings.get().fixedHost &&
      !this.#hardRestriction(parsed.host, kind)
    ) {
      const catalogIndex = TRUSTED_CATALOG.indexOf(parsed.host as (typeof TRUSTED_CATALOG)[number])
      const native = this.vault
        .candidates(
          context.representation,
          this.#unlockedNative.get(context.representation) ?? new Set(),
        )
        .native.find(
          (candidate) =>
            candidate.host === parsed.host &&
            this.vault.resolve(candidate.handle, context) === parsed.url.href,
        )
      const candidate =
        catalogIndex >= 0
          ? {
              type: 'catalog-generated' as const,
              host: parsed.host,
              kind: context.kind,
              catalogIndex,
            }
          : native
      if (candidate) {
        decision = this.#planPlayerFallback(candidate)
      }
    }
    if (
      !decision ||
      decision.action === 'block' ||
      !this.#decisionAllowed(decision, context, kind)
    ) {
      if (context) decision = this.#choose(context, playbackDemand, 'request', null)
      else if (!this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
        decision = this.#pass('unattributed-original-no-preflight', parsed.host, kind ?? 'video')
      } else decision = this.#catalogOnly(playbackDemand, parsed.host, kind)
    }
    let applied = this.#materialize(url, decision, context)
    if (
      decision.action === 'rewrite' &&
      decision.candidate.type === 'catalog-generated' &&
      applied === null
    ) {
      const restriction = this.#hardRestriction(parsed.host, kind)
      decision = restriction
        ? this.#block(restriction, parsed.host)
        : this.#pass('catalog-host-not-replaceable', parsed.host, kind ?? 'video')
      applied = restriction ? null : url
    }
    const finalHost = applied ? parseMediaUrl(applied)?.host : null
    const finalRestriction = finalHost ? this.#hardRestriction(finalHost, kind) : null
    if (finalHost && finalRestriction) {
      decision = this.#block(finalRestriction, finalHost)
      applied = null
    }
    this.#saveAppliedPlan(decision, context, streamKey, kind ?? 'video')
    const sourceHost = context
      ? (parseMediaUrl(this.vault.rootUrl(context.representation) ?? url)?.host ?? parsed.host)
      : parsed.host
    if (applied && context) this.vault.registerAlias(context.representation, applied)
    return {
      decision,
      url: applied,
      context,
      streamKey,
      sourceHost,
      attributionStatus: match.status,
      attributionSource: match.source,
      playurlHostChanged: outputRole?.hostChanged ?? false,
      ...(outputRole ? { playurlOutput: outputRole } : {}),
    }
  }

  #applyHostLocked(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    context: RouteIdentity | null,
    streamKey: string,
    kind: MediaKind | null,
    demand?: PlaybackDemand,
  ): AppliedRouteDecision {
    const original = context ? (this.vault.rootUrl(context.representation) ?? url) : url
    const originalHost = parseMediaUrl(original)?.host ?? parsed.host
    const hard = this.#hardRestriction(originalHost, kind)
    if (hard && context) {
      const fallback = this.#choose(
        context,
        demand ?? { kind: context.kind, requiredMbps: 8, highDemand: false },
        'watchdog',
        originalHost,
      )
      const safe = this.#materialize(original, fallback, context)
      const target = safe ? parseMediaUrl(safe)?.host : null
      if (
        safe &&
        target &&
        target !== originalHost &&
        !this.#hardRestriction(target, context.kind)
      ) {
        this.#savePlan(context.representation, fallback)
        return { decision: fallback, url: safe, context, streamKey, sourceHost: originalHost }
      }
    }
    const decision = hard
      ? this.#block(hard, originalHost)
      : this.#pass('host-locked', originalHost, kind ?? 'video')
    this.#remember(decision, context, kind ?? 'video')
    return { decision, url: hard ? null : original, context, streamKey, sourceHost: originalHost }
  }

  #applyCatalogOnly(
    url: string,
    parsed: NonNullable<ReturnType<typeof parseMediaUrl>>,
    kindHint: MediaKind | null,
    demand?: PlaybackDemand,
  ): AppliedRouteDecision {
    const match = this.vault.match(url),
      context = match.status === 'matched' ? match.context : null
    const root = context ? this.#catalogSource(context, url) : null
    const sourceHost = parseMediaUrl(root ?? url)?.host ?? parsed.host
    const streamKey = mediaIdentity(url)
    const outputRole = context ? this.vault.outputRole(context.representation, url) : null
    const blocked = (
      reason: 'catalog-unreplaceable' | 'catalog-unavailable',
    ): AppliedRouteDecision => ({
      decision: this.#block(reason, parsed.host),
      url: null,
      context,
      streamKey,
      sourceHost,
      attributionStatus: match.status,
      attributionSource: match.source,
      playurlHostChanged: outputRole?.hostChanged ?? false,
      ...(outputRole ? { playurlOutput: outputRole } : {}),
    })
    const exactPcdn = parsed.kind === 'pcdn' && match.source === 'exact' && !!context
    if (
      !catalogRequestEligible({
        kind: parsed.kind,
        replaceable: parsed.replaceable,
        exactPcdn,
        hasContext: !!context,
        hasSource: !!root,
      })
    ) {
      return blocked('catalog-unreplaceable')
    }
    const kind = context?.kind ?? kindHint
    const playbackDemand = demand ?? {
      kind: kind ?? 'video',
      requiredMbps: kind === 'audio' ? 0.5 : 8,
      highDemand: false,
    }
    let decision = context
      ? this.#currentPlan(context.representation)
      : streamKey
        ? this.#streamPlans.get(streamKey)
        : null
    if (
      context?.kind === 'video' &&
      !this.#requestedRepresentations.has(context.representation) &&
      this.session.get().affinity &&
      outputRole?.role !== 'backup' &&
      !this.settings.get().fixedHost
    ) {
      decision = this.#choose(context, playbackDemand, 'representation', null, url)
    }
    if (
      context &&
      outputRole?.role === 'backup' &&
      outputRole.catalogGenerated &&
      isCatalogHost(parsed.host) &&
      !this.settings.get().fixedHost &&
      !this.#hardRestriction(parsed.host, kind) &&
      !this.#incompatible(url, parsed.host)
    ) {
      const candidate = {
        type: 'catalog-generated' as const,
        host: parsed.host,
        kind: context.kind,
        catalogIndex: TRUSTED_CATALOG.indexOf(parsed.host),
      }
      decision = this.#planPlayerFallback(candidate)
    }
    const allowed = (candidate: RouteDecision | null | undefined): boolean =>
      !!candidate &&
      candidate.action === 'rewrite' &&
      candidate.candidate.type === 'catalog-generated' &&
      isCatalogHost(candidate.host) &&
      !this.#hardRestriction(candidate.host, kind) &&
      !this.#incompatible(url, candidate.host) &&
      (!context || !this.vault.isInvalid(context.representation, candidate.host))
    if (!allowed(decision)) {
      decision = context
        ? this.#choose(context, playbackDemand, 'request', null, url)
        : this.#catalogOnly(playbackDemand, parsed.host, kind, url)
    }
    if (!decision || decision.action !== 'rewrite' || !allowed(decision)) {
      return blocked('catalog-unavailable')
    }
    const target = replaceUrlHost(url, decision.host)
    if (
      !target ||
      parseMediaUrl(target)?.kind !== 'normal' ||
      parseMediaUrl(target)?.host !== decision.host ||
      this.#hardRestriction(decision.host, kind) ||
      this.#incompatible(url, decision.host)
    )
      return blocked('catalog-unavailable')
    this.#saveAppliedPlan(decision, context, streamKey, kind ?? 'video')
    if (context) this.vault.registerAlias(context.representation, target)
    return {
      decision,
      url: target,
      context,
      streamKey,
      sourceHost,
      attributionStatus: match.status,
      attributionSource: match.source,
      playurlHostChanged: outputRole?.hostChanged ?? false,
      ...(outputRole ? { playurlOutput: outputRole } : {}),
    }
  }

  decisionRecord(id: DecisionId | null): DecisionRecord | null {
    return id ? (this.#decisions.get(id) ?? null) : null
  }

  opaqueOutput(
    representation: RepresentationId,
    original: string,
    originals: readonly string[],
    source: 'trusted-api' | 'page-hint',
  ): { primary: string; backups: readonly string[] } {
    const context = this.vault.identity(representation)
    if (!context) return { primary: '', backups: [] }
    if (this.isCatalogOnly()) return { primary: '', backups: [] }
    const { primary, backups } = opaquePlayerOutput(
      this.#policyReader(),
      representation,
      context,
      originals,
    )
    if (primary) {
      const host = parseMediaUrl(primary)!.host
      const decision = this.#pass(
        primary === original ? 'opaque-original' : 'opaque-original-backup',
        host,
        context.kind,
      )
      this.#remember(decision, context, context.kind)
      this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
      this.vault.registerOutput(representation, original, primary, backups, decision.id, source)
    }
    return { primary, backups }
  }

  playerOutput(
    representation: RepresentationId,
    original: string,
    decision: RouteDecision,
    originals: readonly string[],
    source: 'trusted-api' | 'page-hint' = 'trusted-api',
    recordOutput = true,
  ): { primary: string; backups: readonly string[] } {
    const context = this.vault.identity(representation)
    if (!context) return { primary: '', backups: [] }
    const policy = this.#policyReader()
    const allowed = (url: string): boolean => outputAllowed(policy, representation, context, url)
    const stream = mediaIdentity(original)
    if (this.#originalComparison) {
      const { primary, backups, permitted } = comparisonOutput(originals, allowed)
      if (primary) {
        const selectedHost = parseMediaUrl(primary)!.host
        const outputDecision =
          primary === original && decision.action === 'pass' && decision.host === selectedHost
            ? decision
            : this.#pass('original-backup', selectedHost, context.kind)
        if (outputDecision !== decision) {
          this.#savePlan(representation, outputDecision)
          this.#remember(outputDecision, context, context.kind)
          this.#emit({ type: 'route-planned', at: this.clock.now(), decision: outputDecision })
        }
        this.vault.registerOutput(
          representation,
          original,
          primary,
          backups,
          outputDecision.id,
          source,
        )
        for (const url of permitted.slice(0, 6)) this.vault.registerAlias(representation, url)
      }
      // A player may keep these URLs after comparison mode ends. Do not emit an
      // external URL that the strict request hook could no longer recognize.
      return this.isBilibiliMedia(primary)
        ? { primary, backups: backups.filter((url) => this.isBilibiliMedia(url)) }
        : { primary: '', backups: [] }
    }
    if (this.isCatalogOnly()) {
      const sourceUrl = this.#catalogSource(context, original)
      const output = catalogPlayerOutput(
        sourceUrl,
        decision,
        allowed,
        (url, host) => this.#incompatible(url, host),
        this.settings.get().backupFamilyDiversityEnabled,
      )
      if (!output || !sourceUrl) return { primary: '', backups: [] }
      const { primary, backups } = output
      this.vault.registerAlias(representation, primary)
      for (const backup of backups) this.vault.registerAlias(representation, backup)
      if (recordOutput)
        this.vault.registerOutput(
          representation,
          sourceUrl,
          primary,
          backups,
          decision.id,
          source,
          true,
        )
      return { primary, backups: Object.freeze(backups) }
    }
    const output = normalPlayerOutput(
      representation,
      original,
      decision,
      originals,
      stream,
      policy,
      allowed,
      (key) => this.#hostLockedStreams.has(key),
      () => this.#materialize(original, decision, context),
      this.settings.get().backupFamilyDiversityEnabled,
    )
    if (!output) return { primary: '', backups: [] }
    const { primary, backups } = output
    this.vault.registerAlias(representation, primary)
    for (const url of backups) this.vault.registerAlias(representation, url)
    this.vault.registerOutput(representation, original, primary, backups, decision.id, source)
    // Alias and output indexes are bounded. Prune a cap-skipped Native backup
    // before the page can retain it across a later switch to Catalog-only mode.
    return this.isBilibiliMedia(primary)
      ? { primary, backups: backups.filter((url) => this.isBilibiliMedia(url)) }
      : { primary: '', backups: [] }
  }

  challenge(
    representation: RepresentationId,
    _demand: PlaybackDemand,
    preferNative: boolean,
    excludedHosts: ReadonlySet<string> = new Set(),
    catalogCursor = 0,
  ): AppliedRouteDecision | null {
    const context = this.vault.identity(representation)
    const root =
      context && this.isCatalogOnly()
        ? this.#catalogSource(context)
        : this.vault.rootUrl(representation)
    const rootKey = root ? mediaIdentity(root) : null
    if (
      !context ||
      !root ||
      this.settings.get().fixedHost ||
      this.#originalComparison ||
      (rootKey !== null && this.#hostLockedStreams.has(rootKey))
    )
      return null
    this.settings.get()
    this.restrictions.snapshot(context.kind)
    const native = this.isCatalogOnly()
      ? []
      : this.vault
          .candidates(representation, this.#unlockedNative.get(representation) ?? new Set())
          .native.filter((candidate) => candidate.activelyExplorable)
    const candidates = challengerCandidates(context.kind, native, preferNative, catalogCursor)
    const now = this.clock.now(),
      currentHost = this.session.get().affinity?.host
    const selected = candidates.find((candidate) => {
      if (candidate.host === currentHost || excludedHosts.has(candidate.host)) return false
      if (this.#hardRestriction(candidate.host, candidate.kind)) return false
      if (candidate.type === 'catalog-generated' && this.#incompatible(root, candidate.host))
        return false
      const attemptKey = `${context.representation}:${candidate.host}`
      if (now - (this.#challengeAttempts.get(attemptKey) ?? 0) < 6 * 60 * 60_000) return false
      const evidence = this.evidence.get(candidate.host, candidate.kind)
      return !evidence || !evidence.updatedAt || now - evidence.updatedAt >= 6 * 60 * 60 * 1000
    })
    if (!selected) return null
    const id = this.#nextId()
    const decision: RouteDecision = {
      action: 'rewrite',
      id,
      reason: 'safe-challenger',
      routeType: selected.type,
      host: selected.host,
      candidate: selected,
      ranking: Object.freeze([]),
    }
    const url =
      selected.type === 'catalog-generated'
        ? replaceUrlHost(root, selected.host)
        : this.vault.resolve(selected.handle, context)
    if (!url || (selected.type === 'catalog-generated' && parseMediaUrl(url)?.kind !== 'normal'))
      return null
    this.#challengeAttempts.set(`${context.representation}:${selected.host}`, now)
    this.#remember(decision, context, context.kind)
    this.#emit({ type: 'route-planned', at: now, decision })
    const applied = {
      decision,
      url,
      context,
      streamKey: rootKey,
      sourceHost: parseMediaUrl(root)?.host ?? null,
    }
    this.#measurementId(applied, 'challenge')
    return applied
  }

  async recordChallenge(
    applied: AppliedRouteDecision,
    bytes: number,
    elapsedMs: number,
    ttfbMs: number | null,
    outcome: 'success' | 'failure',
    failureKind: FailureKind | null,
    workCurrent: () => boolean = () => true,
  ): Promise<void> {
    const context = applied.context
    if (!context || applied.decision.action !== 'rewrite') return
    if (this.isCatalogOnly() && applied.decision.routeType !== 'catalog-generated') return
    const valid = (): boolean =>
      workCurrent() &&
      context.generation === this.session.get().generation &&
      context.epoch === this.session.get().epoch &&
      !this.session.get().disabled &&
      this.vault.isCurrentIdentity(context) &&
      (!this.isCatalogOnly() || applied.decision.routeType === 'catalog-generated')
    if (!valid()) return
    if (failureKind === 'native-invalid' && applied.decision.routeType === 'native-signed') {
      this.vault.invalidate(context.representation, applied.decision.host)
      return
    }
    // Active measurement cannot establish a playback circuit. A failed candidate
    // is skipped by the bounded attempt ledger; only player Transport can punish a host.
    if (outcome === 'failure') return
    await this.evidence.record(
      applied.decision.host,
      context.kind,
      {
        requestId: this.#measurementId(applied, 'challenge'),
        at: this.clock.now(),
        source: 'challenge',
        outcome,
        throughputMbps:
          outcome === 'success' && bytes >= 64 * 1024 && elapsedMs > 0
            ? (bytes * 8) / elapsedMs / 1000
            : null,
        ttfbMs,
        failureKind,
      },
      valid,
    )
  }

  async observe(observation: TransportObservation): Promise<void> {
    if (observation.request) this.#pendingMedia.delete(observation.request.requestId)
    const valid = (): boolean =>
      observation.generation === this.session.get().generation &&
      observation.epoch === this.session.get().epoch &&
      !this.session.get().disabled &&
      (observation.request?.authorityRevision == null ||
        !observation.representation ||
        this.vault.identity(observation.representation)?.authorityRevision ===
          observation.request.authorityRevision)
    const catalogObserved = (): boolean =>
      catalogObservationAllowed(this.isCatalogOnly(), observation)
    const controlsCurrent = (): boolean =>
      valid() &&
      (observation.request
        ? observation.request.routePolicyRevision === this.#policyRevision
        : !!observation.decisionId &&
          this.#decisions.get(observation.decisionId)?.policyRevision === this.#policyRevision)
    if (
      controlsCurrent() &&
      this.isCatalogOnly() &&
      observation.routeType === 'catalog-generated' &&
      isCatalogHost(observation.targetHost) &&
      observation.finalHost &&
      observation.finalHost !== observation.targetHost &&
      observation.streamKey
    )
      this.#markIncompatibleKey(observation.streamKey, observation.targetHost)
    this.#emit({
      type: 'transport-completed',
      at: this.clock.now(),
      observation,
      detached: !valid() || !catalogObserved(),
    })
    if (!valid() || !catalogObserved()) return
    if (controlsCurrent() && observation.kind && observation.request) {
      const fallback = this.#fallbacks.get(observation.kind)
      if (
        fallback?.requestId === observation.request.requestId &&
        fallback.stage === 'entered-hook'
      ) {
        this.#fallbacks.set(observation.kind, {
          ...fallback,
          stage: observation.status > 0 ? 'response-observed' : 'request-failed',
          responseHost: observation.finalHost,
          outcome: observation.outcome,
          status: observation.status,
        })
      }
    }
    const key = observation.kind ?? 'unknown'
    this.#latest.set(key, transportSnapshot(observation))
    if (observation.outcome === 'success' && observation.finalHost)
      this.#lastSuccess.set(key, this.#latest.get(key)!)
    const result = classifyTransportResult(observation)
    if (result.type === 'ignore') return
    if (result.type === 'catalog-forbidden') {
      if (!controlsCurrent()) return
      this.#markIncompatibleKey(observation.streamKey!, observation.targetHost)
      this.#hostLockedStreams.add(observation.streamKey!)
      if (observation.kind === 'video' && observation.representation)
        this.recoverStartup(
          observation.representation,
          { kind: 'video', requiredMbps: 8, highDemand: false },
          observation.targetHost,
          [],
        )
      return
    }
    const representation = observation.representation
    if (result.type === 'native-invalid') {
      if (!controlsCurrent()) return
      this.vault.invalidate(representation!, result.host)
      const demand: PlaybackDemand = {
        kind: result.kind,
        requiredMbps: result.kind === 'audio' ? 0.5 : 8,
        highDemand: false,
      }
      this.recover(representation!, demand, 'verified-failure', result.host)
      return
    }
    await this.evidence.record(
      result.host,
      result.kind,
      result.sample,
      () => valid() && catalogObserved(),
    )
    if (!controlsCurrent() || !catalogObserved()) return
    if (result.type === 'success') {
      const request = observation.request
      if (
        request &&
        !this.#retrySuppressed.has(request.requestId) &&
        Number.isSafeInteger(observation.retryVerifiedBytes) &&
        (observation.retryVerifiedBytes ?? 0) >= 64 * 1024 &&
        request.generation === observation.generation &&
        request.epoch === observation.epoch &&
        request.representation === observation.representation &&
        request.kind === observation.kind &&
        request.targetHost === observation.targetHost &&
        observation.kind === 'video' &&
        observation.routeType === 'catalog-generated' &&
        observation.status === 206 &&
        observation.responseUrlMatchesRequest === true &&
        observation.finalHost === observation.targetHost &&
        observation.bytes >= 64 * 1024 &&
        observation.elapsedMs > 0 &&
        observation.ttfbMs !== null &&
        Number.isFinite(observation.ttfbMs) &&
        observation.ttfbMs >= 0 &&
        this.evidence
          .get(observation.targetHost, 'video')
          ?.samples.some(
            (sample) =>
              sample.requestId === request.requestId &&
              sample.at === observation.completedAt &&
              sample.outcome === 'success' &&
              sample.source === 'transport',
          )
      ) {
        this.#retrySuccesses = this.#retrySuccesses.filter(
          (row) =>
            row.request.requestId !== request.requestId && this.clock.now() - row.at <= 60_000,
        )
        this.#retrySuccesses.push({
          request,
          at: observation.completedAt,
          bytes: observation.retryVerifiedBytes!,
          mbps: (observation.retryVerifiedBytes! * 8) / observation.elapsedMs / 1000,
          ttfbMs: observation.ttfbMs,
        })
        this.#retrySuccesses = this.#retrySuccesses.slice(-32)
      }
      this.#confirmObservedTransport(observation, representation)
      return
    }
    if (representation) {
      const demand: PlaybackDemand = {
        kind: observation.kind!,
        requiredMbps: observation.kind === 'audio' ? 0.5 : 8,
        highDemand: false,
      }
      this.recover(representation, demand, 'verified-failure', result.host)
    }
  }

  #confirmObservedTransport(
    observation: TransportObservation,
    representation: RepresentationId | null,
  ): void {
    if (representation && this.vault.hosts(representation).includes(observation.finalHost!)) {
      this.unlockNative(representation, observation.finalHost!)
    }
    if (observation.kind === 'video') {
      const active = this.session.get().representation
      if (representation && representation !== active) {
        if (this.#tentativeRepresentation === representation) this.#tentativeTransfers++
        else {
          this.#tentativeRepresentation = representation
          this.#tentativeTransfers = 1
        }
        if (this.#tentativeTransfers >= 2) {
          this.session.setRepresentation(representation)
          this.#tentativeRepresentation = null
          this.#tentativeTransfers = 0
        }
      } else {
        this.#tentativeRepresentation = null
        this.#tentativeTransfers = 0
      }
      if (
        representation &&
        this.session.get().representation === representation &&
        observation.decisionId
      ) {
        this.session.setAffinity({
          type: observation.routeType,
          host: observation.finalHost!,
          confirmedAt: observation.completedAt,
          decisionId: observation.decisionId,
          representation,
        })
      }
    }
    this.#emit({ type: 'route-confirmed', at: observation.completedAt, observation })
  }

  snapshot(): RouteSnapshot {
    const session = this.session.get(),
      active = session.representation ? this.#plans.get(session.representation) : null
    const recent = [...this.#plans.entries()]
      .filter(([representation]) => representation !== session.representation)
      .slice(-4)
    const summarize = (decision: RouteDecision): RoutePlanSummary =>
      Object.freeze({
        id: decision.id,
        action: decision.action,
        reason: decision.reason,
        routeType: decision.routeType,
        host: decision.host,
      })
    return Object.freeze({
      originalComparison: this.#originalComparison,
      planCount: this.#plans.size,
      activePlan: active
        ? Object.freeze({
            ...summarize(active),
            ranking: Object.freeze(
              active.ranking.slice(0, 12).map((row) =>
                Object.freeze({
                  host: row.candidate.host,
                  type: row.candidate.type,
                  state: row.state,
                  eligible: row.eligible,
                  reasons: row.reasons,
                  safeMbps: row.safeThroughputMbps,
                  ratio: row.demandRatio,
                  ttfbMs: row.medianTtfbMs,
                }),
              ),
            ),
          })
        : null,
      recentPlans: Object.freeze(
        recent.map(([representation, decision]) =>
          Object.freeze({ representation, ...summarize(decision) }),
        ),
      ),
      affinity: session.affinity,
      latest: Object.freeze(Object.fromEntries(this.#latest)),
      lastSuccess: Object.freeze(Object.fromEntries(this.#lastSuccess)),
      requested: Object.freeze(Object.fromEntries(this.#requested)),
      attribution: session.representation
        ? 'confirmed'
        : this.#tentativeRepresentation
          ? 'awaiting-second-video-transfer'
          : 'awaiting-matched-video',
      representation: session.representation
        ? this.vault.groupSummary(session.representation)
        : null,
      fallback: Object.freeze(Object.fromEntries(this.#fallbacks)),
    })
  }

  #trackFallback(representation: RepresentationId, kind: MediaKind, decision: RouteDecision): void {
    const identity = this.vault.identity(representation)
    if (!decision.host || !identity || identity.kind !== kind) return
    const actionId = recoveryActionId(`recovery-${++this.#recoverySerial}`)
    this.#fallbacks.set(
      kind,
      Object.freeze({
        actionId,
        representation,
        decisionId: decision.id,
        plannedHost: decision.host,
        routeType: decision.routeType,
        stage: 'planned',
        requestId: null,
        responseHost: null,
        outcome: null,
        status: null,
      }),
    )
    this.#emit({
      type: 'recovery',
      at: this.clock.now(),
      action: { action: 'route-fallback', id: actionId, kind, identity, decision },
    })
  }

  #choose(
    context: RouteIdentity,
    demand: PlaybackDemand,
    boundary:
      | 'startup'
      | 'new-epoch'
      | 'representation'
      | 'request'
      | 'verified-failure'
      | 'watchdog'
      | 'user-setting',
    failedHost: string | null,
    sourceUrl?: string,
  ): RouteDecision {
    const settings = this.settings.get()
    const { disabledCatalogHosts, defaultUnavailableHosts } = catalogRestrictions(
      settings.catalogOverrides,
    )
    const restriction = this.restrictions.snapshot(context.kind)
    const unlocked = this.#unlockedNative.get(context.representation) ?? new Set<string>()
    const routes = this.vault.candidates(context.representation, unlocked)
    const root = this.isCatalogOnly()
      ? (this.#catalogSource(context, sourceUrl) ?? '')
      : (sourceUrl ?? this.vault.rootUrl(context.representation) ?? '')
    if (this.isCatalogOnly() && !root) return this.#block('catalog-unreplaceable', null)
    const candidates = selectionCandidates(
      context,
      root,
      routes,
      this.vault,
      () => this.isCatalogOnly(),
      (url, host) => this.#incompatible(url, host),
    )
    const id = this.#nextId()
    const current = this.#currentPlan(context.representation),
      affinity = this.session.get().affinity
    const currentRoute =
      boundary === 'representation' && context.kind === 'video' && affinity
        ? { type: affinity.type, host: affinity.host }
        : current && current.action !== 'block' && current.host
          ? { type: current.routeType, host: current.host }
          : context.kind === 'video' && affinity
            ? { type: affinity.type, host: affinity.host }
            : null
    const decision = chooseRoute(
      {
        candidates,
        evidenceFor: (host, kind) => this.evidence.get(host, kind),
        restrictions: {
          disabledCatalogHosts,
          defaultUnavailableHosts,
          blackHosts: restriction.blackHosts,
          deadHosts: restriction.deadHosts,
          hostLocked: new Set(),
        },
        demand,
        fixedHost: settings.fixedHost,
        current: currentRoute,
        boundary,
        failedHost,
      },
      this.clock,
      id,
    )
    this.session.noteDecision(id)
    this.#remember(decision, context, context.kind)
    this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
    return decision
  }

  #catalogOnly(
    demand: PlaybackDemand,
    originalHost: string,
    knownKind: MediaKind | null,
    sourceUrl?: string,
  ): RouteDecision {
    const settings = this.settings.get(),
      restriction = this.#restrictionSnapshot(knownKind)
    const candidates: CatalogCandidate[] = catalogCandidates(demand.kind).filter(
      (candidate) => !sourceUrl || !this.#incompatible(sourceUrl, candidate.host),
    )
    const id = this.#nextId()
    const decision = chooseRoute(
      {
        candidates,
        evidenceFor: (host, kind) => this.evidence.get(host, kind),
        restrictions: {
          ...catalogRestrictions(settings.catalogOverrides),
          blackHosts: restriction.blackHosts,
          deadHosts: restriction.deadHosts,
          hostLocked: new Set(),
        },
        demand,
        fixedHost: settings.fixedHost,
        current: this.session.get().affinity,
        boundary: 'request',
        failedHost: null,
      },
      this.clock,
      id,
    )
    if (decision.action === 'block') {
      if (this.isCatalogOnly()) return this.#block('catalog-unavailable', originalHost)
      const forbidden = this.#hardRestriction(originalHost, knownKind)
      return forbidden
        ? this.#block(forbidden, originalHost)
        : this.#pass('catalog-unavailable', originalHost, demand.kind)
    }
    return decision
  }

  #materialize(
    original: string,
    decision: RouteDecision,
    context: RouteIdentity | null,
  ): string | null {
    return materializeRoute(original, decision, context, this.vault, (choice, identity, kind) =>
      this.#decisionAllowed(choice, identity, kind),
    )
  }

  #pass(reason: string, host: string | null, _kind: MediaKind): RouteDecision {
    return {
      action: 'pass',
      target: { type: 'request' },
      id: this.#nextId(),
      reason: reason.slice(0, 64),
      routeType: 'root-original',
      host,
      ranking: Object.freeze([]),
    }
  }

  #block(
    reason:
      | 'catalog-disabled'
      | 'default-unavailable'
      | 'black'
      | 'dead'
      | 'circuit-open'
      | 'catalog-unavailable'
      | 'catalog-unreplaceable'
      | 'catalog-only-non-get',
    host: string | null,
  ): RouteDecision {
    return {
      action: 'block',
      id: this.#nextId(),
      reason,
      routeType: 'root-original',
      host,
      ranking: Object.freeze([]),
    }
  }

  #restrictionSnapshot(kind: MediaKind | null): ReturnType<RouteRestrictionsPort['snapshot']> {
    return restrictionSnapshot(this.restrictions, kind)
  }

  #hardRestriction(host: string, kind: MediaKind | null): HardRestriction | null {
    return restrictedHost(
      {
        clock: this.clock,
        settings: this.settings,
        restrictions: this.restrictions,
        evidence: this.evidence,
      },
      host,
      kind,
    )
  }

  #catalogSource(context: RouteIdentity, requested?: string): string | null {
    return catalogSource(this.vault, context, requested)
  }

  #decisionAllowed(
    decision: RouteDecision,
    context: RouteIdentity | null,
    kind: MediaKind | null,
  ): boolean {
    return canUseDecision(this.#policyReader(), decision, context, kind)
  }

  #policyReader(): RoutingPolicyReader {
    return {
      vault: this.vault,
      isCatalogOnly: () => this.isCatalogOnly(),
      hardRestriction: (host, kind) => this.#hardRestriction(host, kind),
      catalogSource: (context, requested) => this.#catalogSource(context, requested),
      incompatible: (url, host) => this.#incompatible(url, host),
      unlockedNative: (representation) => this.#unlockedNative.get(representation) ?? new Set(),
    }
  }

  #currentPlan(representation: RepresentationId): RouteDecision | undefined {
    const current = this.vault.identity(representation),
      prior = this.#planIdentities.get(representation)
    if (prior && prior !== current) {
      this.#plans.delete(representation)
      this.#planIdentities.delete(representation)
      this.#unlockedNative.delete(representation)
      this.#requestedRepresentations.delete(representation)
      if (this.#tentativeRepresentation === representation) {
        this.#tentativeRepresentation = null
        this.#tentativeTransfers = 0
      }
      for (const [kind, fallback] of this.#fallbacks)
        if (fallback.representation === representation) this.#fallbacks.delete(kind)
      for (const key of this.#challengeAttempts.keys())
        if (key.startsWith(`${representation}:`)) this.#challengeAttempts.delete(key)
      const affinity = this.session.get().affinity
      if (affinity?.representation === representation && affinity.type !== 'catalog-generated')
        this.session.setAffinity(null)
    }
    return this.#plans.get(representation)
  }

  #planPlayerFallback(candidate: CatalogCandidate | NativeCandidate): RouteDecision {
    const decision: RouteDecision = {
      action: 'rewrite',
      id: this.#nextId(),
      reason: 'player-fallback',
      routeType: candidate.type,
      host: candidate.host,
      candidate,
      ranking: [],
    }
    this.session.noteDecision(decision.id)
    this.#emit({ type: 'route-planned', at: this.clock.now(), decision })
    return decision
  }

  #saveAppliedPlan(
    decision: RouteDecision,
    context: RouteIdentity | null,
    streamKey: string | null,
    kind: MediaKind,
  ): void {
    this.#remember(decision, context, kind)
    if (context) {
      this.#savePlan(context.representation, decision)
      this.#requestedRepresentations.add(context.representation)
    } else if (streamKey) {
      this.#streamPlans.set(streamKey, decision)
      while (this.#streamPlans.size > 192)
        this.#streamPlans.delete(this.#streamPlans.keys().next().value as string)
    }
  }

  #savePlan(representation: RepresentationId, decision: RouteDecision): void {
    this.#currentPlan(representation)
    const identity = this.vault.identity(representation)
    if (!identity) return
    this.#plans.set(representation, decision)
    this.#planIdentities.set(representation, identity)
  }

  #nextId(): DecisionId {
    return decisionId(`decision-${++this.#serial}`)
  }
  #incompatible(url: string, host: string): boolean {
    const key = mediaIdentity(url)
    return !!key && (this.#startupIncompatible.get(key)?.has(host) ?? false)
  }
  #markIncompatible(url: string, host: string): void {
    const key = mediaIdentity(url)
    if (!key) return
    this.#markIncompatibleKey(key, host)
  }
  #markIncompatibleKey(key: string, host: string): void {
    const hosts = this.#startupIncompatible.get(key) ?? new Set<string>()
    hosts.add(host)
    this.#startupIncompatible.set(key, hosts)
    while (this.#startupIncompatible.size > 256)
      this.#startupIncompatible.delete(this.#startupIncompatible.keys().next().value as string)
  }
  #remember(decision: RouteDecision, context: RouteIdentity | null, kind: MediaKind): void {
    this.#decisions.set(decision.id, {
      decision,
      context,
      kind,
      representation: context?.representation ?? null,
      policyRevision: this.#policyRevision,
    })
    while (this.#decisions.size > 256)
      this.#decisions.delete(this.#decisions.keys().next().value as DecisionId)
  }
  #emit(event: DomainEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
  #measurementId(work: object, kind: 'startup' | 'challenge'): string {
    let id = this.#measurementIds.get(work)
    if (!id) {
      id = this.ids.next(kind)
      this.#measurementIds.set(work, id)
    }
    return id
  }
}
