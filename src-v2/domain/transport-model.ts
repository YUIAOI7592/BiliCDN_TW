import type { PlayurlTransformResult } from './playurl-model.ts'

export interface PlayurlTransportSummary extends PlayurlTransformResult {
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
  readonly enteredFetch: number; readonly enteredXhr: number; readonly mediaRecognized: number
  readonly nativeCalled: number; readonly responseObserved: number; readonly blocked: number
  readonly lastMediaRequest: Readonly<LastMediaRequest> | null
  readonly lastBlocked: Readonly<{ method: string; host: string; reason: string }> | null
  readonly lastPlayurl: PlayurlTransportSummary | null
}
export interface TransportSnapshot extends TransportStats {
  readonly hookState: 'not-installed' | 'installed' | 'failed' | 'degraded'
  readonly hookReason: string; readonly fetchInstalled: boolean; readonly xhrInstalled: boolean; readonly note: string
}
