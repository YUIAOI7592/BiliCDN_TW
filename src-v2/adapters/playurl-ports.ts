import type { PlayurlControllerPort } from '../application/playurl-ports.ts'

export interface PlayurlIngestionPort extends Pick<
  PlayurlControllerPort,
  'lifecycleKey' | 'catalogOnly' | 'codecPreference' | 'ingest' | 'active'
> {}
