import type {
  EvidenceSample,
  MediaKind,
  RouteEvidence,
  CircuitControlStamp,
} from '../domain/model.ts'

export interface CircuitControlRead {
  readonly stamp: CircuitControlStamp | null
  readonly level: number
  readonly until: number
  readonly synchronized: boolean
}
export interface EvidenceCommitResult {
  readonly error?: unknown
  readonly status:
    'committed' | 'duplicate' | 'invalid' | 'unconfirmed' | 'stale' | 'no-common-lock'
  readonly evidence: RouteEvidence
  readonly stamp: CircuitControlStamp | null
}

export interface EvidencePort {
  control(host: string, kind: MediaKind): CircuitControlRead
  commit(
    host: string,
    kind: MediaKind,
    sample: EvidenceSample,
    receipt: object,
    valid?: () => boolean,
  ): Promise<EvidenceCommitResult>
  tryDowngrade(
    host: string,
    kind: MediaKind,
    stamp: CircuitControlStamp,
    commitId: string,
    valid: () => boolean,
  ): Promise<EvidenceCommitResult>
  get(host: string, kind: MediaKind): RouteEvidence | null
  list(kind?: MediaKind): readonly RouteEvidence[]
  record(
    host: string,
    kind: MediaKind,
    sample: EvidenceSample,
    valid?: () => boolean,
  ): Promise<RouteEvidence>
  clear(): Promise<void>
  dispose(): void
}
