export type CodecPreference = 'av1' | 'hevc' | 'avc' | 'auto'

export interface SettingsState {
  readonly schema: 2
  readonly disabled: boolean
  readonly fixedHost: string | null
  readonly considerNativeSources: boolean
  readonly earlyRetryEnabled: boolean
  readonly startupEarlyReleaseEnabled: boolean
  readonly healthMiddleRangeEnabled: boolean
  readonly backupFamilyDiversityEnabled: boolean
  readonly catalogOverrides: Readonly<Record<string, boolean>>
  readonly codec: CodecPreference
  readonly blockWebRtc: boolean
  readonly blockHttpDns: boolean
  readonly verbose: boolean
  readonly updatedAt: number
}

export type SettingsChange = Partial<Omit<SettingsState, 'schema' | 'updatedAt'>>
