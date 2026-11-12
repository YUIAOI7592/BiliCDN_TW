import { playurlRequestContext } from '../../domain/playurl-content.ts'
import {
  type PlayurlRequestContext,
  type PlayurlEndpointKind,
  type PlayurlRejection,
  type PlayurlTransformResult,
} from '../../domain/playurl-model.ts'
import {
  type LastMediaRequest,
  type TransportStats,
  type PlayurlTransportSummary,
  type ApiEndpointSummary,
  type RequestContext,
  type TransportObservation,
} from '../../domain/transport-model.ts'
import { type PlayurlPort } from '../../application/playurl/playurl-contracts.ts'
import { isCatalogHost } from '../../domain/catalog.ts'
import { requestId, type GenerationId } from '../../domain/model.ts'
import { type FailureKind } from '../../domain/evidence-model.ts'
import { type RouteType } from '../../domain/route-model.ts'
import {
  type FrozenMeasurement,
  type TimingBasis,
  measuredPayload,
  measuredTiming,
  readMonotonic,
} from '../../domain/measurement-time.ts'
import { type RuntimeIdPort } from '../../platform/runtime-id-port.ts'
import { type AppliedRouteDecision } from '../../application/routing/route-contracts.ts'
import {
  type TransportRoutes,
  type TransportSettings,
  type StartupGate,
  type TransportSessionPort,
} from './transport-ports.ts'
export interface DispatchCheck {
  readonly generation: GenerationId
  readonly applied: AppliedRouteDecision | null
  readonly targetUrl: string
  readonly managedMedia: boolean
}
export const hostOf = (value: string): string => {
  try {
    return new URL(value, location.href).hostname.toLowerCase()
  } catch {
    return ''
  }
}
export const sameUrl = (responseUrl: string, requestUrl: string): boolean => {
  try {
    return (
      !!responseUrl &&
      new URL(responseUrl, location.href).href === new URL(requestUrl, location.href).href
    )
  } catch {
    return false
  }
}
export const catalogTarget = (applied: AppliedRouteDecision | null): boolean =>
  !!applied?.url &&
  applied.decision.action === 'rewrite' &&
  applied.decision.routeType === 'catalog-generated' &&
  isCatalogHost(applied.decision.host) &&
  hostOf(applied.url) === applied.decision.host
export function responseFailure(
  routeType: RouteType | undefined,
  status: number,
): FailureKind | undefined {
  return routeType === 'native-signed' && [403, 451, 959].includes(status)
    ? 'native-invalid'
    : status >= 500
      ? 'http-5xx'
      : undefined
}

export const blockedPlayurl = (): { code: number; message: string } => ({
  code: -1,
  message: 'BiliCDN Catalog route unavailable',
})
export const blockedPlayurlText = (): string => JSON.stringify(blockedPlayurl())
export const rejectedPlayurl = (reason: PlayurlRejection): PlayurlTransformResult => ({
  accepted: false,
  formats: [],
  videoCount: 0,
  audioCount: 0,
  segmentCount: 0,
  upstreamCode: null,
  reason,
})

export const copyResponseSurface = (target: Response, source: Response): Response => {
  for (const key of ['url', 'redirected', 'type'] as const) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value: source[key],
      })
    } catch {
      /* browser-owned */
    }
  }
  return target
}

export class TransportContext {
  #requestSerial = 0
  #apiDispatchSerial = 0
  #stats = {
    enteredFetch: 0,
    enteredXhr: 0,
    mediaRecognized: 0,
    nativeCalled: 0,
    responseObserved: 0,
    blocked: 0,
  }
  #lastMedia: LastMediaRequest | null = null
  #lastBlocked: TransportStats['lastBlocked'] = null
  #lastPlayurl: PlayurlTransportSummary | null = null
  #lastApiEndpoint: ApiEndpointSummary | null = null
  constructor(
    readonly session: TransportSessionPort,
    readonly settings: TransportSettings,
    readonly routes: TransportRoutes,
    readonly playurl: PlayurlPort,
    readonly measurement: StartupGate,
    readonly now: () => number,
    private readonly ids: RuntimeIdPort,
    private readonly monotonicNow: () => number | null = () => null,
  ) {}
  tick(): number | null {
    return readMonotonic(this.monotonicNow)
  }
  freezeMeasurement(
    start: number | null,
    response: number | null,
    basis: TimingBasis,
  ): FrozenMeasurement {
    const end = this.tick(),
      completedAt = this.now()
    return Object.freeze({
      ...measuredTiming(start, response, end),
      completedAt,
      timingBasis: basis,
    })
  }
  count(
    stage:
      | 'enteredFetch'
      | 'enteredXhr'
      | 'mediaRecognized'
      | 'nativeCalled'
      | 'responseObserved'
      | 'blocked',
  ): void {
    this.#stats[stage]++
  }
  dispatchFailure(input: DispatchCheck): string | null {
    const strict = input.managedMedia && this.routes.isCatalogOnly()
    if (strict && !this.session.isGeneration(input.generation)) return 'catalog-unavailable'
    const applied = input.applied
    if (applied?.decision.action === 'block') return applied.decision.reason
    if (applied && !applied.url) return 'catalog-unavailable'
    if (strict && (!catalogTarget(applied) || !sameUrl(applied?.url ?? '', input.targetUrl)))
      return 'catalog-unavailable'
    return null
  }
  blocked(method: string, url: string, reason: string): void {
    this.#stats.blocked++
    this.#lastBlocked = Object.freeze({ method, host: hostOf(url), reason })
  }
  apiDispatch(url: string, captured?: PlayurlRequestContext): PlayurlRequestContext {
    return Object.freeze({
      ...(captured ?? playurlRequestContext(url)),
      generation: Number(this.session.get().generation),
      requestSequence: ++this.#apiDispatchSerial,
    })
  }
  nextResponseKey(prefix: string): string {
    return `${prefix}-${++this.#requestSerial}`
  }
  noteApiEndpoint(transport: 'fetch' | 'xhr', kind: PlayurlEndpointKind): void {
    if (!['playurl', 'ogv-playview', 'ogv-precheck'].includes(kind)) return
    this.#lastApiEndpoint = Object.freeze({ kind, transport, observedAt: this.now() })
  }
  notePlayurl(
    transport: 'fetch' | 'xhr',
    status: number,
    result: PlayurlTransformResult,
    endpointKind: PlayurlEndpointKind = 'playurl',
  ): void {
    const count = (value: number): number =>
      Number.isFinite(value) ? Math.max(0, Math.min(65_535, Math.trunc(value))) : 0
    const reasons: readonly PlayurlRejection[] = [
      'upstream-error',
      'unsupported-format',
      'malformed-payload',
      'unreplaceable-source',
      'no-legal-route',
      'inactive',
    ]
    // Project the fixed summary fields; payloads, errors and URL-bearing result extras never enter this state.
    this.#lastPlayurl = Object.freeze({
      endpointKind: ['playurl', 'ogv-playview', 'ogv-precheck'].includes(endpointKind)
        ? endpointKind
        : 'playurl',
      transport,
      status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0,
      observedAt: this.now(),
      accepted: result.accepted === true,
      formats: Object.freeze(
        [
          ...new Set(result.formats.filter((format) => ['dash', 'mp4', 'flv'].includes(format))),
        ].slice(0, 3),
      ),
      videoCount: count(result.videoCount),
      audioCount: count(result.audioCount),
      segmentCount: count(result.segmentCount),
      upstreamCode: Number.isSafeInteger(result.upstreamCode) ? result.upstreamCode : null,
      reason: result.reason !== null && reasons.includes(result.reason) ? result.reason : null,
    })
  }
  snapshot(): TransportStats {
    return Object.freeze({
      ...this.#stats,
      lastMediaRequest: this.#lastMedia ? Object.freeze({ ...this.#lastMedia }) : null,
      lastBlocked: this.#lastBlocked,
      lastPlayurl: this.#lastPlayurl,
      lastApiEndpoint: this.#lastApiEndpoint,
    })
  }
  request(
    applied: AppliedRouteDecision,
    originalUrl: string,
    targetUrl: string,
    startedAt: number,
    method: string,
    expectedBytes: number | null = null,
    timingBasis?: TimingBasis,
  ): RequestContext {
    const state = this.session.get(),
      matched = applied.attributionStatus ?? (applied.context ? 'matched' : 'waiting-data')
    const request: RequestContext = this.routes.prepareRequest(
      Object.freeze({
        requestId: requestId(this.ids.next('request')),
        generation: state.generation,
        epoch: state.epoch,
        routePolicyRevision: this.routes.policyRevision(),
        decisionId: applied.decision.id,
        representation: applied.context?.representation ?? null,
        authorityRevision: applied.context?.authorityRevision ?? null,
        kind: applied.context?.kind ?? null,
        attributionStatus: matched,
        attributionSource: applied.attributionSource ?? (applied.context ? 'exact' : 'none'),
        decisionStage: 'request',
        routeType: applied.decision.routeType,
        originalHost: hostOf(originalUrl),
        targetHost: hostOf(targetUrl),
        sourceHost: applied.sourceHost,
        playurlHostChanged: applied.playurlHostChanged ?? false,
        playurlOutput: applied.playurlOutput ?? null,
        urlChanged: originalUrl !== targetUrl,
        hostChanged: hostOf(originalUrl) !== hostOf(targetUrl),
        startedAt,
        expectedBytes:
          Number.isSafeInteger(expectedBytes) && (expectedBytes ?? 0) > 0 ? expectedBytes : null,
        ...(timingBasis ? { timingBasis } : {}),
      }),
    )
    this.#lastMedia = {
      requestId: request.requestId,
      method,
      kind: request.kind ?? 'unknown',
      originalHost: request.originalHost,
      targetHost: request.targetHost,
      hookEntered: true,
      mediaRecognized: true,
      nativeCalled: false,
      responseObserved: false,
      status: null,
    }
    return request
  }

  noteNativeCall(request: RequestContext | null): void {
    if (request && this.#lastMedia?.requestId === request.requestId)
      this.#lastMedia.nativeCalled = true
  }

  noteResponse(request: RequestContext | null, status: number): void {
    if (request && this.#lastMedia?.requestId === request.requestId) {
      this.#lastMedia.responseObserved = true
      this.#lastMedia.status = status
    }
  }

  async observeFetch(
    request: RequestContext,
    applied: AppliedRouteDecision,
    targetUrl: string,
    response: Response | null,
    startedAt: number,
    responseAt: number,
    bytes: number,
    outcome: 'success' | 'abort' | 'failure',
    failureKind?: FailureKind,
    measurement?: FrozenMeasurement,
  ): Promise<void> {
    const finalUrl = response?.url || ''
    if (measurement && response) {
      let valid = false
      try {
        valid = measuredPayload(
          bytes,
          response.headers.get('Content-Length'),
          response.headers.get('Content-Range'),
        )
      } catch {
        /* no comparable size proof */
      }
      measurement = { ...measurement, speedEligible: measurement.speedEligible && valid }
    }
    await this.routes.observe(
      this.observation(
        request,
        applied,
        finalUrl,
        response?.status ?? 0,
        bytes,
        startedAt,
        responseAt,
        outcome,
        failureKind,
        !!response && !response.redirected && sameUrl(finalUrl, targetUrl),
        measurement,
      ),
    )
  }

  observation(
    request: RequestContext,
    applied: AppliedRouteDecision,
    finalUrl: string,
    status: number,
    bytes: number,
    startedAt: number,
    responseAt: number,
    outcome: 'success' | 'abort' | 'failure',
    failureKind?: FailureKind,
    responseUrlMatchesRequest = false,
    measurement?: FrozenMeasurement,
  ): TransportObservation {
    const completedAt = measurement?.completedAt ?? this.now(),
      kind = request.kind
    const routeType: RouteType = applied.decision.routeType
    return {
      request,
      generation: request.generation,
      epoch: request.epoch,
      decisionId: request.decisionId,
      representation: request.representation,
      kind,
      routeType,
      originalHost: request.originalHost,
      targetHost: request.targetHost,
      finalHost: finalUrl ? hostOf(finalUrl) || null : null,
      responseUrlMatchesRequest,
      streamKey: applied.streamKey,
      status,
      bytes,
      ttfbMs: measurement ? measurement.ttfbMs : responseAt > 0 ? responseAt - startedAt : null,
      elapsedMs: measurement ? measurement.elapsedMs : Math.max(0, completedAt - startedAt),
      ...(measurement
        ? { timingBasis: measurement.timingBasis, speedEligible: measurement.speedEligible }
        : {}),
      completedAt,
      outcome,
      ...(failureKind ? { failureKind } : {}),
    }
  }
}
