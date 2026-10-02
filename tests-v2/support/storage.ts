import type { StoragePort } from '../../src-v2/platform/storage.ts'
export class FakeStorage implements StoragePort {
  readonly values = new Map<string, unknown>()
  readonly listeners = new Map<string, Set<(value: unknown, remote: boolean) => void>>()
  get<T>(key: string, fallback: T): T { return (this.values.has(key) ? this.values.get(key) : fallback) as T }
  set<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); for (const listener of this.listeners.get(key) ?? []) listener(value, false) }
  delete(key: string): void { this.values.delete(key) }
  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void {
    const rows = this.listeners.get(key) ?? new Set(); rows.add(listener as (value: unknown, remote: boolean) => void); this.listeners.set(key, rows)
    return () => rows.delete(listener as (value: unknown, remote: boolean) => void)
  }
  async withLock<T>(_name: string, task: () => Promise<T> | T): Promise<T> { return await task() }
  remote<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); for (const listener of this.listeners.get(key) ?? []) listener(value, true) }
}

export class DelayedSettingsStorage extends FakeStorage {
  holdNextSettingsLock = false
  releaseSettingsLock: () => void = () => undefined
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name === 'settings' && this.holdNextSettingsLock) {
      this.holdNextSettingsLock = false
      await new Promise<void>(resolve => { this.releaseSettingsLock = resolve })
    }
    return await super.withLock(name, task)
  }
}
