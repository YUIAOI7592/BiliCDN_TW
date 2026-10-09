import { isCatalogHost } from '../domain/catalog.ts'
import type { StoragePort } from '../platform/storage.ts'

export const SETTINGS_KEY = 'bilicdn.v2.settings'
export type CodecPreference = 'av1' | 'hevc' | 'avc' | 'auto'

export interface SettingsState {
  readonly schema: 2
  readonly disabled: boolean
  readonly fixedHost: string | null
  readonly considerNativeSources: boolean
  readonly catalogOverrides: Readonly<Record<string, boolean>>
  readonly codec: CodecPreference
  readonly blockWebRtc: boolean
  readonly blockHttpDns: boolean
  readonly verbose: boolean
  readonly updatedAt: number
}

export const defaultSettings = (now: number): SettingsState => Object.freeze({
  schema: 2,
  disabled: false,
  fixedHost: null,
  considerNativeSources: false,
  catalogOverrides: Object.freeze({}),
  codec: 'av1',
  blockWebRtc: true,
  blockHttpDns: true,
  verbose: false,
  updatedAt: now,
})

const parseSettings = (value: unknown, now: number): SettingsState => {
  if (!value || typeof value !== 'object') return defaultSettings(now)
  const raw = value as Record<string, unknown>
  if (raw.schema !== 2) return defaultSettings(now)
  const overrides: Record<string, boolean> = {}
  if (raw.catalogOverrides && typeof raw.catalogOverrides === 'object') {
    for (const [host, enabled] of Object.entries(raw.catalogOverrides as Record<string, unknown>)) {
      if (isCatalogHost(host) && typeof enabled === 'boolean') overrides[host] = enabled
    }
  }
  const codec: CodecPreference = ['av1', 'hevc', 'avc', 'auto'].includes(String(raw.codec)) ? raw.codec as CodecPreference : 'av1'
  const fixedHost = typeof raw.fixedHost === 'string' && isCatalogHost(raw.fixedHost) ? raw.fixedHost : null
  return Object.freeze({
    schema: 2,
    disabled: raw.disabled === true,
    fixedHost,
    considerNativeSources: raw.considerNativeSources === true,
    catalogOverrides: Object.freeze(overrides),
    codec,
    blockWebRtc: raw.blockWebRtc !== false,
    blockHttpDns: raw.blockHttpDns !== false,
    verbose: raw.verbose === true,
    updatedAt: Number.isFinite(raw.updatedAt) ? Math.min(now + 5 * 60_000, Math.max(0, Number(raw.updatedAt))) : now,
  })
}

export class SettingsStore {
  #state: SettingsState
  #nativeOffPending = 0
  #listeners = new Set<(state: SettingsState) => void>()
  #stopRemote: () => void

  constructor(private readonly storage: StoragePort, private readonly now: () => number) {
    this.#state = parseSettings(storage.get<unknown>(SETTINGS_KEY, null), now())
    this.#stopRemote = storage.listen<unknown>(SETTINGS_KEY, (value, remote) => {
      if (!remote) return
      const next = parseSettings(value, this.now())
      if (next.updatedAt < this.#state.updatedAt) return
      this.#state = next
      this.#emit()
    })
  }

  get(): SettingsState {
    return this.#nativeOffPending && this.#state.considerNativeSources
      ? Object.freeze({ ...this.#state, considerNativeSources: false }) : this.#state
  }

  subscribe(listener: (state: SettingsState) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async update(change: Partial<Omit<SettingsState, 'schema' | 'updatedAt'>>): Promise<SettingsState> {
    const holdNativeOff = change.considerNativeSources === false
    if (holdNativeOff) { this.#nativeOffPending++; this.#emit() }
    try {
      return await this.storage.withLock('settings', () => {
        const current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), this.now())
        const now = this.now()
        const next = parseSettings({ ...current, ...change, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) }, now)
        this.storage.set(SETTINGS_KEY, next)
        this.#state = next
        this.#emit()
        return next
      })
    } finally {
      if (holdNativeOff) { this.#nativeOffPending--; this.#emit() }
    }
  }

  async setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState> {
    if (!isCatalogHost(host)) throw new TypeError('Unknown Catalog host')
    return await this.storage.withLock('settings', () => {
      const now = this.now(), current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), now)
      const next = parseSettings({ ...current, catalogOverrides: { ...current.catalogOverrides, [host]: enabled },
        updatedAt: Math.max(now, current.updatedAt + 1) }, now)
      this.storage.set(SETTINGS_KEY, next)
      this.#state = next; this.#emit()
      return next
    })
  }

  async reset(): Promise<SettingsState> {
    this.#nativeOffPending++; this.#emit()
    try {
      const next = await this.storage.withLock('settings', () => {
        const now = this.now(), current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), now)
        const state = parseSettings({ ...defaultSettings(now),
          updatedAt: Math.max(now, current.updatedAt + 1) }, now)
        this.storage.set(SETTINGS_KEY, state)
        return state
      })
      this.#state = next
      this.#emit()
      return next
    } finally { this.#nativeOffPending--; this.#emit() }
  }

  dispose(): void { this.#stopRemote(); this.#listeners.clear() }
  #emit(): void { const state = this.get(); for (const listener of this.#listeners) listener(state) }
}
