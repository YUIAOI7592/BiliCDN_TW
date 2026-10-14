import type { EvidenceSample, MediaKind, RouteEvidence } from '../domain/model.ts'

export interface EvidencePort {
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
