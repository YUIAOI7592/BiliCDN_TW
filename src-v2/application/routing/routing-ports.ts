import type {
  Clock,
  MediaKind,
  RepresentationId,
  RouteDecision,
  RouteIdentity,
} from '../../domain/model.ts'
import type { HardRestriction } from '../../domain/route-policy.ts'
import type {
  RouteEvidencePort,
  RouteRestrictionsPort,
  RouteSettingsPort,
  RouteVaultPort,
} from '../route-ports.ts'

export interface RoutingVaultReader extends Pick<
  RouteVaultPort,
  | 'candidates'
  | 'catalogSourceHandle'
  | 'groupSummary'
  | 'isInvalid'
  | 'match'
  | 'resolve'
  | 'rootUrl'
> {}
export interface RoutingEvidenceReader extends Pick<RouteEvidencePort, 'get'> {}
export interface RoutingRestrictionsReader extends RouteRestrictionsPort {}
export interface RoutingSettingsReader extends RouteSettingsPort {}
export interface RoutingPolicyReader {
  readonly vault: RoutingVaultReader
  isCatalogOnly(): boolean
  hardRestriction(host: string, kind: MediaKind | null): HardRestriction | null
  catalogSource(context: RouteIdentity, requested?: string): string | null
  incompatible(url: string, host: string): boolean
  unlockedNative(representation: RepresentationId): ReadonlySet<string>
}
export interface RoutingEnvironmentReader {
  readonly clock: Clock
  readonly evidence: RoutingEvidenceReader
  readonly restrictions: RoutingRestrictionsReader
  readonly settings: RoutingSettingsReader
}
export type DecisionEligibility = (
  decision: RouteDecision,
  context: RouteIdentity | null,
  kind: MediaKind | null,
) => boolean
