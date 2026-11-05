import type { StoragePort, StorageLock, StorageRead } from './storage-port.ts'
export class TampermonkeyStorage implements StoragePort {
  readResult<T>(key: string, fallback: T): StorageRead<T> {
    try {
      return { ok: true, value: GM_getValue<T>(key, fallback) }
    } catch {
      return { ok: false }
    }
  }
  sharedLockAvailable(): boolean {
    try {
      return typeof navigator.locks?.request === 'function'
    } catch {
      return false
    }
  }
  get<T>(key: string, fallback: T): T {
    try {
      return GM_getValue<T>(key, fallback)
    } catch {
      return fallback
    }
  }

  set<T>(key: string, value: T): void {
    GM_setValue(key, value)
  }

  delete(key: string): void {
    try {
      GM_deleteValue(key)
    } catch {
      /* fail-open */
    }
  }

  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void {
    if (typeof GM_addValueChangeListener !== 'function') return () => undefined
    let id: number
    try {
      id = GM_addValueChangeListener<T>(key, (_name, _oldValue, value, remote) =>
        listener(value, remote),
      )
    } catch {
      return () => undefined
    }
    return () => {
      try {
        GM_removeValueChangeListener(id)
      } catch {
        /* fail-open */
      }
    }
  }

  async withLock<T>(name: string, task: (lock?: StorageLock) => Promise<T> | T): Promise<T> {
    const manager = navigator.locks
    if (!manager?.request) return await task({ exclusive: false })
    return await manager.request(`bilicdn.v2.${name}`, async () => await task({ exclusive: true }))
  }
}
