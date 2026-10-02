import type { LastMediaRequest, TransportStats, TransportSnapshot } from '../domain/transport-model.ts'
export type { TransportSnapshot } from '../domain/transport-model.ts'
import type { PlayurlPort } from '../application/ports.ts'
import type { SettingsState } from '../state/settings-store.ts'
import { isCatalogHost } from '../domain/catalog.ts'
import { requestId, type FailureKind, type RequestContext, type RouteType, type TransportObservation, type GenerationId } from '../domain/model.ts'
import type { RouteCoordinator, AppliedRouteDecision } from '../application/route-coordinator.ts'
import type { MeasurementController } from '../application/measurement-controller.ts'
import type { SessionStore } from '../state/session-store.ts'


export type TransportRoutes = Pick<RouteCoordinator, 'isCatalogOnly' | 'recognizesMedia' | 'isBilibiliMedia' | 'apply' | 'inspectOriginal' | 'requestStarted' | 'observe'>
export interface TransportSettings { get(): Pick<SettingsState, 'disabled' | 'blockHttpDns'> }
export type StartupGate = Pick<MeasurementController, 'willGateStartup' | 'prepareStartup' | 'noteUnpreflighted'>
export interface HookInstallation { restore(): void; isInstalled(): boolean }
export interface DispatchCheck {
  readonly generation: GenerationId
  readonly applied: AppliedRouteDecision | null
  readonly targetUrl: string
  readonly managedMedia: boolean
}
export const hostOf = (value: string): string => { try { return new URL(value, location.href).hostname.toLowerCase() } catch { return '' } }
export const sameUrl = (responseUrl: string, requestUrl: string): boolean => {
  try { return !!responseUrl && new URL(responseUrl, location.href).href === new URL(requestUrl, location.href).href } catch { return false }
}
export const catalogTarget = (applied: AppliedRouteDecision | null): boolean => !!applied?.url
  && applied.decision.action === 'rewrite' && applied.decision.routeType === 'catalog-generated'
  && isCatalogHost(applied.decision.host) && hostOf(applied.url) === applied.decision.host
export const blockedPlayurl = (): { code: number; message: string } => ({ code: -1, message: 'BiliCDN Catalog route unavailable' })
export const blockedPlayurlText = (): string => JSON.stringify(blockedPlayurl())

export const copyResponseSurface = (target: Response, source: Response): Response => {
  for (const key of ['url', 'redirected', 'type'] as const) {
    try { Object.defineProperty(target, key, { configurable: true, enumerable: true, value: source[key] }) } catch { /* browser-owned */ }
  }
  return target
}


export class TransportContext {
  #requestSerial = 0
  #stats = { enteredFetch: 0, enteredXhr: 0, mediaRecognized: 0, nativeCalled: 0, responseObserved: 0, blocked: 0 }
  #lastMedia: LastMediaRequest | null = null
  #lastBlocked: TransportStats['lastBlocked'] = null
  constructor(readonly session: Pick<SessionStore, 'get' | 'isGeneration'>, readonly settings: TransportSettings,
    readonly routes: TransportRoutes, readonly playurl: PlayurlPort, readonly measurement: StartupGate, readonly now: () => number) {}
  count(stage: 'enteredFetch' | 'enteredXhr' | 'mediaRecognized' | 'nativeCalled' | 'responseObserved' | 'blocked'): void { this.#stats[stage]++ }
  dispatchFailure(input: DispatchCheck): string | null {
    const strict = input.managedMedia && this.routes.isCatalogOnly()
    if (strict && !this.session.isGeneration(input.generation)) return 'catalog-unavailable'
    const applied = input.applied
    if (applied?.decision.action === 'block') return applied.decision.reason
    if (applied && !applied.url) return 'catalog-unavailable'
    if (strict && (!catalogTarget(applied) || !sameUrl(applied?.url ?? '', input.targetUrl))) return 'catalog-unavailable'
    return null
  }
  blocked(method: string, url: string, reason: string): void {
    this.#stats.blocked++; this.#lastBlocked = Object.freeze({ method, host: hostOf(url), reason })
  }
  nextResponseKey(prefix: string): string { return `${prefix}-${++this.#requestSerial}` }
  snapshot(): TransportStats { return Object.freeze({ ...this.#stats,
    lastMediaRequest: this.#lastMedia ? Object.freeze({ ...this.#lastMedia }) : null, lastBlocked: this.#lastBlocked }) }
  request(applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, startedAt: number, method: string): RequestContext {
    const state = this.session.get(), matched = applied.attributionStatus ?? (applied.context ? 'matched' : 'waiting-data')
    const request: RequestContext = Object.freeze({ requestId: requestId(`request-${++this.#requestSerial}`), generation: state.generation, epoch: state.epoch,
      decisionId: applied.decision.id, representation: applied.context?.representation ?? null,
      authorityRevision: applied.context?.authorityRevision ?? null, kind: applied.context?.kind ?? null,
      attributionStatus: matched, attributionSource: applied.attributionSource ?? (applied.context ? 'exact' : 'none'),
      decisionStage: 'request', routeType: applied.decision.routeType, originalHost: hostOf(originalUrl), targetHost: hostOf(targetUrl),
      sourceHost: applied.sourceHost, playurlHostChanged: applied.playurlHostChanged ?? false,
      playurlOutput: applied.playurlOutput ?? null,
      urlChanged: originalUrl !== targetUrl, hostChanged: hostOf(originalUrl) !== hostOf(targetUrl), startedAt })
    this.#lastMedia = { requestId: request.requestId, method, kind: request.kind ?? 'unknown', originalHost: request.originalHost,
      targetHost: request.targetHost, hookEntered: true, mediaRecognized: true, nativeCalled: false, responseObserved: false, status: null }
    return request
  }

  noteNativeCall(request: RequestContext | null): void {
    if (request && this.#lastMedia?.requestId === request.requestId) this.#lastMedia.nativeCalled = true
  }

  noteResponse(request: RequestContext | null, status: number): void {
    if (request && this.#lastMedia?.requestId === request.requestId) {
      this.#lastMedia.responseObserved = true; this.#lastMedia.status = status
    }
  }

  async observeFetch(request: RequestContext, applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, response: Response | null,
    startedAt: number, responseAt: number, bytes: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind): Promise<void> {
    const finalUrl = response?.url || ''
    await this.routes.observe(this.observation(request, applied, originalUrl, targetUrl, finalUrl, response?.status ?? 0,
      bytes, startedAt, responseAt, outcome, failureKind, !!response && !response.redirected && sameUrl(finalUrl, targetUrl)))
  }

  observation(request: RequestContext, applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, finalUrl: string, status: number,
    bytes: number, startedAt: number, responseAt: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind,
    responseUrlMatchesRequest = false): TransportObservation {
    const completedAt = this.now(), kind = request.kind
    const routeType: RouteType = applied.decision.routeType
    return {
      request, generation: request.generation, epoch: request.epoch, decisionId: request.decisionId,
      representation: request.representation, kind, routeType,
      originalHost: request.originalHost, targetHost: request.targetHost, finalHost: finalUrl ? hostOf(finalUrl) || null : null,
      responseUrlMatchesRequest,
      streamKey: applied.streamKey,
      status, bytes, ttfbMs: responseAt > 0 ? responseAt - startedAt : null,
      elapsedMs: Math.max(1, completedAt - startedAt), completedAt, outcome,
      ...(failureKind ? { failureKind } : {}),
    }
  }
}
