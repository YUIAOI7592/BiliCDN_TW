export type PlayurlFormat = 'dash' | 'mp4' | 'flv'
/** Request-owned content correlation only; never a route authorization. */
export interface PlayurlRequestContext { readonly contentId: string | null }
export type PlayurlRejection = 'upstream-error' | 'unsupported-format' | 'malformed-payload'
  | 'unreplaceable-source' | 'no-legal-route' | 'inactive'
export interface PlayurlTransformResult {
  readonly accepted: boolean
  readonly formats: readonly PlayurlFormat[]
  readonly videoCount: number
  readonly audioCount: number
  readonly segmentCount: number
  readonly upstreamCode: number | null
  readonly reason: PlayurlRejection | null
}
