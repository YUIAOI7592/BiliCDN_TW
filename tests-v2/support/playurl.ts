import type { PlayurlTransformResult } from '../../src-v2/domain/playurl-model.ts'

export const playurlResult = (accepted: boolean): PlayurlTransformResult => ({ accepted, formats: [],
  videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: null, reason: accepted ? null : 'unsupported-format' })
