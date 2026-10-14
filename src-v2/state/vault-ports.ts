import type {
  DecisionId,
  EpochId,
  GenerationId,
  RepresentationId,
  RouteIdentity,
  SignedRouteHandle,
} from '../domain/model.ts'
import type {
  OutputRole,
  RegisterRepresentationInput,
  VaultCandidates,
  VaultGroupSnapshot,
  VaultMatch,
} from './vault-model.ts'

export interface SignedRouteVaultPort {
  reset(generation: GenerationId, epoch: EpochId): void
  register(input: RegisterRepresentationInput): RepresentationId | null
  source(representation: RepresentationId): RegisterRepresentationInput['source'] | null
  isCurrentIdentity(identity: RouteIdentity): boolean
  contextForUrl(url: string): RouteIdentity | null
  match(url: string): VaultMatch
  registerAlias(rep: RepresentationId, url: string): void
  registerOutput(
    rep: RepresentationId,
    original: string,
    primary: string,
    backups: readonly string[],
    decisionId: DecisionId,
    source: 'trusted-api' | 'page-hint',
    catalogGenerated?: boolean,
  ): void
  outputRole(rep: RepresentationId, url: string): Omit<OutputRole, 'representation'> | null
  wasPlayerOutput(url: string): boolean
  candidates(representation: RepresentationId, unlockedHosts: ReadonlySet<string>): VaultCandidates
  identity(representation: RepresentationId): RouteIdentity | null
  hosts(representation: RepresentationId): readonly string[]
  invalidate(representation: RepresentationId, host: string): void
  isInvalid(representation: RepresentationId, host: string): boolean
  rootUrl(representation: RepresentationId): string | null
  catalogSourceHandle(representation: RepresentationId): SignedRouteHandle | null
  sourceURLs(representation: RepresentationId): readonly string[]
  resolve(handle: SignedRouteHandle, identity: RouteIdentity): string | null
  groupSummary(representation: RepresentationId): VaultGroupSnapshot | null
}
