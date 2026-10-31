import { isCatalogHost } from '../domain/catalog.ts'
import type { StoragePort } from '../platform/storage-port.ts'
import type { SettingsChange, SettingsState } from './settings-contracts.ts'
import type { SettingsPort } from './settings-contracts.ts'
export const SETTINGS_KEY = 'bilicdn.v2.settings'

const BOOLEAN_DEFAULTS = Object.freeze({
  disabled: false,
  considerNativeSources: true,
  earlyRetryEnabled: true,
  startupEarlyReleaseEnabled: true,
  healthMiddleRangeEnabled: true,
  backupFamilyDiversityEnabled: true,
  blockWebRtc: true,
  blockHttpDns: true,
})
type BooleanSetting = keyof typeof BOOLEAN_DEFAULTS
const booleanSettings = (raw: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(BOOLEAN_DEFAULTS).map(([key, fallback]) => {
      const value = raw[key]
      return [key, typeof value === 'boolean' ? value : fallback]
    }),
  ) as Record<BooleanSetting, boolean>

const SUPPRESSED_SETTINGS = [
  'startupEarlyReleaseEnabled',
  'healthMiddleRangeEnabled',
  'backupFamilyDiversityEnabled',
  'earlyRetryEnabled',
  'considerNativeSources',
] as const
type SuppressedSetting = (typeof SUPPRESSED_SETTINGS)[number]

export const defaultSettings = (now: number): SettingsState =>
  Object.freeze({
    schema: 2,
    ...BOOLEAN_DEFAULTS,
    fixedHost: null,
    catalogOverrides: Object.freeze({}),
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
  const fixedHost =
    typeof raw.fixedHost === 'string' && isCatalogHost(raw.fixedHost) ? raw.fixedHost : null
  return Object.freeze({
    schema: 2,
    ...booleanSettings(raw),
    fixedHost,
    catalogOverrides: Object.freeze(overrides),
    updatedAt: Number.isFinite(raw.updatedAt)
      ? Math.min(now + 5 * 60_000, Math.max(0, Number(raw.updatedAt)))
      : now,
  })
}

export class SettingsStore implements SettingsPort {
  #pendingOff: Record<SuppressedSetting, number> = {
    startupEarlyReleaseEnabled: 0,
    healthMiddleRangeEnabled: 0,
    backupFamilyDiversityEnabled: 0,
    earlyRetryEnabled: 0,
    considerNativeSources: 0,
  }
  #state: SettingsState
  #listeners = new Set<(state: SettingsState) => void>()
  #stopRemote: () => void

  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
  ) {
    this.#state = parseSettings(storage.get<unknown>(SETTINGS_KEY, null), now())
    this.#stopRemote = storage.listen<unknown>(SETTINGS_KEY, (value, remote) => {
      if (!remote) return
      const next = parseSettings(value, this.now())
      if (next.updatedAt < this.#state.updatedAt) return
      this.#publish(next)
    })
  }

  get(): SettingsState {
    if (!SUPPRESSED_SETTINGS.some((key) => this.#pendingOff[key] > 0)) return this.#state
    const suppressed = SUPPRESSED_SETTINGS.filter((key) => this.#pendingOff[key] > 0)
    return Object.freeze({
      ...this.#state,
      ...Object.fromEntries(suppressed.map((key) => [key, false])),
    })
  }

  #holdOff(keys: readonly SuppressedSetting[]): () => void {
    for (const key of keys) this.#pendingOff[key]++
    if (keys.length) this.#emit()
    return () => {
      for (const key of keys) this.#pendingOff[key]--
      if (keys.length) this.#emit()
    }
  }

  #save(value: SettingsState, current: SettingsState, now: number): SettingsState {
    const next = parseSettings(
      { ...value, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) },
      now,
    )
    this.storage.set(SETTINGS_KEY, next)
    return next
  }

  #publish(next: SettingsState): SettingsState {
    this.#state = next
    this.#emit()
    return next
  }

  subscribe(listener: (state: SettingsState) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async update(change: SettingsChange): Promise<SettingsState> {
    // Preserve the three historical notification groups and their order.
    const releaseAutomation = this.#holdOff(
      SUPPRESSED_SETTINGS.slice(0, 3).filter((key) => change[key] === false),
    )
    const releaseEarlyRetry = this.#holdOff(
      change.earlyRetryEnabled === false ? ['earlyRetryEnabled'] : [],
    )
    const releaseNative = this.#holdOff(
      change.considerNativeSources === false ? ['considerNativeSources'] : [],
    )
    try {
      return await this.storage.withLock('settings', () => {
        const current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), this.now())
        const now = this.now()
        return this.#publish(this.#save({ ...current, ...change }, current, now))
      })
    } finally {
      releaseAutomation()
      releaseEarlyRetry()
      releaseNative()
    }
  }

  async setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState> {
    if (!isCatalogHost(host)) throw new TypeError('Unknown Catalog host')
    return await this.storage.withLock('settings', () => {
      const now = this.now(),
        current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), now)
      return this.#publish(
        this.#save(
          { ...current, catalogOverrides: { ...current.catalogOverrides, [host]: enabled } },
          current,
          now,
        ),
      )
    })
  }

  async reset(): Promise<SettingsState> {
    const release = this.#holdOff(['considerNativeSources', 'earlyRetryEnabled'])
    try {
      const next = await this.storage.withLock('settings', () => {
        const now = this.now(),
          current = parseSettings(this.storage.get<unknown>(SETTINGS_KEY, null), now)
        return this.#save(defaultSettings(now), current, now)
      })
      // Reset publishes after lock completion, unlike the update commands.
      return this.#publish(next)
    } finally {
      release()
    }
  }

  dispose(): void {
    this.#stopRemote()
    this.#listeners.clear()
  }
  #emit(): void {
    const state = this.get()
    for (const listener of this.#listeners) listener(state)
  }
}
