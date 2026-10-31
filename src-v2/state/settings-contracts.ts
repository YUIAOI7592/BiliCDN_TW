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
  readonly blockWebRtc: boolean
  readonly blockHttpDns: boolean
  readonly updatedAt: number
}

export type SettingsChange = Partial<Omit<SettingsState, 'schema' | 'updatedAt'>>

export interface SettingsReader {
  get(): SettingsState
}

export interface SettingsObserver {
  subscribe(listener: (state: SettingsState) => void): () => void
}

export interface SettingsWriter {
  update(change: SettingsChange): Promise<SettingsState>
  setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState>
  reset(): Promise<SettingsState>
}

export interface SettingsPort extends SettingsReader, SettingsObserver, SettingsWriter {
  dispose(): void
}
