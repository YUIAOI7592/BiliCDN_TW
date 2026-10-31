import { SettingsStore, defaultSettings, SETTINGS_KEY } from '../../src-v2/state/settings-store.ts'
import type { FakeStorage } from './storage.ts'

/** Explicit Catalog-only prerequisite; production default coverage uses SettingsStore directly. */
export class CatalogSettingsStore extends SettingsStore {
  constructor(storage: FakeStorage, now: () => number) {
    const existing = storage.get<Record<string, unknown> | null>(SETTINGS_KEY, null)
    if (!existing || typeof existing.considerNativeSources !== 'boolean')
      storage.values.set(SETTINGS_KEY, {
        ...(existing ?? defaultSettings(now())),
        considerNativeSources: false,
      })
    super(storage, now)
  }
}
