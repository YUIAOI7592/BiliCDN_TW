import type { GenerationId, EpochId } from '../domain/model.ts'
import type { RouteCoordinatorPort } from './route-ports.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SignedRouteVaultPort } from '../state/vault-ports.ts'
import type { PlayurlRequestContext } from '../domain/playurl-model.ts'
import type { PlayurlInput, PlayurlOutput } from './playurl-model.ts'

export interface PlayurlSessionPort extends Pick<SessionPort, 'beginEpoch' | 'get'> {}
export interface PlayurlVaultPort extends Pick<
  SignedRouteVaultPort,
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
  | 'resetEpoch'
> {}
export interface PlayurlControllerPort {
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
