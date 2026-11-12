import { type TimingBasis } from './measurement-time.ts'
import { type FailureKind } from './evidence-model.ts'
import { type RouteType } from './route-model.ts'
import {
  type GenerationId,
  type EpochId,
  type RepresentationId,
  type DecisionId,
  type RequestId,
  type MediaKind,
} from './model.ts'
import { type PlayurlEndpointKind, type PlayurlTransformResult } from './playurl-model.ts'
export interface ApiEndpointSummary {
  readonly kind: PlayurlEndpointKind
  readonly transport: 'fetch' | 'xhr'
  readonly observedAt: number
}

export interface PlayurlTransportSummary extends PlayurlTransformResult {
  readonly endpointKind: PlayurlEndpointKind
  readonly transport: 'fetch' | 'xhr'
  readonly status: number
  readonly observedAt: number
}

export interface LastMediaRequest {
  readonly requestId: string
  readonly method: string
  readonly kind: 'video' | 'audio' | 'unknown'
  readonly originalHost: string
  readonly targetHost: string
  readonly hookEntered: true
  readonly mediaRecognized: true
  nativeCalled: boolean
  responseObserved: boolean
  status: number | null
}

export interface TransportStats {
  readonly enteredFetch: number
  readonly enteredXhr: number
  readonly mediaRecognized: number
  readonly nativeCalled: number
  readonly responseObserved: number
  readonly blocked: number
  readonly lastMediaRequest: Readonly<LastMediaRequest> | null
  readonly lastBlocked: Readonly<{ method: string; host: string; reason: string }> | null
  readonly lastPlayurl: PlayurlTransportSummary | null
  readonly lastApiEndpoint?: ApiEndpointSummary | null
}
export interface TransportSnapshot extends TransportStats {
  readonly hookState: 'not-installed' | 'installed' | 'failed' | 'degraded'
  readonly hookReason: string
  readonly fetchInstalled: boolean
  readonly xhrInstalled: boolean
  readonly note: string
}

export type AttributionStatus = 'matched' | 'waiting-data' | 'weak' | 'ambiguous' | 'detached'

export type AttributionSource = 'exact' | 'catalog-alias' | 'path-hint' | 'none'

export interface PlayurlOutputSummary {
  readonly originalHost: string
  readonly outputHost: string
  readonly role: 'primary' | 'backup'
  readonly source: 'trusted-api' | 'page-hint'
  readonly decisionId: DecisionId
  readonly hostChanged: boolean
}

export interface RequestContext {
  readonly timingBasis?: TimingBasis
  /** Assigned by the route owner at dispatch preparation; absent before dispatch. */
  readonly expectedBytes?: number | null
  readonly dispatchSequence?: number
  readonly routeRevision?: number
  readonly selectionRevision?: number
  readonly routePolicyRevision: number
  readonly requestId: RequestId
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly decisionId: DecisionId
  readonly representation: RepresentationId | null
  readonly authorityRevision?: number | null
  readonly kind: MediaKind | null
  readonly attributionStatus: AttributionStatus
  readonly attributionSource: AttributionSource
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly sourceHost: string | null
  readonly playurlHostChanged: boolean
  readonly playurlOutput: PlayurlOutputSummary | null
  readonly hostChanged: boolean
  readonly startedAt: number
}

export interface TransportObservation {
  /** XHR native terminal and trusted byte evidence; independent of early-retry eligibility. */
  readonly circuitVerified?: boolean
  readonly timingBasis?: TimingBasis
  readonly speedEligible?: boolean
  readonly retryVerifiedBytes?: number
  readonly request?: RequestContext
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly decisionId: DecisionId | null
  readonly representation: RepresentationId | null
  readonly kind: MediaKind | null
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly finalHost: string | null
  readonly responseUrlMatchesRequest?: boolean
  readonly streamKey: string | null
  readonly status: number
  readonly bytes: number
  readonly ttfbMs: number | null
  readonly elapsedMs: number
  readonly completedAt: number
  readonly outcome: 'success' | 'abort' | 'failure'
  readonly failureKind?: FailureKind
}
