import type { SettingsChange, SettingsState } from './settings-model.ts'

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
