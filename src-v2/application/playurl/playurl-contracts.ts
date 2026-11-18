import {
  type PlayurlTransformResult,
  type PlayurlRequestContext,
} from '../../domain/playurl-model.ts'
import { type GenerationId, type EpochId } from '../../domain/model.ts'
import { type RouteCoordinatorPort } from '../routing/route-contracts.ts'
import { type SessionPort } from '../../state/session-contracts.ts'
import { type SignedRouteVaultPort } from '../../state/vault-contracts.ts'
export interface PlayurlItem {
  readonly frameRate?: number
  readonly token: object
  readonly key: string
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly primary: string
  readonly urls: readonly string[]
  readonly progressive?: boolean
}
export interface PlayurlInput {
  readonly token: object
  readonly video: readonly PlayurlItem[]
  readonly audio: readonly PlayurlItem[]
}
export interface PlayurlOutput {
  readonly token: object
  readonly primary: string
  readonly backups: readonly string[]
}

export interface PlayurlSessionPort extends Pick<SessionPort, 'beginEpoch' | 'get'> {}
export interface PlayurlVaultPort extends Pick<
  SignedRouteVaultPort,
  | 'registeredRepresentation'
  | 'groupSummary'
  | 'identity'
  | 'isCurrentIdentity'
  | 'register'
  | 'reset'
  | 'rootUrl'
  | 'source'
  | 'sourceURLs'
> {}
export interface PlayurlRoutesPort extends Pick<
  RouteCoordinatorPort,
  | 'apply'
  | 'isBilibiliMedia'
  | 'isCatalogOnly'
  | 'opaqueOutput'
  | 'plan'
  | 'playbackRate'
  | 'playerOutput'
  | 'policyRevision'
  | 'previewCatalogOutput'
  | 'resetEpoch'
> {}
export interface PlayurlControllerPort {
  acceptResponse(context?: PlayurlRequestContext): void
  claimNavigation?(previous: string, next: string, now: number): boolean
  catalogOnly(): boolean
  subscribeEpoch(
    listener: (state: { readonly generation: GenerationId; readonly epoch: EpochId }) => void,
  ): () => void
  active(): boolean
  lifecycleKey(): string
  ingest(
    payload: PlayurlInput | null,
    source?: 'trusted-api' | 'player-mpd' | 'page-hint',
    responseKey?: string,
    context?: PlayurlRequestContext,
  ): readonly PlayurlOutput[] | null
}

export interface PlayurlPort {
  claimNavigation?(previous: string, next: string, now: number): boolean
  transform(
    payload: unknown,
    source: 'trusted-api' | 'player-mpd' | 'page-hint',
    responseKey?: string,
    context?: PlayurlRequestContext,
  ): PlayurlTransformResult
}

export interface LifecyclePlayurlPort extends PlayurlPort {
  lifecycleKey(): string
}

export interface PagePlayinfoPort {
  install(): void
  dispose(): void
}
