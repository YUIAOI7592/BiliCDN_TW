import {
  type EvidenceSample,
  type RouteEvidence,
  type CircuitControlStamp,
} from '../domain/evidence-model.ts'
import { type MediaKind } from '../domain/model.ts'
export interface CircuitControlRead {
  readonly stamp: CircuitControlStamp | null
  readonly level: number
  readonly until: number
  readonly synchronized: boolean
}
export interface CurrentCircuitControlReader {
  readCurrentControl(host: string, kind: MediaKind): CircuitControlRead | null
}
interface EvidenceResult<Status extends string> {
  readonly error?: unknown
  readonly status: Status
  readonly evidence: RouteEvidence
  readonly stamp: CircuitControlStamp | null
}
export type EvidenceWriteResult = EvidenceResult<
  'committed' | 'duplicate' | 'invalid' | 'unconfirmed'
>
export type CircuitDowngradeResult = EvidenceResult<
  EvidenceWriteResult['status'] | 'stale' | 'no-common-lock'
>

export interface EvidencePort {
  control(host: string, kind: MediaKind): CircuitControlRead
  commit(
    host: string,
    kind: MediaKind,
    sample: EvidenceSample,
    receipt: object,
    valid?: () => boolean,
  ): Promise<EvidenceWriteResult>
  tryDowngrade(
    host: string,
    kind: MediaKind,
    stamp: CircuitControlStamp,
    commitId: string,
    valid: () => boolean,
  ): Promise<CircuitDowngradeResult>
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
